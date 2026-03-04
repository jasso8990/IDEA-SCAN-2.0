/* ============================
   CONFIG.JS — Supabase + AI Config
   ============================ */

const CONFIG = {
  supabase: {
    url:    'https://usqugtxeynkozlobeojt.supabase.co',
    anonKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzcXVndHhleW5rb3psb2Jlb2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTYxMzAsImV4cCI6MjA4NjY3MjEzMH0.zs4XiF8AgcE-l3ebtaxvoN7V9rf-6MHWNxMThiQUXKE',
    schema: 'ideascan',
  },
  functions: {
    userAdmin: 'https://usqugtxeynkozlobeojt.supabase.co/functions/v1/user-admin',
    aiVision:  'https://usqugtxeynkozlobeojt.supabase.co/functions/v1/ai-vision',
  }
};

// ── Supabase REST helpers ──────────────────────────────────────────────────

function sbHeaders(extra = {}) {
  const session = getLocalSession();
  return {
    'apikey':        CONFIG.supabase.anonKey,
    'Authorization': `Bearer ${session?.access_token || CONFIG.supabase.anonKey}`,
    'Content-Type':  'application/json',
    'Accept':        'application/json',
    'Accept-Profile':  CONFIG.supabase.schema,
    'Content-Profile': CONFIG.supabase.schema,
    ...extra
  };
}

async function sbGet(table, params = '') {
  const res = await fetch(`${CONFIG.supabase.url}/rest/v1/${table}${params}`, {
    headers: sbHeaders()
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function sbPost(table, body, prefer = 'return=representation') {
  const res = await fetch(`${CONFIG.supabase.url}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbHeaders({ 'Prefer': prefer }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function sbPatch(table, filter, body) {
  const res = await fetch(`${CONFIG.supabase.url}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: sbHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function sbDelete(table, filter) {
  const res = await fetch(`${CONFIG.supabase.url}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: sbHeaders()
  });
  if (!res.ok) throw new Error(await res.text());
}

// ── Auth ──────────────────────────────────────────────────────────────────

async function sbLogin(email, password) {
  const res = await fetch(`${CONFIG.supabase.url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey':       CONFIG.supabase.anonKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.message || 'Error de autenticación');
  return data; // { access_token, user, ... }
}

async function sbLogout(accessToken) {
  await fetch(`${CONFIG.supabase.url}/auth/v1/logout`, {
    method: 'POST',
    headers: {
      'apikey':        CONFIG.supabase.anonKey,
      'Authorization': `Bearer ${accessToken}`
    }
  });
}

// ── Session helpers ───────────────────────────────────────────────────────

function getLocalSession() {
  const raw = localStorage.getItem('wms_session');
  return raw ? JSON.parse(raw) : null;
}

function saveLocalSession(data) {
  localStorage.setItem('wms_session', JSON.stringify(data));
}

function clearLocalSession() {
  localStorage.removeItem('wms_session');
  localStorage.removeItem('wms_user_profile');
}

function getLocalProfile() {
  const raw = localStorage.getItem('wms_user_profile');
  return raw ? JSON.parse(raw) : null;
}

// ── Edge function caller ──────────────────────────────────────────────────

async function callFunction(fnUrl, body) {
  const session = getLocalSession();
  const res = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session?.access_token || CONFIG.supabase.anonKey}`,
      'apikey':        CONFIG.supabase.anonKey,
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.message || 'Error en función');
  return data;
}
