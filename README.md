# 🏭 Warehouse Manager System

Sistema de gestión de almacén 100% funcional en GitHub Pages, sin servidor.

---

## 📁 Estructura de archivos

```
/
├── index.html              ← Página de LOGIN (página principal)
├── css/
│   ├── global.css          ← Estilos generales del sistema
│   ├── login.css           ← Estilos de la pantalla de login
│   └── dashboard.css       ← Estilos del layout y dashboard
├── js/
│   ├── auth.js             ← Autenticación y sesiones
│   ├── storage.js          ← Base de datos (localStorage)
│   ├── dashboard.js        ← Lógica del dashboard
│   ├── inventory.js        ← Gestión de inventario
│   ├── movements.js        ← Entradas y salidas
│   ├── locations.js        ← Gestión de ubicaciones
│   ├── reports.js          ← Reportes y exportaciones
│   └── users.js            ← Gestión de usuarios
└── pages/
    ├── dashboard.html      ← Panel principal
    ├── inventory.html      ← Inventario de productos
    ├── inbound.html        ← Registro de entradas
    ├── outbound.html       ← Registro de salidas
    ├── locations.html      ← Ubicaciones del almacén
    ├── reports.html        ← Reportes y estadísticas
    └── users.html          ← Gestión de usuarios (solo admin)
```

---

## 🔐 Usuarios predeterminados

| Usuario    | Contraseña | Rol           |
|------------|------------|---------------|
| admin      | admin123   | Administrador |
| operador   | op123      | Operador      |

---

## ✅ Funcionalidades incluidas

- **Login** con sesión segura
- **Dashboard** con KPIs en tiempo real
- **Inventario** completo (CRUD de productos)
- **Entradas** de mercancía con folios automáticos
- **Salidas** con validación de stock
- **Ubicaciones** con mapa visual del almacén
- **Reportes** (Inventario, Movimientos, Valorización, Top Productos)
- **Exportar CSV** en todas las secciones
- **Gestión de usuarios** (solo administradores)
- **Alertas** de stock bajo / sin stock

---

## 💾 Almacenamiento

Los datos se guardan en el **localStorage** del navegador. Esto significa:
- No se necesita servidor ni base de datos
- Los datos persisten entre sesiones
- Cada navegador/dispositivo tiene sus propios datos

---

## 🔒 Notas de seguridad

Este sistema es para uso interno en redes locales o equipos confiables.
Para producción con múltiples usuarios, se recomienda agregar un backend real.
