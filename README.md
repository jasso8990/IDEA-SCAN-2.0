# 🏭 IDEA SCAN 2.0 — Warehouse Manager
**Sistema WMS de gestión de almacén — CCA Group**

---

## ✅ PASOS PARA ACTIVAR LA APLICACIÓN

### PASO 1 — Crear proyecto en Supabase (base de datos)

1. Ve a **https://supabase.com** y crea una cuenta gratuita
2. Clic en **"New Project"**
3. Llena los datos:
   - **Name:** IDEA-SCAN
   - **Database Password:** (anota esta contraseña)
   - **Region:** US East (o el más cercano)
4. Espera 2 minutos mientras se crea el proyecto
5. Una vez creado, ve a **Settings → API**
6. Copia estos dos valores:
   - **Project URL** (algo como `https://abcdef.supabase.co`)
   - **anon public key** (clave larga)

---

### PASO 2 — Crear las tablas en Supabase

1. En tu proyecto Supabase, ve a **SQL Editor** (ícono de código en el menú izquierdo)
2. Clic en **"New Query"**
3. Abre el archivo `supabase-schema.sql` de este repositorio
4. Copia y pega TODO el contenido en el editor
5. Clic en **"Run"** (botón verde)
6. Debes ver "Success. No rows returned"

---

### PASO 3 — Conectar la app a tu base de datos

1. Abre el archivo `src/js/core/config.js` en GitHub
2. Clic en el ícono ✏️ (editar)
3. Reemplaza estas dos líneas:
   ```
   const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
   const SUPABASE_KEY = 'YOUR_ANON_KEY';
   ```
   Con tus datos reales, por ejemplo:
   ```
   const SUPABASE_URL = 'https://abcdefghij.supabase.co';
   const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6...';
   ```
4. Clic en **"Commit changes"**

---

### PASO 4 — Activar GitHub Pages

1. En tu repositorio de GitHub, ve a **Settings**
2. En el menú izquierdo, clic en **"Pages"**
3. En "Source", selecciona **"Deploy from a branch"**
4. En "Branch", selecciona **"main"** y carpeta **"/ (root)"**
5. Clic en **"Save"**
6. Espera 3 minutos
7. Tu app estará en: `https://TU_USUARIO.github.io/IDEA-SCAN-2.0/login.html`

---

## 🔐 Usuario por defecto

| Usuario | Contraseña | Rol           |
|---------|------------|---------------|
| admin   | admin123   | Administrador |

> ⚠️ **Cambia la contraseña después del primer acceso** en Configuración → Usuarios

---

## 📱 Instalar como app en el celular

### iPhone / iPad:
1. Abre Safari y ve a tu URL de la app
2. Toca el ícono de compartir (cuadrado con flecha)
3. Selecciona **"Agregar a pantalla de inicio"**

### Android:
1. Abre Chrome y ve a tu URL
2. Toca el menú (3 puntos)
3. Selecciona **"Instalar app"**

---

## 📁 Estructura de archivos

```
IDEA-SCAN-2.0/
├── login.html          ← Pantalla de inicio de sesión
├── dashboard.html      ← Panel principal con KPIs
├── inventario.html     ← Gestión de inventario
├── entradas.html       ← Registro de entradas
├── salidas.html        ← Registro de salidas
├── ai-entry.html       ← Análisis con IA
├── reportes.html       ← Reportes y exportación
├── config.html         ← Configuración (solo admin)
├── sw.js               ← Service Worker (PWA)
├── manifest.json       ← Configuración de la app
├── supabase-schema.sql ← Script de base de datos
└── src/
    ├── css/
    │   ├── base.css        ← Variables y tipografía
    │   ├── layout.css      ← Sidebar, header, navegación
    │   ├── components.css  ← Botones, tablas, modales
    │   ├── utilities.css   ← Helpers y utilidades
    │   └── pages/
    │       ├── login.css
    │       ├── dashboard.css
    │       └── ai-entry.css
    └── js/
        ├── core/
        │   ├── config.js   ← ⚠️ Edita con tus claves Supabase
        │   ├── auth.js     ← Autenticación
        │   └── nav.js      ← Navegación
        └── pages/
            ├── login.js
            ├── dashboard.js
            ├── inventario.js
            ├── entradas.js
            ├── salidas.js
            ├── ai-entry.js
            ├── reportes.js
            └── config.js
```

---

## 🤖 Función de Análisis IA

La página **Análisis IA** usa Claude para analizar fotos de productos:
1. Toma una foto del producto/caja
2. La IA detecta automáticamente el SKU, descripción y código de barras
3. Puedes guardar la entrada directamente desde el resultado

> Esta función requiere conexión a internet y usa la API de Anthropic.

---

## 📞 Soporte

Si tienes problemas, revisa:
1. Que las claves de Supabase estén correctas en `config.js`
2. Que hayas ejecutado el SQL de `supabase-schema.sql`
3. Que GitHub Pages esté activado y apunte a la rama `main`
