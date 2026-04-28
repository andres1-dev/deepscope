import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import { decode } from "https://deno.land/std@0.177.0/encoding/base64.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Configuración de Notificaciones (GAS)
const GAS_NOTIF_URL = 'https://script.google.com/macros/s/AKfycbzHAUyOQ7dZe0BbkE3OPosqqO4Z8UfICbBOiVcbFaXW6mJwF39FQTQ1OZKMgTh-yli5/exec';

async function notificarGuest(supabase: any, idNovedad: string, dataNotif: any) {
  try {
    console.log(`[NOTIF] Intentando notificar a Guest para ${idNovedad}...`);
    console.log(`[NOTIF] Datos de notificación:`, dataNotif);
    
    // Obtener datos de la novedad y de la planta vinculada
    const { data: nov, error: errN } = await supabase
      .from('NOVEDADES')
      .select('PLANTA, LOTE, REFERENCIA')
      .eq('ID_NOVEDAD', idNovedad)
      .single();
      
    if (errN || !nov) {
      console.warn(`[NOTIF] No se pudo encontrar reporte ${idNovedad}`);
      return;
    }

    // Buscar el email de la planta
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
      lote: nov.LOTE,
      referencia: nov.REFERENCIA
    };

    console.log(`[NOTIF] Payload completo a enviar:`, payload);

    const res = await fetch(GAS_NOTIF_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    
    const resJson = await res.json();
    console.log(`[NOTIF] Respuesta GAS:`, resJson);
  } catch (e) {
    console.error("[NOTIF] Error en flujo de notificación:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const payload = await req.json()
    const { accion, hoja, url } = payload
    
    // ── VALIDACIÓN DE SEGURIDAD (RLS para Edge Functions) ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error("No autorizado: Falta token de sesión")
    
    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authErr || !user) throw new Error("No autorizado: Sesión inválida o expirada")

    const userRole = (user.app_metadata?.role || user.user_metadata?.role || 'GUEST').toUpperCase()
    
    // Restricciones de acciones administrativas
    const adminActions = ['LISTAR_USUARIOS', 'CREAR_USUARIO', 'UPDATE_USER', 'ELIMINAR_USUARIO', 'CREAR_PLANTA', 'ACTUALIZAR_PLANTA'];
    if (adminActions.includes(accion) && !['ADMIN', 'MODERATOR'].includes(userRole)) {
      throw new Error("Acceso denegado: Se requieren permisos de administrador")
    }

    const id = payload.id || payload.idNovedad || payload.idReporte;
    let result = { success: false, message: "" }

    console.log(`[OPERATIONS] Acción: ${accion || 'INSERT'}, Usuario: ${user.email}, Rol: ${userRole}`)

    // ── LÓGICA DE ARCHIVO (IMAGEN) ──
    let publicUrl = ""
    const imgData = payload.imagen || payload.archivo // Soporta ambos formatos de payload
    if (imgData && imgData.base64) {
      const fileName = `${Date.now()}_${imgData.fileName || 'upload.jpg'}`
      const contentType = imgData.mimeType || 'image/jpeg'
      const base64Data = imgData.base64

      const { data: storageData, error: storageError } = await supabaseClient
        .storage
        .from('soportes-r2')
        .upload(fileName, decode(base64Data), { contentType, upsert: true })

      if (storageError) throw storageError
      const { data: { publicUrl: pUrl } } = supabaseClient.storage.from('soportes-r2').getPublicUrl(fileName)
      publicUrl = pUrl
    }

    // ── MANEJO DE ACCIONES ──
    switch (accion) {
      case "SUBIR_ARCHIVO":
        if (!publicUrl) throw new Error("No se pudo procesar el archivo")
        result = { success: true, url: publicUrl }
        break;

      case "UPDATE_ARCHIVO_URL":
        if (!hoja || !id || !url) throw new Error("Faltan parámetros para actualizar URL")
        const tableUp = hoja.toUpperCase()
        const pkName = tableUp === 'NOVEDADES' ? 'ID_NOVEDAD' : (tableUp === 'REPORTES' ? 'ID_REPORTE' : 'ID');
        const colName = tableUp === 'REPORTES' ? 'SOPORTE' : 'IMAGEN';

        const { error: errUrl } = await supabaseClient
          .from(tableUp)
          .update({ [colName]: url })
          .eq(pkName, id)
        if (errUrl) throw errUrl
        result = { success: true, message: "URL de imagen actualizada" }
        break;

      case "UPDATE_NOVEDAD": {
        const idNov = payload.timestampId || payload.id;
        
        if (!idNov) {
          throw new Error('Se requiere timestampId para actualizar la novedad');
        }

        // Construir objeto de actualización
        const updateData: any = {};
        
        if (payload.area !== undefined) updateData.AREA = payload.area;
        if (payload.tipoNovedad !== undefined) updateData.TIPO_NOVEDAD = payload.tipoNovedad;
        if (payload.cantidadSolicitada !== undefined) updateData.CANTIDAD_SOLICITADA = payload.cantidadSolicitada;
        if (payload.descripcion !== undefined) updateData.DESCRIPCION = payload.descripcion;
        if (payload.comentarios !== undefined) updateData.COMENTARIOS = payload.comentarios;
        if (payload.cobro !== undefined) updateData.COBRO = payload.cobro;
        
        // TIPO_DETALLE debe ser JSONB, convertir a JSON si es necesario
        if (payload.tipoDetalle !== undefined) {
          updateData.TIPO_DETALLE = payload.tipoDetalle;
        }

        console.log('[UPDATE_NOVEDAD] Actualizando:', idNov, updateData);

        const { error: errUpdate } = await supabaseClient
          .from('NOVEDADES')
          .update(updateData)
          .eq('ID_NOVEDAD', idNov);

        if (errUpdate) {
          console.error('[UPDATE_NOVEDAD] Error:', errUpdate);
          throw errUpdate;
        }

        result = { success: true, message: "Novedad actualizada correctamente" };
        break;
      }

      case "UPDATE_ESTADO": {
        const idNov = payload.timestampId || payload.id;
        
        // Obtener el estado actual para construir el historial
        const { data: novData } = await supabaseClient
          .from('NOVEDADES')
          .select('ESTADO, HISTORIAL_ESTADOS, PLANTA, COMENTARIOS, COBRO')
          .eq('ID_NOVEDAD', idNov)
          .single();
        
        const estadoAnterior = novData?.ESTADO || 'PENDIENTE';
        const historialActual = novData?.HISTORIAL_ESTADOS || '';
        const planta = novData?.PLANTA || '';
        const comentarios = novData?.COMENTARIOS || '';
        const cobro = novData?.COBRO || '';
        
        // Construir nueva entrada de historial: "ANTERIOR->NUEVO@timestamp"
        const timestamp = new Date().toISOString();
        const nuevaEntrada = `${estadoAnterior}->${payload.nuevoEstado}@${timestamp}`;
        const nuevoHistorial = historialActual 
          ? `${historialActual}|${nuevaEntrada}` 
          : nuevaEntrada;
        
        // Actualizar estado e historial
        const { error: errEst } = await supabaseClient
          .from('NOVEDADES')
          .update({ 
            ESTADO: payload.nuevoEstado,
            HISTORIAL_ESTADOS: nuevoHistorial
          })
          .eq('ID_NOVEDAD', idNov)
        if (errEst) throw errEst

        // Enviar broadcast manual para notificar al GUEST (bypasea RLS)
        const channel = supabaseClient.channel('novedades-broadcast');
        await channel.send({
          type: 'broadcast',
          event: 'estado_changed',
          payload: {
            ID_NOVEDAD: idNov,
            ESTADO: payload.nuevoEstado,
            ESTADO_ANTERIOR: estadoAnterior,
            PLANTA: planta,
            TIMESTAMP: timestamp
          }
        });

        result = { success: true, message: "Estado actualizado" }

        // Mantenimiento Automático: Archivar chat si se finaliza la novedad.
        if (payload.nuevoEstado === 'FINALIZADO' || payload.nuevoEstado === 'FINALIZADA' || payload.nuevoEstado === 'RESUELTA') {
          // Notificar resolución con solución y tipo de cobro
          notificarGuest(supabaseClient, idNov, { 
            accion: 'NOVEDAD_FINALIZADA_CON_SOLUCION',
            solucion: comentarios,
            tipoCobro: cobro
          });
          
          payload.idNovedad = idNov; // Set para que ARCHIVE_CHAT lo use
          // Procedemos intencionalmente al bloque de ARCHIVE_CHAT para que haga el trabajo manual.
        } else {
          // Notificar cambio de estado genérico
          notificarGuest(supabaseClient, idNov, { 
            accion: 'CAMBIO_ESTADO', 
            nuevoEstado: payload.nuevoEstado 
          });
          break;
        }
      }
      // NOTA FALLTHROUGH: Si UPDATE_ESTADO = FINALIZADA, caerá directo a ARCHIVE_CHAT para el mantenimiento.

      case "ARCHIVE_CHAT": {
        const idNovArc = payload.idNovedad || payload.timestampId || payload.id;
        if (!idNovArc) break;
        
        const { data: chatData, error: readErr } = await supabaseClient
          .from('CHAT')
          .select('*')
          .eq('ID_NOVEDAD', idNovArc)
          .order('TS', { ascending: true });

        if (chatData && chatData.length > 0) {
          // Comprimir a JSON liviano
          const archivedMsgs = chatData.map((msg: any) => ({
            id: msg.ID_MSG,
            autor: msg.AUTOR,
            rol: msg.ROL,
            mensaje: msg.MENSAJE,
            imagen_url: msg.IMAGEN_URL,
            ts: msg.TS
          }));

          const chatJsonStr = JSON.stringify({ msgs: archivedMsgs });
          
          await supabaseClient.from('NOVEDADES').update({ CHAT: chatJsonStr }).eq('ID_NOVEDAD', idNovArc);
          await supabaseClient.from('CHAT').delete().eq('ID_NOVEDAD', idNovArc);
          console.log(`[CHAT] Se archivaron ${chatData.length} mensajes para ${idNovArc}`);

          // Solo notificar finalización si realmente hubo un chat activo
          notificarGuest(supabaseClient, idNovArc, { accion: 'CHAT_FINALIZADO' });
        } else {
          console.log(`[CHAT] No había mensajes activos para ${idNovArc}, no se notifica finalización.`);
        }

        result = { success: true, message: "Chat archivado correctamente" };
        break;
      }

      case "REOPEN_CHAT": {
        const idNovRe = payload.idNovedad;
        if (!idNovRe) break;

        const { data: novData } = await supabaseClient.from('NOVEDADES').select('CHAT').eq('ID_NOVEDAD', idNovRe).single();
        if (novData && novData.CHAT) {
          try {
            const parsed = JSON.parse(novData.CHAT);
            const msgsArgs = parsed.msgs || [];
            if (msgsArgs.length > 0) {
               const insertPayloads = msgsArgs.map((m:any) => ({
                 ID_MSG: m.id || "MSG-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase(),
                 ID_NOVEDAD: idNovRe,
                 LOTE: payload.lote || 'HISTORICO',
                 OP: payload.lote || 'HISTORICO',
                 AUTOR: m.autor || '',
                 ROL: m.rol || '',
                 MENSAJE: m.mensaje || '',
                 IMAGEN_URL: m.imagen_url || m.img || '',
                 IS_READ: true,
                 TS: m.ts || new Date().toISOString(),
                 TIMESTAMP: m.ts || new Date().toISOString()
               }));
               await supabaseClient.from('CHAT').insert(insertPayloads);
            }
            await supabaseClient.from('NOVEDADES').update({ CHAT: null }).eq('ID_NOVEDAD', idNovRe);
            console.log(`[CHAT] Se restauraron ${msgsArgs.length} mensajes a la tabla CHAT para ${idNovRe}`);
          } catch(e) { 
            console.error('[CHAT] Error re-abriendo chat:', e); 
          }
        }
        result = { success: true, message: "Chat reabierto y restaurantes en tabla" };
        break;
      }

      case "GET_CHAT_MSGS": {
        const idNovGet = payload.idNovedad;
        if (!idNovGet) break;

        const { data: novGet } = await supabaseClient.from('NOVEDADES').select('CHAT, CHAT_READ').eq('ID_NOVEDAD', idNovGet).single();
        let msgsRet = [];
        let rReceipts = {};
        
        if (novGet && novGet.CHAT) {
           try { msgsRet = (JSON.parse(novGet.CHAT).msgs || []); } catch(e) {}
        }
        if (novGet && novGet.CHAT_READ) {
           try { rReceipts = typeof novGet.CHAT_READ === 'string' ? JSON.parse(novGet.CHAT_READ) : novGet.CHAT_READ; } catch(e) {}
        }
        result = { success: true, message: "OK", msgs: msgsRet, readReceipts: rReceipts } as any;
        break;
      }

      case "SEND_CHAT_MSG": {
        // Generar ID único corto: MSG-XXXXXXXX
        const msgId = "MSG-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase().padStart(8, '0');

        // Mapeo profesional: Separamos texto de imagen y quitamos PLANTA
        // Nota: El frontend ya envía los campos limpios y mapeados
        const insertData = {
          ID_MSG:     msgId,
          ID_NOVEDAD: String(payload.idNovedad || payload.ID_NOVEDAD || ''),
          LOTE:       String(payload.lote || payload.LOTE || ''),
          OP:         String(payload.op || payload.OP || ''),
          AUTOR:      String(payload.autor || ''),   // Recibe el Rol (ADMIN/GUEST)
          ROL:        String(payload.rol || ''),     // Recibe el Nombre Real
          MENSAJE:    String(payload.mensaje || ''), // Texto limpio
          IMAGEN_URL: String(payload.imagen_url || payload.imagen || ''), // URL de Drive
          IS_READ:    false,
          TS:         new Date().toISOString(),
          TIMESTAMP:  new Date().toISOString()
        }

        console.log("[CHAT] Insertando en estructura limpia:", insertData)

        const { error: errChat } = await supabaseClient
          .from('CHAT')
          .insert([insertData])

        if (errChat) {
          console.error("[CHAT] Error al insertar:", errChat.message)
          throw new Error(`Error de base de datos: ${errChat.message}`)
        }

        result = { success: true, message: "Mensaje guardado" }

        // NOTIFICACIÓN: Inicio de Chat
        // Si el autor NO es GUEST, verificar si es el primer mensaje del chat activo
        if (insertData.ROL !== 'Taller' && insertData.AUTOR !== 'GUEST') {
           const { count } = await supabaseClient
             .from('CHAT')
             .select('*', { count: 'exact', head: true })
             .eq('ID_NOVEDAD', insertData.ID_NOVEDAD);
           
           if (count === 1) { // Es el primer mensaje que se acaba de insertar
              notificarGuest(supabaseClient, insertData.ID_NOVEDAD, { 
                accion: 'CHAT_INICIADO' 
              });
           }
        }
        break;
      }

      case "MARK_READ":
        // Actualizar CHAT_READ en NOVEDADES (para tracking general)
        const { data: nD } = await supabaseClient.from('NOVEDADES').select('CHAT_READ').eq('ID_NOVEDAD', payload.idNovedad).single()
        let cR = nD?.CHAT_READ || {}
        if (typeof cR === 'string') cR = JSON.parse(cR);
        cR[payload.rol === 'GUEST' ? 'GUEST' : 'OPERATOR'] = new Date().toISOString()
        const { error: errR } = await supabaseClient.from('NOVEDADES').update({ CHAT_READ: cR }).eq('ID_NOVEDAD', payload.idNovedad)
        if (errR) throw errR
        
        // Actualizar IS_READ y READ_AT en mensajes de CHAT que NO son míos
        const myRol = payload.rol || 'GUEST'
        const { error: errChatRead } = await supabaseClient
          .from('CHAT')
          .update({ 
            IS_READ: true, 
            READ_AT: new Date().toISOString() 
          })
          .eq('ID_NOVEDAD', payload.idNovedad)
          .neq('ROL', myRol)  // Solo marcar mensajes que NO son míos
          .eq('IS_READ', false)  // Solo los que aún no están leídos
        
        if (errChatRead) throw errChatRead
        
        result = { success: true, message: "Leído" }
        break;

      case "UPDATE_USER": {
        const userId = String(payload.id);
        const emailToFind = payload.oldEmail || payload.correo || payload.CORREO;
        
        // 1. Búsqueda exhaustiva del UUID de Auth
        let targetAuthId = "";
        const { data: listData, error: listErr } = await supabaseClient.auth.admin.listUsers();
        if (listErr) throw listErr;
        const users = listData?.users || [];
        
        // Intentar encontrar por cualquier medio
        const found = users.find((u:any) => 
          u.id === userId || 
          u.email === emailToFind ||
          u.user_metadata?.id_usuario === userId ||
          u.user_metadata?.cedula === userId
        );

        if (found) {
          targetAuthId = found.id;
        } else if (userId.includes('-') && userId.length > 30) {
          targetAuthId = userId; // Si parece un UUID, lo usamos como último recurso
        }

        console.log(`[UPDATE_USER] Buscando: ${userId}/${emailToFind} -> Encontrado: ${targetAuthId}`);

        if (!targetAuthId) {
          throw new Error("No se pudo encontrar el usuario en el sistema de autenticación.");
        }

        // 2. Preparar datos de actualización limpios
        const attributes: any = {
          user_metadata: { ...found?.user_metadata },
          app_metadata: { ...found?.app_metadata }
        };

        if (payload.usuario !== undefined) attributes.user_metadata.full_name = payload.usuario;
        if (payload.rol !== undefined) {
            attributes.user_metadata.role = payload.rol;
            attributes.app_metadata = { ...attributes.app_metadata, role: payload.rol };
        }
        if (payload.telefono !== undefined) {
            let tel = String(payload.telefono);
            if (tel && !tel.startsWith('+')) tel = '+57' + tel;
            attributes.user_metadata.phone = tel;
            attributes.phone = tel;
        }
        if (payload.correo !== undefined && payload.correo !== found?.email) {
            attributes.email = payload.correo;
        }
        if (payload.password !== undefined && payload.password !== "") {
            attributes.password = payload.password;
        }

        // 3. Ejecutar actualización en Auth
        const { error: authErr } = await supabaseClient.auth.admin.updateUserById(targetAuthId, attributes);
        if (authErr) throw new Error("Error al actualizar identidad: " + authErr.message);

        // 4. Sincronización con tabla legada (ELIMINADA por solicitud del usuario)
        result = { success: true, message: "Usuario actualizado con éxito" };
        break;
      }

      case "ELIMINAR_USUARIO": {
        const userId = String(payload.id);
        
        // 1. Buscar el UUID real si lo que recibimos es la cédula/ID
        let targetAuthId = userId;
        if (!userId.includes('-')) {
           const { data: listData, error: listErr } = await supabaseClient.auth.admin.listUsers();
           if (listErr) throw listErr;
           const users = listData?.users || [];
           const found = users.find((u:any) => 
             u.user_metadata?.id_usuario === userId || 
             u.user_metadata?.cedula === userId
           );
           if (found) targetAuthId = found.id;
        }

        // 2. Borrar de Auth
        if (targetAuthId && targetAuthId.includes('-')) {
          const { error: delAuthErr } = await supabaseClient.auth.admin.deleteUser(targetAuthId);
          if (delAuthErr) console.warn("Error al borrar de Auth:", delAuthErr.message);
        }

        // 3. Borrar de tabla legada (ELIMINADA por solicitud del usuario)
        result = { success: true, message: "Usuario eliminado correctamente" };
        break;
      }

      case "ACTUALIZAR_PLANTA": {
        const plantId = payload.id;
        const plantData: any = {};
        const authData: any = { 
          user_metadata: {},
          app_metadata: {} 
        };

        // Datos para la tabla operativa
        if (payload.nombrePlanta !== undefined) plantData.PLANTA = payload.nombrePlanta;
        if (payload.email !== undefined) plantData.EMAIL = payload.email;
        if (payload.telefono !== undefined) plantData.TELEFONO = payload.telefono;
        if (payload.direccion !== undefined) plantData.DIRECCION = payload.direccion;
        if (payload.rol !== undefined) plantData.ROL = payload.rol;
        
        plantData.PAIS = payload.pais || null;
        plantData.DEPARTAMENTO = payload.departamento || null;
        plantData.CIUDAD = payload.ciudad || null;
        plantData.BARRIO = payload.barrio || null;
        plantData.CONTACTO = payload.contacto || null;

        // Datos para Auth
        if (payload.nombrePlanta !== undefined) {
           authData.user_metadata.full_name = payload.nombrePlanta;
           authData.app_metadata.planta = payload.nombrePlanta;
        }
        if (payload.rol !== undefined) {
           authData.user_metadata.role = payload.rol;
           authData.app_metadata.role = payload.rol;
        }
        if (payload.email !== undefined) authData.email = payload.email;
        if (payload.password !== undefined) authData.password = payload.password;

        // 1. Actualizar Auth (si tenemos el ID de Auth, que suele ser el email o uuid)
        // Intentamos buscar por email si el id no es UUID
        let targetAuthId = plantId;
        if (!plantId.includes('-')) { // No parece un UUID
           const { data: listData, error: listErr } = await supabaseClient.auth.admin.listUsers();
           if (listErr) throw listErr;
           const users = listData?.users || [];
           const found = users.find((u:any) => 
             u.email === (payload.email || plantData.EMAIL) || 
             u.user_metadata?.id_planta === plantId
           );
           if (found) targetAuthId = found.id;
        }

        if (targetAuthId.includes('-')) {
          const { error: authErrP } = await supabaseClient.auth.admin.updateUserById(targetAuthId, authData);
          if (authErrP) console.warn("No se pudo actualizar Auth:", authErrP.message);
        }

        // 2. Actualizar Tabla PLANTAS
        const { error: errP } = await supabaseClient
          .from('PLANTAS')
          .update(plantData)
          .eq('ID_PLANTA', plantId)
        
        if (errP) throw errP;
        result = { success: true, message: "Planta actualizada correctamente" }
        break;
      }

      case "CREAR_USUARIO": {
        // 1. Validar si el ID ya existe en el sistema (Búsqueda por metadatos)
        const { data: listData, error: listErr } = await supabaseClient.auth.admin.listUsers();
        if (listErr) throw listErr;
        const allUsers = listData?.users || [];
        const existingId = allUsers.find((u: any) => 
          u.user_metadata?.id_usuario === payload.id || 
          u.user_metadata?.cedula === payload.id
        );

        if (existingId) {
          throw new Error(`La identificación ${payload.id} ya está registrada para el usuario ${existingId.user_metadata?.full_name || existingId.email}.`);
        }

        // 2. Crear en Auth (MAP Style)
        let rawTel = payload.telefono || payload.TELEFONO;
        if (rawTel && !String(rawTel).startsWith('+')) rawTel = '+57' + rawTel;

        const { data: authUser, error: authErr } = await supabaseClient.auth.admin.createUser({
          email: payload.correo || payload.CORREO,
          password: payload.password || payload.CONTRASEÑA,
          phone: rawTel,
          email_confirm: true,
          user_metadata: {
            full_name: payload.usuario || payload.USUARIO,
            role: payload.rol || 'PENDIENTE',
            id_usuario: payload.id || payload.ID_USUARIO,
            phone: payload.telefono || payload.TELEFONO,
            cedula: payload.id || payload.ID_USUARIO
          },
          app_metadata: {
            role: payload.rol || 'PENDIENTE'
          }
        });

        if (authErr) {
          console.error("[CREAR_USUARIO] Error en Auth:", authErr);
          if (authErr.message.includes('already registered')) {
            if (authErr.message.toLowerCase().includes('phone')) {
              throw new Error('Este número de teléfono ya está registrado con otro usuario.');
            }
            throw new Error('Este correo ya está registrado en el sistema.');
          }
          throw new Error("Error de identidad: " + authErr.message);
        }

        // 2. Intentar guardar en tabla legada (ELIMINADA por solicitud del usuario)
        result = { 
          success: true, 
          message: "Usuario creado exitosamente en el sistema de identidad",
          id: payload.id || authUser.user.id
        }
        break;
      }

      case "CREAR_PLANTA": {
        // 1. Validar si el ID ya existe en el sistema (Búsqueda por metadatos)
        const { data: listDataP, error: listErrP } = await supabaseClient.auth.admin.listUsers();
        if (listErrP) throw listErrP;
        const allPlants = listDataP?.users || [];
        const existingIdP = allPlants.find((u: any) => 
          u.user_metadata?.id_planta === payload.id || 
          u.user_metadata?.id_usuario === payload.id
        );

        if (existingIdP) {
          throw new Error(`La identificación ${payload.id} ya está registrada para ${existingIdP.user_metadata?.full_name || existingIdP.email}.`);
        }

        // 2. Crear en Auth (MAP Style)
        let rawTelP = payload.telefono || payload.TELEFONO;
        if (rawTelP && !String(rawTelP).startsWith('+')) rawTelP = '+57' + rawTelP;

        const { data: authPlant, error: authErrP } = await supabaseClient.auth.admin.createUser({
          email: payload.email || payload.EMAIL,
          password: payload.password || payload.PASSWORD,
          phone: rawTelP,
          email_confirm: true,
          user_metadata: {
            full_name: payload.planta || payload.PLANTA,
            role: payload.rol || 'GUEST',
            id_planta: payload.id || payload.ID_PLANTA,
            phone: payload.telefono || payload.TELEFONO
          },
          app_metadata: {
            role: payload.rol || 'GUEST',
            planta: payload.planta || payload.PLANTA
          }
        });

        if (authErrP) {
          console.error("[CREAR_PLANTA] Error en Auth:", authErrP);
          if (authErrP.message.includes('already registered')) {
            if (authErrP.message.toLowerCase().includes('phone')) {
              throw new Error('Este teléfono ya está registrado para otro taller o usuario.');
            }
            throw new Error('Este correo ya está registrado para otro taller.');
          }
          throw new Error("Error de identidad (Planta): " + authErrP.message);
        }

        // 2. Guardar datos operativos en tabla PLANTAS (esta sí la mantenemos)
        const newPlantData: any = {
          ID_PLANTA: payload.id || payload.ID_PLANTA,
          PLANTA: payload.planta || payload.PLANTA,
          DIRECCION: payload.direccion || payload.DIRECCION,
          TELEFONO: payload.telefono || payload.TELEFONO,
          EMAIL: payload.email || payload.EMAIL,
          ROL: payload.rol || 'GUEST',
          PAIS: payload.pais || 'Colombia',
          DEPARTAMENTO: payload.departamento,
          CIUDAD: payload.ciudad,
          BARRIO: payload.barrio,
          CONTACTO: payload.contacto
        };

        const { error: errNewP } = await supabaseClient.from('PLANTAS').upsert([newPlantData]);
        if (errNewP) throw errNewP;

        result = { success: true, message: "Taller creado exitosamente en Auth y Base de Datos" }
        break;
      }

      case "SYNC_BUSINT": {
        // Vaciar tabla y reemplazar con los datos nuevos completos
        const { records: busintRecords } = payload;
        if (!busintRecords || !Array.isArray(busintRecords)) {
          throw new Error('Se requiere records[]');
        }

        // 1. Vaciar tabla
        const { error: delErr } = await supabaseClient
          .from('BUSINT')
          .delete()
          .neq('OP', '');
        if (delErr) throw new Error('Error al limpiar BUSINT: ' + delErr.message);

        // 2. Insertar en lotes de 200
        const batchSize = 200;
        let inserted = 0;
        const insertErrors: string[] = [];

        for (let i = 0; i < busintRecords.length; i += batchSize) {
          const batch = busintRecords.slice(i, i + batchSize);
          const { error: insErr } = await supabaseClient.from('BUSINT').insert(batch);
          if (insErr) {
            insertErrors.push(`Lote ${Math.floor(i / batchSize) + 1}: ${insErr.message}`);
          } else {
            inserted += batch.length;
          }
        }

        result = {
          success: insertErrors.length === 0,
          message: `BUSINT sincronizado: ${inserted} registros insertados`,
          inserted,
          errors: insertErrors
        } as any;
        break;
      }

      case "LISTAR_USUARIOS": {
        // Obtener usuarios directamente del sistema de Auth (MAP Style)
        const { data: listData, error: listErr } = await supabaseClient.auth.admin.listUsers();
        
        if (listErr) throw listErr;
        const users = listData.users;

        // Mapear al formato que espera la app de MI
        const mappedUsers = users.map((u: any) => ({
          ID_USUARIO: u.user_metadata?.id_usuario || u.id,
          USUARIO: u.user_metadata?.full_name || u.email.split('@')[0],
          CORREO: u.email,
          TELEFONO: u.user_metadata?.phone || '',
          ROL: u.user_metadata?.role || 'PENDIENTE',
          ULTIMO_ACCESO: u.last_sign_in_at,
          ID_AUTH: u.id
        }));

        result = { success: true, users: mappedUsers } as any;
        break;
      }

      default:
        // Caso genérico: Inserción (Novedades, Calidad, etc.)
        if (hoja) {
          const table = hoja.toUpperCase()
          const dataToInsert = { ...payload }
          delete dataToInsert.accion
          delete dataToInsert.hoja
          if (publicUrl) {
            // Unificar nombre de columna de imagen/soporte
            if (table === 'REPORTES') dataToInsert.soporte = publicUrl
            else dataToInsert.imagen = publicUrl
          }

          const finalData: any = {}
          for (const key in dataToInsert) {
            // No procesar IDs aquí, los manejamos abajo
            if (['id', 'ID_NOVEDAD', 'ID_REPORTE', 'ID_VISITA'].includes(key.toUpperCase())) continue;

            // Convertir camelCase a SNAKE_CASE para las columnas de la DB
            const snakeKey = key
              .replace(/([A-Z])/g, "_$1")
              .toUpperCase()
              .replace(/^_/, "");
            finalData[snakeKey] = dataToInsert[key]
          }

          // Generación de Identificadores siguiendo el patrón del usuario
          if (table === 'NOVEDADES' && !finalData.ID_NOVEDAD) {
            finalData.ID_NOVEDAD = "NOV-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase();
          }
          if (table === 'REPORTES' && !finalData.ID_REPORTE) {
            finalData.ID_REPORTE = "REP-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase();
          }
          if (table === 'RUTERO' && !finalData.ID_VISITA) {
            finalData.ID_VISITA = "VIS-" + Math.floor(Math.random() * 0x100000000).toString(16).toUpperCase();
          }

          if (table !== 'RUTERO' && !finalData.FECHA) finalData.FECHA = new Date().toISOString();
          if (table === 'NOVEDADES' && !finalData.ESTADO) finalData.ESTADO = 'PENDIENTE'; // Según JSON es PENDIENTE

          // Manejar AVANCE para REPORTES (no existe como columna, combinar en OBSERVACIONES)
          if (table === 'REPORTES' && finalData.AVANCE !== undefined) {
            if (finalData.AVANCE && finalData.AVANCE !== '' && finalData.AVANCE !== '0') {
              finalData.OBSERVACIONES = `[Avance: ${finalData.AVANCE}%] ` + (finalData.OBSERVACIONES || '');
            }
            delete finalData.AVANCE;
          }

          // Filtro estricto de columnas según esquema
          if (table === 'RUTERO') {
            const ruteroCols = ['ID_VISITA', 'FECHA_VISITA', 'AUDITOR', 'PLANTA', 'LOTE', 'REFERENCIA', 'PROCESO', 'TIPO_VISITA', 'DESTINO', 'CANTIDAD', 'PRIORIDAD', 'ESTADO'];
            for (const k of Object.keys(finalData)) {
              if (!ruteroCols.includes(k)) delete finalData[k];
            }
          } else if (table === 'REPORTES') {
            const reportesCols = ['ID_REPORTE', 'FECHA', 'LOTE', 'REFERENCIA', 'CANTIDAD', 'PLANTA', 'SALIDA', 'LINEA', 'PROCESO', 'PRENDA', 'GENERO', 'TEJIDO', 'EMAIL', 'LOCALIZACION', 'TIPO_VISITA', 'CONCLUSION', 'OBSERVACIONES', 'SOPORTE'];
            for (const k of Object.keys(finalData)) {
              if (!reportesCols.includes(k)) delete finalData[k];
            }
          }

          console.log(`[INSERT] Tabla: ${table}, Datos:`, finalData)

          const { data: insData, error: errIns } = await supabaseClient
            .from(table)
            .insert([finalData])
            .select()
            .single()

          if (errIns) {
            console.error(`[INSERT ERROR] Table: ${table}`, errIns)
            throw new Error(`Error insertando en ${table}: ${errIns.message}`)
          }

          result = {
            success: true,
            message: `Insertado en ${table}`,
            id: insData.ID_NOVEDAD || insData.ID_REPORTE || insData.ID_VISITA || insData.ID,
            ID_NOVEDAD: insData.ID_NOVEDAD
          }

          // Notificar al GUEST cuando se registra una nueva novedad
          if (table === 'NOVEDADES' && insData.ID_NOVEDAD) {
            notificarGuest(supabaseClient, insData.ID_NOVEDAD, {
              accion: 'NOVEDAD_REGISTRADA'
            });
          }
        }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })

  } catch (error) {
    console.error(`[OPERATIONS ERROR]`, error.message)
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
