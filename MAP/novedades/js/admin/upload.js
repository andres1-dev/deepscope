/**
 * upload.js — Lógica de sincronización masiva de datos BUSINT (Nivel 10)
 * Consolidado de DataParser, HeaderDetector, DataMapper y UI Controller.
 */

/* ── Configuración de Headers ── */
const HEADER_SETS = {
    CONFECCION: [
        'Ubicacion', 'Nombre', 'Numlote', 'Marca', 'Ref', 'desclarga', 'Col', 'RefExt', 'Total',
        'FechaSalda', 'FechaEntrada', 'Nombre2', 'Telefono', 'Celular', 'Direccion', 'Ciudad',
        'Encargado', 'NumPed', 'FechaDespacho', 'Cuento', 'Obs Salida', 'Costo Conf+Term',
        'Valor a Pagar', 'Inv Muestras', 'Linea', 'Categoria de Producto'
    ],
    PROCESOS: [
        'Coleccion', 'Ref', 'RefExt', 'NumLote', 'emp', 'Total', 'Vt', 'Planta', 'Proceso',
        'doc', 'Obs', 'FechaSal', 'FechaEntrega', 'Cuento', 'Categoria', 'Linea', 'Cant Minutos'
    ]
};

/* ── Clase DataParser ── */
class DataParser {
    parse(rawText) {
        if (!rawText || !rawText.trim()) return { headers: [], rows: [] };
        const lines = rawText.split(/\r?\n/);
        const matrix = lines.map(line => line.split('\t').map(cell => cell.trim()));
        const nonEmptyMatrix = matrix.filter(row => row.some(cell => cell && cell.length > 0));
        if (nonEmptyMatrix.length === 0) return { headers: [], rows: [] };
        const headers = nonEmptyMatrix[0].map(h => String(h || '').trim());
        const rows = nonEmptyMatrix.slice(1).map(row => {
            if (row.length < headers.length) return [...row, ...Array(headers.length - row.length).fill('')];
            if (row.length > headers.length) return row.slice(0, headers.length);
            return row;
        });
        return { headers, rows };
    }
}

/* ── Clase HeaderDetector ── */
class HeaderDetector {
    detect(headers) {
        if (this.hasAllRequiredHeaders(headers, HEADER_SETS.CONFECCION)) return 'CONFECCION';
        if (this.hasAllRequiredHeaders(headers, HEADER_SETS.PROCESOS)) return 'PROCESOS';
        return 'UNKNOWN';
    }
    hasAllRequiredHeaders(headers, requiredHeaders) {
        for (const required of requiredHeaders) {
            if (!headers.includes(required)) return false;
        }
        return true;
    }
}

/* ── Clase DataMapper ── */
class DataMapper {
    map(headers, rows, type) {
        const headerIndexMap = {};
        headers.forEach((h, idx) => { headerIndexMap[h] = idx; });
        const mapFunction = type === 'CONFECCION' ? this.mapConfeccionRow.bind(this) : this.mapProcesosRow.bind(this);
        return rows.map(row => mapFunction(row, headerIndexMap)).filter(item => this.isValidRow(item));
    }

    isValidRow(row) {
        return (row.OP && String(row.OP).trim().length > 0) || (row.Ref && String(row.Ref).trim().length > 0);
    }

    getValue(rowData, headerIndexMap, headerName) {
        const idx = headerIndexMap[headerName];
        if (idx === undefined || idx >= rowData.length) return '';
        const val = rowData[idx];
        if (val === null || val === undefined) return '';
        const s = String(val).trim();
        const lower = s.toLowerCase();
        if (s === '' || lower === 'null' || lower === 'undefined' || lower === 'n/a' || s === '-') return '';
        return s;
    }

    normalizeProceso(proceso) {
        if (!proceso) return '';
        const upper = proceso.toUpperCase().trim();
        if (upper.startsWith('SERVICIODE')) return proceso.substring(10).trim();
        if (upper.startsWith('SERVICIO ')) return proceso.substring(9).trim();
        return upper === 'SERVICIO' ? '' : proceso.trim();
    }

    normalizeCuento(cuento) {
        if (!cuento) return '';
        return cuento.toUpperCase().trim().replace(/\s*S2\s*$/i, '').replace(/\s+/g, ' ').trim();
    }

    normalizeGenero(genero) {
        if (!genero) return '';
        const upper = genero.toUpperCase().trim();
        if (upper.includes('FEMENINA') || upper.includes('MUJER') || upper.includes('DAMA')) return 'DAMA';
        if (upper.includes('MASCULINA') || upper.includes('HOMBRE') || upper.includes('CABALLERO')) return 'CABALLERO';
        if (upper.includes('NIÑA') || upper.includes('NINA')) return 'NIÑA';
        if (upper.includes('NIÑO') || upper.includes('NINO')) return 'NIÑO';
        return upper.includes('UNISEX') || upper.includes('MIXTO') ? 'UNISEX' : genero.trim();
    }

    normalizeFecha(fecha) {
        if (!fecha) return '';
        const m = { 'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06', 'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12' };
        const match = fecha.trim().match(/^(\d{1,2})-([a-zA-Z]+)-(\d{2})$/);
        if (match) {
            const mes = m[match[2].toLowerCase().substring(0, 3)];
            if (mes) return `20${match[3]}-${mes}-${match[1].padStart(2, '0')}`;
        }
        return fecha.trim();
    }

    mapConfeccionRow(rowData, headerIndexMap) {
        const g = (h) => this.getValue(rowData, headerIndexMap, h);
        return {
            "OP": g('Numlote'), "Ref": g('Ref'), "InvPlanta": parseInt(g('Total')) || 0,
            "NombrePlanta": g('Nombre'), "FSalidaConf": this.normalizeFecha(g('FechaSalda')),
            "FEntregaConf": this.normalizeFecha(g('FechaEntrada')), "Proceso": g('Proceso') || 'CONFECCION',
            "Descripcion": g('Categoria de Producto'), "Cuento": this.normalizeCuento(g('Cuento')),
            "Genero": this.normalizeGenero(g('Linea')), "Obs": g('Obs Salida'), "Costo": g('Costo Conf+Term')
        };
    }

    mapProcesosRow(rowData, headerIndexMap) {
        const g = (h) => this.getValue(rowData, headerIndexMap, h);
        return {
            "OP": g('NumLote'), "Ref": g('Ref'), "InvPlanta": parseInt(g('Total')) || 0,
            "NombrePlanta": g('Planta'), "FSalidaConf": this.normalizeFecha(g('FechaSal')),
            "FEntregaConf": this.normalizeFecha(g('FechaEntrega')), "Proceso": this.normalizeProceso(g('Proceso')),
            "Descripcion": g('Categoria'), "Cuento": this.normalizeCuento(g('Cuento')),
            "Genero": this.normalizeGenero(g('Linea')), "Obs": g('Obs'), "Costo": g('Cant Minutos')
        };
    }
}

/* ── Application Controller ── */
class Application {
    constructor() {
        this.parser = new DataParser();
        this.detector = new HeaderDetector();
        this.mapper = new DataMapper();
        this.spreadsheet = null;
        this.jsonData = [];
        this.detectedType = '';
    }

    init() {
        this.initSpreadsheet();
        this.updateStats();
        // Cargar última sincronización si existe
        const last = localStorage.getItem('busint_last_sync');
        if (last) document.getElementById('stat-last-sync').textContent = last;
    }

    initSpreadsheet() {
        if (typeof jspreadsheet === 'undefined') {
            console.error('jspreadsheet no está cargado. Reintentando en 500ms...');
            setTimeout(() => this.initSpreadsheet(), 500);
            return;
        }

        try {
            this.spreadsheet = jspreadsheet(document.getElementById('spreadsheet'), {
                minDimensions: [26, 15],
                columnSorting: false,
                onpaste: () => {
                    setTimeout(() => this.processData(), 100);
                },
                onchange: () => {
                    setTimeout(() => this.processData(), 100);
                }
            });
        } catch (err) {
            console.error('Error al inicializar jspreadsheet:', err);
        }
    }

    processData() {
        const rawData = this.spreadsheet.getData();
        const textData = rawData.map(row => row.join('\t')).join('\n');
        
        const { headers, rows } = this.parser.parse(textData);
        if (headers.length === 0) return this.resetState();

        this.detectedType = this.detector.detect(headers);
        if (this.detectedType === 'UNKNOWN') {
            this.setStatus('Error: Formato de cabeceras no reconocido', 'error');
            this.toggleSync(false);
            this.toggleActionTools(false);
            return;
        }

        this.jsonData = this.mapper.map(headers, rows, this.detectedType);
        this.updateStats(this.jsonData.length, this.detectedType);
        
        // Mostrar JSON en la previsualización
        this.updateJSONPreview(this.jsonData);
        
        this.setStatus(`Datos listos: ${this.jsonData.length} registros (${this.detectedType})`, 'ready');
        this.toggleActionTools(true);

        // SINCRONIZACIÓN AUTOMÁTICA (Como en el original)
        setTimeout(() => {
            this.syncWithSupabase();
        }, 500);
    }

    updateJSONPreview(data) {
        const el = document.getElementById('jsonContent');
        const count = document.getElementById('jsonCount');
        if (el) el.textContent = JSON.stringify(data, null, 2);
        if (count) count.textContent = `${data.length} registros`;
    }

    toggleActionTools(show) {
        const tools = document.getElementById('action-tools');
        if (tools) {
            tools.style.opacity = show ? '1' : '0';
            tools.style.pointerEvents = show ? 'auto' : 'none';
        }
    }

    handleToggleJSONView() {
        const preview = document.getElementById('jsonPreview');
        const btn = document.getElementById('viewJsonBtn');
        const isVisible = preview.style.display === 'block';
        
        if (isVisible) {
            preview.style.display = 'none';
            btn.innerHTML = '<i class="fas fa-eye"></i> Ver JSON';
        } else {
            preview.style.display = 'block';
            btn.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar JSON';
            preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    handleDownloadJSON() {
        if (!this.jsonData.length) return;
        const blob = new Blob([JSON.stringify(this.jsonData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `datos_mapeados_${new Date().toISOString().slice(0,19)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    handleCopyJSON() {
        if (!this.jsonData.length) return;
        navigator.clipboard.writeText(JSON.stringify(this.jsonData, null, 2)).then(() => {
            const btn = document.getElementById('copyJsonBtn');
            const original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Copiado';
            setTimeout(() => btn.innerHTML = original, 2000);
        });
    }

    async handleDownloadFullTable() {
        const btn = document.getElementById('downloadFullCsvBtn');
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>...';
        btn.disabled = true;

        try {
            // Usar api.js para traer datos (ya que fetchSupabaseData fue refactorizada a /query)
            const result = await fetchSupabaseData('BUSINT');
            if (!result || result.length === 0) {
                Swal.fire('Info', 'La base de datos está vacía.', 'info');
                return;
            }

            const headers = Object.keys(result[0]);
            let csv = headers.join(';') + '\n';
            result.forEach(row => {
                csv += headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(';') + '\n';
            });

            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `BD_BUSINT_FULL_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        } finally {
            btn.innerHTML = original;
            btn.disabled = false;
        }
    }

    setStatus(msg, type) {
        const el = document.getElementById('upload-status');
        el.className = `status-indicator ${type || ''}`;
        el.querySelector('span').textContent = msg;
        const icon = el.querySelector('i');
        if (type === 'ready') icon.className = 'fas fa-check-circle';
        else if (type === 'error') icon.className = 'fas fa-exclamation-circle';
        else if (type === 'processing') icon.className = 'fas fa-spinner fa-spin';
        else icon.className = 'fas fa-info-circle';
    }

    updateStats(total = 0, type = '-') {
        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-type').textContent = type;
    }

    resetState() {
        this.jsonData = [];
        this.detectedType = '';
        this.updateStats();
        this.setStatus('Esperando datos de Excel...', '');
        this.toggleActionTools(false);
        document.getElementById('jsonPreview').style.display = 'none';
        document.getElementById('results-view').style.display = 'none';
        document.getElementById('spreadsheet-wrapper').style.display = 'block';
    }

    async syncWithSupabase() {
        if (this.jsonData.length === 0) return;

        this.setStatus('Sincronizando con BUSINT...', 'processing');
        this.toggleSync(false);

        try {
            const projectUrl = CONFIG.FUNCTIONS_URL.split('/functions/')[0];
            const response = await fetch(`${projectUrl}/functions/v1/upload-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'apikey': SUPABASE_KEY
                },
                body: JSON.stringify({ data: this.jsonData, type: this.detectedType })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Error de servidor');

            const now = new Date().toLocaleString();
            localStorage.setItem('busint_last_sync', now);
            document.getElementById('stat-last-sync').textContent = now;

            // Mostrar vista de resultados
            document.getElementById('spreadsheet-wrapper').style.display = 'none';
            document.getElementById('jsonPreview').style.display = 'none';
            document.getElementById('results-view').style.display = 'block';
            
            document.getElementById('res-updated').textContent = result.data.updated || 0;
            document.getElementById('res-inserted').textContent = result.data.inserted || 0;
            document.getElementById('res-errors').textContent = result.data.errors || 0;

            this.setStatus('Sincronización completada', 'ready');
            
        } catch (error) {
            console.error('Sync Error:', error);
            Swal.fire('Error', error.message, 'error');
            this.setStatus('Error en la sincronización', 'error');
            this.toggleSync(true);
        }
    }
}

// Inicialización de la instancia
const app = new Application();

// Exponer funciones globales inmediatamente
window.resetUpload = () => {
    if (app.spreadsheet) app.spreadsheet.setData([[]]);
    app.resetState();
};
window.handleToggleJSONView = () => app.handleToggleJSONView();
window.handleDownloadJSON = () => app.handleDownloadJSON();
window.handleCopyJSON = () => app.handleCopyJSON();
window.handleDownloadFullTable = () => app.handleDownloadFullTable();

// Inicialización cuando el DOM esté listo
window.addEventListener('DOMContentLoaded', () => {
    app.init();
});
