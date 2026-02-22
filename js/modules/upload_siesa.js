
// CONFIGURACIÓN
const UPLOAD_API_URL = 'https://script.google.com/macros/s/AKfycbz2nUpMXcqkHZwv3qDzC4dEPw60AFeLtRh_viUOD6rupYc-CaWqNslHxtINDsszOG3D/exec';

// ESTADO
let selectedUploadFiles = [];
let isUploadProcessing = false;

// INICIALIZAR (Llamado cuando se cambia a esta vista)
function initUploadSiesa() {
    console.log('Upload Module iniciado');
    setupUploadEventListeners();
    setupUploadDragAndDrop();
    testUploadConnection();
}

function setupUploadEventListeners() {
    const btnSelect = document.getElementById('btnSelectFiles');
    const fileInput = document.getElementById('fileInputUpload'); // Renamed ID to avoid conflict
    const btnProcess = document.getElementById('btnProcessUpload'); // Renamed ID
    const btnClear = document.getElementById('btnClearAllUpload'); // Renamed ID
    const uploadArea = document.getElementById('uploadArea');

    if (btnSelect && fileInput) {
        // Use onclick to avoid multiple event listeners scaling up
        btnSelect.onclick = function (e) {
            e.preventDefault();
            console.log("Button Select Files clicked");
            fileInput.click();
        };

        fileInput.onchange = handleUploadFileSelect;
    }

    // Make the entire area clickable too, just in case, but avoid double trigger if clicking button
    if (uploadArea && fileInput) {
        uploadArea.onclick = function (e) {
            // Trigger if not clicking button or input
            if (e.target !== btnSelect && !btnSelect.contains(e.target) && e.target !== fileInput) {
                console.log("Upload Area clicked");
                fileInput.click();
            }
        };
    }

    if (btnProcess) {
        btnProcess.onclick = processUploadFiles;
    }

    if (btnClear) {
        btnClear.onclick = clearAllUploadFiles;
    }
}

function setupUploadDragAndDrop() {
    const dropzone = document.getElementById('uploadArea');
    if (!dropzone) return;

    // We can use ondragover, etc. to avoid cloneNode complexity
    dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.classList.add('active');
    };

    dropzone.ondragleave = () => {
        dropzone.classList.remove('active');
    };

    dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.classList.remove('active');
        handleUploadDroppedFiles(e.dataTransfer.files);
    };
}

// PROBAR CONEXIÓN
async function testUploadConnection() {
    const statusCard = document.getElementById('statusCardUpload');
    const statusIcon = document.getElementById('statusIconUpload');
    const statusTitle = document.getElementById('statusTitleUpload');
    const statusMessage = document.getElementById('statusMessageUpload');

    if (!statusCard) return;

    try {
        console.log('🔌 Probando conexión con la API de Carga...');

        const response = await fetch(UPLOAD_API_URL);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            // Conexión exitosa
            statusCard.className = 'status-card connected fade-in';
            if (statusIcon) statusIcon.className = 'fas fa-check-circle text-success'; // Using FontAwesome classes
            if (statusTitle) statusTitle.textContent = 'Conectado al servidor';
            if (statusMessage) statusMessage.textContent = 'API lista para recibir archivos';

            console.log('Conexión establecida con API de Carga');
        } else {
            throw new Error(data.message || 'Error en la respuesta');
        }

    } catch (error) {
        console.error('Error de conexión:', error);

        if (statusCard) statusCard.className = 'status-card disconnected fade-in';
        if (statusIcon) statusIcon.className = 'fas fa-times-circle text-danger';
        if (statusTitle) statusTitle.textContent = 'Error de conexión';
        if (statusMessage) statusMessage.textContent = 'No se pudo conectar con el servidor';
    }
}

// MANEJAR ARCHIVOS SELECCIONADOS
function handleUploadFileSelect(e) {
    handleUploadDroppedFiles(e.target.files);
    e.target.value = '';
}

function handleUploadDroppedFiles(fileList) {
    const files = Array.from(fileList);
    console.log(`${files.length} archivo(s) seleccionado(s)`);

    files.forEach(file => {
        // Validar tipo
        const fileType = getUploadFileType(file.name);
        if (!fileType) {
            alert(`"${file.name}" no es un archivo válido.\nSolo se aceptan archivos .csv y .xlsx`);
            return;
        }

        // Validar tamaño (10MB máximo)
        if (file.size > 10 * 1024 * 1024) {
            alert(`"${file.name}" excede el límite de 10MB.`);
            return;
        }

        // Evitar duplicados
        const isDuplicate = selectedUploadFiles.some(f =>
            f.name === file.name && f.size === file.size
        );

        if (isDuplicate) {
            alert(`"${file.name}" ya está en la lista`);
            return;
        }

        // Agregar archivo
        selectedUploadFiles.push({
            file: file,
            name: file.name,
            type: fileType,
            size: file.size,
            status: 'waiting'
        });
    });

    updateUploadFileList();
    updateUploadProcessButton();
}

function getUploadFileType(fileName) {
    const extension = fileName.toLowerCase().split('.').pop();
    if (extension === 'csv') return 'csv';
    if (extension === 'xlsx') return 'xlsx';
    return null;
}

function formatUploadFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ACTUALIZAR LISTA DE ARCHIVOS
function updateUploadFileList() {
    const container = document.getElementById('filesContainerUpload');
    const list = document.getElementById('fileListUpload');
    const count = document.getElementById('filesCountUpload');

    if (!container || !list) return;

    // Limpiar lista
    list.innerHTML = '';

    if (selectedUploadFiles.length === 0) {
        container.style.display = 'none';
        return;
    }

    // Mostrar contenedor
    container.style.display = 'block';
    if (count) count.textContent = `${selectedUploadFiles.length} archivo(s)`;

    // Agregar cada archivo a la lista
    selectedUploadFiles.forEach((file, index) => {
        const fileElement = document.createElement('div');
        fileElement.className = 'file-item fade-in';

        // Icon based on type
        const iconClass = file.type === 'csv' ? 'fa-file-csv' : 'fa-file-excel';

        fileElement.innerHTML = `
            <div class="file-icon ${file.type}">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-meta">
                    <i class="fas fa-hdd me-1"></i>${formatUploadFileSize(file.size)}
                    <span class="mx-2">•</span>
                    <i class="fas fa-clock me-1"></i>${new Date().toLocaleTimeString()}
                </div>
            </div>
            <div class="file-status">
                <span class="status-badge status-${file.status}">
                    <i class="fas ${getUploadStatusIcon(file.status)}"></i>
                    ${getUploadStatusText(file.status)}
                </span>
                <button class="btn-sm btn-link text-danger ms-2" style="background:none; border:none; cursor:pointer;" onclick="removeUploadFile(${index})" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        list.appendChild(fileElement);
    });
}

function getUploadStatusIcon(status) {
    const icons = {
        'waiting': 'fa-clock',
        'processing': 'fa-sync fa-spin',
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle'
    };
    return icons[status] || 'fa-question-circle';
}

function getUploadStatusText(status) {
    const texts = {
        'waiting': 'En espera',
        'processing': 'Procesando',
        'success': 'Completado',
        'error': 'Error'
    };
    return texts[status] || status;
}

// REMOVER ARCHIVO
window.removeUploadFile = function (index) {
    selectedUploadFiles.splice(index, 1);
    updateUploadFileList();
    updateUploadProcessButton();
};

// LIMPIAR TODOS LOS ARCHIVOS
function clearAllUploadFiles() {
    if (selectedUploadFiles.length === 0) return;

    if (confirm(`¿Estás seguro de que quieres eliminar todos los archivos (${selectedUploadFiles.length})?`)) {
        selectedUploadFiles = [];
        updateUploadFileList();
        updateUploadProcessButton();
    }
}

// ACTUALIZAR BOTÓN DE PROCESAR
function updateUploadProcessButton() {
    const btn = document.getElementById('btnProcessUpload');
    if (!btn) return;

    const hasFiles = selectedUploadFiles.length > 0;
    const hasWaitingFiles = selectedUploadFiles.some(f => f.status === 'waiting');

    btn.disabled = !hasFiles || !hasWaitingFiles || isUploadProcessing;
}

// PROCESAR ARCHIVOS
// PROCESAR ARCHIVOS
async function processUploadFiles() {
    if (isUploadProcessing || selectedUploadFiles.length === 0) return;

    isUploadProcessing = true;
    updateUploadProcessButton();

    const btn = document.getElementById('btnProcessUpload');
    const spinner = document.getElementById('processingSpinnerUpload');

    // Mostrar spinner
    if (spinner) spinner.style.display = 'inline-block';
    if (btn) btn.querySelector('span').textContent = 'PROCESANDO...';

    // Ocultar resultados anteriores
    const resultsSection = document.getElementById('resultsSectionUpload');
    if (resultsSection) resultsSection.style.display = 'none';

    try {
        console.log('Iniciando procesamiento de archivos...');

        // 1. Leer contenido de archivos
        const filesData = [];

        for (let i = 0; i < selectedUploadFiles.length; i++) {
            const file = selectedUploadFiles[i];

            if (file.status === 'waiting') {
                // Actualizar estado visual
                selectedUploadFiles[i].status = 'processing';
                updateUploadFileList();

                try {
                    const content = await readUploadFileContent(file.file, file.type);
                    // Match SIESA.html payload structure
                    filesData.push({
                        fileName: file.name,
                        fileType: file.type,
                        content: content
                    });
                } catch (readError) {
                    console.error(`Error leyendo ${file.name}:`, readError);
                    selectedUploadFiles[i].status = 'error';
                    selectedUploadFiles[i].error = "Error de lectura local";
                }
            }
        }

        updateUploadFileList();

        if (filesData.length === 0) {
            throw new Error('No hay archivos válidos para procesar');
        }

        // 2. Enviar a API (USANDO FormData como SIESA.html)
        console.log(`Enviando ${filesData.length} archivo(s) al servidor...`);
        const formData = new FormData();
        formData.append('action', 'uploadFiles');
        formData.append('datos', JSON.stringify(filesData));

        const response = await fetch(UPLOAD_API_URL, {
            method: 'POST',
            body: formData
            // Note: No mode: 'no-cors' here, presuming backend supports CORS like original SIESA.html
        });

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Respuesta del servidor:', result);

        if (result.success) {
            // Update individual file statuses based on server response
            if (result.fileResults) {
                result.fileResults.forEach(res => {
                    const f = selectedUploadFiles.find(sf => sf.name === res.fileName);
                    if (f) f.status = res.status;
                });
            } else {
                // Fallback if no detailed results
                selectedUploadFiles.forEach(f => {
                    if (f.status === 'processing') f.status = 'success';
                });
            }

            updateUploadFileList();
            showUploadResults(result.data || result); // Pass full result object/data
        } else {
            throw new Error(result.message || 'Error desconocido del servidor');
        }

    } catch (error) {
        console.error('Error en procesamiento:', error);

        // Marcar error en los que se estaban procesando
        selectedUploadFiles.forEach(f => {
            if (f.status === 'processing') {
                f.status = 'error';
            }
        });
        updateUploadFileList();
        alert('Hubo un error al procesar los archivos: ' + error.message);
    } finally {
        isUploadProcessing = false;
        if (spinner) spinner.style.display = 'none';
        if (btn) btn.querySelector('span').textContent = 'PROCESAR ARCHIVOS';
        updateUploadProcessButton();
    }
}

// LEER CONTENIDO DEL ARCHIVO (Matches SIESA.html logic)
function readUploadFileContent(file, fileType) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                if (fileType === 'csv') {
                    // Para CSV, devolver texto plano
                    resolve(e.target.result);
                } else {
                    // Para XLSX, convertir a JSON array USANDO SHEETJS
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    resolve(jsonData);
                }
            } catch (error) {
                reject(new Error(`Error procesando ${fileType.toUpperCase()}: ${error.message}`));
            }
        };

        reader.onerror = () => {
            reject(new Error('Error leyendo el archivo'));
        };

        if (fileType === 'csv') {
            reader.readAsText(file, 'UTF-8');
        } else {
            reader.readAsArrayBuffer(file);
        }
    });
}

function showUploadResults(data) {
    const section = document.getElementById('resultsSectionUpload');
    const content = document.getElementById('resultsContentUpload');

    if (!section || !content) return;

    // Normalize data if it came from legacy call (e.g. showUploadResults(5, 0))
    let resultData = data;
    if (typeof data === 'number') {
        resultData = { successful: arguments[0], failed: arguments[1] };
    }

    let html = `
        <div class="summary-card">
            <h4 style="margin:0; font-weight:700; color:var(--primary); margin-bottom: 1rem;"><i class="fas fa-clipboard-check me-2"></i>Resumen del Proceso</h4>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value">${resultData.totalFiles || (resultData.successful + resultData.failed) || 0}</div>
                    <div class="stat-label">Total Archivos</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value text-success">${resultData.successful || 0}</div>
                    <div class="stat-label">Exitosos</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" style="color:var(--danger);">${resultData.failed || 0}</div>
                    <div class="stat-label">Fallidos</div>
                </div>
            </div>
            <p class="mt-3 mb-0" style="font-size: 0.9em; color: var(--text-secondary);">
                <i class="fas fa-info-circle me-1"></i>
                <strong>${resultData.message || 'Procesamiento completado'}</strong>
            </p>
        </div>
    `;

    // Detalles por archivo
    if (resultData.fileResults && resultData.fileResults.length > 0) {
        html += '<h6 class="fw-semibold mb-3" style="margin-top:20px; font-weight:600;">Detalles por archivo:</h6>';

        resultData.fileResults.forEach(fileResult => {
            const icon = fileResult.status === 'success' ? 'fa-check-circle text-success' : 'fa-exclamation-circle text-danger';
            const bgColor = fileResult.status === 'success' ? '#f0fdf4' : '#fef2f2';
            const borderLeft = fileResult.status === 'success' ? '4px solid #10b981' : '4px solid #ef4444';

            html += `
                <div class="file-result fade-in" style="background:${bgColor}; border-left:${borderLeft}; padding:12px; margin-bottom:10px; border-radius:8px;">
                    <div style="display:flex; align-items:start; gap:10px;">
                        <i class="fas ${icon} fs-5" style="margin-top:3px;"></i>
                        <div style="flex:1;">
                            <div style="font-weight:600;">${fileResult.fileName}</div>
                            <small style="color:var(--text-secondary);">${fileResult.message}</small>
                        </div>
                    </div>
                    ${fileResult.details ? `
                        <div style="display:flex; gap:10px; margin-top:8px; margin-left:26px;">
                            <span style="background:rgba(255,255,255,0.6); padding:2px 8px; border-radius:4px; font-size:0.8rem;">
                                <i class="fas fa-list-check me-1"></i>
                                ${fileResult.details.totalRecords || 0} registros
                            </span>
                            <span style="background:rgba(255,255,255,0.6); padding:2px 8px; border-radius:4px; font-size:0.8rem;">
                                <i class="fas fa-plus-circle me-1"></i>
                                ${fileResult.details.newRecords || 0} nuevos
                            </span>
                        </div>
                    ` : ''}
                </div>
            `;
        });
    }

    content.innerHTML = html;
    section.style.display = 'block';

    // Scroll to results
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
