// Lógica de Interfaz de Usuario y DOM

// Función para extracción de datos de la UI
function extractDataFromUI(factura) {
    let lote = '', referencia = '', cantidad = 0;

    // Buscar contenedor de la factura
    const facturaContainer = document.querySelector(`.siesa-item button[data-factura="${factura}"]`)?.closest('.siesa-item');

    if (facturaContainer) {
        // Buscar en los detalles miniatura
        const details = facturaContainer.querySelectorAll('.mini-detail');

        details.forEach(detail => {
            const label = detail.querySelector('.mini-label')?.textContent.trim();
            const value = detail.querySelector('.mini-value')?.textContent.trim();

            if (!label || !value) return;

            if (label.includes('LOTE')) lote = value;
            else if (label.includes('REFERENCIA')) referencia = value;
        });

        if (!cantidad) {
            details.forEach(detail => {
                const label = detail.querySelector('.mini-label')?.textContent.trim();
                if (label && label.includes('CANTIDAD')) {
                    cantidad = parseFloat(detail.querySelector('.mini-value')?.textContent.trim()) || 0;
                }
            });
        }
    }

    return { lote, referencia, cantidad };
}

// Pantalla de carga
function hideLoadingScreen() {
    const scanner = document.getElementById('scanner');
    const loadingScreen = document.getElementById('loadingScreen');
    const barcodeInput = document.getElementById('barcode');

    if (scanner) scanner.style.display = 'flex';

    if (loadingScreen) {
        loadingScreen.style.opacity = '0';

        setTimeout(() => {
            loadingScreen.style.display = 'none';
            if (barcodeInput) {
                barcodeInput.focus();
            }
            // Actualizar estado al iniciar
            if (typeof window.updateStatusDisplay === 'function') window.updateStatusDisplay();
        }, 500);
    }
}

/**
 * Actualiza el texto del estado (status) con prioridad dinámica
 * Prioridad: 1. Mensaje temporal (2 seg), 2. Cliente filtrado, 3. Estado listo por modo
 */
window.updateStatusDisplay = function (tempMessage = null, tempClass = null) {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;

    // Si hay un mensaje temporal, mostrarlo y programar el retorno
    if (tempMessage) {
        statusDiv.textContent = tempMessage;
        if (tempClass) statusDiv.className = tempClass;

        // Limpiar cualquier timer previo
        if (window._statusTimer) clearTimeout(window._statusTimer);

        window._statusTimer = setTimeout(() => {
            window.updateStatusDisplay(); // Llamada sin parámetros para volver al estado base
        }, 2000);
        return;
    }

    // Estado Base (Permanente)
    let baseMessage = "SISTEMA LISTO";
    let baseClass = "ready";

    const hasClient = (typeof USER_SETTINGS !== 'undefined' && USER_SETTINGS.filterEnabled && USER_SETTINGS.selectedClient);

    if (hasClient) {
        baseMessage = USER_SETTINGS.selectedClient;
    } else {
        // Si no hay filtro, mostrar el modo actual de forma amigable
        const mode = window.APP_MODE || 'PDA';
        if (mode === 'PDA') baseMessage = "PDA: ESCANEO LÁSER";
        else if (mode === 'MANUAL') baseMessage = "MODO MANUAL";
        else if (mode === 'CAMERA') baseMessage = "CÁMARA: LISTO";
    }

    statusDiv.textContent = baseMessage;
    statusDiv.className = baseClass;
};

// Imágenes
function mostrarImagenCompleta(imageUrl) {
    let modal = document.getElementById('ih3Modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'ih3Modal';
        modal.className = 'ih3-modal';
        modal.innerHTML = `
      <span class="close-modal" onclick="cerrarImagenCompleta()">&times;</span>
      <img class="ih3-modal-img" src="" alt="Comprobante completo">
    `;
        document.body.appendChild(modal);

        modal.addEventListener('click', function (e) {
            if (e.target === modal) {
                cerrarImagenCompleta();
            }
        });
    }

    const img = modal.querySelector('.ih3-modal-img');
    img.src = imageUrl;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function cerrarImagenCompleta() {
    const modal = document.getElementById('ih3Modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Items Siesa (Acordeones)
function toggleSiesaItem(index) {
    const item = document.getElementById(`siesa-item-${index}`);
    if (item) {
        if (item.classList.contains('collapsed')) {
            item.classList.remove('collapsed');
            item.classList.add('expanded');
        } else {
            item.classList.remove('expanded');
            item.classList.add('collapsed');
        }
    }
}

function expandAllSiesaItems() {
    document.querySelectorAll('.siesa-item.collapsed').forEach(item => {
        const index = item.id.replace('siesa-item-', '');
        toggleSiesaItem(index);
    });
}

function collapseAllSiesaItems() {
    document.querySelectorAll('.siesa-item.expanded').forEach(item => {
        const index = item.id.replace('siesa-item-', '');
        toggleSiesaItem(index);
    });
}

// Utilidades UI
function esMovil() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Inicialización de Listeners UI (llamado desde inicio.js)
function initUIListeners() {
    const barcodeInput = document.getElementById('barcode');

    // Inicializar Modos de Interacción (PDA, Manual, Cámara)
    initPDAModes();

    try {
        // Inicializar UI de Configuracion
        initSettingsUI();

        // --- Reporte Detallado e Inicialización de Flatpickr ---
        const rDateInput = document.getElementById('reportDateRange');

        // Helper para rango por defecto (Hoy y un mes atrás)
        const getReportDefaultRange = () => {
            const end = new Date();
            const start = new Date();
            start.setMonth(start.getMonth() - 1);
            return [start, end];
        };

        if (rDateInput && typeof flatpickr !== 'undefined') {
            console.log("Initializing Flatpickr for Report");

            // Buscar la fecha más reciente para el valor predeterminado
            const latest = getLatestDeliveryDateVal() || new Date();

            window.reportDatePicker = flatpickr(rDateInput, {
                mode: "range",
                dateFormat: "d/m/Y",
                locale: "es",
                maxDate: "today",
                defaultDate: [latest, latest],
                onClose: function (selectedDates) {
                    // Si el usuario selecciona manualmente, cambiamos al icono de "semana" (rango personalizado)
                    const rDateIcon = document.querySelector('.report-date-selector i');
                    if (rDateIcon) {
                        rDateIcon.className = 'fas fa-calendar-week';
                        rDateIcon.title = "Rango personalizado";
                    }

                    if (selectedDates.length === 2) {
                        showDetailedReport(selectedDates);
                    } else if (selectedDates.length === 1) {
                        showDetailedReport(selectedDates[0]);
                    }
                }
            });

            // --- CICLO RÁPIDO DE FECHAS (DÍA / MES / AÑO) ---
            const rDateSelector = document.querySelector('.report-date-selector');
            const rDateIcon = rDateSelector?.querySelector('i');
            if (rDateIcon && window.reportDatePicker) {
                let cycleState = 0; // 0: DÍA, 1: MES, 2: AÑO
                rDateIcon.style.cursor = 'pointer';
                rDateIcon.title = "Filtro rápido: Día";
                rDateIcon.className = 'fas fa-calendar-day'; // Inicializar con el icono de día

                rDateIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const today = new Date();
                    let start, end;

                    // Asegurar que si el icono es "calendar-week" (manual), el siguiente sea DÍA (0)
                    if (rDateIcon.classList.contains('fa-calendar-week')) {
                        cycleState = -1; // Al sumar 1 abajo, será 0 (DÍA)
                    }

                    cycleState = (cycleState + 1) % 3;

                    if (cycleState === 0) { // DÍA
                        rDateIcon.className = 'fas fa-calendar-day';
                        const latestVal = getLatestDeliveryDateVal() || today;
                        start = latestVal;
                        end = latestVal;
                        console.log("Filtro rápido: DÍA");
                    } else if (cycleState === 1) { // MES
                        rDateIcon.className = 'fas fa-calendar-days';
                        start = new Date(today.getFullYear(), today.getMonth(), 1);
                        end = today;
                        console.log("Filtro rápido: MES");
                    } else { // AÑO
                        rDateIcon.className = 'fas fa-calendar';
                        start = new Date(today.getFullYear(), 0, 1);
                        end = today;
                        console.log("Filtro rápido: AÑO");
                    }

                    showDetailedReport([start, end]);
                });
            }
        }

        // Listener para el botón manual del reporte
        const reportBtn = document.getElementById('openDailyReportBtn');
        if (reportBtn) {
            console.log("Report button found, attaching listener");
            reportBtn.addEventListener('click', async (e) => {
                e.preventDefault();

                // Abrir con la última fecha con datos por defecto
                const latestDate = getLatestDeliveryDateVal() || new Date();
                showDetailedReport(latestDate);
            });
        }

        // Detector de reporte (desde notificación)
        const urlParams = new URLSearchParams(window.location.search);
        const reportDateReq = urlParams.get('showReport');
        if (reportDateReq) {
            const checkDataInterval = setInterval(() => {
                if (window.dataLoaded && typeof showDetailedReport === 'function') {
                    clearInterval(checkDataInterval);
                    window.history.replaceState({}, document.title, window.location.pathname);
                    showDetailedReport(parseInt(reportDateReq));
                }
            }, 800);
        }

        // --- LÓGICA DE PESTAÑAS DEL REPORTE ---
        const tabBtns = document.querySelectorAll('.report-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                window.activeReportTab = tab;

                // Actualizar UI de botones
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Recargar reporte con la misma fecha, saltando la actualización de red
                if (window.lastReportTarget) {
                    showDetailedReport(window.lastReportTarget, true);
                }
            });
        });
    } catch (err) {
        console.error("Error initializing UI Listeners:", err);
    }

    // Detector para deshabilitar el teclado virtual en dispositivos móviles
    document.addEventListener('touchstart', function (e) {
        const cameraModal = document.getElementById('cameraModal');
        if (cameraModal && cameraModal.style.display === 'flex' &&
            e.target.tagName !== 'BUTTON') {
            e.preventDefault();
            if (document.activeElement) {
                document.activeElement.blur();
            }
        }
    }, { passive: false });

    // Global State for Modes
    window.APP_MODE = 'PDA'; // 'PDA', 'MANUAL', 'CAMERA'

    function initPDAModes() {
        let focusTimer = null; // Timer para control de foco

        // Selectors for new modal cards
        const btnCamera = document.querySelector('.mode-option-card.btn-camera');
        const btnManual = document.querySelector('.mode-option-card.btn-keyboard');
        const btnPDA = document.querySelector('.mode-option-card.btn-pda');

        const barcodeInput = document.getElementById('barcode');
        const inputIcon = document.getElementById('inputIcon');
        const statusDiv = document.getElementById('status');
        const clientBadge = document.getElementById('clientStatusBadge');
        const clientNameDisplay = document.getElementById('clientNameDisplay');

        // Keypad Selectors
        const keypadModal = document.getElementById('virtualKeypadModal');
        const keypadDisplay = document.getElementById('keypadDisplay');
        const closeKeypadBtn = document.getElementById('closeKeypadBtn');
        const keypadOverlay = document.getElementById('keypadOverlay');
        const keyBtns = document.querySelectorAll('.key-btn');

        // Update User Info & Client Status
        window.updateUserUI = function () {
            // Update User Info in Settings
            if (typeof currentUser !== 'undefined' && currentUser) {
                const nameEl = document.getElementById('settingsUserName');
                const roleEl = document.getElementById('settingsUserRole');
                if (nameEl) nameEl.textContent = currentUser.nombre || 'Usuario';
                if (roleEl) roleEl.textContent = currentUser.rol || 'Rol';

                // Sidebar Update - ELIMINADO (solo móvil, ya no hay sidebar desktop)
                // Se mantiene solo para compatibilidad con otras partes del código
                const sidebarName = document.getElementById('sidebarUserName');
                const sidebarRole = document.getElementById('sidebarUserRole');
                const sidebarAvatar = document.getElementById('sidebarAvatar');

                if (sidebarName) sidebarName.textContent = currentUser.nombre || 'Usuario';
                if (sidebarRole) sidebarRole.textContent = currentUser.rol || 'Rol';

                if (sidebarAvatar) {
                    const role = currentUser.rol || 'USER';
                    let iconClass = 'fas fa-user';
                    let bgColor = 'var(--primary)';

                    if (role === 'ADMIN') {
                        iconClass = 'fas fa-user-shield';
                        bgColor = '#ef4444';
                    } else if (role === 'MODERATOR') {
                        iconClass = 'fas fa-user-cog';
                        bgColor = '#f59e0b';
                    } else if (role === 'GUEST') {
                        iconClass = 'fas fa-user-tag';
                        bgColor = '#6b7280';
                    }

                    sidebarAvatar.style.background = bgColor;
                    sidebarAvatar.innerHTML = `<i class="${iconClass}"></i>`;
                }

                // Mobile/Settings Avatar Update
                const mobileAvatar = document.querySelector('.user-profile-section .user-avatar');
                if (mobileAvatar) {
                    const role = currentUser.rol || 'USER';
                    let iconClass = 'fas fa-user';
                    let bgColor = 'var(--primary)';

                    if (role === 'ADMIN') {
                        iconClass = 'fas fa-user-shield';
                        bgColor = '#ef4444';
                    } else if (role === 'MODERATOR') {
                        iconClass = 'fas fa-user-cog';
                        bgColor = '#f59e0b';
                    } else if (role === 'GUEST') {
                        iconClass = 'fas fa-user-tag';
                        bgColor = '#6b7280';
                    }

                    mobileAvatar.style.background = bgColor;
                    mobileAvatar.innerHTML = `<i class="${iconClass}"></i>`;
                }

                // Admin Nav Item Visibility - MOBILE VERSION
                const navAdmin = document.getElementById('navAdminItem');
                const btnAdminHeader = document.getElementById('openUserAdminBtn');

                if (navAdmin) {
                    if (currentUser.rol === 'ADMIN') navAdmin.style.display = 'flex';
                    else navAdmin.style.display = 'none';
                }

                if (btnAdminHeader) {
                    const adminDivider = document.getElementById('adminDivider');
                    if (currentUser.rol === 'ADMIN') {
                        btnAdminHeader.style.display = 'flex';
                        if (adminDivider) adminDivider.style.display = 'block';
                    } else {
                        btnAdminHeader.style.display = 'none';
                        if (adminDivider) adminDivider.style.display = 'none';
                    }
                }
            }

            // Update Client Badge (Hidden per request)
            if (clientBadge) clientBadge.style.display = 'none';

            // Disable Manual Mode if No Client Selected
            const hasClient = (typeof USER_SETTINGS !== 'undefined' && USER_SETTINGS.filterEnabled && USER_SETTINGS.selectedClient);
            const _btnManual = document.querySelector('.mode-option-card.btn-keyboard');

            if (_btnManual) {
                if (!hasClient) {
                    _btnManual.classList.add('card-disabled');
                    _btnManual.title = "Seleccione un cliente primero";
                } else {
                    _btnManual.classList.remove('card-disabled');
                    _btnManual.title = "Modo Manual";
                }
            }

            // Show/Hide History based on role (Not for USER)
            const navHistory = document.getElementById('navHistoryItem');
            if (navHistory) {
                if (typeof currentUser !== 'undefined' && currentUser) {
                    if (currentUser.rol !== 'USER') {
                        navHistory.style.display = 'flex';
                        navHistory.style.pointerEvents = 'auto';
                        navHistory.style.opacity = '1';
                    } else {
                        navHistory.style.display = 'none';
                    }
                } else {
                    navHistory.style.display = 'none';
                }
            }

            // Show/Hide Upload based on role (Admin/Moderator)
            const navUpload = document.getElementById('navUploadItem');
            if (navUpload) {
                if (typeof currentUser !== 'undefined' && currentUser) {
                    if (currentUser.rol === 'ADMIN' || currentUser.rol === 'MODERATOR') {
                        navUpload.style.display = 'flex';
                    } else {
                        navUpload.style.display = 'none';
                    }
                } else {
                    navUpload.style.display = 'none';
                }
            }
        };

        // Initial Update
        window.updateUserUI();

        // --- ELIMINADO: switchDesktopView (ahora mobile-only) ---

        // Mode Switchers
        function setMode(mode) {
            // Prevent entering Manual if disabled
            if (mode === 'MANUAL') {
                const hasClient = (typeof USER_SETTINGS !== 'undefined' && USER_SETTINGS.filterEnabled && USER_SETTINGS.selectedClient);
                if (!hasClient) {
                    alert("⚠️ Para usar el modo manual, DEBES seleccionar un cliente en Configuración.");
                    return;
                }
            }

            window.APP_MODE = mode;
            if (typeof saveAppMode === 'function') saveAppMode(mode);

            // Visual Updates (Grid Cards)
            document.querySelectorAll('.mode-option-card').forEach(b => b.classList.remove('active'));
            document.body.classList.remove('manual-mode-active');

            // Hide Trigger Btn by default
            const triggerBtn = document.getElementById('triggerCameraBtn');
            const triggerIcon = triggerBtn ? triggerBtn.querySelector('i') : null;

            if (triggerBtn) {
                triggerBtn.style.display = 'none';
                triggerBtn.className = 'input-action-btn';
            }
            if (barcodeInput) {
                barcodeInput.readOnly = false;
                barcodeInput.removeAttribute("inputmode");
                barcodeInput.removeAttribute("pattern");
                barcodeInput.value = "";
            }

            if (mode === 'PDA') {
                if (btnPDA) btnPDA.classList.add('active');
                if (barcodeInput) {
                    barcodeInput.placeholder = "Escanear con PDA (Laser)...";
                }
                if (inputIcon) {
                    inputIcon.className = "fa-solid fa-barcode";
                    inputIcon.title = USER_SETTINGS.persistentFocus ? "Foco Activo (Tocar para desactivar)" : "Foco Inactivo (Tocar para activar)";
                    inputIcon.style.color = USER_SETTINGS.persistentFocus ? "var(--primary)" : "var(--text-secondary)";
                }

                if (typeof window.updateStatusDisplay === 'function') {
                    window.updateStatusDisplay("MODO PDA: LISTO");
                }

                enforceFocusLoop();

            } else if (mode === 'MANUAL') {
                if (btnManual) btnManual.classList.add('active');
                document.body.classList.add('manual-mode-active');

                if (barcodeInput) {
                    barcodeInput.placeholder = "Tocar para ingresar LOTE...";
                    barcodeInput.readOnly = true;
                }
                if (inputIcon) {
                    inputIcon.className = "fas fa-keyboard";
                    inputIcon.title = "Tocar para abrir teclado";
                }

                if (typeof window.updateStatusDisplay === 'function') {
                    window.updateStatusDisplay("MODO MANUAL: ACTIVO");
                }

            } else if (mode === 'CAMERA') {
                if (btnCamera) btnCamera.classList.add('active');

                if (triggerBtn) {
                    triggerBtn.style.display = 'flex';
                    if (triggerIcon) triggerIcon.className = "fas fa-camera";
                    triggerBtn.title = "Abrir Cámara";
                }

                if (barcodeInput) {
                    barcodeInput.placeholder = "Tocar para escanear...";
                    barcodeInput.value = "";
                    barcodeInput.readOnly = true;
                }
                if (inputIcon) {
                    inputIcon.className = "fas fa-camera";
                    inputIcon.title = "Tocar para abrir cámara";
                }

                if (typeof window.updateStatusDisplay === 'function') {
                    window.updateStatusDisplay("MODO CÁMARA: LISTO");
                }
            }
        }

        // Interaction Handler
        function handleInputInteraction(e) {
            if (window.APP_MODE === 'PDA') {
                if (typeof USER_SETTINGS !== 'undefined') {
                    USER_SETTINGS.persistentFocus = !USER_SETTINGS.persistentFocus;

                    const msg = USER_SETTINGS.persistentFocus ? "Foco Persistente: ACTIVADO" : "Foco Persistente: DESACTIVADO";
                    if (typeof window.updateStatusDisplay === 'function') {
                        window.updateStatusDisplay(msg);
                    }

                    if (inputIcon) {
                        inputIcon.title = USER_SETTINGS.persistentFocus ? "Foco Activo (Tocar para desactivar)" : "Foco Inactivo (Tocar para activar)";
                        inputIcon.style.color = USER_SETTINGS.persistentFocus ? "var(--primary)" : "var(--text-secondary)";
                    }

                    if (USER_SETTINGS.persistentFocus && barcodeInput) barcodeInput.focus();
                }
            }
            else if (window.APP_MODE === 'MANUAL') {
                openKeypad();
            }
            else if (window.APP_MODE === 'CAMERA') {
                if (typeof QRScanner !== 'undefined' && window.qrScanner) {
                    window.qrScanner.openScanner();
                } else if (typeof openQRScanner === 'function') openQRScanner();
                else alert("Escáner no disponible");
            }
        }

        // Attach Interaction Listeners
        if (inputIcon) inputIcon.addEventListener('click', handleInputInteraction);
        if (barcodeInput) {
            barcodeInput.addEventListener('click', (e) => {
                if (window.APP_MODE === 'MANUAL' || window.APP_MODE === 'CAMERA') {
                    handleInputInteraction(e);
                }
            });
        }

        // Trigger Button Logic
        const triggerBtn = document.getElementById('triggerCameraBtn');
        if (triggerBtn) {
            triggerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (window.APP_MODE === 'CAMERA') {
                    if (typeof QRScanner !== 'undefined' && window.qrScanner) {
                        window.qrScanner.openScanner();
                    } else if (typeof openQRScanner === 'function') openQRScanner();
                    else alert("Escáner no disponible");
                }
            });
        }

        // Virtual Keypad Logic
        let keypadValue = "";

        function openKeypad() {
            keypadValue = "";
            updateKeypadDisplay();
            if (keypadModal) keypadModal.style.display = 'flex';
        }

        function closeKeypad() {
            if (keypadModal) keypadModal.style.display = 'none';
        }

        function updateKeypadDisplay() {
            if (keypadDisplay) keypadDisplay.textContent = keypadValue || "---";
        }

        function handleKeypadInput(key) {
            if (key === 'clear') {
                keypadValue = "";
            } else if (key === 'backspace') {
                keypadValue = keypadValue.slice(0, -1);
            } else if (key === 'enter') {
                submitKeypad();
                return;
            } else {
                if (keypadValue.length < 20) {
                    keypadValue += key;
                }
            }
            updateKeypadDisplay();
        }

        function submitKeypad() {
            if (!keypadValue) return;

            closeKeypad();

            if (barcodeInput) {
                barcodeInput.value = keypadValue;

                setTimeout(() => {
                    if (window.APP_MODE === 'MANUAL') {
                        const event = new KeyboardEvent('keydown', {
                            key: 'Enter',
                            code: 'Enter',
                            which: 13,
                            keyCode: 13,
                            bubbles: true,
                            cancelable: true
                        });
                        barcodeInput.dispatchEvent(event);
                    }
                }, 100);
            }
        }

        // Keypad Listeners
        if (keyBtns) {
            keyBtns.forEach(btn => {
                const handleInput = (e) => {
                    if (e.type === 'touchstart') {
                        e.preventDefault();
                    }
                    const key = btn.getAttribute('data-key');
                    handleKeypadInput(key);

                    btn.classList.add('active-key');
                    setTimeout(() => btn.classList.remove('active-key'), 100);
                };

                btn.addEventListener('touchstart', handleInput, { passive: false });
                btn.addEventListener('click', handleInput);
            });
        }
        if (closeKeypadBtn) closeKeypadBtn.addEventListener('click', closeKeypad);
        if (keypadOverlay) keypadOverlay.addEventListener('click', closeKeypad);

        // Listeners for mode buttons
        if (btnPDA) btnPDA.addEventListener('click', () => setMode('PDA'));
        if (btnManual) btnManual.addEventListener('click', () => setMode('MANUAL'));
        if (btnCamera) btnCamera.addEventListener('click', () => setMode('CAMERA'));

        // Logout Logic
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm("¿Cerrar sesión?")) {
                    if (typeof logout === 'function') logout();
                    else window.location.reload();
                }
            });
        }

        // 30 Min Inactivity Timeout
        let inactivityTimer;
        function resetInactivityTimer() {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                alert("Sesión cerrada por inactividad (30 min)");
                if (typeof logout === 'function') logout();
                else window.location.reload();
            }, 30 * 60 * 1000);
        }

        ['click', 'touchstart', 'mousemove', 'keydown'].forEach(evt =>
            document.addEventListener(evt, resetInactivityTimer)
        );
        resetInactivityTimer();

        // Persistent Focus Logic (Only for PDA Mode) - EXTREMADAMENTE INSISTENTE
        function enforceFocusLoop() {
            clearTimeout(focusTimer);

            if (window.APP_MODE !== 'PDA') return;
            if (typeof USER_SETTINGS !== 'undefined' && !USER_SETTINGS.persistentFocus) return;

            const barcodeInput = document.getElementById('barcode');
            if (!barcodeInput) return;

            const activeElement = document.activeElement;
            const isInput = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA';

            // Check for ANY open modal or overlay view
            const cameraModal = document.getElementById('cameraModal');
            const settingsModal = document.getElementById('settingsModal');
            const virtualKeypad = document.getElementById('virtualKeypadModal');
            const soportesModal = document.getElementById('soportesGridModal');
            const historyView = document.getElementById('historyView');
            const uploadSiesaView = document.getElementById('uploadSiesaView');
            const qrScannerModal = document.getElementById('qrScannerModal');
            const ih3Modal = document.getElementById('ih3Modal');
            const queueModal = document.getElementById('queueModal');
            const loginScreen = document.getElementById('login-screen');

            // Determine if flow is blocked by UI
            const isOverlayOpen =
                (cameraModal && getComputedStyle(cameraModal).display !== 'none') ||
                (settingsModal && getComputedStyle(settingsModal).display !== 'none') ||
                (virtualKeypad && getComputedStyle(virtualKeypad).display !== 'none') ||
                (soportesModal && getComputedStyle(soportesModal).display !== 'none') ||
                (historyView && getComputedStyle(historyView).display !== 'none') ||
                (uploadSiesaView && getComputedStyle(uploadSiesaView).display !== 'none') ||
                (qrScannerModal && getComputedStyle(qrScannerModal).display !== 'none') ||
                (ih3Modal && getComputedStyle(ih3Modal).display !== 'none') ||
                (queueModal && getComputedStyle(queueModal).display !== 'none') ||
                (loginScreen && getComputedStyle(loginScreen).display !== 'none');

            if (!isOverlayOpen) {
                // If main screen active and focus lost, FORCE IT BACK
                if (activeElement !== barcodeInput) {
                    barcodeInput.focus();
                }
            }

            // Extremely fast loop (100ms) for high responsiveness with Laser Scanners
            if (window.APP_MODE === 'PDA') {
                focusTimer = setTimeout(enforceFocusLoop, 100);
            }
        }

        // Immediate refocus on blur (Aggressive)
        if (barcodeInput) {
            barcodeInput.addEventListener('blur', (e) => {
                if (window.APP_MODE === 'PDA' && USER_SETTINGS.persistentFocus) {
                    // Wait slightly to allow legitimate clicks (like buttons)
                    setTimeout(() => {
                        // Check again if we should refocus by calling the smart loop
                        enforceFocusLoop();
                    }, 50);
                }
            });

            // Re-focus on click outside
            document.addEventListener('click', (e) => {
                if (window.APP_MODE === 'PDA' && USER_SETTINGS.persistentFocus) {
                    const target = e.target;
                    const isButton = target.tagName === 'BUTTON' || target.closest('button') || target.tagName === 'A';
                    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

                    if (!isButton && !isInput) {
                        setTimeout(() => enforceFocusLoop(), 10);
                    }
                }
            });
        }

        // Input Handling
        if (barcodeInput) {
            barcodeInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const val = barcodeInput.value.trim();
                    if (!val) return;

                    if (window.APP_MODE === 'MANUAL') {
                        e.preventDefault();

                        if (!USER_SETTINGS || !USER_SETTINGS.selectedClient) {
                            alert("Error: No has seleccionado cliente");
                            return;
                        }

                        const nit = (typeof CLIENTS_MAP !== 'undefined') ? CLIENTS_MAP[USER_SETTINGS.selectedClient] : null;

                        if (!nit) {
                            alert("Error: Cliente sin NIT configurado");
                            return;
                        }

                        const fullCode = `REC${val}-${nit}`;

                        barcodeInput.value = "";

                        if (typeof parseQRCode === 'function') {
                            const parts = parseQRCode(fullCode);
                            if (parts) {
                                processQRCodeParts(parts);
                            } else {
                                if (typeof showError === 'function') showError(fullCode, "Error formato generado manual");
                            }
                        }
                    }
                }
            });
        }

        // Start Default: Recobrar modo anterior o PDA por defecto
        const savedMode = (typeof getSavedAppMode === 'function') ? getSavedAppMode() : 'PDA';
        if (savedMode === 'MANUAL') {
            const hasClient = (typeof USER_SETTINGS !== 'undefined' && USER_SETTINGS.filterEnabled && USER_SETTINGS.selectedClient);
            if (hasClient) {
                setMode('MANUAL');
            } else {
                setMode('PDA');
            }
        } else {
            setMode(savedMode);
        }
    }

    // Manejar el cambio de orientación en dispositivos móviles
    window.addEventListener('orientationchange', function () {
        const cameraModal = document.getElementById('cameraModal');
        if (cameraModal && cameraModal.style.display === 'flex') {
            setTimeout(() => {
                document.activeElement.blur();
            }, 300);
        }
    });

    // Bloqueo de orientacion
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('portrait').catch(function (error) {
            console.log('Rotación no bloqueada:', error);
        });
    }

    // Prevenir gestos de zoom
    document.addEventListener('gesturestart', function (e) {
        e.preventDefault();
    });

    // Prevenir doble toque para zoom
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function (e) {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) e.preventDefault();
        lastTouchEnd = now;
    }, { passive: false });

    // Prevenir zoom con teclado (Ctrl + +/-)
    document.addEventListener('keydown', function (e) {
        if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '0')) {
            e.preventDefault();
        }
    });
}

// Inicialización de Lógica de Configuración
function initSettingsUI() {
    const minBtn = document.getElementById('openSettingsBtn');
    const modal = document.getElementById('settingsModal');
    const closeBtn = document.getElementById('closeSettingsBtn');
    const overlay = document.getElementById('settingsOverlay');

    const clientSelect = document.getElementById('clientSelect');

    // Toggles
    const focusToggle = document.getElementById('persistentFocusToggle');
    const filterToggle = document.getElementById('clientFilterToggle');
    const audioToggle = document.getElementById('audioFeedbackToggle');
    const clientContainer = document.getElementById('clientSelectContainer');
    const biometrySetting = document.getElementById('biometrySetting');
    const biometryToggle = document.getElementById('biometryToggle');
    const biometryDesc = document.getElementById('biometryDesc');

    if (!minBtn || !modal) return;

    // Poblar dropdown de clientes
    if (clientSelect && typeof CLIENTS_MAP !== 'undefined') {
        clientSelect.innerHTML = '<option value="">-- Seleccionar Cliente --</option>';
        Object.keys(CLIENTS_MAP).forEach(clientName => {
            const option = document.createElement('option');
            option.value = clientName;
            option.textContent = clientName;
            clientSelect.appendChild(option);
        });
    }

    // Load Settings to UI
    function loadToUI() {
        if (focusToggle) {
            focusToggle.checked = USER_SETTINGS.persistentFocus;
            focusToggle.disabled = false;
            if (focusToggle.parentElement) focusToggle.parentElement.style.opacity = "1";
        }
        if (filterToggle) filterToggle.checked = USER_SETTINGS.filterEnabled;
        if (audioToggle) audioToggle.checked = USER_SETTINGS.audioFeedback;
        if (clientSelect) clientSelect.value = USER_SETTINGS.selectedClient;

        if (clientContainer) {
            clientContainer.style.display = USER_SETTINGS.filterEnabled ? 'block' : 'none';
        }

        // Biometría
        if (biometrySetting && typeof BIOMETRY !== 'undefined') {
            BIOMETRY.isSupported().then(supported => {
                if (supported) {
                    biometrySetting.style.display = 'flex';
                    if (biometryToggle) biometryToggle.checked = BIOMETRY.isRegistered();
                    if (biometryDesc) {
                        biometryDesc.textContent = BIOMETRY.isRegistered() ?
                            "Activado (Huella/FaceID)" : "Desactivado";
                    }
                } else {
                    biometrySetting.style.display = 'none';
                }
            });
        }
    }

    // Expose for refresh
    window.refreshSettingsUI = loadToUI;

    // Open Modal
    function openModal(modal) {
        if (!modal) return;

        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);

        if (overlay && modal.id === 'settingsModal') overlay.style.display = 'block';
    }

    minBtn.addEventListener('click', () => {
        loadToUI();
        openModal(modal);
    });

    // Close Modal
    function closeModal() {
        modal.style.display = 'none';
        modal.classList.remove('active');
        overlay.style.display = 'none';

        const barcodeInput = document.getElementById('barcode');
        if (barcodeInput && USER_SETTINGS.persistentFocus) barcodeInput.focus();
    }

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    // Auto-guardado
    const updateSettings = () => {
        USER_SETTINGS.persistentFocus = focusToggle.checked;
        USER_SETTINGS.audioFeedback = audioToggle.checked;
        USER_SETTINGS.filterEnabled = filterToggle.checked;
        USER_SETTINGS.selectedClient = clientSelect.value;

        saveUserSettings();

        if (typeof window.updateStatusDisplay === 'function') {
            window.updateStatusDisplay();
        }

        if (typeof window.updateUserUI === 'function') window.updateUserUI();
    };

    if (focusToggle) focusToggle.addEventListener('change', updateSettings);
    if (audioToggle) audioToggle.addEventListener('change', updateSettings);

    if (filterToggle) {
        filterToggle.addEventListener('change', (e) => {
            if (clientContainer) clientContainer.style.display = e.target.checked ? 'block' : 'none';
            updateSettings();
        });
    }

    if (clientSelect) clientSelect.addEventListener('change', updateSettings);

    // Listener para Biometría
    if (biometryToggle) {
        biometryToggle.addEventListener('change', async (e) => {
            if (e.target.checked) {
                // Intentar registrar
                const result = await BIOMETRY.register();
                if (result.success) {
                    if (typeof window.updateStatusDisplay === 'function') {
                        window.updateStatusDisplay("BIOMETRÍA CONFIGURADA");
                    }
                } else {
                    alert(result.message);
                    e.target.checked = false; // Revertir
                }
            } else {
                // Eliminar registro
                if (confirm("¿Deseas desactivar el inicio de sesión biométrico en este dispositivo?")) {
                    BIOMETRY.remove();
                } else {
                    e.target.checked = true; // Revertir
                }
            }
            loadToUI(); // Refrescar textos
        });
    }
}

// Función global para manejar el colapsable
window.toggleClientReport = function (id) {
    const el = document.getElementById(id);
    const icon = document.getElementById('icon-' + id);
    if (!el || !icon) return;

    if (el.style.display === 'none') {
        el.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
        el.parentElement.classList.add('active');
    } else {
        el.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
        el.parentElement.classList.remove('active');
    }
};

/**
 * Obtiene la fecha más reciente que contiene entregas confirmadas
 */
function getLatestDeliveryDateVal() {
    try {
        const db = window.database || (typeof database !== 'undefined' ? database : null);
        if (!db || !Array.isArray(db)) return null;
        let maxDate = null;

        const robustParse = (str) => {
            if (!str) return null;
            if (str instanceof Date) return str;
            const s = String(str).trim();
            // Formato DD/MM/YYYY o DD-MM-YYYY
            const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
            const d = new Date(s);
            return isNaN(d.getTime()) ? null : d;
        };

        db.forEach(item => {
            if (!item) return;
            const subs = item.datosSiesa || (item.factura ? [item] : []);
            subs.forEach(f => {
                const conf = String(f.confirmacion || f.estado || f.estadoEntrega || "").toUpperCase();
                // Ser muy inclusivo con lo que se considera entregado
                if (conf.includes('ENTREGADO') || conf.includes('CONFIRMADO') || conf.includes('✅')) {
                    const d = robustParse(f.fechaEntrega || f.fecha);
                    if (d) {
                        if (!maxDate || d > maxDate) maxDate = d;
                    }
                }
            });
        });
        return maxDate;
    } catch (e) {
        console.warn("Error in getLatestDeliveryDateVal:", e);
        return null;
    }
}

/**
 * Muestra el Reporte Detallado (Modal Premium)
 * @param {number|Date|Array} target - Fecha YYYYMMDD, Objeto Date o Rango [Start, End]
 */
async function showDetailedReport(target, skipUpdate = false) {
    const modal = document.getElementById('reportDetailedModal');
    const contentArea = document.getElementById('reportContentArea');

    // Guardar el último target y asegurar tab por defecto
    window.lastReportTarget = target;
    if (!window.activeReportTab) window.activeReportTab = 'delivery';

    // Sincronizar UI de pestañas
    const tabBtns = document.querySelectorAll('.report-tab-btn');
    tabBtns.forEach(btn => {
        if (btn.getAttribute('data-tab') === window.activeReportTab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    const reportTitle = document.querySelector('#reportDetailedModal .report-title h2');
    const reportSubtitle = document.querySelector('#reportDetailedModal .report-title p');

    console.log("ShowDetailedReport iniciado:", target, "skipUpdate:", skipUpdate);

    if (!modal || !contentArea) return;

    // Detectar si el modal ya estaba abierto para evitar re-sincronizar datos de red
    const modalAlreadyOpen = modal.style.display === 'flex';

    modal.style.display = 'flex';

    // Sincronizar el DatePicker (Flatpickr)
    const syncPicker = (val) => {
        if (!window.reportDatePicker || !val) return;
        let pDate = [];
        if (typeof val === 'number') {
            const yr = Math.floor(val / 10000), mo = Math.floor((val % 10000) / 100) - 1, dy = val % 100;
            const d = new Date(yr, mo, dy);
            pDate = [d, d];
        } else if (val instanceof Date) {
            pDate = [val, val];
        } else if (Array.isArray(val)) {
            if (val.length === 1) pDate = [val[0], val[0]];
            else if (val.length === 2) pDate = [val[0], val[1]];
        }

        // Normalizar fechas y asegurar que FLAT PICKR reciba un array de 2 elementos para el modo range
        const normalizedDates = pDate.map((d, i) => {
            const date = new Date(d);
            if (i === 0) date.setHours(0, 0, 0, 0);
            else date.setHours(23, 59, 59, 999);
            return date;
        });

        // Forzar actualización visual del input
        window.reportDatePicker.setDate(normalizedDates, false);

        // Manualmente disparar el refresco del texto del input para asegurar visibilidad del rango
        const formatted = normalizedDates.map(d => window.reportDatePicker.formatDate(d, "d/m/Y")).join(" - ");
        if (window.reportDatePicker.input) {
            // Comparar solo fechas (sin horas) para saber si es un solo día
            const isSingleDay = normalizedDates[0].toLocaleDateString() === normalizedDates[1].toLocaleDateString();
            window.reportDatePicker.input.value = isSingleDay
                ? window.reportDatePicker.formatDate(normalizedDates[0], "d/m/Y")
                : formatted;
        }
    };
    syncPicker(target);

    // 1. Normalizar fechas de búsqueda con extremada precaución
    let startDate = null;
    let endDate = null;
    let dateDisplayString = "";

    try {
        if (Array.isArray(target) && target.length === 2) {
            startDate = new Date(target[0]); startDate.setHours(0, 0, 0, 0);
            endDate = new Date(target[1]); endDate.setHours(23, 59, 59, 999);
            dateDisplayString = `${startDate.toLocaleDateString('es-CO')} - ${endDate.toLocaleDateString('es-CO')}`;
        } else if (target instanceof Date) {
            startDate = new Date(target); startDate.setHours(0, 0, 0, 0);
            endDate = new Date(target); endDate.setHours(23, 59, 59, 999);
            dateDisplayString = startDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } else if (typeof target === 'number') {
            const yr = Math.floor(target / 10000);
            const mo = Math.floor((target % 10000) / 100) - 1;
            const dy = target % 100;
            startDate = new Date(yr, mo, dy, 0, 0, 0);
            endDate = new Date(yr, mo, dy, 23, 59, 59, 999);
            dateDisplayString = startDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } else {
            throw new Error("Formato de fecha desconocido");
        }
    } catch (e) {
        if (contentArea) contentArea.innerHTML = `<div style="text-align:center; padding:20px; color:var(--danger);"><i class="fas fa-exclamation-circle"></i> Error en formato de fecha para el reporte.</div>`;
        return;
    }

    // LÓGICA DE ACTUALIZACIÓN ASÍNCRONA:
    const dbExisting = window.database || (typeof database !== 'undefined' ? database : null);
    const hasData = dbExisting && Array.isArray(dbExisting) && dbExisting.length > 0;

    if (!skipUpdate && !modalAlreadyOpen) {
        if (!hasData) {
            // Si no hay datos, mostramos el loader premium y bloqueamos
            contentArea.innerHTML = `
                <div class="report-loading-container">
                    <div class="loader-premium">
                        <div class="loader-ring"></div>
                        <i class="fas fa-database"></i>
                    </div>
                    <h3 class="loading-text-premium">Sincronizando registros</h3>
                    <p class="loading-subtext-premium">Estamos procesando y analizando los últimos movimientos en tiempo real para generar su informe detallado.</p>
                </div>`;

            if (typeof silentReloadData === 'function') {
                try {
                    await silentReloadData();
                } catch (e) {
                    console.error("Error actualizando datos para reporte:", e);
                }
            }
        } else {
            // Si ya hay datos, cargamos en segundo plano para no bloquear
            if (typeof silentReloadData === 'function') {
                silentReloadData().then(() => {
                    // Solo refrescar si sigue abierto el mismo reporte/target
                    if (window.lastReportTarget === target) {
                        showDetailedReport(target, true);
                    }
                });
            }
        }
    } else if (!skipUpdate && modalAlreadyOpen) {
        // Si el modal ya está abierto y se cambia la fecha, mostramos un feedback ligero
        // pero cargamos los nuevos datos del servidor para asegurar exactitud
        contentArea.innerHTML = `<div style="text-align:center; padding:100px; color:var(--text-tertiary);"><i class="fas fa-sync fa-spin fa-2x"></i><p style="margin-top:15px; font-weight:600;">Sincronizando nuevos datos...</p></div>`;
        if (typeof silentReloadData === 'function') {
            await silentReloadData();
        }
    }

    const db = window.database || (typeof database !== 'undefined' ? database : null);

    if (!db || !Array.isArray(db) || db.length === 0) {
        contentArea.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-tertiary);"><i class="fas fa-database" style="font-size:3rem; margin-bottom:15px;"></i><p>Base de datos vacía o no disponible.</p></div>`;
        return;
    }

    if (reportTitle) reportTitle.textContent = "Resumen Diario";

    // Actualizar subtítulo con indicador de carga si aplica
    if (reportSubtitle) {
        if (!skipUpdate && !modalAlreadyOpen && hasData) {
            reportSubtitle.innerHTML = `${dateDisplayString} <span style="font-size:0.75rem; color:var(--primary); margin-left:12px; font-weight:700;"><i class="fas fa-sync fa-spin"></i> Sincronizando...</span>`;
        } else {
            reportSubtitle.textContent = dateDisplayString;
        }
    }

    // Sincronizar icono visual si el rango es de un solo día (resetear a 'day')
    const rDateIcon = document.querySelector('.report-date-selector i');
    if (rDateIcon && startDate && endDate && startDate.getTime() === endDate.getTime()) {
        rDateIcon.className = 'fas fa-calendar-day';
        rDateIcon.title = "Filtro: Día";
    }

    // Lógica de botón Admin para enviar informe
    const adminActions = document.getElementById('reportAdminActions');
    if (adminActions) {
        adminActions.innerHTML = '';
        const user = typeof currentUser !== 'undefined' ? currentUser : (window.auth && window.auth.user);
        if (user && user.rol === 'ADMIN') {
            const sendBtn = document.createElement('button');
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            sendBtn.className = 'btn-report-send';
            sendBtn.title = "Enviar informe a grupos";

            // Estilos premium consistentes con el sistema
            sendBtn.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                width: 44px;
                height: 44px;
                border: none;
                border-radius: 14px;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                font-size: 1.2rem;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
                position: relative;
                overflow: hidden;
            `;

            // Transición para el icono interno
            const icon = sendBtn.querySelector('i');
            if (icon) icon.style.transition = 'all 0.3s ease';

            sendBtn.onmouseover = () => {
                sendBtn.style.transform = 'translateY(-2px) scale(1.05)';
                sendBtn.style.boxShadow = '0 6px 15px rgba(16, 185, 129, 0.35)';
                if (icon) icon.style.transform = 'rotate(-10deg) scale(1.1)';
            };
            sendBtn.onmouseout = () => {
                sendBtn.style.transform = 'translateY(0) scale(1)';
                sendBtn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.25)';
                if (icon) icon.style.transform = 'rotate(0) scale(1)';
            };

            sendBtn.onclick = async (e) => {
                e.preventDefault();
                if (window.notificationManager && startDate && !sendBtn.disabled) {
                    const originalHTML = sendBtn.innerHTML;
                    const originalBg = sendBtn.style.background;

                    try {
                        // Estado: Cargando
                        sendBtn.disabled = true;
                        sendBtn.style.background = '#64748b'; // Color neutro mientras carga
                        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        sendBtn.style.transform = 'scale(0.95)';

                        const yyyy = startDate.getFullYear();
                        const mm = String(startDate.getMonth() + 1).padStart(2, '0');
                        const dd = String(startDate.getDate()).padStart(2, '0');
                        const dateStr = `${yyyy}-${mm}-${dd}`;

                        console.log("Sending summary for:", dateStr);

                        // Llamar al manager y esperar resultado
                        const result = await window.notificationManager.sendDailySummary(dateStr);

                        // Estado: Éxito
                        sendBtn.style.background = '#10b981';
                        sendBtn.innerHTML = '<i class="fas fa-check"></i>';

                        setTimeout(() => {
                            sendBtn.disabled = false;
                            sendBtn.innerHTML = originalHTML;
                            sendBtn.style.background = originalBg;
                            sendBtn.style.transform = 'scale(1)';
                        }, 3000);

                    } catch (err) {
                        console.error("Error enviando reporte:", err);
                        sendBtn.style.background = '#ef4444'; // Error
                        sendBtn.innerHTML = '<i class="fas fa-times"></i>';

                        setTimeout(() => {
                            sendBtn.disabled = false;
                            sendBtn.innerHTML = originalHTML;
                            sendBtn.style.background = originalBg;
                        }, 3000);
                    }
                }
            };
            adminActions.appendChild(sendBtn);
        }
    }

    // Si no es la pestaña de Delivery, mostrar contenido vacío/pendiente
    if (window.activeReportTab !== 'delivery') {
        const tabName = window.activeReportTab.charAt(0).toUpperCase() + window.activeReportTab.slice(1);
        contentArea.innerHTML = `
            <div style="text-align:center; padding:60px; color:var(--text-tertiary);">
                <i class="fas fa-hammer" style="font-size:3rem; margin-bottom:20px; opacity:0.3;"></i>
                <h3 style="color:var(--text-main); margin-bottom:10px;">Módulo ${tabName}</h3>
                <p>Esta sección está en desarrollo y estará disponible próximamente.</p>
                <div style="margin-top:20px; display:inline-block; padding:8px 16px; background:var(--primary-soft); color:var(--primary); border-radius:12px; font-weight:700; font-size:0.75rem;">
                    PRÓXIMAMENTE
                </div>
            </div>`;
        return;
    }

    const robustParse = (str) => {
        if (!str) return null;
        if (str instanceof Date) return str;
        const m = String(str).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2}))?/);
        if (m) {
            return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]), parseInt(m[4] || 0), parseInt(m[5] || 0));
        }
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
    };

    // 2. Filtrar deliveries en el rango
    const filteredDeliveries = [];
    db.forEach(item => {
        if (!item) return;
        const subs = item.datosSiesa || (item.factura ? [item] : []);
        subs.forEach(f => {
            if (!f) return;
            const conf = String(f.confirmacion || f.estado || f.estadoEntrega || "").toUpperCase();
            if (conf.includes('ENTREGADO') || conf.includes('CONFIRMADO') || conf.includes('✅')) {
                const dateObj = robustParse(f.fechaEntrega || f.fecha);
                // Comparar solo fechas (sin horas) para evitar errores de zona horaria
                if (dateObj) {
                    const dTime = new Date(dateObj).setHours(0, 0, 0, 0);
                    const sTime = new Date(startDate).setHours(0, 0, 0, 0);
                    const eTime = new Date(endDate).setHours(23, 59, 59, 999);
                    if (dTime >= sTime && dTime <= eTime) {
                        filteredDeliveries.push({ ...f, dateObj });
                    }
                }
            }
        });
    });

    if (filteredDeliveries.length === 0) {
        contentArea.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-tertiary);"><i class="fas fa-calendar-times" style="font-size:3rem; margin-bottom:15px;"></i><p>No se encontraron entregas en este periodo.</p></div>`;
        return;
    }

    // 3. Consolidar
    const clientGroups = {};
    let totalUnidades = 0;
    let totalValor = 0;
    const facturasUnicas = new Set();

    filteredDeliveries.forEach(d => {
        const client = d.cliente || "CLIENTE NO IDENTIFICADO";
        if (!clientGroups[client]) clientGroups[client] = [];
        clientGroups[client].push(d);
        facturasUnicas.add(d.factura);
        totalUnidades += parseFloat(d.cantidad) || 0;
        totalValor += parseFloat(d.valorBruto) || 0;
    });

    const formatCur = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v);

    let clientsHtml = "";
    Object.keys(clientGroups).sort().forEach(clientName => {
        const deliveries = clientGroups[clientName];
        deliveries.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

        let clientTotalUnidades = 0;
        let clientTotalValor = 0;
        const clientFacturasUnicas = new Set();

        deliveries.forEach(d => {
            clientTotalUnidades += parseFloat(d.cantidad) || 0;
            clientTotalValor += parseFloat(d.valorBruto) || 0;
            clientFacturasUnicas.add(d.factura);
        });

        const sessions = [];
        let currentSess = null;

        deliveries.forEach(d => {
            if (!currentSess || (d.dateObj.getTime() - currentSess.last.getTime() > 3600 * 1000)) {
                currentSess = { start: d.dateObj, last: d.dateObj, unidades: 0, facturas: new Set(), valor: 0 };
                sessions.push(currentSess);
            }
            currentSess.last = d.dateObj;
            currentSess.unidades += parseFloat(d.cantidad) || 0;
            currentSess.facturas.add(d.factura);
            currentSess.valor += parseFloat(d.valorBruto) || 0;
        });

        let sessionsHtml = "";
        sessions.forEach(s => {
            const startStr = s.start.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
            const endStr = s.last.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
            const dateStr = s.start.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });

            // Calcular duración
            const diffMs = s.last.getTime() - s.start.getTime();
            const mins = Math.floor(diffMs / 60000);
            let durationStr = "";
            if (mins > 0) {
                const hrs = Math.floor(mins / 60);
                const rm = mins % 60;
                durationStr = hrs > 0 ? `${hrs}h ${rm}m` : `${mins} min`;
            }

            const timeDisplay = startStr === endStr ? startStr : `${startStr} - ${endStr}`;
            const durationBadge = durationStr ? `<span style="background:var(--primary-soft); color:var(--primary); padding:2px 8px; border-radius:8px; font-size:0.65rem; margin-left:8px; font-weight:700;">${durationStr}</span>` : "";

            sessionsHtml += `
                <div class="session-item">
                    <div class="session-time">
                        <i class="far fa-clock"></i> ${timeDisplay} ${durationBadge}
                        <span style="font-size:0.7rem; color:var(--text-tertiary); margin-left:5px;">(${dateStr})</span>
                    </div>
                    <div class="session-details">
                        <div class="sess-stat"><span class="v">${s.facturas.size}</span><span class="l">Facturas</span></div>
                        <div class="sess-stat"><span class="v">${s.unidades.toLocaleString('es-CO')}</span><span class="l">Unidades</span></div>
                        <div class="sess-stat"><span class="v">${formatCur(s.valor)}</span><span class="l">Valor</span></div>
                    </div>
                </div>`;
        });

        // Generar ID único para el colapsable
        const clientId = `client-${clientName.replace(/\s+/g, '-').toLowerCase()}`;

        clientsHtml += `
            <div class="client-report-card">
                <div class="client-header" onclick="toggleClientReport('${clientId}')">
                    <div class="client-info">
                        <div class="client-name"><i class="fas fa-building"></i> <span>${clientName}</span></div>
                        <div class="client-summary-row">
                            <span><i class="fas fa-file-invoice"></i> ${clientFacturasUnicas.size} Facs</span>
                            <span><i class="fas fa-boxes-stacked"></i> ${clientTotalUnidades.toLocaleString('es-CO')} Unds</span>
                            <span><i class="fas fa-hand-holding-dollar"></i> ${formatCur(clientTotalValor)}</span>
                        </div>
                    </div>
                    <i class="fas fa-chevron-down toggle-icon" id="icon-${clientId}"></i>
                </div>
                <div class="client-sessions" id="${clientId}" style="display: none;">
                    ${sessionsHtml}
                </div>
            </div>`;
    });

    contentArea.innerHTML = `
        <div class="report-stats-grid">
            <div class="report-stat-card"><i class="fas fa-file-invoice"></i><span class="val">${facturasUnicas.size}</span><span class="lab">Facturas</span></div>
            <div class="report-stat-card"><i class="fas fa-boxes-stacked"></i><span class="val">${totalUnidades.toLocaleString('es-CO')}</span><span class="lab">Unidades</span></div>
            <div class="report-stat-card"><i class="fas fa-hand-holding-dollar"></i><span class="val">${formatCur(totalValor)}</span><span class="lab">Valor Total</span></div>
        </div>
        <div class="report-section-title"><i class="fas fa-list-ul"></i> Detalle por Clientes</div>
        <div class="clients-list">${clientsHtml}</div>
        <div style="margin-top: 30px; padding: 20px; text-align: center; color: var(--text-tertiary); font-size: 0.75rem;">
            <i class="fas fa-info-circle"></i> Las entregas se agrupan automáticamente si tienen más de 1 hora de diferencia.
        </div>
    `;
}

// --- LÓGICA DEL MENÚ DE ENCABEZADO ---
function toggleHeaderMenu() {
    const menu = document.getElementById('headerDropdownMenu');
    if (menu) menu.classList.toggle('active');
}

// Listener global para cerrar el menú al hacer clic fuera
document.addEventListener('click', function (e) {
    const container = document.querySelector('.header-menu-container');
    const menu = document.getElementById('headerDropdownMenu');
    if (container && !container.contains(e.target) && menu && menu.classList.contains('active')) {
        menu.classList.remove('active');
    } else if (e.target.closest('.dropdown-item') && menu) {
        menu.classList.remove('active');
    }
});