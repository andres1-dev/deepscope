/**
 * Chart and Data Visualizations
 * Complete trend analysis logic matching backup.html
 */

// Función principal para cargar datos de tendencia DIARIA
function cargarDatosTendencia() {
    if (!currentReportData) return;

    const data = currentReportData.mes;
    const actual = data.actual;
    const anterior = data.anterior;

    // 1. Actualizar información básica
    safeSetText("tendencia-mes", `${actual.mes} ${actual.año}`);

    // 2. Realizar análisis diario
    const analisisDiario = analizarTendenciaDiaria(actual.año, actual.mes);

    if (!analisisDiario) {
        console.error("No se pudieron analizar los datos diarios");
        return;
    }

    // 3. Actualizar UI con análisis diario
    actualizarTendenciaUI(analisisDiario, actual, anterior);

    // 4. Generar gráfico con datos diarios
    generarGraficoTendenciaDiaria(analisisDiario, actual.año, actual.mes);

    // 5. Calcular estadísticas detalladas
    calcularEstadisticasTendenciaDiaria(analisisDiario, actual.año, actual.mes, actual);
}

// Actualizar la UI con los resultados del análisis diario
function actualizarTendenciaUI(analisisDiario, actual, anterior) {
    const { proyeccion, patronesSemanales } = analisisDiario;

    // Actualizar tendencia actual (comparación con mes anterior)
    if (anterior) {
        const crecimiento = calculateGrowthValue(actual.ingreso, anterior.ingreso);
        const tendenciaEl = document.getElementById("tendencia-actual");
        if (tendenciaEl) {
            tendenciaEl.textContent = crecimiento.value;
            tendenciaEl.className = "data-value " + crecimiento.tendencia;
        }
        tendenciaValues.push(crecimiento.tendencia);
    }

    // Actualizar proyección mensual
    if (proyeccion) {
        const proyeccionEl = document.getElementById("tendencia-proyeccion");
        const diferencia = proyeccion.proyeccionConservadora - actual.meta;
        const porcentaje = ((diferencia / actual.meta) * 100).toFixed(1);

        if (proyeccionEl) {
            proyeccionEl.textContent = `${formatoCantidad(proyeccion.proyeccionConservadora)} (${porcentaje >= 0 ? '+' : ''}${porcentaje}%)`;
            proyeccionEl.className = "data-value " + (diferencia >= 0 ? "positive" : "negative");
        }

        updateResumenEjecutivo('proyeccion', {
            valor: proyeccion.proyeccionConservadora,
            meta: actual.meta,
            porcentaje: porcentaje,
            tendencia: diferencia >= 0 ? "positive" : "negative"
        });
    }

    // Actualizar crecimiento interanual
    if (anterior) {
        const crecimiento = calculateGrowthValue(actual.ingreso, anterior.ingreso);
        const crecimientoEl = document.getElementById("tendencia-crecimiento");
        if (crecimientoEl) {
            crecimientoEl.textContent = crecimiento.value;
            crecimientoEl.className = "data-value " + crecimiento.tendencia;
        }
        tendenciaValues.push(crecimiento.tendencia);

        updateResumenEjecutivo('interanual', {
            valor: crecimiento.value,
            tendencia: crecimiento.tendencia
        });
    }

    // Actualizar resumen con patrones semanales
    if (patronesSemanales && patronesSemanales.viernes) {
        const resumenEl = document.getElementById("tendencia-resumen-texto");
        const promedioViernes = patronesSemanales.viernes.promedio;
        const promedioGeneral = analisisDiario.datosDiarios.reduce((sum, d) => sum + d.Ingreso, 0) / analisisDiario.datosDiarios.length;
        const incrementoViernes = ((promedioViernes - promedioGeneral) / promedioGeneral * 100).toFixed(1);

        if (resumenEl) {
            resumenEl.textContent = `Patrón detectado: Los viernes tienen un incremento del ${incrementoViernes}% respecto al promedio diario.`;
        }
    }
}

// Función para actualizar el resumen ejecutivo
function updateResumenEjecutivo(tipo, datos) {
    const resumenEl = document.getElementById("tendencia-resumen-texto");
    if (!resumenEl) return;

    switch (tipo) {
        case 'actual':
            resumenEl.textContent = `El mes actual muestra ${datos.tendencia === 'positive' ? 'un crecimiento' :
                datos.tendencia === 'negative' ? 'una disminución' : 'una estabilidad'} ` +
                `de ${datos.comparativo} respecto al mes anterior.`;
            break;
        case 'proyeccion':
            const vsMeta = parseFloat(datos.porcentaje);
            resumenEl.textContent = `Proyección mensual: ${vsMeta >= 0 ? 'supera' : 'está por debajo de'} ` +
                `la meta en un ${Math.abs(vsMeta)}%.`;
            break;
        case 'interanual':
            resumenEl.textContent = `En comparación anual, el crecimiento es ${datos.tendencia === 'positive' ? 'positivo' :
                datos.tendencia === 'negative' ? 'negativo' : 'neutral'} (${datos.valor}).`;
            break;
    }

    determinarTendenciaGlobal();
}

// Calcular estadísticas de tendencia DIARIA
function calcularEstadisticasTendenciaDiaria(analisisDiario, año, mesActual, actual) {
    const { datosDiarios, patronesSemanales, proyeccion } = analisisDiario;

    // Calcular métricas básicas
    const ingresos = datosDiarios.map(d => d.Ingreso);
    const promedio = Math.round(ingresos.reduce((a, b) => a + b, 0) / ingresos.length);
    const maxIngreso = Math.max(...ingresos);
    const minIngreso = Math.min(...ingresos);

    // Encontrar mejor y peor día
    const mejorDia = datosDiarios.find(d => d.Ingreso === maxIngreso);
    const peorDia = datosDiarios.find(d => d.Ingreso === minIngreso);

    // Calcular variabilidad (coeficiente de variación)
    const desviacion = calcularDesviacionEstandar(ingresos);
    const variabilidad = ((desviacion / promedio) * 100).toFixed(1) + '%';

    // Actualizar UI
    safeSetText("tendencia-promedio-3m", formatoCantidad(promedio));

    if (mejorDia) {
        safeSetText("tendencia-mejor-mes", `${mejorDia.Fecha}: ${formatoCantidad(maxIngreso)}`);
    }

    if (peorDia) {
        safeSetText("tendencia-peor-mes", `${peorDia.Fecha}: ${formatoCantidad(minIngreso)}`);
    }

    safeSetText("tendencia-variabilidad", variabilidad);

    // Actualizar información de proyección si existe
    if (proyeccion) {
        const comparisonGrid = document.querySelector('.trend-analysis-card .comparison-grid');
        if (comparisonGrid) {
            // Check if projection item already exists
            let existingProjection = comparisonGrid.querySelector('.projection-item');
            if (!existingProjection) {
                const proyeccionItem = document.createElement('div');
                proyeccionItem.className = 'comparison-item projection-item';
                proyeccionItem.innerHTML = `
                    <div class="comparison-label">
                        <i class="fas fa-project-diagram"></i> Proyección mensual
                    </div>
                    <div class="comparison-value">${formatoCantidad(proyeccion.proyeccionConservadora)}</div>
                    <div class="comparison-description">Basada en tendencia y patrones</div>
                `;
                comparisonGrid.appendChild(proyeccionItem);
            }
        }
    }

    // Calcular tendencia del promedio
    if (actual && actual.meta) {
        const tendenciaPromedio = promedio > (actual.meta / 30) ? 'positive' : 'negative';
        tendenciaValues.push(tendenciaPromedio);
    }

    // Determinar la tendencia global con todos los datos
    determinarTendenciaGlobal();
}

// Desviación estándar
function calcularDesviacionEstandar(valores) {
    if (!valores || valores.length < 2) return 0;
    const n = valores.length;
    const media = valores.reduce((a, b) => a + b) / n;
    const sumaDiferencias = valores.reduce((sum, val) => sum + Math.pow(val - media, 2), 0);
    return Math.sqrt(sumaDiferencias / n);
}

// Determinar la tendencia global
function determinarTendenciaGlobal() {
    if (!tendenciaValues || tendenciaValues.length === 0) {
        globalTrend = 'neutral';
        updateTrendIndicator();
        return;
    }

    const counts = {
        positive: tendenciaValues.filter(t => t === 'positive').length,
        negative: tendenciaValues.filter(t => t === 'negative').length,
        neutral: tendenciaValues.filter(t => t === 'neutral').length
    };

    if (counts.positive > counts.negative && counts.positive > counts.neutral) {
        globalTrend = 'positive';
    } else if (counts.negative > counts.positive && counts.negative > counts.neutral) {
        globalTrend = 'negative';
    } else {
        globalTrend = 'neutral';
    }

    updateTrendIndicator();
}

// Generar gráfico de tendencia DIARIA
function generarGraficoTendenciaDiaria(analisisDiario, año, mesActual) {
    const { datosDiarios, tendencia, promedioMovil } = analisisDiario;

    const labels = datosDiarios.map(d => {
        const fecha = parseDate(d.Fecha);
        return `${fecha.getDate()}/${fecha.getMonth() + 1}`;
    });

    const dataActual = datosDiarios.map(d => d.Ingreso);
    const ctx = document.getElementById('tendenciaChart');
    if (!ctx) return;

    if (tendenciaChart) tendenciaChart.destroy();

    // Colores para puntos destacados (viernes en rojo)
    const pointBackgroundColors = datosDiarios.map(d => {
        const fecha = parseDate(d.Fecha);
        return fecha.getDay() === 5 ? '#e74c3c' : '#9b59b6';
    });

    tendenciaChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ingresos diarios',
                    data: dataActual,
                    borderColor: '#4361ee',
                    backgroundColor: 'rgba(67, 97, 238, 0.1)',
                    borderWidth: 1,
                    tension: 0.1,
                    pointBackgroundColor: pointBackgroundColors,
                    pointRadius: 4,
                    fill: true
                },
                {
                    label: 'Promedio móvil (7 días)',
                    data: promedioMovil,
                    borderColor: '#f39c12',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.4,
                    pointRadius: 0,
                    borderDash: [5, 5],
                    fill: false
                },
                {
                    label: 'Tendencia lineal',
                    data: tendencia,
                    borderColor: '#2ecc71',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true, padding: 20, font: { size: 12 } }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += formatoCantidad(context.parsed.y);
                            return label;
                        },
                        afterLabel: function (context) {
                            if (context.datasetIndex === 0) {
                                const index = context.dataIndex;
                                const dia = datosDiarios[index].Dia;
                                return `Día: ${dia}`;
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: (v) => formatoCantidad(v) },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// Exportar gráfico como imagen
function exportChartAsImage(chartId, filename) {
    const canvas = document.getElementById(chartId);
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// Obtener tendencia global
function getGlobalTrend() {
    return globalTrend || 'neutral';
}
