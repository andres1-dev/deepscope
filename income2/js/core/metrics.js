/**
 * Metrics Calculation Logic
 */

function generateDayMetrics(dayData, date, fullYearData, isFromPreviousYear = false, currentAnalysisDate = null) {
    let weekData, previousWeekData;

    if (isFromPreviousYear && currentAnalysisDate) {
        const limitDate = new Date(currentAnalysisDate);
        limitDate.setFullYear(date.getFullYear());
        weekData = getWeekData(date, fullYearData, formatDate(limitDate));
        previousWeekData = getPreviousWeekData(date, fullYearData, formatDate(limitDate));
    } else {
        weekData = getWeekData(date, fullYearData);
        previousWeekData = getPreviousWeekData(date, fullYearData);
    }

    return {
        medicion: "dia",
        fecha: dayData.Fecha,
        registros: 1,
        meta: dayData.Meta,
        ingreso: dayData.Ingreso,
        diferencia: dayData.Diferencia,
        porcentaje: dayData.Cumplimiento,
        gestion: null,
        n_semana: dayData.Semana,
        dia_letras: dayData.Dia,
        mes: dayData.Mes,
        año: dayData.Año,
        promedio: calculateAverage([...weekData, ...previousWeekData]),
        ponderado: calculateWeightedAvg([...weekData, ...previousWeekData]),
        desvest: calculateStdDev([...weekData, ...previousWeekData]),
        max: findMax([...weekData, ...previousWeekData])
    };
}

function generatePeriodMetrics(type, date, fullYearData, isFromPreviousYear = false, currentAnalysisDate = null) {
    const monthName = getNombreMes(formatDate(date));
    const year = date.getFullYear();

    let periodData = type === 'mes'
        ? fullYearData.filter(d => d.Mes === monthName && d.Año === year)
        : fullYearData.filter(d => d.Año === year);

    if (isFromPreviousYear && currentAnalysisDate) {
        const limitDate = new Date(currentAnalysisDate);
        limitDate.setFullYear(year);
        const limitDateStr = formatDate(limitDate);

        periodData = periodData.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && dDate <= parseDate(limitDateStr);
        });
    } else {
        const selectedDateStr = formatDate(date);
        periodData = periodData.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && dDate <= parseDate(selectedDateStr);
        });
    }

    const totalMeta = periodData.reduce((sum, d) => sum + d.Meta, 0);
    const totalIngreso = periodData.reduce((sum, d) => sum + d.Ingreso, 0);
    const diferencia = totalIngreso - totalMeta;
    const porcentaje = totalMeta > 0 ? ((totalIngreso / totalMeta) * 100).toFixed(2) + '%' : '0%';

    // Calulate business days (hábiles)
    let habiles_totales = 0;
    if (type === 'mes') {
        const budgetForMonth = budgetData.find(b => b.MES.toUpperCase() === monthName.toUpperCase() && b.ANO === String(year));
        if (budgetForMonth) {
            if (selectedProveedor === 'todos') {
                habiles_totales = budgetForMonth.HABILES;
            } else {
                // If specific provider, total hábiles is usually the same unless it's a weighted calculation
                // For meta calculation, HABILES is global per month in this system
                habiles_totales = budgetForMonth.HABILES;
            }
        }
    } else {
        // Year
        const budgetForYear = budgetData.filter(b => b.ANO === String(year));
        habiles_totales = budgetForYear.reduce((sum, b) => sum + b.HABILES, 0);
    }

    // Calculate business days passed (cursados) globally
    // A day is "passed" if ANY provider had data (present in globalConsolidatedData)
    let globalPeriodData = type === 'mes'
        ? globalConsolidatedData.filter(d => d.Mes === monthName && d.Año === year)
        : globalConsolidatedData.filter(d => d.Año === year);

    if (isFromPreviousYear && currentAnalysisDate) {
        const limitDate = new Date(currentAnalysisDate);
        limitDate.setFullYear(year);
        const limitDateStr = formatDate(limitDate);
        globalPeriodData = globalPeriodData.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && dDate <= parseDate(limitDateStr);
        });
    } else {
        const selectedDateStr = formatDate(date);
        globalPeriodData = globalPeriodData.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && dDate <= parseDate(selectedDateStr);
        });
    }

    return {
        medicion: type,
        fecha: formatDate(date),
        registros: periodData.length,
        meta: Math.round(totalMeta),
        ingreso: Math.round(totalIngreso),
        diferencia: Math.round(diferencia),
        porcentaje: porcentaje,
        gestion: null,
        mes: monthName,
        año: year,
        habiles_cursados: globalPeriodData.length,
        habiles_totales: habiles_totales,
        promedio: calculateAverage(periodData),
        ponderado: calculateWeightedAvg(periodData),
        desvest: calculateStdDev(periodData),
        max: findMax(periodData)
    };
}

function getWeekData(date, data, limitDate = null) {
    const targetWeek = getWeekNumber(date);
    const targetYear = date.getFullYear();

    let weekData = data.filter(d => {
        const dDate = parseDate(d.Fecha);
        return dDate && getWeekNumber(dDate) === targetWeek && d.Año === targetYear;
    });

    if (limitDate) {
        const limitTime = parseDate(limitDate).getTime();
        weekData = weekData.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && dDate.getTime() <= limitTime;
        });
    }

    return weekData;
}

function getPreviousWeekData(date, data, limitDate = null) {
    const targetWeek = getWeekNumber(date) - 1;
    const targetYear = date.getFullYear();

    let weekData;

    if (targetWeek < 1) {
        weekData = data.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && getWeekNumber(dDate) === 52 && d.Año === targetYear - 1;
        });
    } else {
        weekData = data.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && getWeekNumber(dDate) === targetWeek && d.Año === targetYear;
        });
    }

    if (limitDate) {
        const limitTime = parseDate(limitDate).getTime();
        weekData = weekData.filter(d => {
            const dDate = parseDate(d.Fecha);
            return dDate && dDate.getTime() <= limitTime;
        });
    }

    return weekData;
}

function calculateAverage(data) {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, d) => acc + d.Ingreso, 0);
    return Math.round(sum / data.length);
}

function calculateWeightedAvg(data) {
    if (data.length === 0) return 0;
    const weights = data.map(d => {
        const percent = parseFloat(d.Cumplimiento);
        return isNaN(percent) ? 0 : percent;
    });
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight === 0) return 0;
    const weightedSum = data.reduce((sum, d, i) => {
        return sum + (d.Ingreso * (weights[i] / totalWeight));
    }, 0);
    return Math.round(weightedSum);
}

function calculateStdDev(data) {
    if (data.length === 0) return 0;
    const avg = calculateAverage(data);
    const squareDiffs = data.map(d => Math.pow(d.Ingreso - avg, 2));
    const divisor = data.length > 1 ? data.length - 1 : 1;
    const variance = squareDiffs.reduce((sum, val) => sum + val, 0) / divisor;
    return Math.round(Math.sqrt(variance));
}

function findMax(data) {
    if (data.length === 0) return 0;
    return Math.max(...data.map(d => d.Ingreso));
}

function findClosestDateWithData(targetDate, year, data) {
    const targetTime = parseDate(targetDate).getTime();
    const yearData = data.filter(d => d.Año === year);

    if (yearData.length === 0) return null;

    const exactMatch = yearData.find(d => {
        const dDate = parseDate(d.Fecha);
        return dDate && dDate.getTime() === targetTime;
    });
    if (exactMatch) return { date: parseDate(exactMatch.Fecha), isExact: true, data: exactMatch };

    let closestBefore = null;
    let closestAfter = null;

    yearData.forEach(item => {
        const itemDate = parseDate(item.Fecha);
        if (!itemDate) return;

        const itemTime = itemDate.getTime();
        const diff = itemTime - targetTime;

        if (diff < 0) {
            if (!closestBefore || itemTime > parseDate(closestBefore.Fecha).getTime()) {
                closestBefore = item;
            }
        } else {
            if (!closestAfter || itemTime < parseDate(closestAfter.Fecha).getTime()) {
                closestAfter = item;
            }
        }
    });

    if (closestBefore && closestAfter) {
        const beforeDiff = targetTime - parseDate(closestBefore.Fecha).getTime();
        const afterDiff = parseDate(closestAfter.Fecha).getTime() - targetTime;
        return (beforeDiff < afterDiff) ?
            { date: parseDate(closestBefore.Fecha), isExact: false, data: closestBefore } :
            { date: parseDate(closestAfter.Fecha), isExact: false, data: closestAfter };
    }

    const closest = closestBefore || closestAfter;
    return closest ? { date: parseDate(closest.Fecha), isExact: false, data: closest } : null;
}

function isAnulado(item) {
    return !item.CANTIDAD || item.CANTIDAD === 0;
}

function procesarDatosConsolidados(incomeData, budget, baseDates = null) {
    const groupedByDate = incomeData.reduce((acc, item) => {
        let fecha = item.FECHA;
        // Normalize fecha to DD/MM/YYYY for consistency with baseDates if it's in YYYY-MM-DD
        if (fecha && fecha.includes('-')) {
            const d = parseDate(fecha);
            if (d) fecha = formatDate(d);
        }

        if (!fecha) return acc;
        if (!acc[fecha]) {
            acc[fecha] = { fecha, unidades: 0, count: 0 };
        }
        acc[fecha].unidades += item.CANTIDAD || 0;
        acc[fecha].count++;
        return acc;
    }, {});

    // Ensure all base dates are present (even with 0 income)
    if (baseDates && Array.isArray(baseDates)) {
        baseDates.forEach(dateStr => {
            if (!groupedByDate[dateStr]) {
                groupedByDate[dateStr] = { fecha: dateStr, unidades: 0, count: 0 };
            }
        });
    }

    return Object.values(groupedByDate).map(item => {
        const dateObj = parseDate(item.fecha);
        if (!dateObj) return null;

        const mes = getNombreMes(item.fecha);
        const diaSemana = getDiaSemana(item.fecha);
        const año = dateObj.getFullYear();
        const semana = getWeekNumber(dateObj);

        const budgetForMonth = budget.find(b =>
            b.MES.toUpperCase() === mes.toUpperCase() &&
            b.ANO === String(año)
        );

        const metaDiaria = budgetForMonth ? (budgetForMonth.TOTAL / budgetForMonth.HABILES) : 0;
        const diferencia = item.unidades - metaDiaria;
        const cumplimiento = metaDiaria > 0 ? (item.unidades / metaDiaria * 100).toFixed(2) + '%' : '0%';

        return {
            Fecha: formatDate(dateObj),
            Dia: diaSemana,
            Semana: semana,
            Mes: mes.toUpperCase(),
            Año: año,
            Ingreso: Math.round(item.unidades),
            Meta: Math.round(metaDiaria),
            Diferencia: Math.round(diferencia),
            Cumplimiento: cumplimiento,
            TotalRegistros: item.count
        };
    }).filter(item => item !== null)
        .sort((a, b) => parseDate(a.Fecha) - parseDate(b.Fecha));
}
