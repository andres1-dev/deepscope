(function () {
    function verifySession() {
        const user = localStorage.getItem('user');
        const lastActivity = parseInt(localStorage.getItem('last_activity_timestamp') || '0');
        const now = Date.now();

        // Priorizar CONFIG si existe, si no, 1 minuto por seguridad máxima en pruebas
        const timeout = (window.CONFIG && window.CONFIG.SESSION_TIMEOUT_MS) ? window.CONFIG.SESSION_TIMEOUT_MS : 60000;

        if (!user) {
            if (!window.location.pathname.includes('login.html')) {
                window.location.replace('login.html');
            }
            return;
        }

        if (lastActivity > 0 && (now - lastActivity > timeout)) {
            console.error("ALERTA DE SEGURIDAD: Sesión expirada. Redirigiendo...");
            // Limpieza total inmediata
            localStorage.removeItem('user');
            localStorage.removeItem('apiKey');
            localStorage.removeItem('last_activity_timestamp');
            sessionStorage.clear();
            window.location.replace('login.html');
        }
    }

    // Ejecución inmediata (Head)
    verifySession();

    // Re-verificación cuando el DOM esté listo por si el config cargó después
    document.addEventListener('DOMContentLoaded', verifySession);
})();
