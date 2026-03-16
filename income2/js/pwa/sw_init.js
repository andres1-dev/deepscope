/**
 * PWA Service Worker and Installation Logic
 */

let deferredPrompt;

// Registrar Service Worker con ruta relativa
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Obtener la ruta base de la aplicación
        const baseUrl = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
        const swPath = baseUrl + 'sw.js';
        
        navigator.serviceWorker.register(swPath, { scope: baseUrl })
            .then(reg => {
                console.log('✅ Service Worker registrado:', reg.scope);
            })
            .catch(err => {
                console.error('❌ Error al registrar Service Worker:', err);
            });
    });
}

// Detectar evento de instalación de PWA
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallPromotion();
});

// Mostrar botón de instalación
function showInstallPromotion() {
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.classList.remove('hidden');
        installBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación`);
                deferredPrompt = null;
                installBtn.classList.add('hidden');
            }
        });
    }
}

// Detectar cuando la app ya está instalada
window.addEventListener('appinstalled', () => {
    console.log('✅ PWA instalada exitosamente');
    deferredPrompt = null;
});

// Three-finger swipe to refresh (opcional)
let touchStartY = 0;
let touchCount = 0;

window.addEventListener('touchstart', (e) => {
    touchCount = e.touches.length;
    if (touchCount === 3) touchStartY = e.touches[0].pageY;
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    if (touchCount === 3) {
        let touchMoveY = e.touches[0].pageY;
        if (touchMoveY - touchStartY > 200) {
            showRefreshIndicator();
            setTimeout(() => location.reload(), 1000);
        }
    }
}, { passive: true });

function showRefreshIndicator() {
    let indicator = document.querySelector('.swipe-refresh-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'swipe-refresh-indicator';
        indicator.innerHTML = '<i class="fas fa-sync-alt"></i><span>Actualizando datos...</span>';
        indicator.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #2563eb, #1e40af);
            color: white;
            padding: 15px 30px;
            border-radius: 50px;
            box-shadow: 0 4px 20px rgba(37, 99, 235, 0.4);
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 600;
            animation: slideDown 0.3s ease;
        `;
        document.body.appendChild(indicator);
        
        setTimeout(() => {
            indicator.remove();
        }, 2000);
    }
}
