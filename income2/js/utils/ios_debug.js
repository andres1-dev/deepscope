/**
 * iOS PWA Debug Utilities
 * Herramientas para diagnosticar problemas en iOS PWA
 */

// Función para mostrar logs en pantalla (útil en iOS donde no hay consola fácil)
function showDebugLog(message, type = 'info') {
    let debugContainer = document.getElementById('ios-debug-log');
    
    if (!debugContainer) {
        debugContainer = document.createElement('div');
        debugContainer.id = 'ios-debug-log';
        debugContainer.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            max-height: 200px;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.9);
            color: #fff;
            font-family: monospace;
            font-size: 10px;
            padding: 10px;
            z-index: 99999;
            display: none;
        `;
        document.body.appendChild(debugContainer);
    }
    
    const timestamp = new Date().toLocaleTimeString();
    const color = type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#ffffff';
    
    const logEntry = document.createElement('div');
    logEntry.style.color = color;
    logEntry.textContent = `[${timestamp}] ${message}`;
    
    debugContainer.appendChild(logEntry);
    debugContainer.scrollTop = debugContainer.scrollHeight;
}

// Función para activar/desactivar el log de debug
function toggleDebugLog() {
    const debugContainer = document.getElementById('ios-debug-log');
    if (debugContainer) {
        debugContainer.style.display = debugContainer.style.display === 'none' ? 'block' : 'none';
    }
}

// Detectar entorno
function getEnvironmentInfo() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    return {
        isIOS,
        isInStandaloneMode,
        isSafari,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        standalone: window.navigator.standalone
    };
}

// Interceptar console.log para iOS
if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = function(...args) {
        originalLog.apply(console, args);
        showDebugLog(args.join(' '), 'info');
    };
    
    console.error = function(...args) {
        originalError.apply(console, args);
        showDebugLog('ERROR: ' + args.join(' '), 'error');
    };
    
    console.warn = function(...args) {
        originalWarn.apply(console, args);
        showDebugLog('WARN: ' + args.join(' '), 'info');
    };
}

// Agregar botón de debug en la esquina
function addDebugButton() {
    const debugBtn = document.createElement('button');
    debugBtn.textContent = '🐛';
    debugBtn.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #2563eb;
        color: white;
        border: none;
        font-size: 20px;
        z-index: 99998;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    
    debugBtn.addEventListener('click', () => {
        toggleDebugLog();
        const env = getEnvironmentInfo();
        showDebugLog('=== INFORMACIÓN DEL ENTORNO ===', 'info');
        showDebugLog(`iOS: ${env.isIOS}`, 'info');
        showDebugLog(`PWA Mode: ${env.isInStandaloneMode}`, 'info');
        showDebugLog(`Safari: ${env.isSafari}`, 'info');
        showDebugLog(`Platform: ${env.platform}`, 'info');
        showDebugLog(`Versión del código: v16-simple`, 'success');
        
        // Verificar soporte de Web Share API
        const hasShare = 'share' in navigator;
        const canShareFiles = navigator.canShare && navigator.canShare({ files: [new File([], 'test.jpg')] });
        showDebugLog(`Web Share API: ${hasShare ? 'SÍ' : 'NO'}`, hasShare ? 'success' : 'error');
        showDebugLog(`Puede compartir archivos: ${canShareFiles ? 'SÍ' : 'NO'}`, canShareFiles ? 'success' : 'error');
        showDebugLog(`Cache actualizado: ${new Date().toLocaleString()}`, 'info');
    });
    
    document.body.appendChild(debugBtn);
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addDebugButton);
} else {
    addDebugButton();
}

// Forzar actualización del Service Worker y limpiar cache
if ('serviceWorker' in navigator) {
    // Verificar si hay una actualización disponible
    navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
            registration.update();
        }
    });
    
    // Limpiar cache antiguo
    if ('caches' in window) {
        caches.keys().then(cacheNames => {
            cacheNames.forEach(cacheName => {
                if (cacheName.includes('ingresos-mp') && !cacheName.includes('v12-ios-fix')) {
                    console.log('Eliminando cache antiguo:', cacheName);
                    caches.delete(cacheName);
                }
            });
        });
    }
}

// Exportar funciones
window.iosDebug = {
    showLog: showDebugLog,
    toggleLog: toggleDebugLog,
    getEnv: getEnvironmentInfo
};
