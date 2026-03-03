// supabase/functions/ai-vision/index.ts
// Edge Function — Claude Vision para análisis de imágenes WMS
//
// DEPLOY: supabase functions deploy ai-vision
// ENV:    ANTHROPIC_API_KEY = sk-ant-...

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const DEFAULT_PROMPT = `Eres un sistema WMS experto en lectura de etiquetas y documentos de almacén.
Analiza la imagen y extrae TODOS los datos visibles. Busca: Part Number, PO, descripción,
cantidad, bultos, tipo_bulto, tracking number, carrier (FedEx/UPS/DHL), vendor, peso,
serial number, origen, part model.
Responde ÚNICAMENTE con JSON válido sin markdown:
{"numero_parte":"","po":"","descripcion":"","cantidad":0,"bultos":1,"tipo_bulto":"Caja",
"tracking_number":"","carrier":"","vendor":"","peso":"","serial_number":"","origin":"",
"part_model":"","confianza":85,"notas":""}`;

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { base64Image, mediaType = "image/jpeg", prompt } = await req.json();

    if (!base64Image) {
      return new Response(JSON.stringify({ error: "base64Image requerido" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY no configurada" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-opus-4-5",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64Image } },
            { type: "text",  text: prompt || DEFAULT_PROMPT },
          ],
        }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return new Response(JSON.stringify({ error: `Anthropic ${resp.status}`, detail: err }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const data    = await resp.json();
    const rawText = (data?.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");

    let parsed: any = null;
    try {
      const clean = rawText.replace(/```json|```/gi, "").trim();
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch { /* devolver raw */ }

    const result = parsed ?? { raw: rawText, unparsed: true };
    return new Response(JSON.stringify(result),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("[ai-vision]", err);
    return new Response(JSON.stringify({ error: err.message || "Error interno" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
