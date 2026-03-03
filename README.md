# 🏭 Warehouse Manager System (WMS)

Sistema de Gestión de Almacén desarrollado en React 18 + Vite.

## 🚀 Inicio Rápido

```bash
# Instalar dependencias
npm install

# Desarrollo local
npm run dev

# Construir para producción
npm run build
```

## 📁 Estructura del Proyecto

```
src/
├── components/
│   ├── auth/          # ProtectedRoute
│   ├── layout/        # Sidebar, Header, MainLayout
│   ├── products/      # ProductModal
│   ├── inventory/     # StockAdjustModal
│   ├── orders/        # OrderModal
│   └── reports/       # SupplierModal
├── context/
│   ├── AuthContext    # Autenticación
│   └── AppContext     # Estado global de datos
├── pages/
│   ├── LoginPage
│   ├── DashboardPage
│   ├── ProductsPage
│   ├── InventoryPage
│   ├── OrdersPage
│   ├── ReportsPage
│   ├── SuppliersPage
│   └── SettingsPage
├── utils/
│   ├── helpers.js     # Funciones utilitarias
│   └── initialData.js # Datos de ejemplo
└── styles/
    └── global.css     # Sistema de diseño
```

## ✨ Funcionalidades

- **Dashboard** — KPIs, gráficas de movimientos, alertas de stock
- **Productos** — CRUD completo con filtros y búsqueda
- **Inventario** — Control de stock, ajustes de entrada/salida
- **Órdenes** — Registro de entradas y salidas de mercancía
- **Reportes** — Análisis por categoría, valor, top productos
- **Proveedores** — CRUD de proveedores
- **Autenticación** — Login con roles (admin/operator)

## 🔐 Credenciales Demo

| Usuario   | Contraseña | Rol      |
|-----------|------------|----------|
| admin     | admin123   | Admin    |
| operator  | op123      | Operator |

## 🌐 Deploy en GitHub Pages

1. Sube el código a un repositorio GitHub
2. Ve a **Settings → Pages**
3. Source: **GitHub Actions**
4. El workflow `.github/workflows/deploy.yml` construirá y publicará automáticamente

> **Nota:** Asegúrate de que `vite.config.js` tenga `base: '/nombre-del-repo/'`

## 🛠 Tecnologías

- React 18
- React Router v6
- Recharts (gráficas)
- Lucide React (iconos)
- CSS Modules + Variables CSS
- Vite 5
