// ══════════════════════════════════════════════════════════════════════════
// check-sla/index.ts
// Supabase Edge Function — IDEA SCAN 2.0 / CCA Group
//
// Cron job que se ejecuta cada hora para verificar entradas sin completar
// que superen las 24 horas y generar alertas en la tabla "alertas".
//
// Configurar en Supabase → Edge Functions → Schedules:
//   Cron expression: 0 * * * *   (cada hora, en punto)
//   Function: check-sla
//
// También puede invocarse manualmente:
//   POST /functions/v1/check-sla
//   Body: { dry_run?: boolean, sla_horas?: number }
// ══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface EntradaVencida {
  id:             string;
  entry_no:       string;
  cliente_id:     string;
  cliente_nombre: string;
  tipo_recepcion: string;
  estado:         string;
  created_at:     string;
  horas_abiertas: number;
  operador_nombre: string | null;
}

interface Alerta {
  tipo:           string;
  severidad:      "info" | "warning" | "critical";
  titulo:         string;
  mensaje:        string;
  recepcion_id:   string;
  cliente_id:     string;
  datos:          Record<string, unknown>;
  resuelta:       boolean;
}

interface CheckResult {
  ejecutado_en:    string;
  dry_run:         boolean;
  sla_horas:       number;
  entradas_rev:    number;
  alertas_nuevas:  number;
  alertas_duplic:  number;
  detalle:         EntradaVencida[];
}

// ── Constantes ─────────────────────────────────────────────────────────────
const DEFAULT_SLA_HORAS = 24;
const SLA_CRITICO_HORAS = 48;  // Alerta critical si supera 48h
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Handler ────────────────────────────────────────────────────────────────
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  let dryRun   = false;
  let slaHoras = DEFAULT_SLA_HORAS;

  // Permitir configuración manual por body (cron lo llama sin body)
  if (req.method === "POST") {
    try {
      const body = await req.json();
      dryRun   = body?.dry_run   ?? false;
      slaHoras = body?.sla_horas ?? DEFAULT_SLA_HORAS;
    } catch {
      // body vacío (llamada de cron) — usar defaults
    }
  }

  const sbUrl = Deno.env.get("SUPABASE_URL")!;
  const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb    = createClient(sbUrl, sbKey, {
    db: { schema: "public" },
    auth: { persistSession: false },
  });

  try {
    const ahora    = new Date();
    const cutoff   = new Date(ahora.getTime() - slaHoras * 60 * 60 * 1000);
    const cutoffTs = cutoff.toISOString();

    // ── 1. Buscar recepciones abiertas que superaron el SLA ─────────────
    // Estados que cuentan como "sin completar": borrador, en_inspeccion
    const { data: recepciones, error: recErr } = await sb
      .from("recepciones")
      .select(`
        id,
        entry_no,
        cliente_id,
        tipo_recepcion,
        estado,
        created_at,
        operador_nombre,
        clientes ( nombre )
      `)
      .in("estado", ["borrador", "en_inspeccion"])
      .lt("created_at", cutoffTs)
      .order("created_at", { ascending: true });

    if (recErr) {
      console.error("[check-sla] Error consultando recepciones:", recErr.message);
      throw recErr;
    }

    // ── 2. También revisar tablas ideascan legacy (Martech / Cooper) ─────
    const { data: martechAbiertas } = await sb
      .schema("ideascan")
      .from("martech_entradas")
      .select("id, folio, created_at, operador_nombre")
      .eq("estado", "borrador")
      .lt("created_at", cutoffTs);

    const { data: cooperAbiertas } = await sb
      .schema("ideascan")
      .from("cooper_entradas")
      .select("id, folio, created_at, operador_nombre")
      .eq("estado", "borrador")
      .lt("created_at", cutoffTs);

    // ── 3. Construir lista consolidada ───────────────────────────────────
    type RecepcionRow = {
      id: string;
      entry_no: string;
      cliente_id: string;
      tipo_recepcion: string;
      estado: string;
      created_at: string;
      operador_nombre: string | null;
      clientes?: { nombre: string } | null;
    };
    const entradasVencidas: EntradaVencida[] = [
      ...(recepciones ?? []).map((r: RecepcionRow) => ({
        id:              r.id,
        entry_no:        r.entry_no,
        cliente_id:      r.cliente_id,
        cliente_nombre:  (r.clientes as { nombre: string } | null)?.nombre ?? "Desconocido",
        tipo_recepcion:  r.tipo_recepcion,
        estado:          r.estado,
        created_at:      r.created_at,
        horas_abiertas:  Math.round((ahora.getTime() - new Date(r.created_at).getTime()) / 3_600_000),
        operador_nombre: r.operador_nombre ?? null,
      })),
      ...(martechAbiertas ?? []).map((r: { id: string; folio: string; created_at: string; operador_nombre: string | null }) => ({
        id:              r.id,
        entry_no:        r.folio,
        cliente_id:      "martech",
        cliente_nombre:  "Martech Medical Products",
        tipo_recepcion:  "materia_prima",
        estado:          "borrador",
        created_at:      r.created_at,
        horas_abiertas:  Math.round((ahora.getTime() - new Date(r.created_at).getTime()) / 3_600_000),
        operador_nombre: r.operador_nombre ?? null,
      })),
      ...(cooperAbiertas ?? []).map((r: { id: string; folio: string; created_at: string; operador_nombre: string | null }) => ({
        id:              r.id,
        entry_no:        r.folio,
        cliente_id:      "cooper",
        cliente_nombre:  "Cooper Standard",
        tipo_recepcion:  "materia_prima",
        estado:          "borrador",
        created_at:      r.created_at,
        horas_abiertas:  Math.round((ahora.getTime() - new Date(r.created_at).getTime()) / 3_600_000),
        operador_nombre: r.operador_nombre ?? null,
      })),
    ];

    // ── 4. Generar alertas ───────────────────────────────────────────────
    let alertasNuevas   = 0;
    let alertasDuplic   = 0;
    const alertasAInsertar: Alerta[] = [];

    for (const entrada of entradasVencidas) {
      // Verificar si ya existe una alerta activa para este entry_no + tipo
      const { data: existente } = await sb
        .from("alertas")
        .select("id")
        .eq("recepcion_id", entrada.id)
        .eq("tipo", "sla_vencido")
        .eq("resuelta", false)
        .maybeSingle();

      if (existente) {
        alertasDuplic++;
        continue; // Ya hay alerta activa, no duplicar
      }

      const esCritico = entrada.horas_abiertas >= SLA_CRITICO_HORAS;
      const severidad: "warning" | "critical" = esCritico ? "critical" : "warning";

      alertasAInsertar.push({
        tipo:         "sla_vencido",
        severidad,
        titulo:       `SLA ${esCritico ? "CRÍTICO" : "VENCIDO"}: ${entrada.entry_no}`,
        mensaje:      `La entrada ${entrada.entry_no} del cliente ${entrada.cliente_nombre} lleva ${entrada.horas_abiertas}h sin completar (SLA: ${slaHoras}h). Estado: ${entrada.estado}. Operador: ${entrada.operador_nombre ?? "sin asignar"}.`,
        recepcion_id: entrada.id,
        cliente_id:   entrada.cliente_id,
        datos: {
          entry_no:        entrada.entry_no,
          cliente_nombre:  entrada.cliente_nombre,
          tipo_recepcion:  entrada.tipo_recepcion,
          estado:          entrada.estado,
          horas_abiertas:  entrada.horas_abiertas,
          sla_horas:       slaHoras,
          operador_nombre: entrada.operador_nombre,
          created_at:      entrada.created_at,
          checked_at:      ahora.toISOString(),
        },
        resuelta: false,
      });
      alertasNuevas++;
    }

    // ── 5. Insertar alertas (batch) ──────────────────────────────────────
    if (!dryRun && alertasAInsertar.length > 0) {
      const { error: insertErr } = await sb
        .from("alertas")
        .insert(alertasAInsertar);

      if (insertErr) {
        console.error("[check-sla] Error insertando alertas:", insertErr.message);
        // No lanzar — continuar y reportar el error en el resultado
        alertasNuevas = 0;
      }
    }

    // ── 6. Auto-resolver alertas cuyas recepciones ya fueron completadas ─
    if (!dryRun) {
      // Buscar alertas abiertas cuyos entry_no ya están en estado completado
      const { data: alertasAbiertas } = await sb
        .from("alertas")
        .select("id, recepcion_id")
        .eq("tipo", "sla_vencido")
        .eq("resuelta", false);

      if (alertasAbiertas && alertasAbiertas.length > 0) {
        const ids = alertasAbiertas.map((a: { recepcion_id: string }) => a.recepcion_id);

        const { data: completadas } = await sb
          .from("recepciones")
          .select("id")
          .in("id", ids)
          .in("estado", ["confirmado", "cancelado"]);

        if (completadas && completadas.length > 0) {
          const idsAResolver = (completadas as { id: string }[]).map(r => r.id);
          await sb
            .from("alertas")
            .update({ resuelta: true, resuelta_at: ahora.toISOString() })
            .in("recepcion_id", idsAResolver)
            .eq("tipo", "sla_vencido");
        }
      }
    }

    const result: CheckResult = {
      ejecutado_en:   ahora.toISOString(),
      dry_run:        dryRun,
      sla_horas:      slaHoras,
      entradas_rev:   entradasVencidas.length,
      alertas_nuevas: alertasNuevas,
      alertas_duplic: alertasDuplic,
      detalle:        entradasVencidas,
    };

    console.log(`[check-sla] ✅ ${entradasVencidas.length} entradas revisadas, ${alertasNuevas} alertas nuevas, ${alertasDuplic} duplicadas`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[check-sla] error fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
