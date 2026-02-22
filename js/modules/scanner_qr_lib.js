// Lógica de Lector QR y Procesamiento de Códigos

// Función para analizar el código QR
function parseQRCode(code) {
    // Buscamos un formato como "REC58101-805027653"
    const regex = /^([A-Za-z0-9-]+)-([0-9]+)$/;
    const match = code.match(regex);

    if (match) {
        return {
            documento: match[1],
            nit: match[2]
        };
    }

    return null;
}

// Procesa las partes del código QR y muestra los resultados
function processQRCodeParts(parts) {
    const { documento, nit } = parts;

    // VALIDACIÓN DE FILTRO DE CLIENTE
    if (typeof USER_SETTINGS !== 'undefined' && USER_SETTINGS.filterEnabled && USER_SETTINGS.selectedClient) {
        const requiredNIT = typeof CLIENTS_MAP !== 'undefined' ? CLIENTS_MAP[USER_SETTINGS.selectedClient] : null;

        if (requiredNIT) {
            const scanNitDigits = nit.replace(/\D/g, '');
            const requiredNitDigits = requiredNIT.replace(/\D/g, '');

            // Verificar coincidencia (permitiendo variaciones menores como dígito de verificación)
            // Si ninguno contiene al otro, entonces son diferentes
            if (!scanNitDigits.includes(requiredNitDigits) && !requiredNitDigits.includes(scanNitDigits)) {
                showError(`${documento}`, `⚠️ ENTREGA BLOQUEADA<br>El paquete no pertenece a ${USER_SETTINGS.selectedClient}`);
                playErrorSound();
                return;
            }
        }
    }

    // Buscar un registro que coincida con el documento
    const result = database.find(item =>
        item.documento && item.documento.toString() === documento
    );

    if (result) {
        // Filtramos los datosSiesa para mostrar solo los que coinciden con el NIT
        const filteredItem = JSON.parse(JSON.stringify(result));

        if (filteredItem.datosSiesa && Array.isArray(filteredItem.datosSiesa)) {
            // Filtramos por NIT en lugar de por cliente
            filteredItem.datosSiesa = filteredItem.datosSiesa.filter(siesa => {
                // Extraemos solo dígitos del NIT para comparar (por si acaso viene con formato)
                const siesaNitDigits = siesa.nit ? siesa.nit.toString().replace(/\D/g, '') : '';
                const scanNitDigits = nit.replace(/\D/g, '');

                return siesaNitDigits.includes(scanNitDigits) || scanNitDigits.includes(siesaNitDigits);
            });

            displayFullResult(filteredItem, parts);
            playSuccessSound();
        } else {
            displayFullResult(filteredItem, parts);
            playSuccessSound();
        }
    } else {
        showError(`${documento}-${nit}`, "Documento no encontrado en la base de datos");
        playErrorSound();
    }
}

// Inicializar eventos de QR (llamado desde inicio.js)
function initQRListeners() {
    const barcodeInput = document.getElementById('barcode');
    const statusDiv = document.getElementById('status');

    // Detectar escaneo
    if (barcodeInput) {
        barcodeInput.addEventListener('input', function () {
            const code = this.value.trim();

            // Si estamos en modo manual, ignorar el listener de escaneo automático
            // La validación se hace al presionar Enter en initPDAModes
            if (typeof window.APP_MODE !== 'undefined' && window.APP_MODE === 'MANUAL') {
                return;
            }

            if (code.length < 5) return; // Un código válido debe tener al menos 5 caracteres

            // Analizar el formato del código: DOCUMENTO-NIT
            if (window.isProcessingScan) return; // Prevent loop
            window.isProcessingScan = true;

            // Analizar el formato del código: DOCUMENTO-NIT
            const parts = parseQRCode(code);

            if (parts) {
                currentQRParts = parts; // Guardar las partes para uso posterior
                const startTime = Date.now();

                // Clear input immediately to prevent re-trigger
                this.value = '';

                processQRCodeParts(parts);
                const searchTime = Date.now() - startTime;

                if (statusDiv) {
                    statusDiv.className = 'processed';
                    statusDiv.textContent = `REGISTRO PROCESADO (${searchTime}ms)`;
                }
            } else {
                showError(code, "Formato de código QR no válido. Use formato: DOCUMENTO-NIT");
                playErrorSound();
                if (statusDiv) statusDiv.textContent = `FORMATO INVÁLIDO`;

                setTimeout(() => {
                    this.value = '';
                }, 500);
            }

            // Reset processing flag after a delay
            setTimeout(() => {
                window.isProcessingScan = false;
                this.focus();
            }, 1000);
        });
    }

    const qrFloatingBtn = document.getElementById('qrScannerFloatingBtn');
    if (qrFloatingBtn) {
        qrFloatingBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            // Verificar si hay escáner QR disponible
            if (typeof Html5Qrcode !== 'undefined' && window.qrScanner) {
                window.qrScanner.scanQRCode();
            } else if (typeof openQRScanner === 'function') {
                openQRScanner();
            } else {
                // Alternativa: abrir cámara para foto y usar OCR (si implementado)
                alert('Escáner QR no disponible. Usa el campo de texto para ingresar manualmente.');
            }
        });
    }
}
