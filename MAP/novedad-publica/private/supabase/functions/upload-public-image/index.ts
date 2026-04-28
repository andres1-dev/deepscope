import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE SEGURIDAD
// ═══════════════════════════════════════════════════════════════════════════
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const BUCKET_NAME = 'novedades-imagenes';

// Rate limiting
const RATE_LIMIT_PER_HOUR = 10;
const RATE_LIMIT_SEARCH_PER_MINUTE = 30;
const rateLimitMap = new Map();
const searchRateLimitMap = new Map();

// Configuración de notificaciones (GAS)
const GAS_NOTIF_URL = 'https://script.google.com/macros/s/AKfycbzHAUyOQ7dZe0BbkE3OPosqqO4Z8UfICbBOiVcbFaXW6mJwF39FQTQ1OZKMgTh-yli5/exec';

// ═══════════════════════════════════════════════════════════════════════════
// FUNCIONES AUXILIARES
// ═══════════════════════════════════════════════════════════════════════════

function getClientIP(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0] || 
         req.headers.get('x-real-ip') || 
         'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, {
      count: 1,
      resetTime: now + 3600000
    });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_PER_HOUR) {
    return false;
  }
  
  record.count++;
  return true;
}

function checkSearchRateLimit(ip) {
  const now = Date.now();
  const record = searchRateLimitMap.get(ip);
  
  if (!record || now > record.resetTime) {
    searchRateLimitMap.set(ip, {
      count: 1,
      resetTime: now + 60000
    });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_SEARCH_PER_MINUTE) {
    return false;
  }
  
  record.count++;
  return true;
}

function sanitizeString(str, maxLength = 500) {
  if (!str) return '';
  return str
    .toString()
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, '');
}

function validateOP(op) {
  return /^[0-9]+$/.test(op) && op.length > 0 && op.length < 20;
}

function validateArea(area) {
  const validAreas = ['INSUMOS', 'CORTE', 'TELAS', 'CODIGOS', 'DISEÑO', 'OTROS'];
  return validAreas.includes(area);
}

function validateEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 100;
}

async function notificarGuest(supabase, idNovedad, dataNotif) {
  try {
    console.log(`[NOTIF] Notificando Guest para ${idNovedad}...`);
    
    const { data: nov, error: errN } = await supabase
      .from('NOVEDADES')
      .select('PLANTA, OP, REFERENCIA')
      .eq('ID_NOVEDAD', idNovedad)
      .single();
      
    if (errN || !nov) {
      console.warn(`[NOTIF] No se encontró novedad ${idNovedad}`);
      return;
    }

    const { data: plant, error: errP } = await supabase
      .from('PLANTAS')
      .select('EMAIL, PLANTA')
      .eq('PLANTA', nov.PLANTA)
      .single();

    if (errP || !plant || !plant.EMAIL) {
      console.warn(`[NOTIF] No se encontró email para planta ${nov.PLANTA}`);
      return;
    }

    const payload = {
      ...dataNotif,
      email: plant.EMAIL,
      nombre: plant.PLANTA,
      idNovedad: idNovedad,
      op: nov.OP,
      referencia: nov.REFERENCIA
    };

    await fetch(GAS_NOTIF_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    
    console.log(`[NOTIF] Notificación enviada exitosamente`);
  } catch (e) {
    console.error("[NOTIF] Error:", e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVIDOR PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  // Manejar preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  const url = new URL(req.url);
  
  console.log(`[REQUEST] IP: ${clientIP}, Method: ${req.method}, Path: ${url.pathname}`);

  try {
    // Crear cliente de Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ═══════════════════════════════════════════════════════════
    // ENDPOINT GET: BUSCAR OP EN BUSINT
    // ═══════════════════════════════════════════════════════════
    
    if (req.method === "GET") {
      // Rate limiting para búsquedas
      if (!checkSearchRateLimit(clientIP)) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Demasiadas búsquedas. Intente nuevamente en un minuto."
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 429,
          }
        );
      }

      const op = url.searchParams.get('op');
      const plantaId = url.searchParams.get('plantaId');
      
      // ═══════════════════════════════════════════════════════════
      // NUEVO: BUSCAR POR ID DE PLANTA (CÉDULA)
      // ═══════════════════════════════════════════════════════════
      if (plantaId) {
        console.log('[SEARCH] Buscando planta por ID:', plantaId);
        
        // 1. Obtener datos de la planta
        const { data: plantaRecord, error: plantaError } = await supabaseClient
          .from('PLANTAS')
          .select('PLANTA, EMAIL')
          .eq('ID_PLANTA', plantaId)
          .maybeSingle();

        if (plantaError || !plantaRecord) {
          console.log('[SEARCH] Planta no encontrada:', plantaId);
          return new Response(
            JSON.stringify({
              success: false,
              message: "Identificación de planta no encontrada."
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 404,
            }
          );
        }

        // 2. Buscar OPs asociadas en BUSINT
        console.log('[SEARCH] Buscando OPs para planta:', plantaRecord.PLANTA);
        const { data: opsData, error: opsError } = await supabaseClient
          .from('BUSINT')
          .select('OP, Ref, InvPlanta, Descripcion, FSalidaConf, Proceso, Cuento, Genero')
          .eq('NombrePlanta', plantaRecord.PLANTA)
          .order('OP', { ascending: false })
          .limit(30);

        if (opsError) throw opsError;

        return new Response(
          JSON.stringify({
            success: true,
            planta: plantaRecord.PLANTA,
            email: plantaRecord.EMAIL,
            needsEmail: !plantaRecord.EMAIL || plantaRecord.EMAIL.trim() === '',
            ops: (opsData || []).map(record => ({
              OP:         sanitizeString(record.OP, 50),
              referencia: sanitizeString(record.Ref || '', 100),
              cantidad:   parseInt(record.InvPlanta) || 0,
              prenda:     sanitizeString(record.Descripcion || '', 100),
              salida:     sanitizeString(record.FSalidaConf || '', 50),
              proceso:    sanitizeString(record.Proceso || '', 100),
              linea:      sanitizeString(record.Cuento || '', 50),
              genero:     sanitizeString(record.Genero || '', 50),
              planta:     plantaRecord.PLANTA
            }))
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      }
      
      // ═══════════════════════════════════════════════════════════
      // BUSCAR OP DIRECTA
      // ═══════════════════════════════════════════════════════════
      if (!op) {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Identificación de planta o número de OP requerido"
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
          }
        );
      }

      // Validar formato de OP
      if (!validateOP(op)) {
        return new Response(
          JSON.stringify({ success: false, message: "Número de OP inválido" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      console.log('[SEARCH] Buscando OP en BUSINT:', op);
      const opNum = parseInt(op);
      const query = supabaseClient.from('BUSINT').select('*');
      if (!isNaN(opNum)) query.or(`OP.eq.${op},OP.eq.${opNum}`);
      else query.eq('OP', op);

      const { data: busintData, error: busintError } = await query.limit(1);

      if (busintError) throw busintError;

      if (!busintData || busintData.length === 0) {
        return new Response(
          JSON.stringify({ success: false, message: `No se encontró información para la OP: ${op}`, found: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
        );
      }

      const record = busintData[0];
      const opData = {
        OP:         sanitizeString(record.OP         || op,  50),
        referencia: sanitizeString(record.Ref        || '', 100),
        cantidad:   parseInt(record.InvPlanta)       || 0,
        planta:     sanitizeString(record.NombrePlanta || '', 100),
        salida:     sanitizeString(record.FSalidaConf  || '',  50),
        proceso:    sanitizeString(record.Proceso      || '', 100),
        prenda:     sanitizeString(record.Descripcion  || '', 100),
        linea:      sanitizeString(record.Cuento       || '',  50),
        genero:     sanitizeString(record.Genero       || '',  50),
      };

      // Verificar email
      let needsEmail = false;
      let currentEmail = null;
      if (opData.planta) {
        const { data: pData } = await supabaseClient.from('PLANTAS').select('EMAIL').eq('PLANTA', opData.planta).maybeSingle();
        if (pData) {
          currentEmail = pData.EMAIL;
          needsEmail = !pData.EMAIL || pData.EMAIL.trim() === '';
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "OP encontrada", found: true, data: opData, needsEmail, currentEmail }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // ENDPOINT POST: CREAR NOVEDAD O ACTUALIZAR EMAIL
    // ═══════════════════════════════════════════════════════════
    
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Método no permitido. Use GET para buscar OP o POST para crear novedad."
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 405,
        }
      );
    }

    // Rate limiting
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Límite de solicitudes excedido. Intente nuevamente en una hora."
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        }
      );
    }

    // Obtener payload
    const payload = await req.json();
    
    console.log('[PAYLOAD] Recibido:', {
      hasImage: !!payload.imagen,
      OP: payload.OP,
      area: payload.area,
      soloActualizarEmail: payload._soloActualizarEmail
    });

    // ═══════════════════════════════════════════════════════════
    // MODO ESPECIAL: SOLO ACTUALIZAR EMAIL
    // ═══════════════════════════════════════════════════════════
    
    if (payload._soloActualizarEmail && payload.correo && payload.planta) {
      console.log('[EMAIL_UPDATE] Modo actualización de email solamente');
      
      const correoTrimmed = payload.correo.trim();
      
      if (!validateEmail(correoTrimmed)) {
        throw new Error("El correo electrónico proporcionado no es válido");
      }

      const plantaName = payload.planta;
      
      console.log('[EMAIL_UPDATE] Actualizando email para planta:', plantaName);
      
      // Verificar si la planta existe y si ya tiene email
      const { data: plantaExistente, error: plantaCheckError } = await supabaseClient
        .from('PLANTAS')
        .select('EMAIL, PLANTA')
        .eq('PLANTA', plantaName)
        .single();

      if (plantaCheckError) {
        console.warn('[EMAIL_UPDATE] No se encontró la planta:', plantaName);
        throw new Error(`No se encontró la planta: ${plantaName}`);
      }
      
      if (plantaExistente) {
        // Solo actualizar si no tiene email o si es diferente
        if (!plantaExistente.EMAIL || plantaExistente.EMAIL.trim() === '') {
          const { error: updateError } = await supabaseClient
            .from('PLANTAS')
            .update({ EMAIL: correoTrimmed })
            .eq('PLANTA', plantaName);

          if (updateError) {
            console.error('[EMAIL_UPDATE] Error al actualizar:', updateError);
            throw new Error('Error al actualizar el email');
          }
          
          console.log('[EMAIL_UPDATE] Email actualizado exitosamente');
          
          return new Response(
            JSON.stringify({
              success: true,
              message: "Email actualizado exitosamente",
              email: correoTrimmed
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        } else {
          console.log('[EMAIL_UPDATE] La planta ya tiene email registrado');
          return new Response(
            JSON.stringify({
              success: true,
              message: "La planta ya tiene email registrado",
              email: plantaExistente.EMAIL
            }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 200,
            }
          );
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // VALIDAR DATOS DEL FORMULARIO
    // ═══════════════════════════════════════════════════════════

    // Validar campos requeridos — campo es OP (no lote)
    if (!payload.OP || !validateOP(String(payload.OP))) {
      throw new Error("Número de OP inválido");
    }

    if (!payload.area || !validateArea(payload.area)) {
      throw new Error("Área inválida");
    }

    // Validar que la OP exista en BUSINT
    const opNumVal = parseInt(payload.OP);
    const validationQuery = supabaseClient.from('BUSINT').select('OP, Ref, InvPlanta, NombrePlanta');
    
    if (!isNaN(opNumVal)) {
      validationQuery.or(`OP.eq.${payload.OP},OP.eq.${opNumVal}`);
    } else {
      validationQuery.eq('OP', String(payload.OP));
    }

    const { data: busintDataValidation, error: busintErrorValidation } = await validationQuery.limit(1);

    if (busintErrorValidation) {
      console.error('[VALIDATION] Error en query BUSINT:', busintErrorValidation);
      throw busintErrorValidation;
    }

    if (!busintDataValidation || busintDataValidation.length === 0) {
      throw new Error(`No se encontró la OP ${payload.OP} en el sistema`);
    }

    const busintRecord = busintDataValidation[0];
    console.log('[VALIDATION] OP encontrada en BUSINT:', busintRecord.OP);

    // ═══════════════════════════════════════════════════════════
    // ACTUALIZAR EMAIL DE LA PLANTA (SI SE PROPORCIONA)
    // ═══════════════════════════════════════════════════════════

    if (payload.correo) {
      const correoTrimmed = payload.correo.trim();
      
      if (!validateEmail(correoTrimmed)) {
        throw new Error("El correo electrónico proporcionado no es válido");
      }

      const plantaName = payload.planta || busintRecord.NombrePlanta;
      
      if (plantaName) {
        console.log('[EMAIL] Actualizando email para planta:', plantaName);
        
        const { data: plantaExistente, error: plantaCheckError } = await supabaseClient
          .from('PLANTAS')
          .select('EMAIL, PLANTA')
          .eq('PLANTA', plantaName)
          .single();

        if (plantaCheckError) {
          console.warn('[EMAIL] No se encontró la planta:', plantaName);
        } else if (plantaExistente) {
          if (!plantaExistente.EMAIL || plantaExistente.EMAIL.trim() === '') {
            const { error: updateError } = await supabaseClient
              .from('PLANTAS')
              .update({ EMAIL: correoTrimmed })
              .eq('PLANTA', plantaName);

            if (updateError) {
              console.error('[EMAIL] Error al actualizar:', updateError);
              // No lanzar error — no queremos que falle la novedad por esto
            } else {
              console.log('[EMAIL] Email actualizado exitosamente');
            }
          } else {
            console.log('[EMAIL] La planta ya tiene email registrado, no se actualiza');
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PROCESAR IMAGEN (SI EXISTE)
    // ═══════════════════════════════════════════════════════════

    let imagenUrl = '';

    if (payload.imagen && payload.imagen.base64) {
      console.log('[IMAGE] Procesando imagen...');
      
      const imgData = payload.imagen;
      
      // Validar tipo MIME
      if (!ALLOWED_MIME_TYPES.includes(imgData.mimeType)) {
        throw new Error(`Tipo de imagen no permitido: ${imgData.mimeType}`);
      }

      // Decodificar base64
      const base64Data = imgData.base64.replace(/^data:image\/\w+;base64,/, '');
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const fileBlob = new Blob([bytes], { type: imgData.mimeType });

      // Validar tamaño
      if (fileBlob.size > MAX_FILE_SIZE) {
        throw new Error(`Imagen muy grande. Máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      }

      if (fileBlob.size === 0) {
        throw new Error("La imagen está vacía");
      }

      // Generar nombre único y seguro con estructura de carpetas por fecha
      const now = new Date();
      const year  = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day   = String(now.getDate()).padStart(2, '0');
      
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const sanitizedFileName = (imgData.fileName || 'upload.jpg')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .substring(0, 50);
      
      const uniqueFileName = `novedad_${timestamp}_${randomStr}_${sanitizedFileName}`;
      // Estructura: public/YYYY/MM/DD/archivo.jpg
      const filePath = `public/${year}/${month}/${day}/${uniqueFileName}`;

      console.log('[IMAGE] Subiendo:', {
        fileName: uniqueFileName,
        size: `${(fileBlob.size / 1024).toFixed(2)} KB`,
        mimeType: imgData.mimeType
      });

      // Subir a Supabase Storage
      const { data: uploadData, error: uploadError } = await supabaseClient
        .storage
        .from(BUCKET_NAME)
        .upload(filePath, fileBlob, {
          contentType: imgData.mimeType,
          upsert: false,
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('[IMAGE ERROR]', uploadError);
        throw new Error(`Error al subir imagen: ${uploadError.message}`);
      }

      // Obtener URL pública
      const { data: { publicUrl } } = supabaseClient
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

      imagenUrl = publicUrl;
      console.log('[IMAGE] Subida exitosa:', imagenUrl);
    }

    // ═══════════════════════════════════════════════════════════
    // PREPARAR DATOS PARA INSERTAR
    // ═══════════════════════════════════════════════════════════

    const idNovedad = "NOV-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase();

    const novedadData = {
      ID_NOVEDAD:          idNovedad,
      FECHA:               new Date().toISOString().split('T')[0],
      LOTE:                sanitizeString(payload.OP, 50), // Mapeo OP -> LOTE para la DB legacy
      REFERENCIA:          sanitizeString(payload.referencia || busintRecord.Ref, 100),
      CANTIDAD:            parseInt(payload.cantidad) || busintRecord.InvPlanta || 0,
      PLANTA:              sanitizeString(payload.planta || busintRecord.NombrePlanta, 100),
      SALIDA:              sanitizeString(payload.salida, 50),
      LINEA:               sanitizeString(payload.linea, 50),
      PROCESO:             sanitizeString(payload.proceso, 100),
      PRENDA:              sanitizeString(payload.prenda, 100),
      GENERO:              sanitizeString(payload.genero, 50),
      TEJIDO:              sanitizeString(payload.tejido, 50), // Agregado tejido
      AREA:                sanitizeString(payload.area, 50),
      TIPO_NOVEDAD:        sanitizeString(payload.tipoNovedad, 50) || null,
      TIPO_DETALLE:        payload.tipoDetalle || null,
      DESCRIPCION:         sanitizeString(payload.descripcion, 1000),
      CANTIDAD_SOLICITADA: parseInt(payload.cantidadSolicitada) || 0,
      IMAGEN:              imagenUrl,
      ESTADO:              'PENDIENTE',
      CHAT:                null,
      CHAT_READ:           null,
      HISTORIAL_ESTADOS:   null
    };

    console.log('[INSERT] Insertando novedad:', idNovedad);

    // ═══════════════════════════════════════════════════════════
    // INSERTAR EN BASE DE DATOS
    // ═══════════════════════════════════════════════════════════

    const { data: insertData, error: insertError } = await supabaseClient
      .from('NOVEDADES')
      .insert([novedadData])
      .select()
      .single();

    if (insertError) {
      console.error('[INSERT ERROR]', insertError);
      
      // Si falla la inserción y ya subimos imagen, intentar eliminarla
      if (imagenUrl) {
        try {
          const urlParts = imagenUrl.split(`${BUCKET_NAME}/`);
          if (urlParts.length > 1) {
            const filePath = urlParts[1];
            await supabaseClient.storage.from(BUCKET_NAME).remove([filePath]);
            console.log('[CLEANUP] Imagen eliminada tras error de inserción');
          }
        } catch (e) {
          console.error('[CLEANUP ERROR]', e);
        }
      }
      
      throw new Error(`Error al guardar novedad: ${insertError.message}`);
    }

    console.log('[SUCCESS] Novedad creada:', insertData.ID_NOVEDAD);

    // ═══════════════════════════════════════════════════════════
    // NOTIFICAR A LA PLANTA
    // ═══════════════════════════════════════════════════════════

    // Notificar de forma asíncrona (no bloquear respuesta)
    notificarGuest(supabaseClient, insertData.ID_NOVEDAD, {
      accion: 'NOVEDAD_REGISTRADA'
    }).catch(e => console.error('[NOTIF ERROR]', e));

    // ═══════════════════════════════════════════════════════════
    // RESPUESTA EXITOSA
    // ═══════════════════════════════════════════════════════════

    return new Response(
      JSON.stringify({
        success: true,
        message: "Novedad registrada exitosamente",
        id: insertData.ID_NOVEDAD,
        ID_NOVEDAD: insertData.ID_NOVEDAD,
        imagenUrl: imagenUrl || null
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[ERROR]', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Error al procesar la solicitud",
        error: error.toString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
