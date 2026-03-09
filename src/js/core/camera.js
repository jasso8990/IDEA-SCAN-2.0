/* ═══════════════════════════════════════════════════════════════════
   camera.js — Captura de imagen en MÁXIMA CALIDAD
   IDEA SCAN 2.0
   
   PROBLEMA RAÍZ: capture="environment" en iOS/Android PWA hace que
   el navegador tome la foto internamente con resolución reducida.
   
   SOLUCIÓN: Abrir la app de cámara NATIVA del sistema operativo
   → el usuario toma la foto con toda la calidad del hardware
   → la imagen llega a la app sin compresión del navegador.
   
   TRUCO: Usar input sin atributo capture + accept="image/*"
   → en móvil muestra menú "Tomar foto" (app nativa) o "Elegir archivo"
   → la foto nativa tiene la resolución completa de la cámara
   ═══════════════════════════════════════════════════════════════════ */

'use strict';

/* ── Función principal de captura ──────────────────────────────────────
   Devuelve Promise<dataUrl> con la imagen en MÁXIMA calidad nativa.
   NO recomprime — solo convierte a base64 para la API.
   
   El parámetro 'modo' controla si se permite SOLO cámara o también galería:
     'camara'  → solo cámara trasera (usa capture="environment")
                 ADVERTENCIA: en algunos teléfonos baja la resolución
     'libre'   → sin capture → el SO abre su app nativa de cámara
                 RECOMENDADO para lectura de etiquetas y documentos
     'galeria' → para seleccionar fotos ya tomadas
   ─────────────────────────────────────────────────────────────────── */
function cameraCapture(modo = 'libre') {
  return new Promise((resolve, reject) => {
    const inp = document.createElement('input');
    inp.type   = 'file';
    inp.accept = 'image/*';
    inp.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';

    // MODO LIBRE: sin capture → el SO muestra su menú nativo
    // "Tomar foto" abre la cámara nativa con calidad completa
    // "Elegir de galería" permite usar fotos existentes
    if (modo === 'camara') {
      // Solo si el usuario explícitamente quiere forzar cámara
      inp.capture = 'environment';
    }
    // Para 'libre' y 'galeria' NO ponemos capture

    inp.onchange = async (e) => {
      const file = e.target.files?.[0];
      inp.remove();
      if (!file) { reject(new Error('Captura cancelada')); return; }
      
      const reader = new FileReader();
      reader.onload = ev => resolve(ev.target.result); // dataUrl completo
      reader.onerror = () => reject(new Error('Error al leer imagen'));
      reader.readAsDataURL(file);
    };

    inp.oncancel = () => { inp.remove(); reject(new Error('Captura cancelada')); };

    document.body.appendChild(inp);
    inp.click();
  });
}

/* ── Preparar imagen para enviar a la API ──────────────────────────────
   La cámara nativa puede dar imágenes de 10-20MB.
   Necesitamos reducir el TAMAÑO DEL ARCHIVO sin perder texto legible.
   
   Regla: mantener al menos 2000px en el lado más largo → texto legible
   Calidad JPEG: 0.88 → balance entre nitidez y tamaño de archivo
   
   Si la imagen ya es pequeña (< 2000px) → NO reescalar, solo re-encodear
   ─────────────────────────────────────────────────────────────────── */
function prepararParaAPI(dataUrl, maxLado = 2000, calidadJPEG = 0.88) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      
      // Si la imagen ya cabe, solo re-encodear (sin redimensionar)
      let nw = w, nh = h;
      if (w > maxLado || h > maxLado) {
        if (w >= h) { nw = maxLado; nh = Math.round(h * maxLado / w); }
        else        { nh = maxLado; nw = Math.round(w * maxLado / h); }
      }

      const canvas = document.createElement('canvas');
      canvas.width  = nw;
      canvas.height = nh;
      
      const ctx = canvas.getContext('2d');
      // Activar suavizado de alta calidad para mantener texto nítido
      ctx.imageSmoothingEnabled  = true;
      ctx.imageSmoothingQuality  = 'high';
      ctx.drawImage(img, 0, 0, nw, nh);
      
      // Devolver solo el base64 (sin el prefijo data:image/jpeg;base64,)
      resolve(canvas.toDataURL('image/jpeg', calidadJPEG).split(',')[1]);
    };
    img.onerror = () => reject(new Error('Error procesando imagen'));
    img.src = dataUrl;
  });
}

/* ── Alias de compatibilidad con código anterior ───────────────────────
   El código existente llama compressImage(dataUrl, modo)
   Ahora 'modo' es ignorado — siempre usamos alta calidad
   ─────────────────────────────────────────────────────────────────── */
function compressImage(dataUrl, modo = 'texto') {
  // Para texto/etiquetas: 2200px máximo, calidad 0.88
  // Para normal: 1600px, calidad 0.82  
  const cfg = {
    texto:  { max: 2200, q: 0.88 },
    normal: { max: 1600, q: 0.82 },
    thumb:  { max: 900,  q: 0.75 },
  };
  const { max, q } = cfg[modo] || cfg.texto;
  return prepararParaAPI(dataUrl, max, q);
}
