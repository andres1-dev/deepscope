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
        if (storedUser) {
            currentUser = JSON.parse(storedUser);
            window.currentUser = currentUser;
            console.log("Sesión restaurada para:", currentUser.nombre);

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
    currentUser = null;
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem('apiKey');
    localStorage.removeItem(ACTIVITY_KEY);
    sessionStorage.removeItem('token');
    window.location.replace('login.html');
}

// --- LOGICA DE INACTIVIDAD ---
const ACTIVITY_KEY = 'last_activity_timestamp';
const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 1 hora

function updateActivityTime() {
    localStorage.setItem(ACTIVITY_KEY, Date.now().toString());
}

let inactivityInterval = null;

function initInactivityMonitoring() {
    if (inactivityInterval) return; // Ya iniciado

    // Actualizar timestamp al iniciar
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

    // Chequear inactividad cada minuto
    inactivityInterval = setInterval(checkInactivity, 60000);
}

function checkInactivity() {
    const lastActivity = parseInt(localStorage.getItem(ACTIVITY_KEY) || '0');
    const now = Date.now();

    // Si ha pasado el tiempo límite
    if (now - lastActivity > INACTIVITY_LIMIT_MS) {

        // VERIFICAR COLA DE CARGA
        if (window.uploadQueue) {
            const hasPending = window.uploadQueue.queue.length > 0;
            const isProcessing = window.uploadQueue.isProcessing;

            if (hasPending || isProcessing) {
                console.log("Inactividad detectada, pero hay elementos en cola. Sesión mantenida.");
                return;
            }
        }

        console.log("Cerrando sesión por inactividad (> 1h)");
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
