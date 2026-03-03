/* ═══════════════════════════════════════════════════════
   vision.js — AI Vision API calls
   Depende de: config.js
   ═══════════════════════════════════════════════════════ */

'use strict';

// ── Llamada principal a Vision API ────────────────────────
async function callVision(base64, mediaType = 'image/jpeg', promptOverride = null) {
  const resp = await fetch(AI_VISION_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
    },
    body: JSON.stringify({
      base64Image: base64,
      mediaType,
      ...(promptOverride ? { prompt: promptOverride } : {}),
    }),
  });
  if (!resp.ok) throw new Error(`Vision API ${resp.status}`);
  return await resp.json();
}

// ── Parsear resultado de AI a JSON seguro ─────────────────
function parseAIJson(raw) {
  try {
    // El modelo puede devolver texto o un objeto directamente
    if (typeof raw === 'object' && raw !== null && !raw.content) return raw;

    // Si viene envuelto en content[]
    const text = Array.isArray(raw?.content)
      ? raw.content.map(b => b.text || '').join('')
      : (typeof raw === 'string' ? raw : JSON.stringify(raw));

    // Limpiar posibles backticks de markdown
    const clean = text.replace(/```json|```/gi, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    console.warn('[Vision] No se pudo parsear respuesta AI:', e);
    return null;
  }
}

// ── Mostrar/ocultar overlay de AI ────────────────────────
function showAI(title, subtitle = '') {
  const overlay = document.getElementById('aiOverlay');
  if (!overlay) return;
  const titleEl    = overlay.querySelector('.ai-title, #aiTitle');
  const subtitleEl = overlay.querySelector('.ai-sub, #aiSub');
  if (titleEl)    titleEl.textContent    = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;
  overlay.classList.add('open');
}

function hideAI() {
  document.getElementById('aiOverlay')?.classList.remove('open');
}
