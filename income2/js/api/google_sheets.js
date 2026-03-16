/**
 * Google Sheets API - Optimized with batchGet
 * Income: 3 requests en paralelo (spreadsheets distintos)
 * Budget: 1 request batchGet (mismo spreadsheet, 3 rangos)
 * Database: 3 requests en paralelo → misma lógica que el GAS, sin cold start
 */

// ─── Core batchGet helper ─────────────────────────────────────────────────────
async function batchGetRanges(spreadsheetId, ranges) {
    const params = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params}&key=${API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sheets batchGet error ${res.status}`);
    const json = await res.json();
    return (json.valueRanges || []).map(vr => vr.values || []);
}

// ─── Lookup helpers (migrados del GAS) ───────────────────────────────────────
const _GESTORES = {
    'ANGELES':     'VILLAMIZAR GOMEZ LUIS',
    'MODAFRESCA':  'FABIAN MARIN FLOREST',
    'BASICO':      'CESAR AUGUSTO LOPEZ GIRALDO',
    'INTIMA':      'KELLY GIOVANA ZULUAGA HOYOS',
    'URBANO':      'MARYI ANDREA GONZALEZ SILVA',
    'DEPORTIVO':   'JOHAN STEPHANIE ESPINOSA RAMIREZ',
    'PRONTAMODA':  'SANCHEZ LOPEZ YULIETH',
    'ESPECIALES':  'JUAN ESTEBAN ZULUAGA HOYOS',
    'BOGOTA':      'JUAN ESTEBAN ZULUAGA HOYOS',
    'DENIM':       'JUAN ESTEBAN ZULUAGA HOYOS',
    'NEBRASK':     'SANCHEZ LOPEZ YULIETH'
};

function _normalizeLinea(linea) {
    return String(linea).replace(/^LINEA\s*/i, '').replace(/\s+/g, '').toUpperCase();
}

function _normalizePVP(pvp) {
    return String(pvp).replace(/\$\s*/g, '').replace(/\./g, '').trim();
}

function _normalizeDocumento(doc) {
    return String(doc).replace(/^REC/i, '');
}

function _normalizeTaller(taller) {
    return String(taller || '').replace(/\s+/g, ' ').trim();
}

function _getGestor(linea) {
    const n = _normalizeLinea(linea);
    for (const [key, val] of Object.entries(_GESTORES)) {
        if (n.includes(key)) return val;
    }
    return 'GESTOR NO ASIGNADO';
}

function _getProveedor(linea) {
    return _normalizeLinea(linea).includes('ANGELES')
        ? 'TEXTILES Y CREACIONES LOS ANGELES SAS'
        : 'TEXTILES Y CREACIONES EL UNIVERSO SAS';
}

function _getClase(pvp) {
    const v = parseFloat(pvp);
    if (isNaN(v))      return 'NO DEFINIDO';
    if (v <= 39900)    return 'LINEA';
    if (v <= 59900)    return 'MODA';
    return 'PRONTAMODA';
}

// ─── Income parsers (uso interno para métricas) ───────────────────────────────
function _parseMainRows(rows) {
    return rows.map(row => {
        try {
            const j = JSON.parse(row[0]);
            const linea = (j.LINEA || '').toUpperCase();
            return {
                FECHA: normalizeDate(j.FECHA || ''),
                CANTIDAD: Number(j.CANTIDAD) || 0,
                ANO: '2025',
                PROVEEDOR: linea.includes('ANGELES') ? 'ANGELES' : 'UNIVERSO'
            };
        } catch { return null; }
    }).filter(Boolean);
}

function _parseRecRows(rows, ano) {
    return rows.map(row => {
        if (!row[0] && !row[1]) return null;
        const linea = (row[3] || '').toUpperCase();
        return {
            FECHA: normalizeDate(row[1] || ''),
            CANTIDAD: Number(row[18]) || 0,
            ANO: ano,
            PROVEEDOR: linea.includes('ANGELES') ? 'ANGELES' : 'UNIVERSO'
        };
    }).filter(Boolean);
}

function _parseBudgetSheet(data, year) {
    if (!data || data.length < 2) return [];
    const lineas = data[0].slice(1, -2);
    return data.slice(1).map(row => ({
        MES: row[0],
        ANO: year,
        TOTAL: Number(row[row.length - 2]) || 0,
        HABILES: Number(row[row.length - 1]) || 0,
        LINEAS: lineas.reduce((acc, linea, idx) => {
            acc[linea] = Number(row[idx + 1]) || 0;
            return acc;
        }, {})
    }));
}

// ─── Database parsers (lógica completa del GAS) ───────────────────────────────

/** DATA2: cada fila es un JSON en columna S */
function _parseDbData2(rows) {
    return rows.map(row => {
        try {
            const j = JSON.parse(row[0]);
            const pvp = _normalizePVP(j.PVP || '');
            const linea = j.LINEA || '';
            return {
                DOCUMENTO:   _normalizeDocumento(j.A || ''),
                FECHA:       normalizeDate(j.FECHA || ''),
                TALLER:      j.TALLER || '',
                LINEA:       _normalizeLinea(linea),
                AUDITOR:     j.AUDITOR || '',
                ESCANER:     j.ESCANER || '',
                LOTE:        Number(j.LOTE) || 0,
                REFPROV:     String(j.REFPROV || ''),
                DESCRIPCION: j.DESCRIPCIÓN || '',
                CANTIDAD:    Number(j.CANTIDAD) || 0,
                REFERENCIA:  j.REFERENCIA || '',
                TIPO:        j.TIPO || '',
                PVP:         pvp,
                PRENDA:      j.PRENDA || '',
                GENERO:      j.GENERO || '',
                GESTOR:      _getGestor(linea),
                PROVEEDOR:   _getProveedor(linea),
                CLASE:       _getClase(pvp),
                FUENTE:      'SISPRO',
                ANO:         2025
            };
        } catch { return null; }
    }).filter(Boolean);
}

/** REC / REC2024: columnas fijas A:AF */
function _parseDbRec(rows, ano) {
    return rows.map(row => {
        const cantidad = Number(row[18]) || 0;
        if (cantidad <= 0) return null; // filtro igual que el GAS
        const linea = row[3] || '';
        const pvp = _normalizePVP(row[31] || '');
        return {
            DOCUMENTO:   _normalizeDocumento(String(row[0] || '')),
            FECHA:       normalizeDate(row[1] || ''),
            TALLER:      _normalizeTaller(row[2] || ''),
            LINEA:       _normalizeLinea(linea),
            AUDITOR:     row[4] || '',
            ESCANER:     row[5] || '',
            LOTE:        Number(row[8]) || 0,
            REFPROV:     String(row[6] || ''),
            DESCRIPCION: row[9] || '',
            CANTIDAD:    cantidad,
            REFERENCIA:  row[26] || '',
            TIPO:        row[27] || '',
            PVP:         pvp,
            PRENDA:      row[29] || '',
            GENERO:      row[30] || '',
            GESTOR:      _getGestor(linea),
            PROVEEDOR:   _getProveedor(linea),
            CLASE:       _getClase(pvp),
            FUENTE:      'BUSINT',
            ANO:         ano
        };
    }).filter(Boolean);
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function getAllIncomeData() {
    const [mainRows, recRows, rec2024Rows] = await Promise.all([
        batchGetRanges(SPREADSHEET_IDS.DATA2,   ['DATA2!S2:S']).then(r => r[0]),
        batchGetRanges(SPREADSHEET_IDS.REC,     ['DataBase!A2:AF']).then(r => r[0]),
        batchGetRanges(SPREADSHEET_IDS.REC2024, ['DataBase!A2:AF']).then(r => r[0])
    ]);

    return [
        ..._parseMainRows(mainRows),
        ..._parseRecRows(recRows, '2025'),
        ..._parseRecRows(rec2024Rows, '2024')
    ];
}

async function getBudgetData() {
    const [rows2026, rows2025, rows2024] = await batchGetRanges(
        SPREADSHEET_IDS.BUDGETID,
        ['BUDGET2026!A1:K14', 'BUDGET2025!A1:L14', 'BUDGET2024!A1:M14']
    );

    return [
        ..._parseBudgetSheet(rows2026, '2026'),
        ..._parseBudgetSheet(rows2025, '2025'),
        ..._parseBudgetSheet(rows2024, '2024')
    ];
}

/**
 * Reemplaza el Apps Script completamente.
 * 3 requests en paralelo → misma lógica de transformación del GAS, sin cold start.
 */
async function datosCargarEndpoint() {
    try {
        const [mainRows, recRows, rec2024Rows] = await Promise.all([
            batchGetRanges(SPREADSHEET_IDS.DATA2,   ['DATA2!S2:S']).then(r => r[0]),
            batchGetRanges(SPREADSHEET_IDS.REC,     ['DataBase!A2:AF']).then(r => r[0]),
            batchGetRanges(SPREADSHEET_IDS.REC2024, ['DataBase!A2:AF']).then(r => r[0])
        ]);

        datosRegistros = [
            ..._parseDbData2(mainRows),
            ..._parseDbRec(recRows, 2025),
            ..._parseDbRec(rec2024Rows, 2024)
        ];

        const counter = document.getElementById('datos-contador');
        if (counter) counter.textContent = `${datosRegistros.length} registros`;
        return true;
    } catch (error) {
        console.error('Error al cargar datos:', error);
        return false;
    }
}
