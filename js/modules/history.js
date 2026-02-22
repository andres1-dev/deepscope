// historial.js - Módulo de Reporte y DataTables
// Depende de: principal.js (para obtenerDatosSiesa, obtenerDatosSoportes), jquery, datatables, flatpickr

let dataTableInstance = null;
let flatpickrInstance = null;
let filterMinDate = null;
let filterMaxDate = null;

// Inicialización de filtros y eventos
function initHistoryModule() {
    initFilters();
    setupModalEvents();
}

// Configurar Flatpickr y eventos de cambio
function initFilters() {
    // 1. Configurar Flatpickr
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    flatpickrInstance = flatpickr("#filterDateRange", {
        mode: "range",
        dateFormat: "d/m/Y",
        defaultDate: [firstDayOfMonth, today],
        locale: "es",
        onChange: function (selectedDates, dateStr, instance) {
            if (selectedDates.length === 2) {
                filterMinDate = selectedDates[0];
                filterMaxDate = selectedDates[1];
                filterMaxDate.setHours(23, 59, 59, 999);
                filterMinDate.setHours(0, 0, 0, 0);

                if (dataTableInstance) dataTableInstance.draw();
            } else if (selectedDates.length === 0) {
                filterMinDate = null;
                filterMaxDate = null;
                if (dataTableInstance) dataTableInstance.draw();
            }
        }
    });

    filterMinDate = firstDayOfMonth;
    filterMinDate.setHours(0, 0, 0, 0);
    filterMaxDate = today;
    filterMaxDate.setHours(23, 59, 59, 999);

    // 2. Event Listeners
    $('#filterStatus, #filterClient, #filterProvider').on('change', function () {
        if (dataTableInstance) dataTableInstance.draw();
    });

    $('input[name="filterType"]').on('change', function () {
        if (dataTableInstance) dataTableInstance.draw();
    });

    // 3. Extension búsqueda personalizada
    $.fn.dataTable.ext.search.push(
        function (settings, data, dataIndex) {
            // Validar que la tabla sea la nuestra y la instancia exista
            if (settings.nTable.id !== 'deliveryTable') {
                return true;
            }
            if (!dataTableInstance) {
                return true;
            }

            const rowData = dataTableInstance.row(dataIndex).data();
            if (!rowData) return true;

            // Filtro Fechas
            if (filterMinDate && filterMaxDate) {
                const parts = rowData.fechaFactura.split('/');
                const fechaFactura = new Date(parts[2], parts[1] - 1, parts[0]);
                if (fechaFactura < filterMinDate || fechaFactura > filterMaxDate) {
                    return false;
                }
            }

            // Filtro Tipo
            const filterType = $('input[name="filterType"]:checked').val();
            if (filterType !== 'all') {
                const esFactura = rowData.factura.startsWith('FEV') || rowData.factura.startsWith('FVE');
                if (filterType === 'factura' && !esFactura) return false;
                if (filterType === 'remision' && esFactura) return false;
            }

            // Filtro Estado
            const filterStatus = $('#filterStatus').val();
            if (filterStatus && rowData.estado !== filterStatus) {
                return false;
            }

            // Filtro Cliente
            const filterClient = $('#filterClient').val();
            if (filterClient && rowData.cliente !== filterClient) {
                return false;
            }

            // Filtro Proveedor
            const filterProvider = $('#filterProvider').val();
            if (filterProvider && rowData.proveedor !== filterProvider) {
                return false;
            }

            return true;
        }
    );
}

function setupModalEvents() {
    const modal = document.getElementById('filterModal');
    // const overlay = document.getElementById('filterOverlay'); // Removed in index.html, handling if exists or not
    const btnOpen = document.getElementById('openFiltersBtn');
    const btnClose = document.getElementById('closeFilterModal');
    const overlay = document.querySelector('.modal-overlay#filterOverlay'); // Try select if exists

    if (btnOpen) {
        btnOpen.onclick = () => {
            modal.style.display = 'flex';
            if (overlay) overlay.style.display = 'block';
        };
    }

    const closeModal = () => {
        modal.style.display = 'none';
        if (overlay) overlay.style.display = 'none';
    };

    if (btnClose) btnClose.onclick = closeModal;
    if (overlay) overlay.onclick = closeModal;
}

// Función principal de carga
async function loadHistoryData() {
    console.log("Cargando historial de entregas...");

    const refreshBtn = document.getElementById('refreshHistoryBtn');
    if (refreshBtn) {
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        refreshBtn.disabled = true;
    }

    try {
        if (!flatpickrInstance) initHistoryModule();

        const siesaData = await obtenerDatosSiesa();
        const soportesData = await obtenerDatosSoportes();

        const reporte = siesaData.map(row => {
            const facturaId = row[1];
            const fechaFacturaStr = row[2];
            const lote = row[3];
            const referencia = row[7];
            const cliente = row[5];
            const proveedor = row[4];
            const valor = row[6];
            const cantidad = row[8];
            const nit = row[9];

            let soporteInfo = soportesData['BY_FACTURA_' + facturaId.trim()];
            const estado = soporteInfo ? 'ENTREGADO' : 'PENDIENTE';
            let fechaEntrega = soporteInfo ? formatearFechaTimestamp(soporteInfo.fechaEntrega) : '';
            let imageId = soporteInfo ? soporteInfo.imageId : '';
            const dias = calcularDiferenciaDias(fechaFacturaStr, fechaEntrega);

            return {
                factura: facturaId,
                fechaFactura: fechaFacturaStr,
                lote: lote,
                referencia: referencia,
                cliente: cliente,
                proveedor: proveedor,
                valor: formatMoney(valor),
                cantidad: cantidad,
                estado: estado,
                dias: dias,
                fechaEntrega: fechaEntrega || '---',
                ih3: imageId
            };
        });

        populateSelectFilter('#filterClient', reporte.map(r => r.cliente));
        populateSelectFilter('#filterProvider', reporte.map(r => r.proveedor));

        renderDataTable(reporte);

    } catch (e) {
        console.error("Error generando historial:", e);
        alert("Error cargando datos: " + e.message);
    } finally {
        if (refreshBtn) {
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            refreshBtn.disabled = false;
        }
    }
}

function populateSelectFilter(selector, values) {
    const uniqueValues = [...new Set(values)].sort();
    const select = $(selector);
    const currentVal = select.val();

    select.empty();
    select.append('<option value="">Todos</option>');

    uniqueValues.forEach(val => {
        if (val) {
            select.append(`<option value="${val}">${val}</option>`);
        }
    });

    if (currentVal && uniqueValues.includes(currentVal)) {
        select.val(currentVal);
    }
}

function renderDataTable(data) {
    // Destruir instancia existente de forma segura
    if ($.fn.DataTable.isDataTable('#deliveryTable')) {
        $('#deliveryTable').DataTable().destroy();
        // Limpiar completamente el contenedor si es necesario o DataTables se confunde
        $('#deliveryTable').empty();
    }

    // Re-crear estructura básica del thead si se borró con empty() 
    // DataTables necesita <thead>Defined</thead> o columns title definidos en JS, 
    // pero si usamos empty() borramos el <thead> del HTML.
    // Mejor estrategia: NO usar empty(), solo destroy(). 
    // Pero si columns cambiaron dinámicamente, empty() es util.
    // Como definimos 'title' en JS columns, DataTables reconstruirá el header.

    // Sin embargo, para evitar problemas de "reinitialise", destroy() es suficiente.
    // El error original era porque dataTableInstance era null pero la tabla HTML ya tenia datatable activado.

    dataTableInstance = $('#deliveryTable').DataTable({
        data: data,
        // Configuración de Columnas:
        // Visible: Factura, Lote, Referencia, Cantidad, Soporte, Control(Responsive)
        // Hidden (Child): Fecha Factura, Cliente, Proveedor, Valor, Estado, Días, Fecha Entrega
        columns: [
            // 0. Factura (Visible)
            { title: "Factura", data: 'factura', className: 'dtr-control' },

            // 1. Lote (Visible)
            { title: "Lote", data: 'lote' },

            // 2. Referencia (Visible)
            { title: "Referencia", data: 'referencia' },

            // 3. Cantidad (Visible)
            { title: "Cantidad", data: 'cantidad' },

            // 4. Soporte (Visible)
            {
                title: "Soporte",
                data: 'ih3',
                render: function (data, type, row) {
                    if (data) {
                        const url = "https://lh3.googleusercontent.com/d/" + data;
                        return `<button class="img-preview-btn" onclick="openPreviewImage('${url}')"><i class="fas fa-image"></i> Ver</button>`;
                    }
                    return '<span style="color: #cbd5e1;"><i class="fas fa-ban"></i></span>';
                }
            },

            // --- Columnas Ocultas (Child Row) ---
            { title: "Fecha Factura", data: 'fechaFactura', className: 'none' },
            { title: "Cliente", data: 'cliente', className: 'none' },
            { title: "Proveedor", data: 'proveedor', className: 'none' },
            { title: "Valor", data: 'valor', className: 'none' },
            {
                title: "Estado",
                data: 'estado',
                className: 'none',
                render: function (data, type, row) {
                    const colorClass = data === 'ENTREGADO' ? 'status-delivered' : 'status-pending';
                    const icon = data === 'ENTREGADO' ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-clock"></i>';
                    return `<span class="status-badge ${colorClass}">${icon} ${data}</span>`;
                }
            },
            {
                title: "Días Transcurridos",
                data: 'dias',
                className: 'none',
                render: function (data) {
                    return `<span style="font-weight:bold; color: ${data > 30 ? '#ef4444' : '#3b82f6'}">${data} días</span>`;
                }
            },
            { title: "Fecha Entrega", data: 'fechaEntrega', className: 'none' }
        ],
        responsive: {
            details: {
                type: 'column',
                target: 'tr' // Click on row to expand
            }
        },
        language: {
            "sProcessing": "Procesando...",
            "sLengthMenu": "Mostrar _MENU_ registros",
            "sZeroRecords": "No se encontraron resultados",
            "sEmptyTable": "Ningún dato disponible en esta tabla",
            "sInfo": "Mostrando registros del _START_ al _END_ de un total de _TOTAL_ registros",
            "sInfoEmpty": "Mostrando registros del 0 al 0 de un total de 0 registros",
            "sInfoFiltered": "(filtrado de un total de _MAX_ registros)",
            "sInfoPostFix": "",
            "sSearch": "Buscar:",
            "sUrl": "",
            "sInfoThousands": ",",
            "sLoadingRecords": "Cargando...",
            "oPaginate": {
                "sFirst": "Primero",
                "sLast": "Último",
                "sNext": "Siguiente",
                "sPrevious": "Anterior"
            },
            "oAria": {
                "sSortAscending": ": Activar para ordenar la columna de manera ascendente",
                "sSortDescending": ": Activar para ordenar la columna de manera descendente"
            }
        },
        pageLength: 5,
        lengthMenu: [[5, 10, 25, 50, -1], [5, 10, 25, 50, "Todos"]],
        order: [[0, 'desc']], // Ordenar por Factura por defecto, o cambiar segun preferencia
    });

    if (filterMinDate && filterMaxDate) {
        dataTableInstance.draw();
    }
}

function formatearFechaTimestamp(timestamp) {
    if (!timestamp) return null;
    const dateObj = new Date(timestamp);
    if (isNaN(dateObj.getTime())) return timestamp.split(' ')[0];

    return dateObj.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function calcularDiferenciaDias(fechaFactura, fechaEntrega) {
    if (!fechaFactura) return 0;

    const parseDate = (str) => {
        if (!str) return null;
        const parts = str.split('/');
        if (parts.length !== 3) return null;
        return new Date(parts[2], parts[1] - 1, parts[0]);
    };

    const fFactura = parseDate(fechaFactura);
    if (!fFactura) return 0;

    let fFin;
    if (fechaEntrega) {
        fFin = parseDate(fechaEntrega);
        if (!fFin) fFin = new Date();
    } else {
        fFin = new Date();
    }

    const diffTime = Math.abs(fFin - fFactura);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function formatMoney(amount) {
    if (!amount) return "$0";
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);
}

function openPreviewImage(url) {
    if (typeof mostrarImagenCompleta === 'function') {
        mostrarImagenCompleta(url);
    } else {
        window.open(url, '_blank');
    }
}

$(document).ready(function () {
    initHistoryModule();
});
