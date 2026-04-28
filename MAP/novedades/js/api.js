/* ==========================================================================
   api.js — Comunicación con Supabase (Migrado desde GAS/Sheets)
   Depende de: config.js (CONFIG)
   ========================================================================== */

// ── Remapeo específico para tabla BUSINT ──
// Los datos vienen del CSV con nombres específicos que se mapean
// a los nombres que espera la aplicación (esquema legado)
const BUSINT_MAP = {
    'OP': 'LOTE',
    'Ref': 'REFERENCIA',
    'InvPlanta': 'CANTIDAD',
    'NombrePlanta': 'PLANTA',
    'FSalidaConf': 'SALIDA',
    'Proceso': 'PROCESO',
    'Descripcion': 'PRENDA',
    'Cuento': 'LINEA',
    'Genero': 'GENERO',
    'Tipo Tejido': 'TEJIDO'
};

// ── Inicialización de Configuración ──
// Las claves de Supabase ya no se exponen al cliente de JS. Todo fluye por Edge Functions.
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwaWtqamNiaWV2ZnB6ZWd1cG13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzU1NDEsImV4cCI6MjA5MjQ1MTU0MX0.HJxSSIcUSVrf5IAsjwnkf3eq0xZobchtlg1k_iFjW_g";

let _sbClient = null;
window.getSupabaseClient = function() {
    if (_sbClient) return _sbClient;
    if (!window.supabase) {
        return null;
    }
    const projectUrl = CONFIG.FUNCTIONS_URL.split('/functions/')[0];
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        _sbClient = supabase.createClient(projectUrl, SUPABASE_KEY);
    }
    return _sbClient;
};

let secureConfigPromise = null;

async function fetchSecureConfig() {
    return CONFIG;
}

// ── Caché en memoria para todas las tablas ──
// Evita re-fetches al cambiar de módulo dentro de la misma sesión de página.
// TTL por tabla (ms): SISPRO 15min, auth tables 10min, operativas 5min.
const _memCache = new Map(); // key → { data, ts }
const _CACHE_TTL = {
    BUSINT:    15 * 60 * 1000,
    PLANTAS:   10 * 60 * 1000,
    NOVEDADES:  5 * 60 * 1000,
    REPORTES:   5 * 60 * 1000,
    RUTERO:     5 * 60 * 1000,
    CHAT:       1 * 60 * 1000,
};

// Promesas en vuelo para evitar fetches duplicados simultáneos (deduplicación)
const _inFlight = new Map();

/**
 * Invalida el caché de una tabla para forzar recarga en el próximo fetch.
 * Útil después de insertar/actualizar registros.
 */
function invalidateCache(tableName) {
    const key = tableName.toUpperCase();
    _memCache.delete(key);
    // También limpiar sessionStorage legacy de BUSINT
    if (key === 'BUSINT') sessionStorage.removeItem('sb_cache_BUSINT');
}

/**
 * Warm-up de la edge function /query para evitar cold start en la primera carga real.
 * Se llama sin await para no bloquear nada.
 */
function _warmUpQuery() {
    const sb = getSupabaseClient();
    if (!sb) return;
    
    sb.auth.getSession().then(({ data: { session } }) => {
        const token = session ? session.access_token : SUPABASE_KEY;
        fetch(`${CONFIG.FUNCTIONS_URL}/query?table=PLANTAS`, {
            headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_KEY }
        }).catch(() => {});
    });
}

/**
 * Obtiene los datos de una tabla proxying a la Edge Function segura.
 * Incluye caché en memoria, deduplicación de requests y warm-up automático.
 */
async function fetchSupabaseData(tableName, options = {}) {
    const tableUpper = tableName.toUpperCase();
    const isBusint = tableUpper === 'BUSINT';
    const hasFilters = options.filters && options.filters.length > 0;

    // 1. Caché en memoria (solo para consultas sin filtros dinámicos)
    if (!options.noCache && !hasFilters) {
        const cached = _memCache.get(tableUpper);
        const ttl = _CACHE_TTL[tableUpper] || 5 * 60 * 1000;
        if (cached && (Date.now() - cached.ts) < ttl) {
            return _normalizeSupabaseData(cached.data, tableName);
        }

        // Fallback: caché sessionStorage legacy para BUSINT
        if (isBusint) {
            const raw = sessionStorage.getItem('sb_cache_BUSINT');
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    if (Date.now() - parsed.ts < ttl) {
                        _memCache.set(tableUpper, { data: parsed.data, ts: parsed.ts });
                        return _normalizeSupabaseData(parsed.data, tableName);
                    }
                } catch(e) {}
            }
        }
    }

    // 2. Deduplicación: si ya hay un fetch en vuelo para esta tabla, reutilizarlo
    const flightKey = tableUpper + (options.filters ? JSON.stringify(options.filters) : '');
    if (!options.noCache && _inFlight.has(flightKey)) {
        return _inFlight.get(flightKey);
    }

    // 3. Fetch real usando la Edge Function 'query' (Segura)
    const fetchPromise = (async () => {
        try {
            const queryParams = new URLSearchParams({ table: tableName });
            if (options.select) queryParams.append('select', options.select);
            
            if (options.filters) {
                options.filters.forEach(f => {
                    queryParams.append(`${f.type}_${f.column}`, f.value);
                });
            }

            // Obtener el token de sesión real para que RLS funcione
            let token = SUPABASE_KEY;
            const sb = getSupabaseClient();
            if (sb) {
                const { data: { session } } = await sb.auth.getSession();
                if (session) token = session.access_token;
            }
            
            const response = await fetch(`${CONFIG.FUNCTIONS_URL}/query?${queryParams.toString()}`, {
                headers: { 
                    'Authorization': `Bearer ${token}`, 
                    'apikey': SUPABASE_KEY 
                }
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
                throw new Error(err.error || `Error en servidor: ${response.status}`);
            }

            const data = await response.json();

            if (Array.isArray(data)) {
                // Guardar en caché solo si no tiene filtros dinámicos
                if (!hasFilters) {
                    _memCache.set(tableUpper, { data: data, ts: Date.now() });
                    if (isBusint) {
                        sessionStorage.setItem('sb_cache_BUSINT', JSON.stringify({ ts: Date.now(), data: data }));
                    }
                }
                return _normalizeSupabaseData(data, tableName);
            } else {
                throw new Error("Formato de respuesta inválido");
            }
        } catch (error) {
            console.error(`[API] Error crítico en fetchSupabaseData (${tableName}):`, error);
            throw error;
        } finally {
            _inFlight.delete(flightKey);
        }
    })();

    if (!options.noCache) {
        _inFlight.set(flightKey, fetchPromise);
        fetchPromise.finally(() => _inFlight.delete(flightKey));
    }

    return fetchPromise;
}

/** Helper para normalizar claves y aplicar mapeos legacy */
function _normalizeSupabaseData(records, tableName) {
    const tableUpper = tableName.toUpperCase();

    // Para BUSINT, NO convertir a mayúsculas porque los nombres del CSV tienen case-sensitive
    const isBusint = tableUpper === 'BUSINT';
    
    let normalized = records.map(r => {
        if (isBusint) {
            // Para BUSINT, mantener los nombres originales del CSV y mapear
            const remapped = {};
            
            // Copiar todos los campos originales
            for (const key in r) {
                remapped[key] = r[key];
            }
            
            // Agregar los campos mapeados para compatibilidad con la app
            for (const [csvName, appName] of Object.entries(BUSINT_MAP)) {
                if (csvName in r) {
                    // Convertir a string para asegurar compatibilidad
                    const value = r[csvName];
                    remapped[appName] = (value === null || value === undefined) ? '' : String(value);
                }
            }
            
            return remapped;
        } else {
            // Para otras tablas, normalizar a mayúsculas
            const obj = {};
            for (const key in r) {
                const val = r[key];
                const keyUpper = key.toUpperCase();
                
                // Preservar objetos JSONB (no convertir a string)
                if (val !== null && val !== undefined && typeof val === 'object') {
                    obj[keyUpper] = val;
                } else {
                    obj[keyUpper] = (val === null || val === undefined) ? '' : String(val);
                }
            }
            return obj;
        }
    });

    // Filtro de seguridad GUEST: solo aplica a tablas operativas, NO a usuarios/plantas/chat
    const sessionUser = (typeof currentUser !== 'undefined') ? currentUser : null;
    const skipFilter = ['PLANTAS', 'CHAT'].includes(tableUpper); 

    if (!skipFilter && sessionUser && sessionUser.ROL === 'GUEST' && sessionUser.PLANTA) {
        const userPlanta = String(sessionUser.PLANTA).trim().toUpperCase();

        // Filtrado inteligente: buscar en PLANTA (normalizado) o NombrePlanta (original BUSINT)
        normalized = normalized.filter(r => {
            const rowPlanta = String(r.PLANTA || r.NombrePlanta || '').trim().toUpperCase();
            return rowPlanta === userPlanta;
        });
    }

    return normalized;
}

/**
 * Carga todos los datos necesarios (lotes y plantas).
 */
async function fetchAllData() {
    const [lots, plantas] = await Promise.all([
        fetchSupabaseData('BUSINT'),
        fetchPlantasData()
    ]);

    return { lots, plantas };
}

/**
 * Obtiene el listado de novedades con filtro opcional por estado.
 * @param {boolean} soloFinalizados - Si es true, trae solo FINALIZADOS. Si es false, trae todo excepto FINALIZADOS.
 */
async function fetchNovedadesData(soloFinalizados = false) {
    // Usar la función query segura para evitar bloqueos por RLS en ADMIN
    const queryParams = new URLSearchParams({ table: 'NOVEDADES' });
    if (soloFinalizados) {
        queryParams.append('eq_ESTADO', 'FINALIZADO');
    } else {
        // Para traer PENDIENTE y ELABORACION, la función query actual no soporta NEQ fácilmente,
        // pero podemos filtrar en el cliente o mejorar la query. 
        // Por ahora, traemos todo y filtramos en el cliente para asegurar que nada se pierda.
    }
    
    const sb = getSupabaseClient();
    let token = SUPABASE_KEY;
    if (sb) {
        const { data: { session } } = await sb.auth.getSession();
        if (session) token = session.access_token;
    }

    const response = await fetch(`${CONFIG.FUNCTIONS_URL}/query?${queryParams.toString()}`, {
        headers: { 
            'Authorization': `Bearer ${token}`, 
            'apikey': SUPABASE_KEY 
        }
    });
    
    if (!response.ok) throw new Error('Error al consultar novedades');
    const data = await response.json();
    
    // Filtrado manual en cliente si no es soloFinalizados (para emular el NEQ FINALIZADO)
    if (!soloFinalizados) {
        return _normalizeSupabaseData(data.filter(n => (n.ESTADO || 'PENDIENTE') !== 'FINALIZADO'), 'NOVEDADES');
    }
    
    return _normalizeSupabaseData(data, 'NOVEDADES');
}

/**
 * Obtiene el listado de plantas.
 */
async function fetchPlantasData() {
    return fetchSupabaseData('PLANTAS');
}

/**
 * Obtiene el listado de usuarios desde Supabase Auth (MAP Style).
 */
async function fetchUsuariosData() {
    try {
        const sb = getSupabaseClient();
        let token = SUPABASE_KEY;
        if (sb) {
            const { data: { session } } = await sb.auth.getSession();
            if (session) token = session.access_token;
        }

        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({ accion: 'LISTAR_USUARIOS' })
        });

        if (!response.ok) throw new Error('Error al listar usuarios');
        const result = await response.json();
        return result.users || [];
    } catch (e) {
        console.error('[API] Error al listar usuarios de Auth:', e);
        return [];
    }
}

/**
 * Obtiene el listado completo de reportes de calidad.
 */
async function fetchReportesData() {
    return fetchSupabaseData('REPORTES');
}

/**
 * Obtiene el listado del rutero.
 */
async function fetchRuteroData() {
    return fetchSupabaseData('RUTERO');
}
/**
 * Llama a la Edge Function de IA para procesar texto.
 */
async function callSupabaseAI(text, promptType = 'CHAT_CORRECTION', context = null) {
    try {
        const sb = getSupabaseClient();
        let token = SUPABASE_KEY;
        if (sb) {
            const { data: { session } } = await sb.auth.getSession();
            if (session) token = session.access_token;
        }

        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/ai`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({ text, promptType, context })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Error de conexión' }));
            throw new Error(err.error || 'Error en la IA');
        }

        return await response.json();
    } catch (e) {
        console.error('[API] Error en callSupabaseAI:', e);
        throw e;
    }
}

/**
 * Sube una imagen a Supabase Storage mediante la Edge Function 'operations'
 * @param {File} file - El archivo a subir
 * @returns {Promise<string>} URL pública de la imagen
 */
async function uploadToSupabase(file) {
    try {
        console.log(`[UPLOAD] Iniciando subida de: ${file.name}`);
        
        // 1. Comprimir imagen (estándar MAP)
        const compressedBlob = await compressImage(file);
        
        // 2. Convertir a Base64 para el payload JSON
        const base64Data = await blobToBase64(compressedBlob);
        
        const sb = getSupabaseClient();
        let token = SUPABASE_KEY;
        if (sb) {
            const { data: { session } } = await sb.auth.getSession();
            if (session) token = session.access_token;
        }

        // 3. Enviar a Edge Function 'operations'
        const response = await fetch(`${CONFIG.FUNCTIONS_URL}/operations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'apikey': SUPABASE_KEY
            },
            body: JSON.stringify({
                accion: 'SUBIR_ARCHIVO',
                imagen: {
                    base64: base64Data,
                    mimeType: 'image/jpeg',
                    fileName: file.name.replace(/\.[^.]+$/, '.jpg')
                }
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({ message: 'Error de servidor' }));
            throw new Error(err.message || 'Error en la subida');
        }

        const result = await response.json();
        if (!result.success || !result.url) {
            throw new Error(result.message || 'No se recibió la URL de la imagen');
        }

        console.log(`[UPLOAD] Éxito: ${result.url}`);
        return result.url;

    } catch (e) {
        console.error('[UPLOAD] Error crítico:', e);
        throw e;
    }
}

/** Helper: Comprime imagen antes de subir (Balanceado: ~150KB) */
function compressImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            try {
                const MAX_W = 1024;
                let w = img.width, h = img.height;
                if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob(b => b ? resolve(b) : reject('Error Blob'), 'image/jpeg', 0.7);
            } catch (e) { reject(e); }
        };
        img.onerror = () => reject('Error Carga');
        img.src = url;
    });
}

/** Helper: Convierte Blob a Base64 (sin prefijo) */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Exportar a global
window.uploadToSupabase = uploadToSupabase;
