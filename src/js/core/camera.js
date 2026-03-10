/* ═══════════════════════════════════════════════════════════════════
   camera.js — Captura de cámara con máxima calidad
   IDEA SCAN 2.0

   REGLA SIMPLE:
   - capture="environment"  →  abre cámara trasera directo (iOS y Android)
   - Sin capture            →  abre galería (NO queremos esto)
   
   El problema anterior de "imagen borrosa" NO era el capture="environment"
   sino que compressImage() reducía a 800px con calidad 0.65.
   
   SOLUCIÓN: Mantener capture="environment" + procesar a alta calidad
   (2200px máximo, calidad JPEG 0.88)
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ── cameraCapture — abre la cámara del móvil via input nativo ─────────
   Devuelve Promise<dataUrl>
   - modo 'camara'  → capture="environment" (cámara trasera directa)
   - modo 'libre'   → sin capture (galería o cámara, el usuario elige)
   ─────────────────────────────────────────────────────────────────── */
function cameraCapture(modo = 'camara') {
  return new Promise((resolve, reject) => {
    const inp = document.createElement('input');
    inp.type   = 'file';
    inp.accept = 'image/*';
    inp.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';

    // SIEMPRE ponemos capture="environment" para ir directo a la cámara
    // Solo omitimos si explícitamente se pide galería
    if (modo !== 'galeria') {
      inp.capture = 'environment';
    }

    inp.onchange = async (e) => {
      const file = e.target.files?.[0];
      inp.remove();
      if (!file) { reject(new Error('Captura cancelada')); return; }
      const reader = new FileReader();
      reader.onload  = ev => resolve(ev.target.result);
      reader.onerror = ()  => reject(new Error('Error al leer imagen'));
      reader.readAsDataURL(file);
    };

    // Timeout de seguridad por si el usuario cancela sin disparar onchange
    inp.oncancel = () => { inp.remove(); reject(new Error('Captura cancelada')); };

    document.body.appendChild(inp);
    inp.click();
  });
}

/* ── compressImage — prepara la imagen para enviar a la API ────────────
   NO destruye la calidad — solo lleva al tamaño que la API puede procesar
   eficientemente sin timeout.
   
   Modos:
     'texto'  → 2200px máx, calidad 0.88  (etiquetas, sellos, documentos)
     'normal' → 1600px máx, calidad 0.82  (fotos de inventario)
     'thumb'  → 900px  máx, calidad 0.75  (previews/miniaturas)
   ─────────────────────────────────────────────────────────────────── */
function compressImage(dataUrl, modo = 'texto') {
  const cfg = {
    texto:  { max: 2200, q: 0.88 },
    normal: { max: 1600, q: 0.82 },
    thumb:  { max: 900,  q: 0.75 },
  };
  const { max, q } = cfg[modo] || cfg.texto;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // Si la imagen ya cabe en el límite, no redimensionar
      let nw = w, nh = h;
      if (w > max || h > max) {
        if (w >= h) { nw = max; nh = Math.round(h * max / w); }
        else        { nh = max; nw = Math.round(w * max / h); }
      }

      const canvas = document.createElement('canvas');
      canvas.width  = nw;
      canvas.height = nh;

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, nw, nh);

      // Devolver solo base64 sin prefijo
      resolve(canvas.toDataURL('image/jpeg', q).split(',')[1]);
    };
    img.onerror = () => reject(new Error('Error procesando imagen'));
    img.src = dataUrl;
  });
}
