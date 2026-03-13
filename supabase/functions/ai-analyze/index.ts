// ══════════════════════════════════════════════════════════════════════════
// ai-analyze/index.ts
// Supabase Edge Function — IDEA SCAN 2.0 / CCA Group
//
// Procesa hasta 10 fotos de packing simultáneamente usando Claude claude-opus-4-5
// con ventana de contexto de 1M tokens.
// Consolida SKUs duplicados, suma cantidades y traduce descripciones al español.
//
// POST /functions/v1/ai-analyze
// Body: {
//   fotos: string[],          // base64 JPEG, máx 10 imágenes
//   cliente_id: string,
//   tipo: "materia_prima" | "maquinaria",
//   entry_no?: string,        // para logging
//   idioma_origen?: string,   // "en" (default) | "zh" | "de" | etc.
// }
// Response: { renglones: Renglon[], metadata: AnalysisMetadata }
// ══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Tipos ──────────────────────────────────────────────────────────────────
interface RequestBody {
  fotos: string[];           // base64 JPEG (sin prefijo data:image/...)
  cliente_id: string;
  tipo?: "materia_prima" | "maquinaria";
  entry_no?: string;
  idioma_origen?: string;
}

interface Renglon {
  pn:             string;
  descripcion_en: string;
  descripcion_es: string;
  cantidad:       number;
  um:             string;
  peso_lbs:       number | null;
  peso_kgs:       number | null;
  origen:         string | null;   // ISO-2
  po:             string | null;
  hts_fraccion:   string | null;
  tracking:       string | null;
  vendor:         string | null;
  serie:          string[];
  marca:          string | null;
  modelo:         string | null;
  secuencia_bulto: string | null;
  bulto_num:      number;
  confianza:      number;          // 0-100 score de confianza de la IA
}

interface AnalysisMetadata {
  total_renglones:     number;
  total_cantidad:      number;
  pns_detectados:      number;
  pns_consolidados:    number;
  carrier_detectado:   string | null;
  tracking_global:     string | null;
  num_bultos_total:    number | null;
  vendor_global:       string | null;
  fotos_procesadas:    number;
  modelo_ia:           string;
  tokens_usados:       number;
  tiempo_ms:           number;
}

interface ClaudeRenglon {
  pn:              string;
  descripcion_en:  string;
  descripcion_es:  string;
  cantidad:        number;
  um:              string;
  peso_lbs?:       number | null;
  peso_kgs?:       number | null;
  origen?:         string | null;
  po?:             string | null;
  hts_fraccion?:   string | null;
  tracking?:       string | null;
  vendor?:         string | null;
  serie?:          string[];
  marca?:          string | null;
  modelo?:         string | null;
  secuencia_bulto?: string | null;
  bulto_num?:      number;
  confianza?:      number;
}

// ── Constantes ─────────────────────────────────────────────────────────────
const MODEL         = "claude-opus-4-5";
const MAX_TOKENS    = 8192;   // respuesta max; el contexto del modelo es 1M
const MAX_FOTOS     = 10;
const TIMEOUT_MS    = 120_000; // 2 minutos para 10 fotos

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Mapa de países a código ISO-2
const COUNTRY_MAP: Record<string, string> = {
  "china":"CN","méxico":"MX","mexico":"MX","united states":"US","usa":"US",
  "germany":"DE","alemania":"DE","france":"FR","francia":"FR",
  "japan":"JP","japón":"JP","korea":"KR","corea":"KR","india":"IN",
  "taiwan":"TW","italy":"IT","italia":"IT","spain":"ES","españa":"ES",
  "brazil":"BR","brasil":"BR","canada":"CA","uk":"GB","united kingdom":"GB",
};

function normalizarOrigen(texto?: string | null): string | null {
  if (!texto) return null;
  const t = texto.trim();
  if (/^[A-Z]{2}$/.test(t)) return t;
  const low = t.toLowerCase();
  for (const [name, code] of Object.entries(COUNTRY_MAP)) {
    if (low.includes(name)) return code;
  }
  return t.toUpperCase().slice(0, 2);
}

// ── Handler ────────────────────────────────────────────────────────────────
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return errResp(405, "Method not allowed");
  }

  const t0 = Date.now();

  try {
    const body: RequestBody = await req.json();
    const {
      fotos,
      cliente_id,
      tipo = "materia_prima",
      entry_no,
      idioma_origen = "en",
    } = body;

    // ── Validaciones ────────────────────────────────────────────────────
    if (!fotos || !Array.isArray(fotos) || fotos.length === 0) {
      return errResp(400, "Se requiere al menos 1 foto");
    }
    if (fotos.length > MAX_FOTOS) {
      return errResp(400, `Máximo ${MAX_FOTOS} fotos por solicitud (recibidas: ${fotos.length})`);
    }
    if (!cliente_id) {
      return errResp(400, "cliente_id es requerido");
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return errResp(500, "ANTHROPIC_API_KEY no configurada en Supabase Secrets");
    }

    // ── Obtener código del cliente para contexto ─────────────────────────
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb    = createClient(sbUrl, sbKey, {
      db: { schema: "public" },
      auth: { persistSession: false },
    });

    const { data: cliente } = await sb
      .from("clientes")
      .select("codigo, nombre, importador_default")
      .eq("id", cliente_id)
      .single();

    const clienteNombre = cliente?.nombre ?? "Desconocido";

    // ── Construir mensaje multimodal para Claude ─────────────────────────
    const esMaquinaria = tipo === "maquinaria";

    // Agregar las imágenes como bloques de contenido
    const imageBlocks = fotos.map((b64: string) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/jpeg" as const,
        data: b64,
      },
    }));

    const systemPrompt = `Eres un sistema experto en documentos de importación/exportación para almacén 3PL.
Cliente: ${clienteNombre}
Tipo de mercancía: ${esMaquinaria ? "MAQUINARIA / INDUSTRIAL" : "MATERIA PRIMA"}
Idioma origen de documentos: ${idioma_origen.toUpperCase()}

CAPACIDADES ESPECIALES:
- Puedes procesar hasta 10 imágenes simultáneamente (packing lists, invoices, labels de carrier, cajas)
- Detectas información en documentos en inglés, chino, alemán, japonés y otros idiomas
- Consolidas automáticamente renglones del mismo Part Number de diferentes imágenes
- Sumas cantidades cuando el mismo PN aparece en múltiples imágenes
- Traduces todas las descripciones al español mexicano de almacén

REGLAS CRÍTICAS:
- NO inventes datos. Solo extrae lo visible en las imágenes
- Copia el Part Number EXACTAMENTE como aparece (mayúsculas, guiones, espacios, puntos)
- Para maquinaria: extrae cada número de serie S/N como un elemento separado en el array serie[]
- Consolida SIEMPRE renglones con el mismo PN exacto (suma cantidades)
- La descripción en español debe ser clara para operadores de almacén en México`;

    const userPrompt = `Analiza TODAS las ${fotos.length} imágenes adjuntas (pueden ser packing lists, invoices, labels de carrier, fotos de cajas/piezas).

Extrae TODA la información y responde ÚNICAMENTE con JSON válido sin backticks ni texto extra:

{
  "renglones": [
    {
      "pn": "Part Number exacto",
      "descripcion_en": "descripción en inglés tal como aparece en el documento",
      "descripcion_es": "traducción al español para almacén (clara, concisa, sin tecnicismos innecesarios)",
      "cantidad": 1,
      "um": "PCS",
      "peso_lbs": null,
      "peso_kgs": null,
      "origen": "MX",
      "po": "PO#",
      "hts_fraccion": null,
      "tracking": null,
      "vendor": null,
      "serie": [],
      "marca": null,
      "modelo": null,
      "secuencia_bulto": "1 of 3",
      "bulto_num": 1,
      "confianza": 95
    }
  ],
  "carrier_detectado": null,
  "tracking_global": null,
  "num_bultos_total": null,
  "vendor_global": null
}

INSTRUCCIONES DE CONSOLIDACIÓN:
1. Si el mismo PN aparece en múltiples imágenes → UN solo renglon con la suma de cantidades
2. Si el mismo PN tiene múltiples S/N → array serie[] con todos los S/N
3. confianza: 95-100 = dato claro y legible, 70-94 = dato parcialmente legible, <70 = dato inferido
4. peso: extrae ACTWGT de labels de carrier; prioriza LBS sobre KG
5. secuencia_bulto: si ves "1 of 3" o "Box 2/4" → usa ese formato exacto
6. Para maquinaria: cada S/N diferente del mismo PN va en serie[], NO crees renglones separados aquí`;

    const content = [
      ...imageBlocks,
      { type: "text" as const, text: userPrompt },
    ];

    // ── Llamada a Claude claude-opus-4-5 ──────────────────────────────────────
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    let claudeResp: Response;
    try {
      claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         apiKey,
          "anthropic-version": "2023-06-01",
          // Habilitar la ventana de 1M tokens en beta
          "anthropic-beta":    "interleaved-thinking-2025-05-14,max-tokens-3-5-sonnet-2025-07-15",
        },
        body: JSON.stringify({
          model:      MODEL,
          max_tokens: MAX_TOKENS,
          system:     systemPrompt,
          messages: [
            { role: "user", content },
          ],
        }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!claudeResp.ok) {
      const errBody = await claudeResp.text();
      console.error("[ai-analyze] Claude API error:", errBody);
      return errResp(502, `Claude API error ${claudeResp.status}: ${errBody.slice(0, 200)}`);
    }

    const claudeJson = await claudeResp.json();
    const rawText: string = claudeJson?.content?.[0]?.text ?? "{}";
    const tokensUsados: number = claudeJson?.usage?.input_tokens ?? 0;

    // ── Parsear JSON de respuesta ────────────────────────────────────────
    let parsed: {
      renglones: ClaudeRenglon[];
      carrier_detectado?: string | null;
      tracking_global?: string | null;
      num_bultos_total?: number | null;
      vendor_global?: string | null;
    };
    try {
      parsed = JSON.parse(
        rawText.replace(/```json/g, "").replace(/```/g, "").trim()
      );
    } catch {
      console.error("[ai-analyze] JSON parse error, raw:", rawText.slice(0, 500));
      return errResp(422, "La IA no devolvió JSON válido. Intenta con imágenes más claras.");
    }

    const renglonesRaw: ClaudeRenglon[] = parsed.renglones ?? [];

    // ── Normalizar y consolidar por PN ────────────────────────────────────
    const mapa = new Map<string, Renglon>();

    for (const r of renglonesRaw) {
      const pnKey = (r.pn ?? "").trim();
      if (!pnKey) continue;

      const pesoLbs = r.peso_lbs ? Number(r.peso_lbs) : null;
      const pesoKgs = r.peso_kgs
        ? Number(r.peso_kgs)
        : pesoLbs != null ? Math.round(pesoLbs * 0.45359237 * 10000) / 10000 : null;

      if (mapa.has(pnKey)) {
        // Consolidar: sumar cantidad y unir series
        const exist = mapa.get(pnKey)!;
        exist.cantidad    += Number(r.cantidad ?? 1);
        exist.serie       = [...new Set([...exist.serie, ...(r.serie ?? [])])];
        if (!exist.peso_lbs && pesoLbs) exist.peso_lbs = pesoLbs;
        if (!exist.peso_kgs && pesoKgs) exist.peso_kgs = pesoKgs;
        if (!exist.vendor  && r.vendor) exist.vendor   = r.vendor;
        if (!exist.po      && r.po)     exist.po        = r.po;
      } else {
        mapa.set(pnKey, {
          pn:              pnKey,
          descripcion_en:  (r.descripcion_en ?? "").trim(),
          descripcion_es:  (r.descripcion_es ?? "").trim(),
          cantidad:        Number(r.cantidad ?? 1),
          um:              (r.um ?? "PCS").toUpperCase(),
          peso_lbs:        pesoLbs,
          peso_kgs:        pesoKgs,
          origen:          normalizarOrigen(r.origen),
          po:              r.po   ?? null,
          hts_fraccion:    r.hts_fraccion ?? null,
          tracking:        r.tracking     ?? null,
          vendor:          r.vendor       ?? null,
          serie:           r.serie        ?? [],
          marca:           r.marca        ?? null,
          modelo:          r.modelo       ?? null,
          secuencia_bulto: r.secuencia_bulto ?? null,
          bulto_num:       r.bulto_num ?? 1,
          confianza:       r.confianza ?? 90,
        });
      }
    }

    const renglones = Array.from(mapa.values());

    // ── Metadata ─────────────────────────────────────────────────────────
    const metadata: AnalysisMetadata = {
      total_renglones:   renglones.length,
      total_cantidad:    renglones.reduce((a, r) => a + r.cantidad, 0),
      pns_detectados:    renglonesRaw.length,
      pns_consolidados:  renglonesRaw.length - renglones.length,
      carrier_detectado: parsed.carrier_detectado ?? null,
      tracking_global:   parsed.tracking_global   ?? null,
      num_bultos_total:  parsed.num_bultos_total   ?? null,
      vendor_global:     parsed.vendor_global      ?? null,
      fotos_procesadas:  fotos.length,
      modelo_ia:         MODEL,
      tokens_usados:     tokensUsados,
      tiempo_ms:         Date.now() - t0,
    };

    // ── Log en actividad_log (no bloquea la respuesta) ────────────────────
    sb.from("actividad_log").insert({
      tabla:       "recepciones",
      tipo:        "ai_analyze",
      descripcion: `ai-analyze: ${renglones.length} renglones desde ${fotos.length} fotos`,
      datos: {
        entry_no,
        cliente_id,
        tipo,
        metadata,
      },
    }).then();   // fire and forget

    return new Response(JSON.stringify({ renglones, metadata }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("AbortError") || msg.includes("aborted")) {
      return errResp(504, `Timeout: Claude tardó más de ${TIMEOUT_MS / 1000}s. Reduce el número de fotos.`);
    }
    console.error("[ai-analyze] error:", msg);
    return errResp(500, msg);
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────
function errResp(status: number, msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
