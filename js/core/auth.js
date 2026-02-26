// Gestión de autenticación y sesiones (Versión Independiente)
const AUTH_KEY = 'user';

// Estado de usuario
let currentUser = null;

// Inicializar sistema de autenticación
function initAuth() {
    // Checking session
    checkSession();
}

// Verificar si hay sesión activa
function checkSession() {
    try {
        const storedUser = localStorage.getItem(AUTH_KEY);
        const lastActivity = parseInt(localStorage.getItem(CONFIG.ACTIVITY_KEY) || '0');
        const now = Date.now();

        if (storedUser) {
            // Verificar expiración por tiempo (Seguridad agresiva inicial)
            if (lastActivity > 0 && (now - lastActivity > CONFIG.SESSION_TIMEOUT_MS)) {
                console.warn("Sesión expirada detectada en checkSession: ", (now - lastActivity) / 1000, "segundos de inactividad");
                logout();
                return;
            }

            currentUser = JSON.parse(storedUser);
            window.currentUser = currentUser;
            console.log("Sesión restaurada para:", currentUser.nombre);

            // Actualizar tiempo de actividad al restaurar sesión
            updateActivityTime();

            // Mostrar app
            showApp();
        } else {
            // Redirigir a login independiente
            window.location.replace('login.html');
        }
    } catch (e) {
        console.error("Error al restaurar sesión:", e);
        window.location.replace('login.html');
    }
}

function showLogin() {
    window.location.replace('login.html');
}

function showApp() {
    const scanner = document.getElementById('scanner');
    const barcodeInput = document.getElementById('barcode');

    if (scanner) {
        scanner.style.display = 'flex';
        // Ajustar UI según rol
        applyRolePermissions();

        // Actualizar permisos de notificaciones
        if (window.notificationManager) {
            window.notificationManager.applyRolePermissions();
        }

        // Actualizar UI de usuario (Header)
        if (typeof window.updateUserUI === 'function') {
            window.updateUserUI();
        }

        if (barcodeInput) barcodeInput.focus();

        // Iniciar monitor de inactividad
        initInactivityMonitoring();
    }
}

function logout() {
    console.log("Cerrando sesión del sistema...");
    currentUser = null;
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem('apiKey');
    localStorage.removeItem(CONFIG.ACTIVITY_KEY);
    sessionStorage.removeItem('token');
    window.location.replace('login.html');
}

// --- LOGICA DE INACTIVIDAD ---

function updateActivityTime() {
    localStorage.setItem(CONFIG.ACTIVITY_KEY, Date.now().toString());
}

let inactivityInterval = null;

function initInactivityMonitoring() {
    if (inactivityInterval) return; // Ya iniciado

    // Actualizar timestamp al iniciar por si acaso
    updateActivityTime();

    // Eventos que reinician el contador
    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];

    // Usar throttle para no escribir en localStorage constantemente
    let lastUpdateStr = 0;

    const recordActivity = () => {
        const now = Date.now();
        if (now - lastUpdateStr > 5000) { // Actualizar máximo cada 5 segundos
            updateActivityTime();
            lastUpdateStr = now;
        }
    };

    activityEvents.forEach(evt => {
        window.addEventListener(evt, recordActivity, { passive: true });
    });

    // --- SEGURIDAD AGRESIVA: RESUME CHECK ---
    // Verificar inactividad apenas la app vuelva a primer plano
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log("App volvió a primer plano. Verificando inactividad...");
            checkInactivity();
        }
    });

    // También al enfocar la ventana
    window.addEventListener('focus', () => {
        console.log("Ventana enfocada. Verificando inactividad...");
        checkInactivity();
    });

    // Chequear inactividad periódicamente cada 2 segundos (monitoreo agresivo)
    inactivityInterval = setInterval(checkInactivity, 2000);
}

function checkInactivity() {
    const lastActivity = parseInt(localStorage.getItem(CONFIG.ACTIVITY_KEY) || '0');
    const now = Date.now();
    const timeout = (window.CONFIG && window.CONFIG.SESSION_TIMEOUT_MS) ? window.CONFIG.SESSION_TIMEOUT_MS : 60000;

    // Si no hay user, nada que chequear
    if (!localStorage.getItem(AUTH_KEY)) return;

    // Si ha pasado el tiempo límite
    if (now - lastActivity > timeout) {
        console.error("DEBUG: Inactividad crítica detectada. Logout inmediato.");
        logout();
    }
}

// Aplicar permisos según rol
function applyRolePermissions() {
    if (!currentUser) return;

    // Remove old classes
    document.body.classList.remove('role-admin', 'role-moderator', 'role-user', 'role-guest', 'role-delivery');

    // Add new class based on role (normalized to lowercase)
    const roleClass = `role-${currentUser.rol.toLowerCase()}`;
    document.body.classList.add(roleClass);

    if (currentUser.rol === 'USER' || currentUser.rol === 'DELIVERY') {
        document.body.classList.add('role-delivery');
    }

    // Actualizar UI existente
    updateDeleteButtonsVisibility();
}

function updateDeleteButtonsVisibility() {
    const isAdmin = currentUser && currentUser.rol === 'ADMIN';
    const deleteBtns = document.querySelectorAll('.btn-delete');

    deleteBtns.forEach(btn => {
        if (!isAdmin) {
            btn.style.display = 'none';
        } else {
            btn.style.display = 'flex';
        }
    });
}

// Llamar al inicio
document.addEventListener('DOMContentLoaded', initAuth);
