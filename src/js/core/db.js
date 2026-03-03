/* ═══════════════════════════════════════════════════════
   db.js — Cliente Supabase y helpers de consultas
   Depende de: config.js
   ═══════════════════════════════════════════════════════ */

'use strict';

let db;

// ── Inicializar cliente Supabase ──────────────────────────
function initDB() {
  if (!window.supabase) {
    console.error('[DB] Supabase SDK no cargado');
    return;
  }
  db = window.supabase.createClient(SUPA_URL, SUPA_KEY);
}

// ── Shorthand para queries con schema ────────────────────
const Q = {
  schema: () => db.schema('ideascan'),
  from:   (table) => db.schema('ideascan').from(table),
};

// ── Wrapper seguro para queries ───────────────────────────
// Captura errores y los loguea sin romper el flujo
async function safeQuery(queryFn) {
  try {
    const res = await queryFn();
    if (res.error) {
      console.error('[DB] Error en query:', res.error);
      return null;
    }
    return res.data;
  } catch (e) {
    console.error('[DB] Query fallida:', e);
    return null;
  }
}

// ── Insert con manejo de error ────────────────────────────
async function safeInsert(table, payload) {
  try {
    const { data, error } = await Q.from(table).insert(payload).select().single();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error(`[DB] Insert en ${table} falló:`, e);
    return null;
  }
}

// ── Update con manejo de error ────────────────────────────
async function safeUpdate(table, payload, matchColumn, matchValue) {
  try {
    const { data, error } = await Q.from(table)
      .update(payload)
      .eq(matchColumn, matchValue)
      .select()
      .single();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error(`[DB] Update en ${table} falló:`, e);
    return null;
  }
}

// ── Delete con manejo de error ────────────────────────────
async function safeDelete(table, matchColumn, matchValue) {
  try {
    const { error } = await Q.from(table)
      .delete()
      .eq(matchColumn, matchValue);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error(`[DB] Delete en ${table} falló:`, e);
    return false;
  }
}
