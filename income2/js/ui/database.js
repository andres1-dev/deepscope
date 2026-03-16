/**
 * DataBase (Records) Card Logic and Downloads
 */

let rangoSeleccionado = [];

function datosDescargar(formato) {
    if (!datosRegistros || datosRegistros.length === 0) {
        alert('No hay datos cargados.');
        return;
    }

    switch (formato) {
        case 'csv': datosDescargarCSV(datosRegistros); break;
        case 'json': datosDescargarJSON(datosRegistros); break;
        case 'excel': datosDescargarExcel(datosRegistros); break;
    }
}

function datosDescargarCSV(data) {
    const headers = Object.keys(data[0]).join(';');
    const csvContent = data.map(row =>
        Object.values(row).map(v => (typeof v === 'string' && v.includes(',')) ? `"${v}"` : v).join(';')
    ).join('\n');

    const blob = new Blob([headers + '\n' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'datos.csv';
    link.click();
}

function datosDescargarJSON(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'datos.json';
    link.click();
}

function datosDescargarExcel(data) {
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js';
        script.onload = () => generarYDescargarExcel(data);
        document.head.appendChild(script);
    } else {
        generarYDescargarExcel(data);
    }
}

function generarYDescargarExcel(data) {
    try {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Datos");
        XLSX.writeFile(wb, 'datos.xlsx');
    } catch (error) {
        console.error('Error al generar Excel:', error);
        alert('Error al generar el archivo Excel.');
    }
}

function initFlatpickr() {
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    rangoSeleccionado = [primerDiaMes, hoy];

    if (typeof flatpickr !== 'undefined') {
        flatpickr("#filtro-fechas", {
            mode: "range",
            dateFormat: "Y-m-d",
            defaultDate: [primerDiaMes, hoy],
            onChange: (selectedDates) => {
                rangoSeleccionado = selectedDates.length === 1 ? [selectedDates[0], selectedDates[0]] : selectedDates;
            }
        });
    }
}

function datosDescargarExcelFiltrado() {
    if (!datosRegistros || datosRegistros.length === 0) {
        alert('No hay datos cargados.');
        return;
    }
    if (!rangoSeleccionado || rangoSeleccionado.length < 2) {
        alert('Selecciona un rango válido de fechas.');
        return;
    }

    const inicio = normalizarInicio(rangoSeleccionado[0]);
    const fin = normalizarFin(rangoSeleccionado[1]);

    const datosFiltrados = datosRegistros.filter(registro => {
        const fecha = parseFechaLocal(registro.FECHA);
        return fecha >= inicio && fecha <= fin;
    });

    if (datosFiltrados.length === 0) {
        alert('No hay datos en el rango seleccionado.');
        return;
    }

    const datosConFechas = datosFiltrados.map(registro => {
        const copia = { ...registro };
        copia.FECHA = toFechaLocalYYYYMMDD(parseFechaLocal(registro.FECHA));
        return copia;
    });

    datosDescargarExcel(datosConFechas);
}

// Call init on load
document.addEventListener('DOMContentLoaded', initFlatpickr);
