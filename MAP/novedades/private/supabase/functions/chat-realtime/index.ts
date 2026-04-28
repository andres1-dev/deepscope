import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

/**
 * Edge Function: Chat Realtime
 * 
 * Función optimizada para operaciones de chat en tiempo real
 * - Lectura ultra-rápida de mensajes con filtros
 * - Sin caché, siempre datos frescos
 * - Bypasea RLS usando Service Role Key
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const url = new URL(req.url)
    const action = url.searchParams.get("action") || "get_messages"

    switch (action) {
      case "get_messages": {
        // Obtener mensajes de chat con filtros opcionales
        const idNovedad = url.searchParams.get("id_novedad")
        const rol = url.searchParams.get("rol") // ADMIN, GUEST, etc.
        const limit = parseInt(url.searchParams.get("limit") || "1000")

        let query = supabaseClient
          .from('CHAT')
          .select('*')
          .order('TS', { ascending: true })
          .limit(limit)

        // Aplicar filtros
        if (idNovedad) {
          query = query.eq('ID_NOVEDAD', idNovedad)
        }
        
        // IMPORTANTE: Filtrar por la columna ROL, no AUTOR
        // ROL contiene: GUEST, ADMIN, USER-P
        // AUTOR contiene: el nombre de la persona
        if (rol) {
          query = query.eq('ROL', rol)
        }

        const { data, error } = await query

        if (error) throw error

        return new Response(JSON.stringify({
          success: true,
          messages: data || [],
          count: data?.length || 0
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        })
      }

      case "get_unread_count": {
        // Contar mensajes no leídos por novedad
        const idNovedad = url.searchParams.get("id_novedad")
        const rol = url.searchParams.get("rol")

        if (!idNovedad) {
          throw new Error("Se requiere id_novedad")
        }

        let query = supabaseClient
          .from('CHAT')
          .select('*', { count: 'exact', head: true })
          .eq('ID_NOVEDAD', idNovedad)
          .eq('IS_READ', false)

        if (rol) {
          query = query.neq('AUTOR', rol) // Mensajes que NO son míos
        }

        const { count, error } = await query

        if (error) throw error

        return new Response(JSON.stringify({
          success: true,
          unread_count: count || 0
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        })
      }

      case "get_latest_by_novedad": {
        // Obtener el último mensaje de cada novedad (para badges)
        const rol = url.searchParams.get("rol") // Filtrar por rol del autor
        
        // Obtener todos los mensajes
        let query = supabaseClient
          .from('CHAT')
          .select('*')
          .order('TS', { ascending: false })

        // IMPORTANTE: Filtrar por la columna ROL, no AUTOR
        // ROL contiene: GUEST, ADMIN, USER-P
        // AUTOR contiene: el nombre de la persona
        if (rol) {
          query = query.eq('ROL', rol)
        }

        const { data, error } = await query

        if (error) throw error

        // Agrupar por ID_NOVEDAD y quedarnos solo con el más reciente
        const latestByNovedad: Record<string, any> = {}
        
        for (const msg of (data || [])) {
          const novId = msg.ID_NOVEDAD
          if (!latestByNovedad[novId]) {
            latestByNovedad[novId] = msg
          }
        }

        return new Response(JSON.stringify({
          success: true,
          messages: Object.values(latestByNovedad),
          count: Object.keys(latestByNovedad).length
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        })
      }

      case "get_all": {
        // Obtener TODOS los mensajes (sin filtros)
        const { data, error } = await supabaseClient
          .from('CHAT')
          .select('*')
          .order('TS', { ascending: true })

        if (error) throw error

        return new Response(JSON.stringify({
          success: true,
          messages: data || [],
          count: data?.length || 0
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        })
      }

      default:
        throw new Error(`Acción no soportada: ${action}`)
    }

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
