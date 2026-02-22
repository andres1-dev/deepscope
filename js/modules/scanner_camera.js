// Función para abrir la cámara
function abrirCamara(factura) {
    // Guardar datos para uso posterior
    currentDocumentData = {
        factura: factura,
        btnElement: document.querySelector(`.delivery-btn[data-factura="${factura}"]`)
    };

    // Mostrar la cámara
    mostrarCamara();
}

// Función para mostrar la cámara
function mostrarCamara() {
    const cameraModal = document.getElementById('cameraModal');
    const cameraFeed = document.getElementById('cameraFeed');
    const photoPreview = document.getElementById('photoPreview');
    const takePhotoBtn = document.getElementById('takePhotoBtn');
    const dummyInput = document.getElementById('dummyInput');

    // Ocultar teclado al abrir la cámara
    if (typeof barcodeInput !== 'undefined' && barcodeInput) {
        barcodeInput.blur();
    }
    document.activeElement.blur();

    // Forzar que no se muestre el teclado
    if (dummyInput) {
        dummyInput.readOnly = true;
        dummyInput.setAttribute('inputmode', 'none');
    }

    // Prevenir que cualquier elemento obtenga el foco mientras la cámara está abierta
    if (typeof preventKeyboardTimer !== 'undefined') {
        if (preventKeyboardTimer) clearInterval(preventKeyboardTimer);
    }

    preventKeyboardTimer = setInterval(() => {
        if (document.activeElement && document.activeElement.tagName === 'INPUT' && document.activeElement.id !== 'dummyInput') {
            document.activeElement.blur();
        }
    }, 100);

    // Mostrar modal y ocultar vista previa
    cameraModal.style.display = 'flex';
    photoPreview.style.display = 'none';
    cameraFeed.style.display = 'block';

    // VERIFICACIÓN DE STREAM EXISTENTE
    if (typeof cameraStream !== 'undefined' && cameraStream && cameraStream.active) {
        const tracks = cameraStream.getVideoTracks();
        if (tracks.length > 0 && tracks[0].readyState === 'live') {
            // Reactivar tracks
            tracks.forEach(track => track.enabled = true);
            cameraFeed.srcObject = cameraStream;
            cameraFeed.play().catch(e => console.error("Error al reanudar video:", e));
            configurarUIComun();
            return;
        }
    }

    // Configurar cámara - usar cámara trasera por defecto
    navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
        }
    })
        .then(stream => {
            cameraStream = stream;
            cameraFeed.srcObject = stream;
            configurarUIComun();
        })
        .catch(error => {
            console.error("Error al acceder a la cámara:", error);
            alert("No se pudo acceder a la cámara. Por favor permite el acceso.");
            cerrarCamara();
        });
}

function configurarUIComun() {
    const takePhotoBtn = document.getElementById('takePhotoBtn');
    const cameraModal = document.getElementById('cameraModal');

    // Configurar botones
    takePhotoBtn.innerHTML = '<i class="fas fa-camera"></i> Tomar Foto';
    takePhotoBtn.disabled = false;
    takePhotoBtn.onclick = capturarFoto;
    document.getElementById('uploadStatus').style.display = 'none';

    // Agregar listener para prevenir el comportamiento predeterminado de los clics
    cameraModal.addEventListener('touchstart', preventDefaultBehavior, { passive: false });
    cameraModal.addEventListener('touchmove', preventDefaultBehavior, { passive: false });
}

// Prevenir comportamiento predeterminado para evitar enfoque de teclado
function preventDefaultBehavior(e) {
    if (e.target.tagName !== 'BUTTON') {
        e.preventDefault();
    }
}

// Función para capturar foto
function capturarFoto() {
    const cameraFeed = document.getElementById('cameraFeed');
    const photoPreview = document.getElementById('photoPreview');
    const takePhotoBtn = document.getElementById('takePhotoBtn');

    // Crear canvas temporal
    const canvas = document.createElement('canvas');
    canvas.width = cameraFeed.videoWidth;
    canvas.height = cameraFeed.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);

    // Obtener blob de la imagen
    canvas.toBlob(blob => {
        photoBlob = blob;

        // Mostrar vista previa
        photoPreview.src = URL.createObjectURL(blob);
        photoPreview.style.display = 'block';
        cameraFeed.style.display = 'none';

        // Cambiar botón para subir foto
        takePhotoBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Subir Foto';
        takePhotoBtn.onclick = subirFoto;
    }, 'image/jpeg', 0.85);
}

// Función para subir foto (ahora usa la cola)
async function subirFoto() {
    if (!currentDocumentData || !photoBlob) {
        console.error("No hay datos disponibles para subir");
        return;
    }

    const { factura, btnElement } = currentDocumentData;
    const takePhotoBtn = document.getElementById('takePhotoBtn');
    const uploadStatus = document.getElementById('uploadStatus');

    // Deshabilitar botón y mostrar estado de carga
    takePhotoBtn.disabled = true;
    takePhotoBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Preparando...';
    uploadStatus.style.display = 'flex';
    uploadStatus.innerHTML = '<i class="fas fa-spinner fa-pulse"></i> Preparando foto...';

    try {
        // Convertir blob a base64
        const base64Data = await blobToBase64(photoBlob);
        const nombreArchivo = `${factura}_${Date.now()}.jpg`.replace(/[^a-zA-Z0-9\-]/g, '');

        // Extraer datos específicos de la factura
        const facturaData = getFacturaData(factura);
        if (!facturaData) {
            throw new Error("No se pudieron obtener los datos de la factura");
        }

        // Crear objeto de trabajo para la cola con TODOS los datos específicos
        const jobData = {
            ...facturaData,
            fotoBase64: base64Data,
            fotoNombre: nombreArchivo,
            fotoTipo: 'image/jpeg',
            timestamp: new Date().toISOString(),
            usuario: (typeof currentUser !== 'undefined' && currentUser && currentUser.nombre) ? currentUser.nombre : 'Desconocido'
        };

        // Agregar a la cola
        uploadQueue.addJob({
            type: 'photo',
            data: jobData,
            factura: factura,
            btnElementId: btnElement ? btnElement.getAttribute('data-factura') : null
        });

        // Actualizar UI
        uploadStatus.innerHTML = '<i class="fas fa-check-circle"></i> En cola para subir';
        takePhotoBtn.innerHTML = '<i class="fas fa-check"></i> En cola';

        // Cerrar cámara después de un breve retraso
        setTimeout(cerrarCamara, 1500);

    } catch (error) {
        console.error("Error al preparar foto:", error);
        uploadStatus.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error al preparar';
        takePhotoBtn.disabled = false;
        takePhotoBtn.innerHTML = '<i class="fas fa-redo"></i> Reintentar';
    }
}

// Función para extraer datos específicos de la factura seleccionada
function getFacturaData(factura) {
    const facturaContainer = document.querySelector(`.siesa-item button[data-factura="${factura}"]`)?.closest('.siesa-item');
    if (!facturaContainer) return null;

    const data = {
        documento: '',
        lote: '',
        referencia: '',
        cantidad: 0,
        factura: factura,
        nit: ''
    };

    // Extraer datos del contenedor principal (documento)
    const mainContainer = document.querySelector('.result-item');
    if (mainContainer) {
        // Buscar documento
        const headers = mainContainer.querySelectorAll('.col-header');
        headers.forEach(header => {
            if (header.textContent.includes('Documento')) {
                const val = header.nextElementSibling;
                if (val && val.classList.contains('json-value')) {
                    data.documento = val.textContent.trim();
                }
            }
            if (header.textContent.includes('Lote')) {
                const val = header.nextElementSibling;
                if (val && val.classList.contains('json-value')) {
                    data.lote = val.textContent.trim();
                }
            }
        });
    }

    // Extraer datos específicos de la factura
    const rows = facturaContainer.querySelectorAll('.mini-detail, .result-row'); // Adaptar a ambos estilos si es necesario
    rows.forEach(row => {
        const header = row.querySelector('.col-header, .mini-label')?.textContent.trim();
        const value = row.querySelector('.json-value, .mini-value')?.textContent.trim();

        if (!header || !value) return;

        if (header.includes('Referencia')) data.referencia = value;
        else if (header.includes('Cantidad')) data.cantidad = parseFloat(value) || 0;
        else if (header.includes('NIT') || header.includes('Nit')) data.nit = value;
    });

    return data;
}

// Función para cerrar la cámara
function cerrarCamara() {
    // MODIFICADO: Solo deshabilitar tracks en lugar de detenerlos para mantener permisos
    if (typeof cameraStream !== 'undefined' && cameraStream) {
        cameraStream.getVideoTracks().forEach(track => {
            track.enabled = false;
        });
        // NO seteamos cameraStream = null
    }

    const cameraModal = document.getElementById('cameraModal');

    // Eliminar los listeners para prevenir comportamiento predeterminado
    cameraModal.removeEventListener('touchstart', preventDefaultBehavior);
    cameraModal.removeEventListener('touchmove', preventDefaultBehavior);

    // Limpiar el timer de prevención de teclado
    if (preventKeyboardTimer) {
        clearInterval(preventKeyboardTimer);
        preventKeyboardTimer = null;
    }

    cameraModal.style.display = 'none';
    photoBlob = null;

    // Restauramos el foco normal después de cerrar la cámara
    setTimeout(() => {
        const barcodeInput = document.getElementById('barcode');
        if (barcodeInput) barcodeInput.focus();
    }, 300);
}

// Configurar botón cancelar
document.getElementById('cancelCaptureBtn')?.addEventListener('click', cerrarCamara);

// Función actualizada para procesar entregas
function procesarEntrega(documento, lote, referencia, cantidad, factura, nit, btnElement) {
    // Verificar si la entrega no tiene factura y manejarlo apropiadamente
    const esSinFactura = !factura || factura.trim() === "";

    // Guardar todos los datos específicos de la factura
    currentDocumentData = {
        documento: documento,
        lote: lote || '',
        referencia: referencia || '',
        cantidad: parseFloat(cantidad) || 0,
        factura: factura || '', // Mantener factura como está, vacía si no hay factura
        nit: nit || '',
        btnElement: btnElement,
        esSinFactura: esSinFactura // Marcamos si es sin factura para tratamiento especial después
    };

    // Crear un input de tipo file temporal para capturar fotos
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.capture = 'environment'; // Usar cámara trasera por defecto

    // Agregar evento para procesar la imagen cuando se capture
    fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
            procesarImagenCapturada(e.target.files[0]);
        }
    });

    // Simular clic para abrir la cámara del dispositivo
    fileInput.click();
}

// Nueva función para procesar la imagen capturada
function procesarImagenCapturada(archivo) {
    if (!archivo) {
        console.error("No se seleccionó ninguna imagen");
        return;
    }

    // Mostrar estado de carga
    //statusDiv.innerHTML = '<i class="fas fa-image"></i> Procesando imagen...';

    const lector = new FileReader();
    lector.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            // Crear canvas para procesamiento
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Establecer dimensiones manteniendo proporciones pero limitando tamaño
            let width = img.width;
            let height = img.height;

            // Redimensionar si la imagen es muy grande (para optimizar)
            const maxDimension = CONFIG.MAX_IMAGE_SIZE || 1200;
            if (width > height && width > maxDimension) {
                height = (height / width) * maxDimension;
                width = maxDimension;
            } else if (height > width && height > maxDimension) {
                width = (width / height) * maxDimension;
                height = maxDimension;
            }

            canvas.width = width;
            canvas.height = height;

            // Dibujar imagen en el canvas
            ctx.drawImage(img, 0, 0, width, height);

            // Aplicar marca de agua
            aplicarMarcaDeAgua(ctx, width, height);

            // Convertir a Blob
            canvas.toBlob(function (blob) {
                photoBlob = blob;

                // Opcionalmente mostrar una vista previa
                //mostrarVistaPrevia(URL.createObjectURL(blob));

                // Subir la imagen procesada a la cola
                subirFotoCapturada(blob);
            }, 'image/jpeg', 0.85);
        };
        img.src = e.target.result;
    };
    lector.readAsDataURL(archivo);
}

// Función para aplicar marca de agua CON FORMATO DE FECHA ESTANDARIZADO
function aplicarMarcaDeAgua(ctx, width, height) {
    // Área para la marca de agua (aumentar altura para caber todo)
    const marcaHeight = Math.floor(height / 5);

    // Fondo degradado
    const gradient = ctx.createLinearGradient(0, height - marcaHeight, 0, height);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(0.2, "rgba(0, 0, 0, 0.6)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.8)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, height - marcaHeight, width, marcaHeight);

    // Fuente y estilo
    const fontFamily = "Inter, sans-serif";
    const fontSize = Math.max(10, Math.floor(width / 70)); // Tamaño base
    const fontSizeTitle = fontSize * 2; // Título al doble
    ctx.fillStyle = "white";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";

    // Márgenes y espaciado
    const marginLeft = Math.floor(width / 20);
    const lineSpacing = Math.floor(fontSize * 1.6);
    let posY = height - Math.floor(marcaHeight * 0.1);

    // 1. Fecha y hora - FORMATO ESTÁNDAR (DD/MM/YYYY HH:MM:SS)
    ctx.font = `500 ${fontSize}px ${fontFamily}`;
    const now = new Date();
    const fecha = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    ctx.fillText(fecha, marginLeft, posY);
    posY -= lineSpacing;

    // 2. Usuario (Nuevo)
    let userName = "Usuario";
    // currentData se define en auth.js al loguear
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.nombre) {
        userName = currentUser.nombre;
    }
    ctx.fillText(`${userName}`, marginLeft, posY);
    posY -= lineSpacing;

    // 3. Datos técnicos (FACTURA | LOTE | REF | CANT)
    const datos = [];
    if (currentDocumentData) {
        if (currentDocumentData.factura) datos.push(currentDocumentData.factura);
        if (currentDocumentData.lote) datos.push(currentDocumentData.lote);
        if (currentDocumentData.referencia) datos.push(currentDocumentData.referencia);
        if (currentDocumentData.cantidad) datos.push(currentDocumentData.cantidad);
    }

    if (datos.length > 0) {
        ctx.fillText(datos.join(" | "), marginLeft, posY);
        posY -= lineSpacing;
    }

    // 4. Título: App Name (más grande)
    ctx.font = `700 ${fontSizeTitle}px ${fontFamily}`;
    ctx.fillText(CONFIG.APP_NAME, marginLeft, posY);
}

// Función para mostrar brevemente una vista previa (opcional)
function mostrarVistaPrevia(imgUrl) {
    // Crear elemento para vista previa temporal
    let preview = document.createElement('div');
    preview.style.position = 'fixed';
    preview.style.top = '50%';
    preview.style.left = '50%';
    preview.style.transform = 'translate(-50%, -50%)';
    preview.style.zIndex = '10000';
    preview.style.backgroundColor = 'rgba(0,0,0,0.8)';
    preview.style.padding = '10px';
    preview.style.borderRadius = '8px';
    preview.style.boxShadow = '0 0 20px rgba(0,0,0,0.5)';
    preview.style.maxWidth = '90%';
    preview.style.maxHeight = '70%';

    let img = document.createElement('img');
    img.src = imgUrl;
    img.style.width = '100%';
    img.style.height = 'auto';
    img.style.maxHeight = '70vh';
    img.style.objectFit = 'contain';
    img.style.borderRadius = '4px';

    let mensaje = document.createElement('div');
    mensaje.textContent = 'Procesando imagen...';
    mensaje.style.color = 'white';
    mensaje.style.textAlign = 'center';
    mensaje.style.padding = '10px';

    preview.appendChild(img);
    preview.appendChild(mensaje);
    document.body.appendChild(preview);

    // Eliminar después de 3 segundos
    setTimeout(() => {
        document.body.removeChild(preview);
    }, 3000);
}

// Función para subir la foto capturada
async function subirFotoCapturada(blob) {
    if (!currentDocumentData || !blob) {
        console.error("No hay datos disponibles para subir");
        statusDiv.innerHTML = '<span style="color: var(--danger)">Error: No hay datos para subir</span>';
        return;
    }

    const { documento, lote, referencia, cantidad, factura, nit, btnElement, esSinFactura } = currentDocumentData;

    try {
        // Convertir blob a base64
        const base64Data = await blobToBase64(blob);
        const nombreArchivo = `${factura}_${Date.now()}.jpg`.replace(/[^a-zA-Z0-9\-]/g, '');

        // Crear objeto de trabajo para la cola
        const jobData = {
            documento: documento,
            lote: lote,
            referencia: referencia,
            cantidad: cantidad,
            factura: factura,
            nit: nit,
            fotoBase64: base64Data,
            fotoNombre: nombreArchivo,
            fotoTipo: 'image/jpeg',
            timestamp: new Date().toISOString(),
            esSinFactura: esSinFactura, // Pasar esta propiedad a la cola
            usuario: (typeof currentUser !== 'undefined' && currentUser && currentUser.nombre) ? currentUser.nombre : 'Desconocido'
        };

        // Agregar a la cola
        uploadQueue.addJob({
            type: 'photo',
            data: jobData,
            factura: factura,
            btnElementId: btnElement ? btnElement.getAttribute('data-factura') : null,
            esSinFactura: esSinFactura
        });

        // Actualizar botón de entrega si existe
        if (btnElement) {
            // Reemplazar boton con icono de procesando (UNIFICADO & CONTEXTUALIZADO)
            const processingIcon = document.createElement('div');
            processingIcon.className = 'status-icon-only processing contextual';
            processingIcon.innerHTML = '<div class="premium-spinner"></div>';
            // Mantener data-factura para que upload-queue pueda encontrarlo si es necesario
            processingIcon.setAttribute('data-factura', factura);

            if (btnElement.parentNode) {
                btnElement.parentNode.replaceChild(processingIcon, btnElement);
            }

            // ACTUALIZACIÓN VISUAL TARJETA: Cambiar a AZUL (Procesando)
            const card = processingIcon.closest('.siesa-item');
            if (card) {
                card.classList.remove('status-pendiente', 'status-nofacturado', 'status-entregado');
                card.classList.add('status-processing');
            }
        }

        // --- NUEVO: Actualizar base de datos local y refrescar vista para mostrar miniatura ---
        if (typeof database !== 'undefined' && Array.isArray(database)) {
            // Crear URL temporal para mostrar inmediatamente
            const tempImageUrl = URL.createObjectURL(blob);

            // Buscar y actualizar en la base de datos local
            let found = false;
            for (const doc of database) {
                if (doc.datosSiesa && Array.isArray(doc.datosSiesa)) {
                    const item = doc.datosSiesa.find(s => s.factura === factura);
                    if (item) {
                        item.confirmacion = "ENTREGADO"; // Asumimos entregado localmente mientras carga
                        item.Ih3 = tempImageUrl; // Asignar URL temporal
                        found = true;

                        // Si estamos viendo este documento actualmente, refrescar la vista
                        if (currentDocumentData && doc.documento === currentDocumentData.documento) {
                            // Usar setTimeout para asegurar que la UI se actualice después de los cambios del botón
                            setTimeout(() => {
                                if (typeof displayFullResult === 'function') {
                                    // Clonar el documento para no mutar la base de datos con el filtro visual
                                    const filteredDoc = JSON.parse(JSON.stringify(doc));

                                    // Aplicar el MISMO filtro que en lector_qr.js
                                    if (currentDocumentData.nit && filteredDoc.datosSiesa) {
                                        const scanNitDigits = currentDocumentData.nit.replace(/\D/g, '');

                                        filteredDoc.datosSiesa = filteredDoc.datosSiesa.filter(siesa => {
                                            const siesaNitDigits = siesa.nit ? siesa.nit.toString().replace(/\D/g, '') : '';
                                            return siesaNitDigits.includes(scanNitDigits) || scanNitDigits.includes(siesaNitDigits);
                                        });
                                    }

                                    // Necesitamos pasar qrParts, intentamos obtenerlo del contexto global o reconstruirlo
                                    const mockQrParts = {
                                        documento: doc.documento,
                                        nit: currentDocumentData.nit
                                    };
                                    // Si existe currentQRParts global, usarlo
                                    const qrPartsToUse = (typeof currentQRParts !== 'undefined') ? currentQRParts : mockQrParts;

                                    // PRESERVAR ESTADO DE EXPASIÓN
                                    // Capturar estado actual antes de renderizar
                                    const expandedState = {};
                                    document.querySelectorAll('.siesa-item').forEach((el, idx) => {
                                        if (el.classList.contains('expanded')) {
                                            expandedState[idx] = true;
                                        }
                                    });

                                    displayFullResult(filteredDoc, qrPartsToUse);

                                    // RESTAURAR ESTADO DE EXPANSIÓN
                                    // Solo expandir si el usuario lo tenía abierto previamente
                                    Object.keys(expandedState).forEach(idx => {
                                        const itemEl = document.getElementById(`siesa-item-${idx}`);
                                        if (itemEl) {
                                            itemEl.classList.remove('collapsed');
                                            itemEl.classList.add('expanded');
                                        }
                                    });
                                }
                            }, 100);
                        }
                        break;
                    }
                }
                if (found) break;
            }
        }
        // ----------------------------------------------------------------------------------

        // Si es sin factura, actualizamos el botón inmediatamente después
        if (esSinFactura && btnElement) {
            setTimeout(() => {
                // Recuperar iconos y tarjeta nuevamente ya que el scope anterior se cerró
                const processingIcon = document.querySelector(`.status-icon-only.processing[data-factura="${factura}"]`);
                const card = processingIcon ? processingIcon.closest('.siesa-item') : null;

                if (processingIcon) {
                    processingIcon.className = 'status-icon-only success';
                    processingIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
                }

                if (card) {
                    card.classList.remove('status-processing');
                    card.classList.add('status-entregado');
                }

                // Actualizar estado global
                actualizarEstado('processed', '<i class="fas fa-check-circle"></i> ENTREGA SIN FACTURA CONFIRMADA');
            }, 2000);
        }

        // Reproducir sonido de éxito
        playSuccessSound();

    } catch (error) {
        console.error("Error al preparar foto:", error);
        statusDiv.innerHTML = '<span style="color: var(--danger)">Error al procesar la imagen</span>';

        // Reproducir sonido de error
        playErrorSound();
    }
}

// Función auxiliar para convertir Blob a Base64
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // El resultado incluye "data:image/jpeg;base64,", así que lo separamos
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Función para eliminar una entrega (foto)
// Función para eliminar una entrega (foto)
async function eliminarEntrega(factura) {
    if (!factura) return;

    if (!confirm(`¿Estás seguro de que quieres eliminar la entrega de la factura ${factura} de la base de datos? Esta acción es irreversible.`)) {
        return;
    }

    // 1. Mostrar estado de "Eliminando..." en la UI
    // Buscar contenedores afectados para mostrar spinner ROJO
    const elements = document.querySelectorAll(`[data-factura="${factura}"]`);
    elements.forEach(el => {
        const statusContainer = el.closest('.status-actions');
        // Usar clase 'deleting' e ICONO UNIFICADO (premium-spinner) y CONTEXTUAL (sin fondo)
        // El color rojo lo hereda por la clase 'deleting'
        const spinnerHtml = '<div class="status-icon-only deleting contextual"><div class="premium-spinner"></div></div>';

        if (statusContainer) {
            statusContainer.innerHTML = spinnerHtml;
        } else if (el.classList.contains('status-actions')) {
            el.innerHTML = spinnerHtml;
        }

        // TRANSICIÓN VISUAL: Tarjeta ROJA + PULSO durante eliminación
        // Usamos la clase CSS .status-deleting en lugar de estilos inline
        const card = el.closest('.siesa-item');
        if (card) {
            // Remover otros estados visuales para evitar conflictos
            card.classList.remove('status-entregado', 'status-pendiente', 'status-processing');
            card.classList.add('status-deleting');

            // Limpiar estilos inline previos si existen para que mande la clase CSS
            card.style.background = '';
            card.style.borderColor = '';

            const solapa = card.querySelector('.status-solapa');
            if (solapa) {
                solapa.style.background = '';
                solapa.style.borderColor = '';
            }
        }
    });

    try {
        // 2. Enviar petición de eliminación al GAS
        const formData = new FormData();
        formData.append('action', 'delete');
        formData.append('factura', factura);
        formData.append('token', sessionStorage.getItem('token') || '');

        // Usar fetch para llamar al API
        // Nota: API_URL_POST está definida en configuracion.js
        const response = await fetch(API_URL_POST, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || "Error al eliminar en el servidor");
        }

        // 3. Éxito: Actualizar base de datos local y UI

        // A. Remover de la cola local si existe
        if (window.uploadQueue) {
            const initialLen = window.uploadQueue.queue.length;
            window.uploadQueue.queue = window.uploadQueue.queue.filter(job => job.factura !== factura);
            if (window.uploadQueue.queue.length !== initialLen) {
                window.uploadQueue.saveQueue();
                window.uploadQueue.updateQueueUI();
            }
        }

        // B. Actualizar base de datos local en memoria
        let updated = false;
        let foundDoc = null;
        let foundSiesa = null;

        if (typeof database !== 'undefined' && Array.isArray(database)) {
            for (const doc of database) {
                if (doc.datosSiesa && Array.isArray(doc.datosSiesa)) {
                    const item = doc.datosSiesa.find(s => s.factura === factura);
                    if (item) {
                        item.confirmacion = "PENDIENTE"; // Reset a pendiente
                        updated = true;
                        foundDoc = doc;
                        foundSiesa = item;
                    }
                }
            }

            if (updated && typeof saveDatabaseToCache === 'function') {
                saveDatabaseToCache(database);
            }
        }

        // C. Restaurar botón de cámara en la UI
        const elementsToUpdate = document.querySelectorAll(`[data-factura="${factura}"]`);

        elementsToUpdate.forEach(el => {
            // Determinar el contenedor padre correcto para el reemplazo
            let container = el.closest('.status-actions');
            if (!container && el.classList.contains('status-actions')) container = el;
            if (!container) container = el.closest('.status-icon-only')?.parentNode; // Fallback

            if (container) {
                const card = container.closest('.siesa-item');
                if (card) {
                    card.classList.remove('status-entregado', 'status-deleting');
                    card.classList.add('status-pendiente');
                    // Limpiar estilos inline forzados anteriormente
                    card.style.background = '';
                    card.style.borderColor = '';

                    // Limpiar también la solapa
                    const solapa = card.querySelector('.status-solapa');
                    if (solapa) {
                        solapa.style.background = '';
                        solapa.style.borderColor = '';
                        // Asegurar que no quede animación residual
                        solapa.style.animation = '';
                    }
                }

                if (foundDoc && foundSiesa) {
                    // Recrear botón de cámara con la lógica correcta
                    // Nota: el onclick debe llamar a procesarEntrega con los parametros correctos
                    // Usamos foundDoc y foundSiesa que obtuvimos de la base de datos local

                    const btnHtml = `<button class="action-btn-mini btn-scan" 
                        data-factura="${foundSiesa.factura}" 
                        onclick="event.stopPropagation(); procesarEntrega('${foundDoc.documento}', '${foundSiesa.lote || foundDoc.lote}', '${foundSiesa.referencia}', '${foundSiesa.cantidad}', '${foundSiesa.factura}', '${foundSiesa.nit || ''}', this)">
                        <i class="fas fa-camera"></i>
                     </button>`;

                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = btnHtml;
                    const newBtn = tempDiv.firstElementChild;

                    // Reemplazar el contenedor de acciones por el botón de cámara
                    if (container.parentNode) {
                        container.parentNode.replaceChild(newBtn, container);
                    }
                }
            }
        });

        // Notificación de éxito silenciada por petición del usuario
        /*
        if (window.uploadQueue && typeof window.uploadQueue.showNotification === 'function') {
            window.uploadQueue.showNotification('Registro eliminado correctamente', 'success');
        } else {
            alert('Registro eliminado correctamente');
        }
        */

    } catch (error) {
        console.error("Error al eliminar entrega:", error);

        // Revertir UI a estado de error o mantener el estado anterior
        if (window.uploadQueue && typeof window.uploadQueue.showNotification === 'function') {
            window.uploadQueue.showNotification('Error al eliminar: ' + error.message, 'error');
        } else {
            alert('Error al eliminar: ' + error.message);
        }

        // Restaurar botón de eliminar (estado entregado)
        const elements = document.querySelectorAll(`[data-factura="${factura}"]`);
        elements.forEach(el => {
            let container = el.closest('.status-actions'); // Si aun existe (aunque lo cambiamos a spinner)
            if (container || el.classList.contains('status-actions')) {
                const target = container || el;
                target.innerHTML = `
                    <button class="action-btn-mini btn-delete contextual" style="background: transparent; box-shadow: none;" onclick="event.stopPropagation(); eliminarEntrega('${factura}')" title="Eliminar entrega">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                    <div class="status-icon-only success"><i class="fas fa-check-circle"></i></div>
                `;
            }
        });
    }
}
