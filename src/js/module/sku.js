/* ═══════════════════════════════════════════════════════
   sku.js — Generación y validación de SKUs
   Formato: CODIGO + YYMM + ### → SAF2602001
   Depende de: db.js
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── Parte YYMM del mes actual ─────────────────────────────
function skuMonthPart() {
  const d  = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return yy + mm;   // e.g. "2602"
}

// ── Prefijo completo para el mes ──────────────────────────
function skuMonthPrefix(codigo) {
  return codigo + skuMonthPart();   // e.g. "SAF2602"
}

// ── Obtener siguiente secuencia del mes ───────────────────
async function getNextSkuSeq(codigo) {
  const prefix = skuMonthPrefix(codigo);
  const { data } = await Q.from('inventario')
    .select('sku')
    .like('sku', prefix + '%');

  const nums = (data || []).map(r => {
    const tail = (r.sku || '').replace(prefix, '');
    return parseInt(tail) || 0;
  });
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return String(next).padStart(3, '0');
}

// ── Generar SKU completo ──────────────────────────────────
async function generateSKU(codigo) {
  const seq = await getNextSkuSeq(codigo);
  return skuMonthPrefix(codigo) + seq;   // SAF2602001
}

// ── Validar formato SKU ───────────────────────────────────
// Espera: 3-10 letras + 4 dígitos YYMM + 3 dígitos seq
function isValidSKU(sku) {
  return /^[A-Z]{3,10}\d{4}\d{3}$/.test(sku || '');
}

// ── Extraer partes del SKU ────────────────────────────────
function parseSKU(sku) {
  if (!isValidSKU(sku)) return null;
  const codigo = sku.replace(/\d+$/, '').slice(0, -4);
  const yymm   = sku.slice(codigo.length, codigo.length + 4);
  const seq    = sku.slice(-3);
  return { codigo, yymm, seq };
}
