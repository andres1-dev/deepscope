/**
 * Event Listeners and Interaction Logic
 */

function toggleCard(header) {
    const card = header.closest('.card');
    const cardContent = header.nextElementSibling;
    const indicator = header.querySelector('.collapse-indicator');
    
    card.classList.toggle('expanded');
    cardContent.classList.toggle('expanded');
    if (indicator) indicator.classList.toggle('expanded');
}

function toggleComparison(header) {
    const card = header.closest('.card') || header.parentElement;
    const content = header.nextElementSibling;
    const indicator = header.querySelector('.comparison-collapse-icon');
    
    if (card) card.classList.toggle('expanded');
    content.classList.toggle('expanded');
    if (indicator) indicator.classList.toggle('expanded');
}

function datosToggleCard(element) {
    const content = element.nextElementSibling;
    const indicator = element.querySelector('.collapse-indicator');
    const contador = document.getElementById('datos-contador');

    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        indicator.classList.replace('fa-chevron-up', 'fa-chevron-down');
    } else {
        content.classList.add('expanded');
        indicator.classList.replace('fa-chevron-down', 'fa-chevron-up');
        if (!datosRegistros && !datosCargando) {
            datosCargando = true;
            if (contador) contador.textContent = 'Cargando...';
            datosCargarEndpoint().then(() => { datosCargando = false; });
        }
    }
}

// Password verification
function checkPassword() {
    const password = prompt("Ingrese la contraseña para enviar el informe:");
    if (password === "One") return true;
    alert("Contraseña incorrecta");
    return false;
}

// Initialize Page
document.addEventListener('DOMContentLoaded', async function () {
    initDatePicker();
    initProveedorFilter();
    initCaptureButton();
    initWhatsAppButton();

    try {
        const today = new Date();
        await updateReportWithDate(today, true);
        // All cards stay collapsed after initial load
        document.querySelectorAll('.comparison-content').forEach(c => c.classList.remove('expanded'));
        document.querySelectorAll('.comparison-collapse-icon').forEach(i => i.classList.remove('expanded'));
    } catch (error) {
        console.error("Initialization error:", error);
    }
});

function initDatePicker() {
    const datePicker = document.getElementById('datePicker');
    const updateBtn = document.getElementById('updateReportBtn');
    if (!datePicker) return;

    datePicker.valueAsDate = new Date();
    datePicker.addEventListener('change', () => {
        const selectedDate = datePicker.valueAsDate;
        if (selectedDate && consolidatedData.length > 0) {
            generarReporteCompleto(selectedDate).then(reporte => {
                currentReportData = reporte;
                cargarDatosDia();
                cargarDatosMes();
                cargarDatosAño();
                cargarDatosTendencia();
            });
        }
    });

    if (updateBtn) {
        updateBtn.addEventListener('click', () => {
            const selectedDate = datePicker.valueAsDate || new Date();
            updateReportWithDate(selectedDate, true);
        });
    }
}

function initProveedorFilter() {
    const select = document.getElementById('proveedorFilter');
    if (!select) return;

    select.addEventListener('change', async () => {
        selectedProveedor = select.value;
        if (allIncomeData.length === 0) return;

        reconsolidateWithFilter();

        const datePicker = document.getElementById('datePicker');
        const selectedDate = datePicker ? (datePicker.valueAsDate || new Date()) : new Date();

        try {
            const reporte = await generarReporteCompleto(selectedDate);
            currentReportData = reporte;
            cargarDatosDia();
            cargarDatosMes();
            cargarDatosAño();
            cargarDatosTendencia();
        } catch (error) {
            console.error("Provider filter error:", error);
        }
    });
}

function reconsolidateWithFilter() {
    let filteredData = allIncomeData;
    let filteredBudget = budgetData;

    if (selectedProveedor === 'universo') {
        filteredData = allIncomeData.filter(d => d.PROVEEDOR === 'UNIVERSO');
        // Recalculate budget: sum all lines EXCEPT ANGELES
        filteredBudget = budgetData.map(b => {
            const lineas = b.LINEAS || {};
            let total = 0;
            for (const [linea, valor] of Object.entries(lineas)) {
                if (!linea.toUpperCase().includes('ANGELES')) {
                    total += valor;
                }
            }
            return { ...b, TOTAL: total };
        });
    } else if (selectedProveedor === 'angeles') {
        filteredData = allIncomeData.filter(d => d.PROVEEDOR === 'ANGELES');
        // Recalculate budget: sum only ANGELES line
        filteredBudget = budgetData.map(b => {
            const lineas = b.LINEAS || {};
            let total = 0;
            for (const [linea, valor] of Object.entries(lineas)) {
                if (linea.toUpperCase().includes('ANGELES')) {
                    total += valor;
                }
            }
            return { ...b, TOTAL: total };
        });
    }

    // Always calculate global consolidated data to track total business days elapsed
    globalConsolidatedData = procesarDatosConsolidados(allIncomeData, budgetData);
    const globalDates = globalConsolidatedData.map(d => d.Fecha);

    consolidatedData = procesarDatosConsolidados(filteredData, filteredBudget, globalDates);
}

function initCaptureButton() {
    const captureBtn = document.getElementById('captureBtn');
    if (captureBtn) captureBtn.addEventListener('click', captureAndDownloadCards);
}

function initWhatsAppButton() {
    const whatsappBtn = document.getElementById('whatsappBtn');
    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (checkPassword()) {
                const icon = whatsappBtn.querySelector('i');
                const orig = icon.className;
                icon.className = 'fas fa-spinner fa-spin';
                captureAndDownloadCards().finally(() => { icon.className = orig; });
            }
        });
    }
}

async function updateReportWithDate(newDate, forceReload = false) {
    if (isLoading) return;
    isLoading = true;
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    const loadingProgress = document.getElementById('loadingProgress');

    try {
        if (loadingOverlay) loadingOverlay.classList.add('active');
        if (loadingText) loadingText.textContent = "Actualizando datos...";
        if (loadingProgress) loadingProgress.style.width = '10%';

        if (forceReload || consolidatedData.length === 0) {
            await cargarDatosIniciales();
        }

        const reporte = await generarReporteCompleto(newDate);
        currentReportData = reporte;

        cargarDatosDia();
        cargarDatosMes();
        cargarDatosAño();
        cargarDatosTendencia();
        if (loadingProgress) loadingProgress.style.width = '100%';
        await new Promise(r => setTimeout(r, 300));
    } catch (error) {
        console.error("Update error:", error);
    } finally {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
        isLoading = false;
    }
}

async function cargarDatosIniciales() {
    try {
        // Income (3 requests paralelas) + Budget (1 request batchGet) simultáneos
        const [incomeData, budget] = await Promise.all([
            getAllIncomeData(),
            getBudgetData()
        ]);

        allIncomeData = incomeData;
        budgetData = budget;

        reconsolidateWithFilter();

        // Apps Script es lento, no bloquea la carga principal
        datosCargarEndpoint();
    } catch (error) {
        console.error("Initial load error:", error);
        throw error;
    }
}

async function generarReporteCompleto(targetDate) {
    const fechaObj = parseDate(targetDate);
    const currentYear = fechaObj.getFullYear();
    const currentResult = findClosestDateWithData(fechaObj, currentYear, consolidatedData);
    if (!currentResult) throw new Error("No data");

    const previousYear = currentYear - 1;
    const previousYearDate = new Date(fechaObj);
    previousYearDate.setFullYear(previousYear);
    let previousResult = findClosestDateWithData(previousYearDate, previousYear, consolidatedData);

    const report = {
        filtros: { actual: formatDate(currentResult.date), anterior: previousResult ? formatDate(previousResult.date) : null },
        dia: {
            actual: generateDayMetrics(currentResult.data, currentResult.date, consolidatedData, false),
            anterior: previousResult ? generateDayMetrics(previousResult.data, previousResult.date, consolidatedData, true, currentResult.date) : null
        },
        mes: {
            actual: generatePeriodMetrics('mes', currentResult.date, consolidatedData, false),
            anterior: previousResult ? generatePeriodMetrics('mes', previousResult.date, consolidatedData, true, currentResult.date) : null
        },
        año: {
            actual: generatePeriodMetrics('año', currentResult.date, consolidatedData, false),
            anterior: previousResult ? generatePeriodMetrics('año', previousResult.date, consolidatedData, true, currentResult.date) : null
        }
    };

    // Calculate gestion (year-over-year comparison) for each period
    if (report.dia.anterior) {
        report.dia.actual.gestion = calculateGrowth(report.dia.actual.porcentaje, report.dia.anterior.porcentaje);
    }
    if (report.mes.anterior) {
        report.mes.actual.gestion = calculateGrowth(report.mes.actual.porcentaje, report.mes.anterior.porcentaje);
    }
    if (report.año.anterior) {
        report.año.actual.gestion = calculateGrowth(report.año.actual.porcentaje, report.año.anterior.porcentaje);
    }

    return report;
}



// ── Loading Stream ────────────────────────────────────────────────────────────
(function () {
    const LINES = [
        ['Inicializando entorno de ejecución',           'mid'],
        ['Verificando integridad del sistema',           'dim'],
        ['Cargando módulos principales',                 'mid'],
        ['Estableciendo conexión segura',                'mid'],
        ['Autenticando credenciales',                    'dim'],
        ['Validando permisos de acceso',                 'dim'],
        ['Conexión establecida',                         'accent'],
        ['Inicializando motor de datos',                 'mid'],
        ['Configurando protocolo de transferencia',      'dim'],
        ['Preparando solicitudes en paralelo',           'mid'],
        ['Enviando solicitud al servidor primario',      'dim'],
        ['Enviando solicitud al servidor secundario',    'dim'],
        ['Enviando solicitud al servidor terciario',     'dim'],
        ['Esperando respuesta del servidor',             'dim'],
        ['Recibiendo paquetes de datos',                 'mid'],
        ['Verificando integridad de paquetes',           'dim'],
        ['Descomprimiendo payload',                      'dim'],
        ['Deserializando estructura de datos',           'mid'],
        ['Validando esquema de respuesta',               'dim'],
        ['Esquema validado correctamente',               'accent'],
        ['Procesando registros fuente primaria',         'bright'],
        ['Normalizando campos de texto',                 'dim'],
        ['Normalizando campos numéricos',                'dim'],
        ['Normalizando campos de fecha',                 'dim'],
        ['Aplicando zona horaria UTC-5',                 'dim'],
        ['Resolviendo referencias cruzadas',             'mid'],
        ['Clasificando registros por categoría',         'dim'],
        ['Aplicando reglas de negocio',                  'mid'],
        ['Filtrando registros inválidos',                'dim'],
        ['Fuente primaria procesada',                    'accent'],
        ['Procesando registros fuente secundaria',       'bright'],
        ['Mapeando estructura de columnas',              'dim'],
        ['Validando tipos de datos por campo',           'dim'],
        ['Aplicando transformaciones de normalización',  'dim'],
        ['Resolviendo entidades relacionadas',           'mid'],
        ['Calculando campos derivados',                  'dim'],
        ['Aplicando filtros de integridad',              'mid'],
        ['Fuente secundaria procesada',                  'accent'],
        ['Procesando registros fuente histórica',        'bright'],
        ['Cargando datos del período anterior',          'dim'],
        ['Normalizando serie temporal histórica',        'dim'],
        ['Alineando períodos para comparación',          'mid'],
        ['Fuente histórica procesada',                   'accent'],
        ['Cargando parámetros presupuestales',           'bright'],
        ['Procesando estructura de presupuesto',         'dim'],
        ['Calculando distribución por período',          'dim'],
        ['Calculando días hábiles por mes',              'dim'],
        ['Calculando meta diaria por período',           'mid'],
        ['Parámetros presupuestales cargados',           'accent'],
        ['Iniciando consolidación de fuentes',           'bright'],
        ['Unificando registros de todas las fuentes',    'mid'],
        ['Agrupando transacciones por fecha',            'dim'],
        ['Calculando totales diarios',                   'dim'],
        ['Calculando diferencia vs objetivo',            'dim'],
        ['Calculando porcentaje de cumplimiento',        'dim'],
        ['Asignando semana ISO a cada registro',         'dim'],
        ['Generando índice temporal',                    'mid'],
        ['Consolidación completada',                     'accent'],
        ['Iniciando cálculo de métricas',                'bright'],
        ['Calculando métricas del período diario',       'mid'],
        ['Calculando métricas del período mensual',      'mid'],
        ['Calculando métricas del período anual',        'mid'],
        ['Calculando promedio aritmético',               'dim'],
        ['Calculando promedio ponderado',                'dim'],
        ['Calculando desviación estándar',               'dim'],
        ['Calculando varianza del período',              'dim'],
        ['Identificando valor máximo',                   'dim'],
        ['Identificando valor mínimo',                   'dim'],
        ['Calculando percentil 75',                      'dim'],
        ['Calculando percentil 25',                      'dim'],
        ['Buscando fecha de referencia más cercana',     'mid'],
        ['Métricas del período actual calculadas',       'accent'],
        ['Calculando métricas comparativas',             'bright'],
        ['Cargando datos del mismo período año anterior','dim'],
        ['Alineando fechas para comparación interanual', 'dim'],
        ['Calculando variación absoluta',                'dim'],
        ['Calculando variación porcentual',              'dim'],
        ['Calculando gestión interanual',                'mid'],
        ['Métricas comparativas calculadas',             'accent'],
        ['Iniciando análisis de tendencia',              'bright'],
        ['Construyendo serie temporal',                  'dim'],
        ['Aplicando regresión lineal',                   'dim'],
        ['Calculando coeficiente de correlación',        'dim'],
        ['Calculando pendiente de tendencia',            'dim'],
        ['Generando proyección conservadora',            'dim'],
        ['Generando proyección optimista',               'dim'],
        ['Calculando intervalo de confianza',            'dim'],
        ['Identificando mejor período',                  'mid'],
        ['Identificando período crítico',                'mid'],
        ['Análisis de tendencia completado',             'accent'],
        ['Preparando capa de presentación',              'bright'],
        ['Compilando datos para visualización',          'dim'],
        ['Renderizando componentes gráficos',            'mid'],
        ['Generando gráfico de tendencia',               'dim'],
        ['Aplicando paleta de colores',                  'dim'],
        ['Calculando escala de ejes',                    'dim'],
        ['Renderizando tarjeta de período diario',       'mid'],
        ['Renderizando tarjeta de período mensual',      'mid'],
        ['Renderizando tarjeta de período anual',        'mid'],
        ['Actualizando indicadores de progreso',         'dim'],
        ['Aplicando umbrales de color por rendimiento',  'dim'],
        ['Actualizando indicadores de gestión',          'dim'],
        ['Interfaz de usuario actualizada',              'accent'],
        ['Inicializando módulo de exportación',          'mid'],
        ['Preparando motor de exportación CSV',          'dim'],
        ['Preparando motor de exportación JSON',         'dim'],
        ['Preparando motor de exportación Excel',        'dim'],
        ['Configurando selector de rango de fechas',     'dim'],
        ['Módulo de exportación listo',                  'accent'],
        ['Registrando Service Worker',                   'mid'],
        ['Verificando recursos en caché',                'dim'],
        ['Sincronizando estado de la aplicación',        'dim'],
        ['Aplicando preferencias del usuario',           'dim'],
        ['Optimizando rendimiento de renderizado',       'dim'],
        ['Liberando memoria temporal',                   'dim'],
        ['Todos los módulos inicializados',              'accent'],
        ['Sistema operativo',                            'accent'],
    ];

    let currentEl = null;
    let idx = 0;
    let timer = null;

    function showNext() {
        const container = document.getElementById('loadingStream');
        if (!container) return;

        if (currentEl) currentEl.classList.remove('visible');

        const [text, cls] = LINES[idx % LINES.length];
        const el = document.createElement('div');
        el.className = `loading-stream-line ${cls}`;
        el.textContent = text;
        container.appendChild(el);

        el.getBoundingClientRect();
        el.classList.add('visible');

        if (currentEl) {
            const old = currentEl;
            setTimeout(() => old.remove(), 300);
        }

        currentEl = el;
        idx++;
        timer = setTimeout(showNext, 150);
    }

    function startStream() {
        idx = 0;
        currentEl = null;
        clearTimeout(timer);
        const container = document.getElementById('loadingStream');
        if (container) container.innerHTML = '';
        showNext();
    }

    function stopStream() {
        clearTimeout(timer);
        const container = document.getElementById('loadingStream');
        if (container) container.innerHTML = '';
        currentEl = null;
    }

    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        const observer = new MutationObserver(() => {
            if (overlay.classList.contains('active')) startStream();
            else stopStream();
        });
        observer.observe(overlay, { attributes: true, attributeFilter: ['class'] });
        if (overlay.classList.contains('active')) startStream();
    }
})();
