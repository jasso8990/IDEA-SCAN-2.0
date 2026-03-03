# 📦 IDEA SCAN 2.0 — Warehouse Manager System
**CCA Group | v2.0.0 | PWA · AI Vision · Supabase**

> Sistema WMS con inteligencia artificial. Captura, escanea y controla tu inventario desde cualquier dispositivo.

---

## 📁 Estructura del proyecto

```
warehouse-manager/
│
├── 📄 Páginas principales (HTML)
│   ├── login.html              → Autenticación
│   ├── inventario.html         → Inventario principal
│   ├── salidas.html            → Escaneo y control de salidas
│   ├── ai-entry.html           → Entrada con IA (SAFRAN)
│   ├── martech-entry.html      → Entrada MARTECH
│   ├── ordenes.html            → Órdenes de trabajo
│   ├── reportes.html           → Reportes y analíticas
│   ├── mapa.html               → Mapa de almacén
│   └── config.html             → Configuración y usuarios
│
├── src/
│   ├── js/
│   │   ├── core/
│   │   │   ├── config.js       → Constantes (URLs, keys)
│   │   │   ├── auth.js         → Sesión, login, permisos
│   │   │   ├── db.js           → Cliente Supabase + helpers DB
│   │   │   ├── nav.js          → Sidebar y bottom nav
│   │   │   └── utils.js        → Fechas, SKU, toast, XLSX, print
│   │   │
│   │   ├── modules/
│   │   │   ├── vision.js       → Llamadas a AI Vision API
│   │   │   ├── sku.js          → Generación y validación de SKUs
│   │   │   ├── camera.js       → Acceso a cámara (getUserMedia)
│   │   │   ├── scanner.js      → Lógica de escaneo con AI
│   │   │   └── export.js       → Exportación XLSX / PDF / Print
│   │   │
│   │   └── pages/
│   │       ├── login.js        → Lógica de la página de login
│   │       ├── inventario.js   → Lógica del inventario
│   │       ├── salidas.js      → Lógica de salidas/scan
│   │       ├── ai-entry.js     → Lógica de entrada AI
│   │       ├── martech.js      → Lógica de entrada MARTECH
│   │       ├── ordenes.js      → Lógica de órdenes
│   │       ├── reportes.js     → Lógica de reportes
│   │       ├── mapa.js         → Lógica del mapa
│   │       └── config.js       → Lógica de configuración
│   │
│   └── css/
│       ├── base.css            → Reset, variables CSS, tipografía
│       ├── layout.css          → Sidebar, bottom nav, grid
│       ├── components.css      → Botones, cards, modales, formularios
│       ├── utilities.css       → Toast, overlays, badges, loaders
│       └── pages/
│           ├── login.css       → Estilos exclusivos del login
│           ├── inventario.css  → Estilos del inventario
│           ├── salidas.css     → Estilos de salidas/scan
│           └── mapa.css        → Estilos del mapa
│
├── public/
│   └── icons/                  → favicon16.png, favicon32.png, icon192.png, icon512.png
│
├── docs/
│   ├── DATABASE.md             → Esquema de Supabase (tablas, RLS)
│   ├── ROLES.md                → Roles y permisos del sistema
│   ├── API.md                  → Endpoints AI Vision + Supabase
│   └── DEPLOYMENT.md           → Guía de despliegue
│
├── manifest.json               → PWA manifest
└── README.md
```

---

## 🚀 Tecnologías

| Tecnología | Uso |
|---|---|
| **Supabase** | Base de datos PostgreSQL + Auth + Edge Functions |
| **Claude AI (Vision)** | Análisis de imágenes/etiquetas con IA |
| **Vanilla JS (ES6+)** | Sin frameworks, modular por archivos |
| **CSS Variables** | Design system consistente |
| **XLSX.js** | Exportación de reportes a Excel |
| **PWA** | Funciona en móvil como app nativa |

---

## 👥 Roles del sistema

| Rol | Acceso |
|---|---|
| `admin` | Todo — configuración, usuarios, todos los módulos |
| `supervisor` | Inventario, órdenes, reportes, mapa |
| `operador` | Inventario, entradas, salidas, mapa |
| `cliente` | Inventario, órdenes, reportes (solo sus items) |

---

## 🗄️ Base de datos (Supabase schema: `ideascan`)

- `usuarios` — usuarios del sistema
- `clientes` — clientes registrados
- `almacenes` — almacenes por cliente
- `inventario` — items del inventario con SKU
- `ordenes` — órdenes de trabajo
- `salidas` — registro de salidas
- `entradas_ai` — entradas registradas por AI
- `entradas_martech` — entradas MARTECH

---

## ⚙️ Instalación local

```bash
# Clonar el repositorio
git clone https://github.com/cca-group/idea-scan-2.git
cd idea-scan-2

# No requiere build — es HTML/CSS/JS puro
# Servir con cualquier servidor estático:
npx serve .
# o
python3 -m http.server 8080
```

---

## 📱 PWA (Progressive Web App)

La app está optimizada para móvil e instalable como PWA desde el navegador.

---

*IDEA SCAN 2.0 © 2026 CCA Group*
