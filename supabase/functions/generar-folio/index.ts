// ══════════════════════════════════════════════════════════════════════════
// generar-folio/index.ts
// Supabase Edge Function — IDEA SCAN 2.0 / CCA Group
//
// Genera el siguiente Entry No. de forma atómica para evitar duplicados.
// Formato: {CODIGO}{YY}{MM}{SEQ:003}   ej. SAF2603002
//
// POST /functions/v1/generar-folio
// Body: { cliente_id: string, tipo?: "materia_prima" | "maquinaria" }
// Response: { entry_no: string, prefix: string, seq: number }
// ══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface RequestBody {
  cliente_id: string;
  tipo?: "materia_prima" | "maquinaria" | "refacciones" | "consumibles";
}

interface FolioResponse {
  entry_no: string;
  prefix: string;
  yymm: string;
  seq: number;
}

// ── CORS headers ───────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Handler ────────────────────────────────────────────────────────────────
serve(async (req: Request): Promise<Response> => {

  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  try {
    // ── 1. Parse body ──────────────────────────────────────────────────────
    const body: RequestBody = await req.json();
    const { cliente_id, tipo = "materia_prima" } = body;

    if (!cliente_id) {
      return json400("cliente_id es requerido");
    }

    // ── 2. Crear cliente Supabase con service_role (bypass RLS) ───────────
    const sbUrl  = Deno.env.get("SUPABASE_URL")!;
    const sbKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb     = createClient(sbUrl, sbKey, {
      db: { schema: "ideascan" },
      auth: { persistSession: false },
    });

    // ── 3. Obtener código del cliente ─────────────────────────────────────
    const { data: cliente, error: clienteErr } = await sb
      .from("clientes")
      .select("codigo")
      .eq("id", cliente_id)
      .single();

    if (clienteErr || !cliente?.codigo) {
      return json400(`Cliente ${cliente_id} no encontrado o sin código asignado`);
    }

    const codigoBase = (cliente.codigo as string).toUpperCase().trim();

    // Martech Maquinaria usa prefijo MAQ en lugar de MAR
    const prefix = (codigoBase === "MAR" && tipo === "maquinaria")
      ? "MAQ"
      : codigoBase;

    // ── 4. YYMM del momento actual (zona horaria UTC-6 / Monterrey) ────────
    const now   = new Date();
    // Ajuste a UTC-6 (CST fijo — sin horario de verano para consistencia)
    const cst   = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const yy    = String(cst.getUTCFullYear()).slice(2);   // "26"
    const mm    = String(cst.getUTCMonth() + 1).padStart(2, "0"); // "03"
    const yymm  = yy + mm;                                         // "2603"
    const likePattern = `${prefix}${yymm}%`;

    // ── 5. Consulta atómica con bloqueo de fila (NOWAIT) ──────────────────
    // Usamos la función RPC que definimos en el schema SQL para garantizar
    // atomicidad. Si la función no existe aún, fallback a COUNT+1 con retry.
    const { data: rpcData, error: rpcErr } = await sb.rpc("generar_entry_no", {
      p_cliente_id: cliente_id,
      p_tipo: tipo,
    });

    if (!rpcErr && rpcData) {
      // La función RPC devuelve "SAF2603-001" con guion; quitamos el guion
      // para el formato compacto SAF2603001 que usa el frontend
      const entryNoRaw: string = rpcData as string;
      const entryNoCompact = entryNoRaw.replace("-", "");
      const seqStr = entryNoRaw.split("-")[1] ?? "001";
      const seq    = parseInt(seqStr, 10);

      return jsonOk({ entry_no: entryNoCompact, prefix, yymm, seq });
    }

    // ── 6. Fallback: COUNT + 1 con retry hasta 3 veces ────────────────────
    // Se usa cuando la función RPC no existe todavía en la BD.
    let seq = 1;
    let entryNo = "";
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // Contar entries existentes en este prefijo+mes
      const { count, error: countErr } = await sb
        .from("recepciones")
        .select("entry_no", { count: "exact", head: true })
        .like("entry_no", likePattern);

      if (countErr) throw countErr;

      seq    = (count ?? 0) + 1 + attempt; // +attempt para retry anti-race
      entryNo = `${prefix}${yymm}${String(seq).padStart(3, "0")}`;

      // Verificar que no existe (doble check)
      const { data: exists } = await sb
        .from("recepciones")
        .select("entry_no")
        .eq("entry_no", entryNo)
        .maybeSingle();

      if (!exists) break; // No hay duplicado, podemos usar este folio
    }

    return jsonOk({ entry_no: entryNo, prefix, yymm, seq });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generar-folio] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────
function jsonOk(data: FolioResponse): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function json400(msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
