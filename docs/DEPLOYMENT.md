# 🚀 DEPLOYMENT — Guía de despliegue

## Opción 1: GitHub Pages (recomendado)

1. Subir el repo a GitHub
2. En Settings → Pages → Source: `main` branch, `/` root
3. La app estará disponible en `https://usuario.github.io/repo-name`

## Opción 2: Netlify / Vercel

1. Conectar repo de GitHub
2. Build command: `(vacío — es HTML estático)`
3. Publish directory: `.` (raíz)

## Opción 3: Servidor local

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# VS Code
# Instalar extensión "Live Server" y hacer click en "Go Live"
```

---

## Variables de entorno

Los valores de Supabase están en `src/js/core/config.js`:

```js
const SUPA_URL = 'https://TU-PROJECT.supabase.co';
const SUPA_KEY = 'TU-ANON-KEY';
```

> ⚠️ Para producción, considera usar una Edge Function como proxy para no exponer el key en el cliente.

---

## PWA — Agregar al home screen

El `manifest.json` ya está configurado. Los iconos deben estar en `/public/icons/`:
- `favicon16.png`
- `favicon32.png`
- `icon192.png`
- `icon512.png`
- `appletouchicon.png`

---

## Actualizar la app

```bash
git add .
git commit -m "feat: descripción del cambio"
git push origin main
```

Los cambios se reflejan automáticamente en GitHub Pages (~1 min).
