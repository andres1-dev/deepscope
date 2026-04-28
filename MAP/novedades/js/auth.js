/**
 * auth.js - Sistema de Autenticación Unificado (Native Supabase)
 * NO guarda datos sensibles en LocalStorage.
 * Intercepta llamadas legadas para mantener compatibilidad sin persistencia.
 */

const IS_LOGIN_PAGE = window.location.pathname.toLowerCase().includes('login.html');
const B_KEY = 'busint_biometric_ids';

// 1. Objeto de Usuario en Memoria (Fuente de Verdad)
window.currentUser = null;

// 2. Interceptor de Compatibilidad (Evita que scripts viejos crasheen)
// Esto permite que el sistema funcione SIN guardar nada en LocalStorage
(function _compatLayer() {
    const _oldGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
        if (key === 'busint_user') {
            return window.currentUser ? JSON.stringify(window.currentUser) : _oldGetItem.call(this, key);
        }
        return _oldGetItem.call(this, key);
    };
})();

// 3. Función Maestra de Sesión
function hasValidSession() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('-auth-token')) {
                const raw = localStorage.getItem(key);
                if (!raw) continue;
                const session = JSON.parse(raw);
                if (session && session.access_token) return true;
            }
        }
    } catch (e) { }
    return false;
}

// 4. Constructor de Perfil
function _buildCurrentUser(user) {
    if (!user) return null;
    const meta = user.user_metadata || {};

    window.currentUser = {
        ID_USUARIO: meta.id_usuario || user.id,
        ID_PLANTA: meta.id_planta || meta.id_usuario || user.id,
        USUARIO: meta.full_name || meta.usuario || user.email,
        PLANTA: meta.planta || meta.full_name || '',
        CORREO: user.email,
        EMAIL: user.email,
        ROL: meta.role || meta.ROL || 'GUEST',
        TELEFONO: meta.telefono || '',
        DIRECCION: meta.direccion || '',
        PAIS: meta.pais || 'Colombia',
        DEPARTAMENTO: meta.departamento || '',
        CIUDAD: meta.ciudad || '',
        BARRIO: meta.barrio || '',
        COMUNA: meta.comuna || '',
        CONTACTO: meta.contacto || ''
    };

    // RETRO-COMPATIBILIDAD: Guardar para páginas legacy que buscan 'busint_user'
    try {
        localStorage.setItem('busint_user', JSON.stringify(window.currentUser));
    } catch (e) { }

    return window.currentUser;
}

// 5. Inicialización Sincrónica
(function _init() {
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.includes('-auth-token')) {
                const session = JSON.parse(localStorage.getItem(key));
                if (session && session.user) {
                    _buildCurrentUser(session.user);
                    // DIBUJO INMEDIATO: No esperar a loadUsers
                    if (!IS_LOGIN_PAGE && typeof updateAuthUI === 'function') {
                        setTimeout(updateAuthUI, 0);
                    }
                }
            }
        }
    } catch (e) { }
})();

// 6. Escudo de Seguridad
(function _shield() {
    const active = hasValidSession();
    if (!active && !IS_LOGIN_PAGE) {
        sessionStorage.setItem('auth_redirect', window.location.href);
        window.location.replace('login.html');
    } else if (active && IS_LOGIN_PAGE) {
        window.location.replace('index.html');
    }
})();

// 6.5 Render Inmediato de Navegación (Native MAP Style)
(function _renderNavInstant() {
    if (IS_LOGIN_PAGE) return;
    try {
        const user = window.currentUser;
        if (!user) return;

        const usuario = user.USUARIO || user.PLANTA || 'Usuario';
        const rol = user.ROL || 'GUEST';

        const sidebarUser = document.getElementById('sidebar-user-name');
        if (sidebarUser) sidebarUser.textContent = usuario;

        const sidebarRol = document.getElementById('sidebar-user-role');
        if (sidebarRol) sidebarRol.textContent = rol;

        // Actualizar TopNav
        const navUser = document.getElementById('nav-user-name');
        if (navUser) navUser.textContent = usuario;

        // Mostrar el body si ya tenemos usuario
        document.body.classList.add('auth-shield-pass');
    } catch (e) {
        console.error("Error en renderNavInstant:", e);
    }
})();

// 7. Funciones Core
function getSB() {
    if (typeof getSupabaseClient === 'function') return getSupabaseClient();
    return null;
}

async function loadUsers() {
    console.log("[AUTH] Iniciando carga de perfiles...");
    if (typeof fetchUsuariosData !== 'function') {
        console.warn("[AUTH] fetchUsuariosData no disponible");
        return;
    }
    try {
        const [u, p] = await Promise.all([
            fetchUsuariosData().catch(e => { console.error("Error en fetchUsuariosData:", e); return []; }),
            fetchPlantasData().catch(e => { console.error("Error en fetchPlantasData:", e); return []; })
        ]);

        console.log(`[AUTH] Datos recibidos: ${u.length} usuarios, ${p.length} plantas`);

        // GUARDAR GLOBALMENTE para compatibilidad con usuarios.js
        window.allUsers = u;
        window.allPlantas = p;

        if (window.currentUser) {
            const real = u.find(x => String(x.ID_USUARIO || '').trim().toLowerCase() === String(window.currentUser.ID_USUARIO || '').trim().toLowerCase()) ||
                p.find(x => String(x.ID_PLANTA || '').trim().toLowerCase() === String(window.currentUser.ID_PLANTA || '').trim().toLowerCase());
            if (real) {
                console.log("[AUTH] Perfil completo vinculado:", real.USUARIO || real.PLANTA);
                Object.assign(window.currentUser, real);
            } else {
                console.warn("[AUTH] No se encontró perfil detallado para el usuario actual.");
            }
        }

        // Native MAP Style: Retirar escudo visual una vez cargados los datos
        document.body.classList.add('auth-shield-pass');

        // REINVENTAR UI: Inyectar Nav y Sidebar
        if (!IS_LOGIN_PAGE && typeof window.updateAuthUI === 'function') {
            window.updateAuthUI();
            window.applyAccessControl(); // Aplicar permisos tras inyectar UI
        }
    } catch (e) {
        console.error("[AUTH] Error crítico cargando perfiles:", e);
        // Intentar mostrar la UI básica de todos modos
        document.body.classList.add('auth-shield-pass');
        if (!IS_LOGIN_PAGE) window.updateAuthUI();
    }
}

/** ── Motor de UI ── */
window.logout = async function () {
    // 1. Limpiar sesión en Supabase
    const sb = getSB();
    if (sb) await sb.auth.signOut();

    // 2. Limpiar memoria y persistencia quirúrgicamente
    window.currentUser = null;

    // Borrar solo lo relacionado con la sesión, no la biometría registrada
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.includes('-auth-token') || key === 'busint_user' || key === 'busint_avatar_prefs') {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();

    // 3. Redirigir
    window.location.replace('login.html');
};

window.toggleSidebar = function () {
    const sidebar = document.getElementById('user-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
};

/**
 * ══════════════════════════════════════════════════════════════════════════
 * UI ENGINE: SIDEBAR & TOPNAV (Native MAP Shell)
 * ══════════════════════════════════════════════════════════════════════════
 */

function updateAuthUI() {
    if (IS_LOGIN_PAGE) return;
    const user = window.currentUser;
    if (!user) return;

    let navContainer = document.getElementById('app-top-nav');
    if (!navContainer) {
        navContainer = document.createElement('div');
        navContainer.id = 'app-top-nav';
        navContainer.className = 'app-header-bar';
        document.body.prepend(navContainer);
    }

    const roleClass = `role-${(user.ROL || 'GUEST').toLowerCase()}`;
    const pageTitle = (document.title.split(' - ')[0] || 'BUSINT').toUpperCase();

    // Descripciones de módulos originales
    const moduleDescriptions = {
        'REPORTES': 'Registro de eventos',
        'SEGUIMIENTO': 'Estado de novedades',
        'RUTERO': 'Agenda de visitas',
        'USUARIOS': 'Gestión administrativa',
        'INGRESO': 'Control de ingreso',
        'CALIDAD': 'Reportes técnicos',
        'NOVEDADES': 'Centro de soluciones',
        'GESTIÓN DE PLANTA': 'Datos de planta',
        'ACCESO': 'Inicio de sesión',
        'RESTABLECER CONTRASEÑA': 'Recuperar acceso',
        'CARGAR BARRAS': 'Carga de códigos de barras',
        'CARGAR CURVAS': 'Carga de curvas de producción',
        'CARGAR DATOS': 'Sincronización masiva de lotes'
    };
    const moduleDesc = moduleDescriptions[pageTitle] || 'Grupo TDM';

    const avatarStyle = _avatarStyle('mini', user.ROL);
    const iconClass = _getRoleIcon(user.ROL);

    navContainer.innerHTML = `
        <div class="nav-brand-area">
            <img src="icons/app.svg" alt="Logo TMD" class="nav-logo">
            <span class="brand-tag">
                <span style="display:block;font-weight:800;font-size:0.9rem;">${pageTitle}</span>
                <span style="display:block;font-size:0.65rem;color:#94a3b8;font-weight:500;margin-top:1px;">${moduleDesc}</span>
            </span>
        </div>
        <div class="nav-user-area" style="display:flex;align-items:center;gap:6px;">
            <button class="btn-expand-view" id="btn-expand-view" onclick="toggleExpandView()" title="Contraer vista">
                <i class="fas fa-compress-alt"></i>
            </button>
            <div style="position:relative;display:inline-flex;align-items:center;">
                <button id="notif-bell-btn" onclick="toggleNotifPanel()" title="Notificaciones" style="
                    background:none; border:none; cursor:pointer;
                    padding:6px 10px; border-radius:50%;
                    color:#64748b; font-size:1.1rem;
                    transition:all 0.2s ease; position:relative;
                " onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='none'">
                    <i class="fas fa-bell"></i>
                    <span id="notif-badge" style="
                        display:none; position:absolute;
                        top:2px; right:2px;
                        background:#ef4444; color:white;
                        font-size:0.6rem; font-weight:800;
                        min-width:16px; height:16px;
                        border-radius:8px; padding:0 4px;
                        line-height:16px; text-align:center;
                    ">0</span>
                </button>
            </div>
            <button onclick="toggleSidebar()" class="btn-profile-toggle ${roleClass}" id="profileToggle">
                <span class="avatar-mini" style="${avatarStyle}">${_avatarInner(iconClass)}</span>
                <i class="fas fa-bars"></i>
            </button>
        </div>
    `;

    createSidebar();
}

function createSidebar() {
    const user = window.currentUser;
    if (!user) return;

    let sidebar = document.getElementById('user-sidebar');
    if (!sidebar) {
        sidebar = document.createElement('div');
        sidebar.id = 'user-sidebar';
        sidebar.className = 'app-sidebar-drawer';
        document.body.appendChild(sidebar);

        const overlay = document.createElement('div');
        overlay.id = 'sidebar-overlay';
        overlay.className = 'sidebar-backdrop';
        overlay.onclick = toggleSidebar;
        document.body.appendChild(overlay);
    }

    const path = window.location.pathname;
    const roleIcon = _getRoleIcon(user.ROL);
    const prefs = getAvatarPrefs();
    const avatarLargeInner = _avatarInner(roleIcon);
    const hasCalidad = ['ADMIN', 'MODERATOR', 'USER-C'].includes(user.ROL);

    const isAdmin = user.ROL === 'ADMIN';

    sidebar.innerHTML = `
        <div class="sidebar-header">
            <div class="sidebar-user-card">
                ${isAdmin ? `
                    <div class="user-avatar-large admin" id="sidebar-avatar-large" style="${_avatarStyle('large', user.ROL)}">${avatarLargeInner}</div>
                ` : `
                    <div class="avatar-edit-btn" onclick="toggleAvatarCustomizer()" title="Personalizar avatar">
                        <div class="user-avatar-large ${user.ROL.toLowerCase()}" id="sidebar-avatar-large" style="${_avatarStyle('large', user.ROL)}">${avatarLargeInner}</div>
                        <div class="avatar-overlay"><i class="fas fa-pen"></i></div>
                    </div>
                `}
                <div class="user-meta">
                    <span class="u-name" id="sidebar-user-name">${user.USUARIO || user.PLANTA || 'Usuario'}</span>
                    <span class="u-role" id="sidebar-user-role">${user.ROL}</span>
                </div>
            </div>
            ${!isAdmin ? `
            <div class="avatar-customizer" id="avatar-customizer-panel" style="display:none;">
                <div class="avatar-customizer-row">
                    <span class="avatar-customizer-label">Color</span>
                    <div class="avatar-color-picker-wrap">
                        <input type="color" id="avatar-color-input" value="${prefs.color || '#3f51b5'}" oninput="setAvatarColor(this.value)">
                        <span class="avatar-color-preview" style="background:${prefs.color || '#3f51b5'}"></span>
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
        <div class="sidebar-body">
            <div class="sidebar-label">MENÚ DE ACCESO</div>
            <a href="index.html" class="sidebar-link ${path.includes('index.html') ? 'active' : ''}">
                <i class="fas fa-home"></i> Reportes
            </a>
            ${(user.ROL === 'ADMIN' || user.ROL === 'MODERATOR' || user.ROL === 'USER-P') ? `
                <a href="resolucion.html" class="sidebar-link ${path.includes('resolucion.html') ? 'active' : ''}">
                    <i class="fas fa-desktop"></i> Novedades
                </a>
            ` : ''}
            ${user.ROL === 'GUEST' ? `
                <a href="seguimiento.html" class="sidebar-link ${path.includes('seguimiento.html') ? 'active' : ''}">
                    <i class="fas fa-shipping-fast"></i> Seguimiento
                </a>
                <a href="gestion-planta.html?id=${user.ID_PLANTA || user.ID}" class="sidebar-link ${path.includes('gestion-planta.html') ? 'active' : ''}">
                    <i class="fas fa-industry"></i> Actualizar
                </a>
            ` : ''}
            ${(user.ROL === 'ADMIN' || user.ROL === 'MODERATOR') ? `
                <a href="calidad.html" class="sidebar-link ${path.includes('calidad.html') ? 'active' : ''}">
                    <i class="fas fa-microscope"></i> Calidad
                </a>
            ` : ''}
            ${(user.ROL === 'ADMIN' || user.ROL === 'USER-C' || user.ROL === 'MODERATOR') ? `
                <a href="rutero.html" class="sidebar-link ${path.includes('rutero.html') ? 'active' : ''}">
                    <i class="fas fa-route"></i> Rutero
                </a>
            ` : ''}
            ${user.ROL === 'ADMIN' ? `
                <a href="upload.html" class="sidebar-link ${path.includes('upload.html') ? 'active' : ''}">
                    <i class="fas fa-file-import"></i> Actualizar
                </a>
                <a href="usuarios.html" class="sidebar-link ${path.includes('usuarios.html') ? 'active' : ''}">
                    <i class="fas fa-users-cog"></i> Usuarios
                </a>
            ` : ''}
        </div>
        <div class="sidebar-footer">
            <button onclick="logout()" class="btn-logout-full mb-3">
                <i class="fas fa-power-off me-2"></i> Cerrar Sesión
            </button>
            <div class="sidebar-credits">
                <p>Developed by Andrés Mendoza © 2026</p>
            </div>
        </div>
    `;
}

function toggleSidebar() {
    const sidebar = document.getElementById('user-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar) return;
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

/** ── Helpers de Avatar ── */
function _getRoleIcon(role) {
    if (role === 'ADMIN') return 'fas fa-user-shield';
    if (role === 'MODERATOR') return 'fas fa-user-tie';
    if (role === 'USER-C') return 'fas fa-user-check';
    if (role === 'USER-I') return 'fas fa-sign-in-alt';
    if (role === 'GUEST') return 'fas fa-user-secret';
    return 'fas fa-user';
}

function _avatarStyle(type, role) {
    const prefs = getAvatarPrefs();
    const systemBlue = '#3f51b5';

    // Forzar azul del sistema para ADMIN
    if (role === 'ADMIN') return `background-color:${systemBlue};`;

    if (prefs.image) return `background-image:url(${prefs.image});background-size:cover;`;
    return `background-color:${prefs.color || systemBlue};`;
}

function _avatarInner(iconClass) {
    const prefs = getAvatarPrefs();
    if (prefs.image) return '';
    return `<i class="${iconClass}"></i>`;
}

function getAvatarPrefs() {
    try {
        const p = localStorage.getItem('busint_avatar_prefs');
        return p ? JSON.parse(p) : { color: '#3f51b5', icon: 'fas fa-user' };
    } catch (e) { return { color: '#3f51b5' }; }
}

function saveAvatarPrefs(prefs) {
    localStorage.setItem('busint_avatar_prefs', JSON.stringify(prefs));
}

function setAvatarColor(color) {
    const prefs = getAvatarPrefs();
    prefs.color = color;
    saveAvatarPrefs(prefs);
    updateAuthUI();
}

function toggleAvatarCustomizer() {
    const panel = document.getElementById('avatar-customizer-panel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function toggleExpandView() {
    document.body.classList.toggle('view-expanded');
}

window.setAvatarColor = setAvatarColor;
window.toggleAvatarCustomizer = toggleAvatarCustomizer;
window.toggleExpandView = toggleExpandView;
window.updateAuthUI = updateAuthUI;

function applyAccessControl() {
    const user = window.currentUser;
    if (!user) return;

    console.log(`[AUTH] Aplicando control de acceso para rol: ${user.ROL}`);

    // Ocultar elementos protegidos por defecto
    const protectedElements = document.querySelectorAll('[data-role-min]');
    protectedElements.forEach(el => {
        const minRole = el.getAttribute('data-role-min');
        if (!_hasPermission(user.ROL, minRole)) {
            el.style.display = 'none';
        } else {
            el.style.display = ''; // Restaurar si tiene permiso
        }
    });
}

function _hasPermission(userRole, minRoleRequired) {
    const weights = { 'GUEST': 1, 'USER-I': 2, 'USER-P': 3, 'USER-C': 4, 'MODERATOR': 8, 'ADMIN': 10 };
    return (weights[userRole] || 0) >= (weights[minRoleRequired] || 0);
}

window.applyAccessControl = applyAccessControl;

async function handleLogin(email, password, isLoginPage = false) {
    const sb = getSB();
    if (!sb) throw new Error("Error de conexión");

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const user = await _buildCurrentUser(data.user);
    console.log("[AUTH] Login exitoso, verificando biometría...", { isLoginPage, biometry: typeof BIOMETRY, supported: await BIOMETRY?.isSupported() });

    // ── Lógica Biométrica (Vault / MAP Style) ──
    let willShowBiometric = false;
    if (isLoginPage && typeof BIOMETRY !== 'undefined' && await BIOMETRY.isSupported()) {
        const map = JSON.parse(localStorage.getItem(B_KEY) || '{}');
        const userEmail = user.CORREO.toLowerCase();

        console.log("[AUTH] Verificando registro previo para:", userEmail, "Registrado:", !!map[userEmail]);

        if (!map[userEmail]) {
            console.log("[AUTH] Disparando modal de registro biométrico...");
            window._tempPass = password;
            willShowBiometric = true;
            setTimeout(() => _showBiometricModal(userEmail), 1000);
        }
    }

    // Solo redirigir si no estamos mostrando el modal
    if (isLoginPage && !willShowBiometric) {
        if (window.currentUser.ROL === 'GUEST' && (!window.currentUser.DEPARTAMENTO)) {
            window.location.href = 'gestion-planta.html?id=' + window.currentUser.ID_PLANTA;
            return;
        }
        window.location.href = 'index.html';
    }
}

/** ── Lógica de Registro en Vault (MAP Style) ── */
function _showBiometricModal(email) {
    const modal = document.getElementById('biometric-modal');
    if (!modal) return;

    // Inyectar icono y textos dinámicos según el dispositivo
    const iconWrap = document.getElementById('bm-icon-wrap');
    if (iconWrap) iconWrap.innerHTML = BIOMETRY.getSVGForType();

    const title = document.getElementById('bm-title');
    if (title) title.textContent = `Activar ${BIOMETRY.getLabelForType()}`;

    modal.style.display = 'flex';

    const btnActivate = document.getElementById('bm-activate');
    const btnSkip = document.getElementById('bm-skip');

    btnActivate.onclick = async () => {
        btnActivate.disabled = true;
        btnActivate.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Activando...';
        try {
            await registerBiometricInVault(email, window._tempPass);
            modal.style.display = 'none';
            window.location.href = 'index.html';
        } catch (err) {
            Swal.fire('Error', 'No se pudo activar la biometría: ' + err.message, 'error');
            btnActivate.disabled = false;
            btnActivate.textContent = 'Activar';
        }
    };

    btnSkip.onclick = () => {
        modal.style.display = 'none';
        window.location.href = 'index.html';
    };
}

async function registerBiometricInVault(email, password) {
    if (!password) throw new Error("Sesión expirada, reintente login manual");

    // 1. Crear credencial en el hardware (Windows Hello / Touch ID)
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const credential = await navigator.credentials.create({
        publicKey: {
            challenge,
            rp: { name: "Grupo TDM" },
            user: {
                id: crypto.getRandomValues(new Uint8Array(16)),
                name: email,
                displayName: email
            },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
            authenticatorSelection: { userVerification: "required" },
            timeout: 60000
        }
    });

    if (!credential) throw new Error("El usuario canceló el registro");

    const credentialIdB64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    // 2. Registrar en el Vault de Supabase (Edge Function)
    const projectUrl = CONFIG.FUNCTIONS_URL.split('/functions/')[0];
    const res = await fetch(`${projectUrl}/functions/v1/biometric-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'enroll',
            email,
            password,
            credential_id: credentialIdB64
        })
    });

    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.error || "Error en el servidor");

    // 3. Guardar mapeo local (público)
    const map = JSON.parse(localStorage.getItem(B_KEY) || '{}');
    map[email.toLowerCase()] = credentialIdB64;
    localStorage.setItem(B_KEY, JSON.stringify(map));

    Swal.fire('¡Éxito!', 'Biometría activada correctamente', 'success');
}

async function loginWithBiometric() {
    const userId = window._biometricUserId;
    if (!userId) return typeof showManualLogin === 'function' ? showManualLogin() : null;

    try {
        const map = JSON.parse(localStorage.getItem(B_KEY) || '{}');
        const credIdB64 = map[userId.toLowerCase()];
        if (!credIdB64) throw new Error("No hay huella registrada para este usuario");

        const binaryId = Uint8Array.from(atob(credIdB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

        const assertion = await navigator.credentials.get({
            publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                allowCredentials: [{ type: 'public-key', id: binaryId }],
                userVerification: 'required'
            }
        });

        const sb = getSB();
        const projectUrl = CONFIG.FUNCTIONS_URL.split('/functions/')[0];
        const res = await fetch(`${projectUrl}/functions/v1/biometric-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'authenticate', email: userId, credential_id: credIdB64 })
        });

        const result = await res.json();
        if (!res.ok || !result.success) throw new Error(result.error);

        await sb.auth.setSession(result.session);
        await _buildCurrentUser(result.session.user);
        window.location.href = 'index.html';
    } catch (err) {
        if (err.name !== 'NotAllowedError') Swal.fire('Aviso', err.message, 'warning');
        if (typeof showManualLogin === 'function') showManualLogin();
    }
}

window.handleLogin = handleLogin;
window.loginWithBiometric = loginWithBiometric;
window.loadUsers = loadUsers;
window.resetCredentials = async () => {
    const sb = getSB();
    if (sb) await sb.auth.signOut();
    localStorage.clear();
    sessionStorage.clear();
    location.reload();
};
