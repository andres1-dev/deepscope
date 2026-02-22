// Gestión de Datos (Carga, Caché, Errores)

function loadDataFromServer() {
    const statusDiv = document.getElementById('status');
    const dataStats = document.getElementById('data-stats');

    // Usar el sistema de prioridad dinámica para el estado principal
    if (typeof window.updateStatusDisplay === 'function') {
        window.updateStatusDisplay("SINCRONIZANDO CON SERVIDOR...", "loading");
    }

    if (dataStats) {
        dataStats.innerHTML = '<i class="fas fa-sync fa-spin"></i> Actualizando base de datos...';
    }

    // Usamos la función de main.js en lugar del fetch
    if (typeof obtenerDatosFacturados === 'function') {
        obtenerDatosFacturados()
            .then(serverData => handleDataLoadSuccess(serverData))
            .catch(error => handleDataLoadError(error));
    } else {
        console.error("main.js no cargado correctamente");
        handleDataLoadError(new Error("Error de integración: main.js no disponible"));
    }
}

function handleDataLoadSuccess(serverData) {
    const statusDiv = document.getElementById('status');
    const dataStats = document.getElementById('data-stats');
    const resultsDiv = document.getElementById('results');
    const offlineBanner = document.getElementById('offline-banner');

    if (serverData && serverData.success && serverData.data) {
        database = serverData.data;
        dataLoaded = true;
        cacheData(database);

        // Actualizar UI de estado
        if (typeof window.updateStatusDisplay === 'function') {
            window.updateStatusDisplay("SISTEMA ACTUALIZADO");
        }
        if (dataStats) {
            const timeStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
            dataStats.innerHTML = `<i class="fas fa-database"></i> ${database.length} | ${timeStr}`;
        }

        // Mostrar contenido principal SOLO si NO hay resultados activos (background friendly)
        const resultsDiv = document.getElementById('results');
        if (resultsDiv && (!window.currentDocumentData)) {
            resultsDiv.innerHTML = `
        <div class="result-item" style="text-align: center; padding: 40px 20px;">
            <div style="margin-bottom: 30px;">
                <!-- REEMPLAZADO: Logo SVG oficial - CON COLORES ORIGINALES, FONDO TRANSPARENTE -->
                <div style="width: 70px; height: 70px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; animation: subtleFloat 3s ease-in-out infinite;">
                    <img src="icons/icon.svg" alt="${CONFIG.APP_NAME} Logo" style="width: 100%; height: 100%;">
                </div>
                <h1 class="brand-app-name">${CONFIG.APP_NAME}</h1>
                <p class="brand-app-desc">${CONFIG.APP_DESCRIPTION}</p>
            </div>
            
            <div style="background: #f8fafc; border-radius: 16px; padding: 18px 20px; margin: 25px 0; border: 1px solid var(--border); display: flex; align-items: center; gap: 16px; text-align: left;">
                <div style="width: 42px; height: 42px; background: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--primary); font-size: 1.2rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); flex-shrink: 0;">
                    <i class="fas fa-qrcode"></i>
                </div>
                <div style="flex: 1;">
                    <p style="font-size: 13px; color: var(--text-main); margin: 0 0 2px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Sistema listo</p>
                    <p style="font-size: 12px; color: var(--text-secondary); margin: 0; opacity: 0.85;">Escanea un código QR para comenzar</p>
                </div>
                <div style="width: 8px; height: 8px; background: var(--success); border-radius: 50%; box-shadow: 0 0 8px var(--success);"></div>
            </div>
            
            <div style="margin-top: 40px; padding-top: 2px; border-top: 1px solid var(--border);">
                <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 15px; line-height: 1.4;" class="credits">
                    ${CONFIG.FOOTER_CREDITS}
                </p>
            </div>
        </div>
    `;
        }

        if (hideLoadingScreen && typeof hideLoadingScreen === 'function') hideLoadingScreen();
        if (playSuccessSound && typeof playSuccessSound === 'function') playSuccessSound();
    } else {
        handleDataLoadError(new Error('Formato de datos incorrecto'));
    }
}

function handleDataLoadError(error) {
    console.error("Error al cargar datos:", error);
    const statusDiv = document.getElementById('status');
    const dataStats = document.getElementById('data-stats');
    const resultsDiv = document.getElementById('results');
    const offlineBanner = document.getElementById('offline-banner');

    // Verificar si hay datos en caché
    const cachedData = getCachedData();
    if (cachedData) {
        database = cachedData.data;
        dataLoaded = true;

        if (typeof window.updateStatusDisplay === 'function') {
            window.updateStatusDisplay("SISTEMA LISTO (DATOS CACHEADOS)", "ready");
        }
        if (dataStats) dataStats.innerHTML = `${database.length} | Última actualización: ${new Date(cachedData.timestamp).toLocaleString()}`;

        // En handleDataLoadError, dentro del else (caché)
        if (resultsDiv) {
            resultsDiv.innerHTML = `
        <div class="result-item" style="text-align: center; color: var(--gray);">
            <!-- REEMPLAZADO: Logo SVG oficial - Tamaño 4rem (64px) -->
            <div style="width: 4rem; height: 4rem; margin: 0 auto 0.15rem auto; background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); border-radius: 18px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25);">
                <img src="icons/icon.svg" alt="${CONFIG.APP_NAME} Logo" style="width: 80%; height: 80%;">
            </div>
            <h1 class="brand-app-name" style="font-size: 1.8rem !important; margin-top: 0.5rem !important;">${CONFIG.APP_NAME}</h1>
            <div class="brand-app-desc" style="margin-top: 6px !important; font-size: 13px !important; line-height: 1.3 !important;">
                <div class="credits" style="margin-bottom: 8px;">${CONFIG.FOOTER_CREDITS}</div>
                <div style="display: flex; justify-content: center; gap: 8px; margin-top: 6px;">
                    <a href="${CONFIG.SOCIAL_LINKS.FACEBOOK}" target="_blank" style="color: var(--primary);"><i class="fab fa-facebook"></i></a>
                    <a href="${CONFIG.SOCIAL_LINKS.INSTAGRAM}" target="_blank" style="color: var(--primary);"><i class="fab fa-instagram"></i></a>
                    <a href="${CONFIG.SOCIAL_LINKS.WHATSAPP}" target="_blank" style="color: var(--primary);"><i class="fab fa-whatsapp"></i></a>
                </div>
            </div>
        </div>
    `;
        }

        if (offlineBanner) offlineBanner.style.display = 'block';

        // Ocultar pantalla de carga ya que tenemos datos en caché
        if (hideLoadingScreen && typeof hideLoadingScreen === 'function') hideLoadingScreen();
    } else {
        if (statusDiv) {
            statusDiv.className = 'error';
            statusDiv.innerHTML = '<span style="color: var(--danger)">ERROR AL CARGAR DATOS</span>';
        }
        if (dataStats) dataStats.textContent = error.message || 'Error desconocido';
        if (resultsDiv) resultsDiv.innerHTML = `<div class="error"><i class="fas fa-exclamation-circle"></i> No se pudo cargar la base de datos: ${error.message || 'Error desconocido'}</div>`;

        // Mostrar mensaje de error en la pantalla de carga pero no ocultarla
        const loadingName = document.querySelector('#loadingScreen .version-text');
        if (loadingName) {
            loadingName.innerHTML = 'Error al cargar datos<br>Comprueba tu conexión';
            loadingName.style.color = '#ef4444';
            loadingName.style.fontWeight = '600';

            // Añadir botón de reintento
            const retryButton = document.createElement('button');
            retryButton.innerHTML = '<i class="fas fa-redo"></i> Reintentar';
            retryButton.style.marginTop = '15px';
            retryButton.style.padding = '8px 16px';
            retryButton.style.background = 'var(--danger)';
            retryButton.style.color = 'white';
            retryButton.style.border = 'none';
            retryButton.style.borderRadius = '12px';
            retryButton.style.fontWeight = '600';
            retryButton.style.fontSize = '13px';
            retryButton.style.cursor = 'pointer';
            retryButton.addEventListener('click', () => {
                location.reload();
            });

            loadingName.parentNode.appendChild(retryButton);
        }

        if (playErrorSound && typeof playErrorSound === 'function') playErrorSound();
    }
}

function getCachedData() {
    const cache = localStorage.getItem('pdaScannerCache');
    if (!cache) return null;

    try {
        const parsed = JSON.parse(cache);
        if (Date.now() - parsed.timestamp > CONFIG.CACHE_TTL) return null;
        return parsed;
    } catch (e) {
        console.error("Error al parsear cache:", e);
        return null;
    }
}

function cacheData(data) {
    const cache = {
        data: data,
        timestamp: Date.now(),
        version: CONFIG.VERSION
    };

    try {
        localStorage.setItem('pdaScannerCache', JSON.stringify(cache));
    } catch (e) {
        console.error("Error al guardar en cache:", e);
        if (e.name === 'QuotaExceededError') {
            clearOldCache();
            cacheData(data);
        }
    }
}

function clearOldCache() {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
        if (key.startsWith('pdaScannerCache')) {
            localStorage.removeItem(key);
        }
    }
}

// Función para recargar datos silenciosamente (sin borrar la UI)
async function silentReloadData() {
    console.log("🔄 Iniciando actualización silenciosa de datos...");

    if (typeof obtenerDatosFacturados !== 'function') {
        console.warn("obtenerDatosFacturados no disponible");
        return;
    }

    try {
        const serverData = await obtenerDatosFacturados();

        if (serverData && serverData.success && serverData.data) {
            // Actualizar base de datos global
            database = serverData.data;

            // Actualizar caché
            cacheData(database);

            console.log(`✅ Datos actualizados silenciosamente: ${database.length} registros`);

            // Actualizar estadísticas si existen en pantalla
            const dataStats = document.getElementById('data-stats');
            if (dataStats) {
                const timeStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                dataStats.innerHTML = `<i class="fas fa-database"></i> ${database.length} | ${timeStr}`;
            }

            return true;
        }
    } catch (e) {
        console.error("Error en actualización silenciosa:", e);
        return false;
    }
}
