/* ═══════════════════════════════════════════════════════
   camera.js — Acceso a cámara del dispositivo
   ═══════════════════════════════════════════════════════ */

'use strict';

let _stream = null;

// ── Iniciar cámara en un elemento <video> ─────────────────
async function startCamera(videoEl, facingMode = 'environment') {
  try {
    if (_stream) stopCamera();
    _stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
      audio: false,
    });
    videoEl.srcObject = _stream;
    await videoEl.play();
    return true;
  } catch (e) {
    console.error('[Camera] No se pudo acceder a la cámara:', e);
    showToast('No se pudo acceder a la cámara', 'error');
    return false;
  }
}

// ── Detener la cámara ─────────────────────────────────────
function stopCamera() {
  if (_stream) {
    _stream.getTracks().forEach(t => t.stop());
    _stream = null;
  }
}

// ── Capturar frame del video como base64 ──────────────────
function captureFrame(videoEl, quality = 0.85) {
  const c = document.createElement('canvas');
  c.width  = videoEl.videoWidth  || 1280;
  c.height = videoEl.videoHeight || 960;
  c.getContext('2d').drawImage(videoEl, 0, 0);
  return c.toDataURL('image/jpeg', quality);
}

// ── Cargar imágenes desde input[type=file] ────────────────
function readFilesAsDataURL(files) {
  return Promise.all(
    [...files].map(file =>
      new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload  = e => resolve(e.target.result);
        r.onerror = () => reject(new Error('No se pudo leer el archivo'));
        r.readAsDataURL(file);
      })
    )
  );
}
