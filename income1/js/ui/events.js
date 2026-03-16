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

        // Re-consolidate data with provider filter
        reconsolidateWithFilter();

        // Regenerate report for current date
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
        const [mainData, recData, rec2024Data, budget] = await Promise.all([
            getParsedMainData(),
            getREC(),
            getREC2024(),
            getBudgetData()
        ]);
        // Store raw data for provider re-filtering
        allIncomeData = [...mainData, ...recData, ...rec2024Data];
        budgetData = budget;

        // Apply current provider filter
        reconsolidateWithFilter();

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
