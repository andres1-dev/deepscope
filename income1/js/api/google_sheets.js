/**
 * Google Sheets API Data Fetching
 */

async function getParsedMainData() {
    try {
        const range = "DATA2!S2:S";
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_IDS.DATA2}/values/${range}?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.values || data.values.length === 0) {
            throw new Error("No se encontraron datos en la hoja DATA2");
        }

        return data.values.map(row => {
            try {
                const jsonData = JSON.parse(row[0]);
                const linea = (jsonData.LINEA || '').toUpperCase();
                return {
                    FECHA: normalizeDate(jsonData.FECHA || ''),
                    CANTIDAD: Number(jsonData.CANTIDAD) || 0,
                    ANO: '2025',
                    PROVEEDOR: linea.includes('ANGELES') ? 'ANGELES' : 'UNIVERSO'
                };
            } catch (e) {
                console.error("Error al parsear JSON:", e);
                return null;
            }
        }).filter(item => item !== null);

    } catch (error) {
        console.error("Error en getParsedMainData:", error);
        throw error;
    }
}

async function getREC() {
    try {
        const range = "DataBase!A2:AF";
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_IDS.REC}/values/${range}?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.values || data.values.length === 0) {
            throw new Error("No se encontraron datos en la hoja DataBase");
        }

        return data.values.map(row => {
            if (!row[0] && !row[1]) return null;
            const linea = (row[3] || '').toUpperCase();
            return {
                FECHA: normalizeDate(row[1] || ''),
                CANTIDAD: Number(row[18]) || 0,
                ANO: '2025',
                PROVEEDOR: linea.includes('ANGELES') ? 'ANGELES' : 'UNIVERSO'
            };
        }).filter(item => item !== null);

    } catch (error) {
        console.error("Error en getREC:", error);
        throw error;
    }
}

async function getREC2024() {
    try {
        const range = "DataBase!A2:AF";
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_IDS.REC2024}/values/${range}?key=${API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.values || data.values.length === 0) {
            throw new Error("No se encontraron datos en la hoja DataBase de REC2024");
        }

        return data.values.map(row => {
            if (!row[0] && !row[1]) return null;
            const linea = (row[3] || '').toUpperCase();
            return {
                FECHA: normalizeDate(row[1] || ''),
                CANTIDAD: Number(row[18]) || 0,
                ANO: '2024',
                PROVEEDOR: linea.includes('ANGELES') ? 'ANGELES' : 'UNIVERSO'
            };
        }).filter(item => item !== null);

    } catch (error) {
        console.error("Error en getREC2024:", error);
        throw error;
    }
}

async function getBudgetData() {
    try {
        const range2026 = "BUDGET2026!A1:K14";
        const range2025 = "BUDGET2025!A1:L14";
        const range2024 = "BUDGET2024!A1:M14";

        const [response2026, response2025, response2024] = await Promise.all([
            fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_IDS.BUDGETID}/values/${range2026}?key=${API_KEY}`),
            fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_IDS.BUDGETID}/values/${range2025}?key=${API_KEY}`),
            fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_IDS.BUDGETID}/values/${range2024}?key=${API_KEY}`)
        ]);

        const [data2026, data2025, data2024] = await Promise.all([
            response2026.json(),
            response2025.json(),
            response2024.json()
        ]);

        // Process function
        const processBudget = (data, year) => {
            const lineas = data.values[0].slice(1, -2);
            return data.values.slice(1).map(row => ({
                MES: row[0],
                ANO: year,
                TOTAL: Number(row[row.length - 2]) || 0,
                HABILES: Number(row[row.length - 1]) || 0,
                LINEAS: lineas.reduce((acc, linea, idx) => {
                    acc[linea] = Number(row[idx + 1]) || 0;
                    return acc;
                }, {})
            }));
        };

        return [
            ...processBudget(data2026, '2026'),
            ...processBudget(data2025, '2025'),
            ...processBudget(data2024, '2024')
        ];
    } catch (error) {
        console.error("Error en getBudgetData:", error);
        throw error;
    }
}

async function datosCargarEndpoint() {
    try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbwmNpKpXLf6yRSdCxEl-sM5q2eSS797_MMiQsg72l5AAe9pD9RO19EQIu6khG8wF-QwRw/exec');
        const data = await response.json();

        if (data.status === "success") {
            datosRegistros = data.data;
            const counter = document.getElementById('datos-contador');
            if (counter) counter.textContent = `${data.registros} registros`;
            return true;
        } else {
            throw new Error('Respuesta inválida');
        }
    } catch (error) {
        console.error('Error al cargar datos:', error);
        return false;
    }
}
