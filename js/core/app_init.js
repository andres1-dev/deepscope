// Script de Inicialización y Encendido de la App

document.addEventListener('DOMContentLoaded', () => {
    // 0. Registrar Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('SW registrado con éxito:', registration.scope);
                })
                .catch(err => {
                    console.log('Fallo registro SW:', err);
                });
        });
    }

    // Bloquear rotación de pantalla (Forzar Portrait)
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait').catch(function (error) {
            console.log('La orientación no pudo ser bloqueada por JS: ' + error);
        });
    }

    // 1. Inicializar Listeners UI
    initUIListeners();

    // 2. Inicializar Listeners QR
    initQRListeners();

    // 3. Referencias DOM para eventos online/offline
    const offlineBanner = document.getElementById('offline-banner');
    const statusDiv = document.getElementById('status');

    // Verificar si estamos en modo offline
    window.addEventListener('online', function () {
        if (offlineBanner) offlineBanner.style.display = 'none';
        if (statusDiv) {
            statusDiv.className = 'reconnected';
            statusDiv.innerHTML = '<i class="fas fa-wifi"></i> CONEXIÓN RESTABLECIDA';
        }
        // Si los datos aún no se han cargado, intentar cargarlos de nuevo
        if (!dataLoaded) {
            setTimeout(() => loadDataFromServer(), 1000);
        }
    });

    window.addEventListener('offline', function () {
        if (offlineBanner) offlineBanner.style.display = 'block';
        if (statusDiv) {
            statusDiv.className = 'offline';
            statusDiv.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 10px; text-align: center;">
                <i class="fas fa-wifi-slash" style="font-size: 20px;"></i>
                <span>MODO OFFLINE ACTIVO</span>
            </div>
        `;
        }
    });

    // Agregar eventos para prevenir teclado virtual en cámara de forma segura
    const cameraModal = document.getElementById('cameraModal');
    if (cameraModal) {
        document.addEventListener('focusin', function (e) {
            if (cameraModal.style.display === 'flex' &&
                e.target.id !== 'dummyInput') {
                e.preventDefault();
            }
        });
    }

    // 4. Cargar datos
    loadDataFromServer();
});
