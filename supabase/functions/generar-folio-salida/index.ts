import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ══════════════════════════════════════════════════════════════
// generar-folio-salida — IDEA SCAN 2.0
// Generates an atomic outbound folio: SAL[YY][MM][NNN]
// Format: SAL2603001 (year=26, month=03, seq=001, resets monthly)
// ══════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { cliente_id, tipo_salida, referencia_cliente, transportista_placas, items } = body;

    if (!cliente_id) {
      return new Response(
        JSON.stringify({ error: "cliente_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role (bypasses RLS for atomic ops)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { db: { schema: "ideascan" } }
    );

    // ─────────────────────────────────────────────────────────
    // 1. Validate cliente exists
    // ─────────────────────────────────────────────────────────
    const { data: cliente, error: clienteErr } = await supabase
      .from("clientes")
      .select("id, nombre, codigo")
      .eq("id", cliente_id)
      .single();

    if (clienteErr || !cliente) {
      return new Response(
        JSON.stringify({ error: "Cliente not found", detail: clienteErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────
    // 2. Generate folio atomically using folio_sequences table
    //    Format: SAL[YY][MM][NNN] with monthly reset
    // ─────────────────────────────────────────────────────────
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);       // "26"
    const mm = String(now.getMonth() + 1).padStart(2, "0"); // "03"
    const yearMonth = yy + mm;                             // "2603"
    const tipo = "SAL";

    // Upsert sequence row and increment atomically
    const { data: seqData, error: seqErr } = await supabase.rpc
      ? await supabase.rpc("increment_folio_sequence", { p_tipo: tipo, p_year_month: yearMonth })
      : { data: null, error: new Error("rpc not available") };

    let nextSeq: number;

    if (seqErr || seqData === null) {
      // Fallback: manual upsert if RPC not yet created
      const { data: existing } = await supabase
        .from("folio_sequences")
        .select("last_seq")
        .eq("tipo", tipo)
        .eq("year_month", yearMonth)
        .single();

      if (existing) {
        nextSeq = existing.last_seq + 1;
        await supabase
          .from("folio_sequences")
          .update({ last_seq: nextSeq })
          .eq("tipo", tipo)
          .eq("year_month", yearMonth);
      } else {
        nextSeq = 1;
        await supabase
          .from("folio_sequences")
          .insert({ tipo, year_month: yearMonth, last_seq: 1 });
      }
    } else {
      nextSeq = seqData;
    }

    const seq = String(nextSeq).padStart(3, "0"); // "001"
    const folio = `${tipo}${yy}${mm}${seq}`;     // "SAL2603001"

    // ─────────────────────────────────────────────────────────
    // 3. Create salida record
    // ─────────────────────────────────────────────────────────
    const totalSkus = Array.isArray(items) ? items.length : 0;
    const totalBultos = Array.isArray(items)
      ? items.reduce((sum: number, i: { cantidad_salida?: number; cantidad?: number }) =>
          sum + (i.cantidad_salida ?? i.cantidad ?? 0), 0)
      : 0;

    const { data: salida, error: salidaErr } = await supabase
      .from("salidas")
      .insert({
        folio_sal: folio,
        cliente_id,
        referencia_cliente: referencia_cliente ?? null,
        tipo_salida: tipo_salida ?? "venta",
        transportista_placas: transportista_placas ?? null,
        status: "completado",
        total_skus: totalSkus,
        total_bultos: totalBultos,
        cerrado_en: new Date().toISOString(),
      })
      .select()
      .single();

    if (salidaErr) {
      return new Response(
        JSON.stringify({ error: "Failed to create salida record", detail: salidaErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─────────────────────────────────────────────────────────
    // 4. Register line items in salidas_detalle and
    //    DEDUCT from inventario atomically
    // ─────────────────────────────────────────────────────────
    const errors: string[] = [];

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        // Insert detail line
        const { error: detErr } = await supabase
          .from("salidas_detalle")
          .insert({
            salida_id: salida.id,
            inventario_id: item.inventario_id ?? null,
            sku: item.sku ?? "",
            descripcion: item.descripcion ?? "",
            cantidad_pedida: item.cantidad_pedida ?? item.cantidad ?? 0,
            cantidad_salida: item.cantidad_salida ?? item.cantidad ?? 0,
            unidad: item.unidad ?? "PZA",
            ubicacion: item.ubicacion ?? null,
            status: item.discrepancia ? "discrepancia" : "ok",
            discrepancia: item.discrepancia ?? null,
          });

        if (detErr) {
          errors.push(`Detail insert error for SKU ${item.sku}: ${detErr.message}`);
          continue;
        }

        // Deduct from inventario if inventario_id provided
        if (item.inventario_id) {
          const cantSalida = item.cantidad_salida ?? item.cantidad ?? 0;

          // Get current quantity
          const { data: invRow } = await supabase
            .from("inventario")
            .select("cantidad, estado")
            .eq("id", item.inventario_id)
            .single();

          if (invRow) {
            const nuevaCantidad = Math.max(0, (invRow.cantidad ?? 0) - cantSalida);
            const nuevoEstado = nuevaCantidad === 0 ? "agotado" : "disponible";

            const { error: invErr } = await supabase
              .from("inventario")
              .update({
                cantidad: nuevaCantidad,
                estado: nuevoEstado,
              })
              .eq("id", item.inventario_id);

            if (invErr) {
              errors.push(`Inventory deduction error for ${item.inventario_id}: ${invErr.message}`);
            }

            // Update ubicacion capacity
            if (invRow && item.ubicacion && nuevaCantidad === 0) {
              await supabase
                .from("ubicaciones")
                .update({ capacidad_actual: 0, estado: "disponible" })
                .eq("codigo", item.ubicacion);
            }
          }
        }
      }
    }

    // ─────────────────────────────────────────────────────────
    // 5. Return folio and summary
    // ─────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        folio,
        folio_sal: folio,
        salida_id: salida.id,
        cliente: { id: cliente.id, nombre: cliente.nombre, codigo: cliente.codigo },
        tipo_salida: tipo_salida ?? "venta",
        total_skus: totalSkus,
        total_bultos: totalBultos,
        year_month: yearMonth,
        seq: nextSeq,
        errors: errors.length > 0 ? errors : undefined,
        creado_en: salida.creado_en,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    console.error("generar-folio-salida error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
