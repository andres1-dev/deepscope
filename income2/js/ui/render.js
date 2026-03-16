/**
 * UI Rendering and DOM Updates
 * Complete rendering logic matching backup.html
 */

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function safeSetClass(id, className) {
    const el = document.getElementById(id);
    if (el) el.className = className;
}

function safeSetHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

// ============ DATOS DEL DÍA ============
function cargarDatosDia() {
    if (!currentReportData) return;

    const data = currentReportData.dia;
    const actual = data.actual;
    const anterior = data.anterior;

    safeSetText("dia-fecha", actual.fecha);
    safeSetText("dia-habiles", `1 / 1`);
    safeSetText("dia-meta", formatoCantidad(actual.meta));
    safeSetText("dia-ingreso", formatoCantidad(actual.ingreso));

    // Diferencia
    safeSetText("dia-diferencia", formatoCantidad(actual.diferencia));
    safeSetClass("dia-diferencia", "data-value " + (actual.diferencia >= 0 ? "positive" : "negative"));

    // Porcentaje
    safeSetText("dia-porcentaje", actual.porcentaje);

    // Barra de progreso
    updateProgressBar("dia", actual.porcentaje, actual.meta, actual.ingreso);

    // Gestión
    updateGrowthTrend("dia", actual.gestion);

    // Estadísticas adicionales
    safeSetText("dia-average", formatoCantidad(actual.promedio));
    safeSetText("dia-weighted", formatoCantidad(actual.ponderado));
    safeSetText("dia-desvest", formatoCantidad(actual.desvest));
    safeSetText("dia-max", formatoCantidad(actual.max));

    // Comparativo extendido
    if (anterior) {
        safeSetText("dia-metaAnterior", formatoCantidad(anterior.meta));
        safeSetText("dia-ingresoAnterior", formatoCantidad(anterior.ingreso));
        safeSetText("dia-porcentajeAnterior", anterior.porcentaje);
        safeSetText("dia-diaAnterior", anterior.dia_letras);
        safeSetText("dia-averageAnterior", formatoCantidad(anterior.promedio));
        safeSetText("dia-weightedAnterior", formatoCantidad(anterior.ponderado));
        safeSetText("dia-desvestAnterior", formatoCantidad(anterior.desvest));
        safeSetText("dia-maxAnterior", formatoCantidad(anterior.max));
    }
}

// ============ DATOS DEL MES ============
function cargarDatosMes() {
    if (!currentReportData) return;

    const data = currentReportData.mes;
    const actual = data.actual;
    const anterior = data.anterior;

    // Rango de fechas en el badge (Compact)
    const mesCorto = getNombreMesCorto(currentReportData.filtros.actual).toUpperCase();
    const añoCorto = String(actual.año).slice(-2);
    let rangoTexto = `${mesCorto} '${añoCorto}`;

    try {
        const fechaInicio = consolidatedData
            .filter(d => d.Mes === actual.mes && d.Año === actual.año)
            .sort((a, b) => parseDate(a.Fecha) - parseDate(b.Fecha))[0];
        const fechaFin = parseDate(currentReportData.filtros.actual);
        if (fechaInicio && fechaFin) {
            const diaInicio = parseDate(fechaInicio.Fecha).getDate();
            const diaFin = fechaFin.getDate();
            rangoTexto = `${mesCorto} '${añoCorto} (${diaInicio}-${diaFin})`;
        }
    } catch (e) { /* fallback */ }

    safeSetText("mes-mes", rangoTexto);
    safeSetText("mes-habiles", `${actual.habiles_cursados} / ${actual.habiles_totales}`);
    safeSetText("mes-meta", formatoCantidad(actual.meta));
    safeSetText("mes-ingreso", formatoCantidad(actual.ingreso));

    // Diferencia
    safeSetText("mes-diferencia", formatoCantidad(actual.diferencia));
    safeSetClass("mes-diferencia", "data-value " + (actual.diferencia >= 0 ? "positive" : "negative"));

    // Porcentaje
    safeSetText("mes-porcentaje", actual.porcentaje);

    // Barra de progreso
    updateProgressBar("mes", actual.porcentaje, actual.meta, actual.ingreso);

    // Gestión
    updateGrowthTrend("mes", actual.gestion);

    // Estadísticas adicionales
    safeSetText("mes-average", formatoCantidad(actual.promedio));
    safeSetText("mes-weighted", formatoCantidad(actual.ponderado));
    safeSetText("mes-desvest", formatoCantidad(actual.desvest));
    safeSetText("mes-max", formatoCantidad(actual.max));

    // Comparativo extendido
    if (anterior) {
        safeSetText("mes-metaAnterior", formatoCantidad(anterior.meta));
        safeSetText("mes-ingresoAnterior", formatoCantidad(anterior.ingreso));
        safeSetText("mes-porcentajeAnterior", anterior.porcentaje);
        safeSetText("mes-habilAnterior", anterior.registros + " días");
        safeSetText("mes-averageAnterior", formatoCantidad(anterior.promedio));
        safeSetText("mes-weightedAnterior", formatoCantidad(anterior.ponderado));
        safeSetText("mes-desvestAnterior", formatoCantidad(anterior.desvest));
        safeSetText("mes-maxAnterior", formatoCantidad(anterior.max));
    }
}

// ============ DATOS DEL AÑO ============
function cargarDatosAño() {
    if (!currentReportData) return;

    const data = currentReportData.año;
    const actual = data.actual;
    const anterior = data.anterior;

    // Rango de fechas en el badge (Compact)
    let rangoTexto = `${actual.año}`;
    try {
        const fechaInicio = consolidatedData
            .filter(d => d.Año === actual.año)
            .sort((a, b) => parseDate(a.Fecha) - parseDate(b.Fecha))[0];
        const fechaFin = parseDate(currentReportData.filtros.actual);
        if (fechaInicio && fechaFin) {
            const mesInicioCorto = getNombreMesCorto(fechaInicio.Fecha);
            const diaInicio = parseDate(fechaInicio.Fecha).getDate();
            const mesFinCorto = getNombreMesCorto(formatDate(fechaFin));
            const diaFin = fechaFin.getDate();
            rangoTexto = `${actual.año} (${diaInicio} ${mesInicioCorto} - ${diaFin} ${mesFinCorto})`;
        }
    } catch (e) { /* fallback */ }

    safeSetText("año-año", rangoTexto);
    safeSetText("año-habiles", `${actual.habiles_cursados} / ${actual.habiles_totales}`);
    safeSetText("año-meta", formatoCantidad(actual.meta));
    safeSetText("año-ingreso", formatoCantidad(actual.ingreso));

    // Diferencia
    safeSetText("año-diferencia", formatoCantidad(actual.diferencia));
    safeSetClass("año-diferencia", "data-value " + (actual.diferencia >= 0 ? "positive" : "negative"));

    // Porcentaje
    safeSetText("año-porcentaje", actual.porcentaje);

    // Barra de progreso
    updateProgressBar("año", actual.porcentaje, actual.meta, actual.ingreso);

    // Gestión
    updateGrowthTrend("año", actual.gestion);

    // Estadísticas adicionales
    safeSetText("año-average", formatoCantidad(actual.promedio));
    safeSetText("año-weighted", formatoCantidad(actual.ponderado));
    safeSetText("año-desvest", formatoCantidad(actual.desvest));
    safeSetText("año-max", formatoCantidad(actual.max));

    // Comparativo extendido
    if (anterior) {
        safeSetText("año-metaAnterior", formatoCantidad(anterior.meta));
        safeSetText("año-ingresoAnterior", formatoCantidad(anterior.ingreso));
        safeSetText("año-porcentajeAnterior", anterior.porcentaje);
        safeSetText("año-diferenciaAnterior", formatoCantidad(anterior.diferencia));
        safeSetText("año-averageAnterior", formatoCantidad(anterior.promedio));
        safeSetText("año-weightedAnterior", formatoCantidad(anterior.ponderado));
        safeSetText("año-desvestAnterior", formatoCantidad(anterior.desvest));
        safeSetText("año-maxAnterior", formatoCantidad(anterior.max));
    }
}

// ============ BARRA DE PROGRESO ============
function updateProgressBar(idPrefix, percentStr, meta, ingreso) {
    const progressBar = document.getElementById(`${idPrefix}-progressBar`);
    const progressPercent = document.getElementById(`${idPrefix}-progressPercent`);
    const remainingEl = document.getElementById(`${idPrefix}-restante`);

    let progreso = extraerPorcentaje(percentStr);
    let colorBarra;

    if (progreso < 30) {
        colorBarra = "linear-gradient(90deg, #e74c3c, #f39c12)";
    } else if (progreso < 70) {
        colorBarra = "linear-gradient(90deg, #f39c12, #f1c40f)";
    } else if (progreso < 100) {
        colorBarra = "linear-gradient(90deg, #2ecc71, #27ae60)";
    } else {
        colorBarra = "linear-gradient(90deg, #27ae60, #219653)";
    }

    if (progressBar) {
        progressBar.style.background = colorBarra;
        if (progressPercent) progressPercent.textContent = "0%";
        setTimeout(() => {
            progressBar.style.width = Math.min(progreso, 100) + "%";
            if (progressPercent) progressPercent.textContent = percentStr;
        }, 300);
    }

    if (remainingEl) {
        const diff = meta - ingreso;
        remainingEl.textContent = diff > 0 ? `Faltan ${formatoCantidad(diff)} para alcanzar la meta` : "Meta alcanzada";
    }
}

// ============ GESTIÓN / TENDENCIA ============
function updateGrowthTrend(idPrefix, gestion) {
    const gestEl = document.getElementById(`${idPrefix}-gestion`);
    const trendIcon = document.getElementById(`${idPrefix}-trendIcon`);
    if (!gestEl || !trendIcon) return;

    if (gestion) {
        const val = parseFloat(gestion);
        gestEl.textContent = gestion;

        if (val > 5) {
            gestEl.className = "positive";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
            trendIcon.style.color = "var(--success-color)";
        } else if (val < -5) {
            gestEl.className = "negative";
            trendIcon.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
            trendIcon.style.color = "var(--danger-color)";
        } else {
            gestEl.className = "neutral";
            trendIcon.innerHTML = '<i class="fa-solid fa-equals"></i>';
            trendIcon.style.color = "var(--warning-color)";
        }
    } else {
        gestEl.textContent = "N/A";
        gestEl.className = "";
        trendIcon.innerHTML = '';
    }
}

// ============ INDICADOR DE TENDENCIA GLOBAL ============
function updateTrendIndicator() {
    const indicator = document.getElementById("global-trend-indicator");
    if (!indicator) return;
    const dot = indicator.querySelector('.indicator-dot');
    const value = indicator.querySelector('.indicator-value');
    if (dot && value) {
        dot.style.background = globalTrend === 'positive' ? 'var(--success-color)' :
            globalTrend === 'negative' ? 'var(--danger-color)' : 'var(--warning-color)';
        value.textContent = globalTrend === 'positive' ? 'Alza' :
            globalTrend === 'negative' ? 'Baja' : 'Estable';
        value.className = 'indicator-value ' + globalTrend;
    }
}
