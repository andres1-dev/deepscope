/* novedad-publica.js - Formulario público de novedades */

// ═══════════════════════════════════════════════════════════════════════════
// PREVENIR CACHÉ - FORZAR DATOS FRESCOS SIEMPRE
// ═══════════════════════════════════════════════════════════════════════════

// Limpiar todo el caché al cargar
if ('caches' in window) {
    caches.keys().then(function(names) {
        for (let name of names) caches.delete(name);
    });
}

// Limpiar localStorage y sessionStorage relacionado con novedades
const keysToRemove = [];
for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('novedad') || key.includes('cache') || key.includes('sb_'))) {
        keysToRemove.push(key);
    }
}
keysToRemove.forEach(key => localStorage.removeItem(key));

// Limpiar sessionStorage
sessionStorage.clear();

// ═══════════════════════════════════════════════════════════════════════════

// Nota: Estos valores se usan como fallback, lo ideal es que vengan de CONFIG
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvcXN1cnh4eGF1ZG51dHN5ZGxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3MjExMDUsImV4cCI6MjA5MTI5NzEwNX0.yKcRgTad3cb2otQ7wtjkRETj3P-3THB9v8csluebALg';
const SUPABASE_STORAGE_BUCKET = 'novedades-imagenes';

const INSUMOS_OPCIONES = ['ETIQUETA','PLACA','PLASTIFLECHA','TRAZABILIDAD','ELASTICO','ARGOLLA','TENSOR','FRAMILON','TRANSFER','MARQUILLA','CIERRE','CORDON','HILADILLA','HERRAJE','HEBILLA','ABROCHADURA','APLIQUE','BOTON','GANCHO','PUNTERAS','COPA','ENCAJE','VARILLA','ENTRETELA','VELCRO','OJALES','REMACHES'];
const CORTE_OPCIONES = ['PIEZAS', 'SESGO', 'ENTRETELA'];
const TELAS_OPCIONES = ['ROTOS', 'MANCHAS', 'HILOS', 'MAREADA', 'TONO', 'SE DESTIÑE', 'SE ROMPE'];

const FormState = {
    currentStep: 1,
    opData: null,
    selectedFile: null,
    isSubmitting: false
};

const ValidationRules = {
    op: { pattern: /^[0-9]+$/, message: 'El número de OP solo debe contener números' },
    descripcion: { minLength: 10, maxLength: 1000, message: 'La descripción debe tener entre 10 y 1000 caracteres' },
    imagen: { maxSize: 5 * 1024 * 1024, allowedTypes: ['image/jpeg', 'image/png', 'image/gif'], message: 'El archivo debe ser una imagen JPG, PNG o GIF menor a 5MB' }
};

let CURVAS_CACHE = {};

document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
    attachEventListeners();
});

function initializeForm() {
    updateStepIndicator(1);
    document.getElementById('plantaIdInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('btnBuscarPlanta').click();
        }
    });
}

function attachEventListeners() {
    document.getElementById('btnBuscarPlanta').addEventListener('click', buscarPlanta);
    document.getElementById('btnVolverIdentificacion').addEventListener('click', volverIdentificacion);
    
    document.getElementById('area').addEventListener('change', handleAreaChange);
    document.getElementById('tipoNovedad').addEventListener('change', handleTipoNovedadChange);
    document.getElementById('descripcion').addEventListener('input', validateDescripcion);
    document.getElementById('imagen').addEventListener('change', handleFileSelect);
    
    // Asignar funciones a botones dinámicos
    document.getElementById('btnAddInsumo').onclick = () => agregarFilaInsumo();
    document.getElementById('btnAddCorte').onclick = () => agregarFilaCorte();
    document.getElementById('btnAddTela').onclick = () => agregarFilaTela();
    document.getElementById('btnAddCodigo').onclick = () => agregarFilaCodigo();
    
    // Validación y actualización automática del correo
    const correoInput = document.getElementById('correoInput');
    if (correoInput) {
        correoInput.addEventListener('input', validateCorreoInput);
        correoInput.addEventListener('blur', actualizarEmailPlanta);
    }
    
    const fileLabel = document.querySelector('.file-upload-label');
    if (fileLabel) {
        fileLabel.addEventListener('dragover', handleDragOver);
        fileLabel.addEventListener('dragleave', handleDragLeave);
        fileLabel.addEventListener('drop', handleFileDrop);
    }
    
    document.getElementById('btnVolverBusqueda').addEventListener('click', volverSeleccionOP);
    document.getElementById('btnConfirmarProducto').addEventListener('click', confirmarProducto);
    document.getElementById('btnVolverConfirmacion').addEventListener('click', volverConfirmacion);
    document.getElementById('btnContinuar').addEventListener('click', continuarAdicional);
    document.getElementById('btnVolverDetalles').addEventListener('click', volverDetalles);
    document.getElementById('btnNuevoReporte').addEventListener('click', iniciarNuevoReporte);
    document.getElementById('novedadForm').addEventListener('submit', handleSubmit);
}

async function buscarPlanta() {
    const plantaIdInput = document.getElementById('plantaIdInput');
    const plantaId = plantaIdInput.value.trim();
    const btn = document.getElementById('btnBuscarPlanta');
    
    if (!plantaId) {
        showError(plantaIdInput, document.getElementById('opError'), 'La identificación es obligatoria');
        plantaIdInput.focus();
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div><span>Buscando...</span>';
    
    try {
        const url = `${CONFIG.FUNCTIONS_URL}/upload-public-image?plantaId=${encodeURIComponent(plantaId)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: 'Error de conexión' }));
            throw new Error(err.message || `Error ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            document.getElementById('nombrePlantaDisplay').textContent = result.planta;
            renderizarTarjetasOP(result.ops);
            
            // Guardar datos de email si vienen
            FormState.needsEmail = result.needsEmail;
            FormState.plantaName = result.planta;
            
            document.getElementById('seccionBusqueda').classList.add('hidden');
            document.getElementById('seccionSeleccionOP').classList.remove('hidden');
            hideError(plantaIdInput, document.getElementById('opError'));
        }
    } catch (error) {
        console.error('[buscarPlanta] 💥 ERROR:', error);
        Swal.fire({ icon: 'error', title: 'Identificación Inválida', text: error.message });
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-search"></i><span>Buscar Mis OPs</span>';
    }
}

function renderizarTarjetasOP(ops) {
    const container = document.getElementById('opCardsContainer');
    container.innerHTML = '';
    
    if (!ops || ops.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #5f6368; background: #f8f9fa; border-radius: 24px; border: 2px dashed #dadce0;">
                <div style="background: #ffffff; width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                    <i class="fas fa-search-minus" style="font-size: 2rem; color: #667eea;"></i>
                </div>
                <h3 style="color: #202124; margin-bottom: 10px; font-weight: 600;">Sin OPs Pendientes</h3>
                <p style="max-width: 300px; margin: 0 auto;">No encontramos órdenes de producción activas para tu planta en este momento.</p>
            </div>
        `;
        return;
    }
    
    ops.forEach((op, index) => {
        const card = document.createElement('div');
        card.className = 'op-card';
        card.style.animationDelay = `${index * 0.05}s`;
        
        card.innerHTML = `
            <div class="op-card-header">
                <span class="op-card-number">OP #${op.OP}</span>
                <span class="op-card-badge"><i class="fas fa-industry" style="margin-right: 5px;"></i> ${op.proceso || 'TALLER'}</span>
            </div>
            <div class="op-card-info">
                <span class="op-card-ref">Ref: ${op.referencia}</span>
                <span class="op-card-prenda">${op.prenda}</span>
            </div>
            <div class="op-card-footer">
                <div class="op-card-qty">
                    <i class="fas fa-boxes" style="margin-right: 5px; font-size: 0.8rem;"></i>
                    ${op.cantidad} unds
                </div>
                <i class="fas fa-chevron-right op-card-arrow"></i>
            </div>
        `;
        card.onclick = () => seleccionarOP(op);
        container.appendChild(card);
    });
}

function seleccionarOP(opData) {
    FormState.opData = opData;
    mostrarInformacionProducto(opData);
    
    const correoGroup = document.getElementById('correoGroup');
    if (FormState.needsEmail) {
        correoGroup.classList.remove('hidden');
    } else {
        correoGroup.classList.add('hidden');
    }
    
    document.getElementById('seccionSeleccionOP').classList.add('hidden');
    document.getElementById('seccionDetalles').classList.remove('hidden');
    updateStepIndicator(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverIdentificacion() {
    document.getElementById('seccionSeleccionOP').classList.add('hidden');
    document.getElementById('seccionBusqueda').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverSeleccionOP() {
    document.getElementById('seccionDetalles').classList.add('hidden');
    document.getElementById('seccionSeleccionOP').classList.remove('hidden');
    updateStepIndicator(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function validateCorreoInput(e) {
    const input = e.target;
    const value = input.value.trim();
    const errorElement = document.getElementById('correoError');
    if (!value) { hideError(input, errorElement); return true; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) { showError(input, errorElement, 'Por favor ingresa un correo válido'); return false; }
    else { hideError(input, errorElement); return true; }
}

async function actualizarEmailPlanta() {
    const correoInput = document.getElementById('correoInput');
    const correo = correoInput.value.trim();
    if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return;
    if (!FormState.opData || !FormState.opData.planta) return;
    const planta = FormState.opData.planta;
    correoInput.disabled = true;
    try {
        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/upload-public-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
            body: JSON.stringify({ _soloActualizarEmail: true, correo: correo, planta: planta })
        });
        if (response.ok) {
            correoInput.classList.add('success');
            const helperText = document.getElementById('correoGroup').querySelector('.helper-text');
            if (helperText) { helperText.textContent = '✓ Email guardado exitosamente'; helperText.style.color = '#1e8e3e'; }
            setTimeout(() => { document.getElementById('correoGroup').classList.add('hidden'); }, 3000);
        }
    } catch (error) { console.error(error); }
    finally { correoInput.disabled = false; }
}

function updateStepIndicator(step) {
    FormState.currentStep = step;
    for (let i = 1; i <= 5; i++) {
        const stepElement = document.getElementById(`step${i}`);
        if (!stepElement) continue;
        stepElement.classList.remove('active', 'completed');
        if (i < step) stepElement.classList.add('completed');
        else if (i === step) stepElement.classList.add('active');
    }
}

function validateDescripcion(e) {
    const textarea = e.target;
    const value = textarea.value.trim();
    const errorElement = document.getElementById('descripcionError');
    if (value.length > 0 && value.length < 10) { showError(textarea, errorElement, `Faltan ${10 - value.length} caracteres`); return false; }
    else if (value.length > ValidationRules.descripcion.maxLength) { showError(textarea, errorElement, 'Límite excedido'); return false; }
    else { hideError(textarea, errorElement); return true; }
}

function showError(input, errorElement, message) {
    if (!input || !errorElement) return;
    input.classList.add('error');
    errorElement.textContent = message;
    errorElement.classList.add('show');
    const wrapper = input.closest('.input-wrapper');
    if (wrapper) wrapper.classList.add('error');
}

function hideError(input, errorElement) {
    if (!input || !errorElement) return;
    input.classList.remove('error');
    errorElement.classList.remove('show');
    const wrapper = input.closest('.input-wrapper');
    if (wrapper) wrapper.classList.remove('error');
}


function mostrarInformacionProducto(data) {
    document.getElementById('infoPlanta').textContent = data.planta;
    document.getElementById('infoReferencia').textContent = data.referencia;
    // Adaptación para usar OP que devuelve la Edge Function
    document.getElementById('infoOP').textContent = data.OP || data.lote;
    document.getElementById('infoCantidad').textContent = data.cantidad;
    
    const rows = [
        { id: 'infoProceso', rowId: 'infoProcesoRow', value: data.proceso },
        { id: 'infoPrenda', rowId: 'infoPrendaRow', value: data.prenda },
        { id: 'infoGenero', rowId: 'infoGeneroRow', value: data.genero },
        { id: 'infoCuento', rowId: 'infoCuentoRow', value: data.linea || data.cuento },
        { id: 'infoSalida', rowId: 'infoSalidaRow', value: data.salida, isDate: true }
    ];

    rows.forEach(row => {
        const el = document.getElementById(row.id);
        const rowEl = document.getElementById(row.rowId);
        if (row.value) {
            el.innerHTML = row.isDate ? formatearFechaLarga(row.value) : row.value;
            rowEl.style.display = 'flex';
        } else {
            rowEl.style.display = 'none';
        }
    });
}

function formatearFechaLarga(fechaStr) {
    try {
        let fecha;
        if (fechaStr.includes('-')) {
            fecha = new Date(fechaStr + 'T00:00:00');
        } else if (fechaStr.includes('/')) {
            const partes = fechaStr.split('/');
            fecha = new Date(partes[2], partes[1] - 1, partes[0]);
        } else {
            return fechaStr;
        }
        
        const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        const diaSemana = diasSemana[fecha.getDay()];
        const dia = fecha.getDate();
        const mes = meses[fecha.getMonth()];
        const año = fecha.getFullYear();
        
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        fecha.setHours(0, 0, 0, 0);
        
        const diasHabiles = calcularDiasHabiles(fecha, hoy);
        let colorClass = '';
        let textoTiempo = '';
        
        if (diasHabiles === 0) {
            textoTiempo = 'hoy';
            colorClass = 'fecha-verde';
        } else if (diasHabiles === 1) {
            textoTiempo = 'hace 1 día hábil';
            colorClass = 'fecha-verde';
        } else if (diasHabiles > 1) {
            textoTiempo = `hace ${diasHabiles} días hábiles`;
            colorClass = diasHabiles > 2 ? 'fecha-rojo' : 'fecha-verde';
        } else {
            const diasFuturos = Math.abs(diasHabiles);
            textoTiempo = diasFuturos === 1 ? 'en 1 día hábil' : `en ${diasFuturos} días hábiles`;
            colorClass = 'fecha-verde';
        }
        
        return `${diaSemana}, ${dia} de ${mes} del ${año} <span class="${colorClass}">(${textoTiempo})</span>`;
    } catch (error) {
        return fechaStr;
    }
}

function calcularDiasHabiles(fechaInicio, fechaFin) {
    let invertido = false;
    if (fechaInicio > fechaFin) {
        [fechaInicio, fechaFin] = [fechaFin, fechaInicio];
        invertido = true;
    }
    let diasHabiles = 0;
    let fechaActual = new Date(fechaInicio);
    while (fechaActual < fechaFin) {
        const diaSemana = fechaActual.getDay();
        if (diaSemana >= 1 && diaSemana <= 5) diasHabiles++;
        fechaActual.setDate(fechaActual.getDate() + 1);
    }
    return invertido ? -diasHabiles : diasHabiles;
}

function mostrarSeccionDetalles() {
    document.getElementById('seccionBusqueda').classList.add('hidden');
    document.getElementById('seccionDetalles').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverBusqueda() {
    document.getElementById('seccionDetalles').classList.add('hidden');
    document.getElementById('seccionBusqueda').classList.remove('hidden');
    updateStepIndicator(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function confirmarProducto() {
    document.getElementById('seccionDetalles').classList.add('hidden');
    document.getElementById('seccionNovedadDetalles').classList.remove('hidden');
    updateStepIndicator(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function volverConfirmacion() {
    document.getElementById('seccionNovedadDetalles').classList.add('hidden');
    document.getElementById('seccionDetalles').classList.remove('hidden');
    updateStepIndicator(2);
    document.getElementById('area').value = '';
    document.getElementById('tipoNovedad').value = '';
    document.getElementById('tipoNovedadGroup').classList.add('hidden');
    ['tipoInsumoGroup', 'tipoCorteGroup', 'tipoTelasGroup', 'tipoCodigosGroup', 'cantidadNormalGroup'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    lockFieldsAfter('area');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleAreaChange(e) {
    const area = e.target.value;
    const tipoGroup = document.getElementById('tipoNovedadGroup');
    const cantidadGroup = document.getElementById('cantidadNormalGroup');
    
    // Ocultar todo primero
    ['tipoInsumoGroup', 'tipoCorteGroup', 'tipoTelasGroup', 'tipoCodigosGroup', 'cantidadNormalGroup'].forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    
    if (!area) {
        tipoGroup.classList.add('hidden');
        return;
    }
    
    hideError(e.target, document.getElementById('areaError'));
    
    if (area === 'OTROS' || area === 'DISEÑO') {
        tipoGroup.classList.add('hidden');
        if (area === 'OTROS') {
            cantidadGroup.classList.remove('hidden', 'field-locked');
            cantidadGroup.classList.add('field-reveal');
        }
    } else {
        tipoGroup.classList.remove('hidden', 'field-locked');
        tipoGroup.classList.add('field-reveal');
    }
    
    // Mostrar campos específicos
    const specificGroups = {
        'INSUMOS': 'tipoInsumoGroup',
        'CORTE': 'tipoCorteGroup',
        'TELAS': 'tipoTelasGroup',
        'CODIGOS': 'tipoCodigosGroup'
    };
    
    if (specificGroups[area]) {
        const group = document.getElementById(specificGroups[area]);
        group.classList.remove('hidden', 'field-locked');
        group.classList.add('field-reveal');
        
        // Inicializar si está vacío
        const listId = area.toLowerCase() + 'List';
        if (document.getElementById(listId).children.length === 0) {
            if (area === 'INSUMOS') agregarFilaInsumo();
            else if (area === 'CORTE') agregarFilaCorte();
            else if (area === 'TELAS') agregarFilaTela();
            else if (area === 'CODIGOS') handleCodigosTipoChange();
        }
    }
}

function handleTipoNovedadChange(e) {
    if (e.target.value) {
        hideError(e.target, document.getElementById('tipoError'));
    }
}

function lockFieldsAfter(id) {
    // Lógica simplificada para esta versión
}

function agregarFilaInsumo() {
    _crearFilaDinamica(INSUMOS_OPCIONES, 'insumosList', 'eliminarFilaInsumo');
}
function eliminarFilaInsumo(btn) {
    _eliminarFilaDinamica(btn, 'insumosList');
}

function agregarFilaCorte() {
    _crearFilaDinamica(CORTE_OPCIONES, 'corteList', 'eliminarFilaCorte');
}
function eliminarFilaCorte(btn) {
    _eliminarFilaDinamica(btn, 'corteList');
}

function agregarFilaTela() {
    _crearFilaDinamica(TELAS_OPCIONES, 'telasList', 'eliminarFilaTela');
}
function eliminarFilaTela(btn) {
    _eliminarFilaDinamica(btn, 'telasList');
}

function _crearFilaDinamica(opciones, listId, removeFn) {
    const lista = document.getElementById(listId);
    const fila = document.createElement('div');
    fila.className = 'dynamic-item';
    
    const id = Date.now();
    fila.innerHTML = `
        <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Tipo <span class="required">*</span></label>
            <div class="input-wrapper custom-dropdown-wrapper">
                <i class="fas fa-tag input-icon"></i>
                <input type="text" class="form-control item-tipo" placeholder="Seleccione..." list="list-${id}">
                <datalist id="list-${id}">
                    ${opciones.map(opt => `<option value="${opt}">`).join('')}
                </datalist>
            </div>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Cantidad <span class="required">*</span></label>
            <div class="input-wrapper">
                <i class="fas fa-hashtag input-icon"></i>
                <input type="number" class="form-control item-cantidad" min="1" placeholder="0">
            </div>
        </div>
        <button type="button" class="btn-remove-item" onclick="${removeFn}(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    lista.appendChild(fila);
}

function _eliminarFilaDinamica(btn, listId) {
    const lista = document.getElementById(listId);
    if (lista.children.length > 1) {
        btn.closest('.dynamic-item').remove();
    } else {
        Swal.fire({
            icon: 'warning',
            title: 'Atención',
            text: 'Debes incluir al menos un elemento en el reporte.',
            confirmButtonColor: '#673ab7'
        });
    }
}

function handleCodigosTipoChange() {
    const tipo = document.getElementById('codigosTipoSolicitud').value;
    const loteGroup = document.getElementById('codigosLoteCompletoGroup');
    const unidadesGroup = document.getElementById('codigosUnidadesGroup');
    
    if (tipo === 'LOTE_COMPLETO') {
        loteGroup.classList.remove('hidden');
        unidadesGroup.classList.add('hidden');
        document.getElementById('codigosCantidadTotal').value = FormState.opData ? FormState.opData.cantidad : 0;
    } else if (tipo === 'UNIDADES') {
        loteGroup.classList.add('hidden');
        unidadesGroup.classList.remove('hidden');
        if (document.getElementById('codigosList').children.length === 0) {
            agregarFilaCodigo();
        }
    }
}

function agregarFilaCodigo() {
    const lista = document.getElementById('codigosList');
    const fila = document.createElement('div');
    fila.className = 'dynamic-item';
    fila.innerHTML = `
        <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Talla <span class="required">*</span></label>
            <select class="form-control codigo-talla">
                <option value="">Talla...</option>
                <option value="XS">XS</option><option value="S">S</option>
                <option value="M">M</option><option value="L">L</option>
                <option value="XL">XL</option><option value="XXL">XXL</option>
                <option value="U">Única</option>
            </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Cantidad <span class="required">*</span></label>
            <input type="number" class="form-control codigo-cantidad" min="1" placeholder="0">
        </div>
        <button type="button" class="btn-remove-item" onclick="this.closest('.dynamic-item').remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    lista.appendChild(fila);
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!ValidationRules.imagen.allowedTypes.includes(file.type) || file.size > ValidationRules.imagen.maxSize) {
        showError(e.target, document.getElementById('imagenError'), ValidationRules.imagen.message);
        e.target.value = '';
        return;
    }
    
    FormState.selectedFile = file;
    const preview = document.getElementById('filePreview');
    preview.innerHTML = `
        <div class="file-preview">
            <div class="file-preview-info">
                <div class="file-preview-icon"><i class="fas fa-image"></i></div>
                <div class="file-preview-name">${file.name}</div>
            </div>
            <button type="button" class="file-preview-remove" id="btnRemoveFile"><i class="fas fa-trash"></i></button>
        </div>
    `;
    preview.classList.remove('hidden');
    document.getElementById('btnRemoveFile').onclick = () => {
        FormState.selectedFile = null;
        preview.classList.add('hidden');
        e.target.value = '';
    };
    hideError(e.target, document.getElementById('imagenError'));
}

async function handleSubmit(e) {
    e.preventDefault();
    if (FormState.isSubmitting) return;
    
    const btn = document.getElementById('btnSubmit');
    FormState.isSubmitting = true;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div><span>Enviando...</span>';
    
    try {
        const area = document.getElementById('area').value;
        const payload = {
            OP: FormState.opData.OP || FormState.opData.lote,
            referencia: FormState.opData.referencia,
            planta: FormState.opData.planta,
            salida: FormState.opData.salida,
            linea: FormState.opData.linea,
            proceso: FormState.opData.proceso,
            prenda: FormState.opData.prenda,
            genero: FormState.opData.genero,
            cantidad: FormState.opData.cantidad,
            area: area,
            tipoNovedad: document.getElementById('tipoNovedad').value,
            descripcion: document.getElementById('descripcion').value,
            cantidadSolicitada: 0,
            tipoDetalle: null
        };
        
        // Recolectar datos según el área
        if (area === 'INSUMOS') {
            const items = document.querySelectorAll('#insumosList .dynamic-item');
            const dataItems = [];
            items.forEach(item => {
                const tipo = item.querySelector('.item-tipo').value;
                const cant = parseInt(item.querySelector('.item-cantidad').value) || 0;
                if (tipo && cant > 0) {
                    dataItems.push({ tipo, cantidad: cant });
                    payload.cantidadSolicitada += cant;
                }
            });
            if (dataItems.length > 0) payload.tipoDetalle = { items: dataItems };
        } else if (area === 'CORTE') {
            const items = document.querySelectorAll('#corteList .dynamic-item');
            const dataItems = [];
            items.forEach(item => {
                const tipo = item.querySelector('.item-tipo').value;
                const cant = parseInt(item.querySelector('.item-cantidad').value) || 0;
                if (tipo && cant > 0) {
                    dataItems.push({ tipo, cantidad: cant });
                    payload.cantidadSolicitada += cant;
                }
            });
            if (dataItems.length > 0) payload.tipoDetalle = { items: dataItems };
        } else if (area === 'TELAS') {
            const items = document.querySelectorAll('#telasList .dynamic-item');
            const dataItems = [];
            items.forEach(item => {
                const tipo = item.querySelector('.item-tipo').value;
                const cant = parseInt(item.querySelector('.item-cantidad').value) || 0;
                if (tipo && cant > 0) {
                    dataItems.push({ tipo, cantidad: cant });
                    payload.cantidadSolicitada += cant;
                }
            });
            if (dataItems.length > 0) payload.tipoDetalle = { items: dataItems };
        } else if (area === 'CODIGOS') {
            const tipoSolicitud = document.getElementById('codigosTipoSolicitud').value;
            if (tipoSolicitud === 'LOTE_COMPLETO') {
                payload.cantidadSolicitada = parseInt(document.getElementById('codigosCantidadTotal').value) || 0;
                payload.tipoDetalle = { tipo_solicitud: 'LOTE_COMPLETO', cantidad_total: payload.cantidadSolicitada };
            } else {
                const items = document.querySelectorAll('#codigosList .dynamic-item');
                const dataItems = [];
                items.forEach(item => {
                    const talla = item.querySelector('.codigo-talla').value;
                    const cant = parseInt(item.querySelector('.codigo-cantidad').value) || 0;
                    if (talla && cant > 0) {
                        dataItems.push({ talla, cantidad: cant });
                        payload.cantidadSolicitada += cant;
                    }
                });
                if (dataItems.length > 0) payload.tipoDetalle = { tipo_solicitud: 'UNIDADES', items: dataItems };
            }
        } else {
            payload.cantidadSolicitada = parseInt(document.getElementById('cantidadNormal').value) || 0;
        }

        // Validar que haya cantidad si el área lo requiere
        if (payload.cantidadSolicitada <= 0 && area !== 'DISEÑO') {
            throw new Error('Debes ingresar al menos una unidad o detalle para el reporte');
        }
        
        // Procesar imagen si existe
        if (FormState.selectedFile) {
            const base64 = await toBase64(FormState.selectedFile);
            payload.imagen = {
                base64: base64,
                fileName: FormState.selectedFile.name,
                mimeType: FormState.selectedFile.type
            };
        }
        
        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/upload-public-image`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        if (result.success) {
            document.getElementById('novedadIdDisplay').textContent = result.ID_NOVEDAD;
            document.getElementById('seccionAdicional').classList.add('hidden');
            document.getElementById('seccionExito').classList.remove('hidden');
            updateStepIndicator(5);
        } else {
            throw new Error(result.message || 'Error al enviar el reporte');
        }
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    } finally {
        FormState.isSubmitting = false;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-paper-plane"></i><span>Enviar Reporte</span>';
    }
}

function toBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function iniciarNuevoReporte() {
    window.location.reload();
}

// Drag & Drop
function handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('dragover'); }
function handleDragLeave(e) { e.currentTarget.classList.remove('dragover'); }
function handleFileDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
        const input = document.getElementById('imagen');
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        handleFileSelect({ target: input });
    }
}
function continuarAdicional() {
    document.getElementById('seccionNovedadDetalles').classList.add('hidden');
    document.getElementById('seccionAdicional').classList.remove('hidden');
    updateStepIndicator(4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
function volverDetalles() {
    document.getElementById('seccionAdicional').classList.add('hidden');
    document.getElementById('seccionNovedadDetalles').classList.remove('hidden');
    updateStepIndicator(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
