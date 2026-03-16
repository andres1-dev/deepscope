/**
 * Formatting Utilities
 */

const formatoCantidad = num => {
    if (num === null || num === undefined) return '0';
    if (typeof num === 'string') {
        const numValue = parseFloat(num.replace(/\./g, '').replace(',', '.'));
        return !isNaN(numValue) ? numValue.toLocaleString("es-ES") : num;
    }
    return num.toLocaleString("es-ES");
};

const extraerPorcentaje = porcentajeStr => {
    if (!porcentajeStr) return 0;
    const match = porcentajeStr.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[0]) : 0;
};

// Data normalization
function normalizeLinea(linea) {
    if (!linea) return '';
    let normalized = linea.replace(/^LINEA\s*/i, '');
    return normalized.replace(/\s+/g, '').toUpperCase();
}

function normalizePVP(pvp) {
    if (!pvp) return '0';
    return pvp.replace(/\$\s*/g, '').replace(/\./g, '').trim();
}

function normalizeDocumento(documento) {
    if (!documento) return '';
    return documento.replace(/^REC/i, '');
}

function calculateGrowth(currentPercent, previousPercent) {
    if (!previousPercent || previousPercent === '0%') return null;
    const current = parseFloat(currentPercent);
    const previous = parseFloat(previousPercent);
    if (previous === 0) return null;
    const growth = ((current / previous) - 1) * 100;
    return growth.toFixed(2) + '%';
}

function calculateGrowthValue(current, previous) {
    if (!previous || previous === 0) return { value: "N/A", tendencia: "neutral" };

    const growth = ((current / previous) - 1) * 100;
    const absGrowth = Math.abs(growth);
    let tendencia;

    if (absGrowth < 5) {
        tendencia = "neutral";
    } else if (growth > 0) {
        tendencia = "positive";
    } else {
        tendencia = "negative";
    }

    return {
        value: growth.toFixed(1) + "%",
        tendencia: tendencia
    };
}
