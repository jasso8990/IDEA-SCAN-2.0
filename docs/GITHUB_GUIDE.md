# 🚀 Guía GitHub — Warehouse Manager System

> Pasos exactos para subir y mantener el proyecto en GitHub

---

## 📦 PASO 1 — Configuración inicial (solo una vez)

### 1.1 Instalar Git
Descarga desde https://git-scm.com/downloads e instala.

### 1.2 Configurar tu identidad
```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"
```

### 1.3 Crear repositorio en GitHub
1. Ve a **github.com** → clic en **"New repository"** (botón verde `+`)
2. Nombre: `warehouse-manager`
3. Visibilidad: **Private** (recomendado)
4. **NO** marques "Add README" ni ".gitignore"
5. Clic en **"Create repository"**
6. Copia la URL que aparece, ej: `https://github.com/TU_USUARIO/warehouse-manager.git`

### 1.4 Crear la carpeta local del proyecto
```
warehouse-manager/
├── login.html
├── inventario.html
├── salidas.html
├── ai-entry.html
├── martech-entry.html
├── config.html
├── mapa.html
├── reportes.html
├── ordenes.html
├── src/
│   ├── css/
│   │   ├── base.css
│   │   ├── layout.css
│   │   ├── components.css
│   │   ├── utilities.css
│   │   └── pages/
│   │       ├── login.css
│   │       ├── inventario.css
│   │       ├── salidas.css
│   │       ├── ai-entry.css
│   │       ├── config.css
│   │       ├── mapa.css
│   │       ├── reportes.css
│   │       └── ordenes.css
│   └── js/
│       ├── core/
│       │   ├── config.js
│       │   ├── auth.js
│       │   ├── db.js
│       │   ├── nav.js
│       │   └── utils.js
│       ├── modules/
│       │   ├── camera.js
│       │   ├── vision.js
│       │   ├── sku.js
│       │   └── export.js
│       └── pages/
│           ├── login.js
│           ├── inventario.js
│           ├── salidas.js
│           ├── ai-entry.js
│           ├── martech.js
│           ├── config-admin.js
│           ├── mapa.js
│           ├── reportes.js
│           └── ordenes.js
├── docs/
│   ├── DATABASE.md
│   └── DEPLOYMENT.md
└── README.md
```

### 1.5 Inicializar Git y subir por primera vez
```bash
# Entra a la carpeta del proyecto
cd warehouse-manager

# Inicializar repositorio local
git init

# Conectar con GitHub
git remote add origin https://github.com/TU_USUARIO/warehouse-manager.git

# Agregar TODOS los archivos
git add .

# Primer commit
git commit -m "🎉 Initial commit — estructura modular WMS"

# Subir al servidor
git push -u origin main
```

---

## 🔄 PASO 2 — Flujo de trabajo diario

Cada vez que Claude te entrega archivos modificados, usa este flujo:

### 2.1 Ver qué cambió
```bash
git status
```
Esto te muestra en **rojo** los archivos modificados o nuevos.

### 2.2 Ver el detalle de cambios (opcional)
```bash
git diff
```
Muestra exactamente qué líneas cambiaron.

### 2.3 Agregar los cambios
```bash
# Opción A: Agregar TODOS los archivos modificados
git add .

# Opción B: Agregar solo archivos específicos
git add src/js/pages/inventario.js
git add src/js/pages/salidas.js
```

### 2.4 Hacer commit con mensaje descriptivo
```bash
git commit -m "✅ Implementar inventario.js y salidas.js completos"
```

### 2.5 Subir a GitHub
```bash
git push
```

---

## 🏷️ PASO 3 — Convención de mensajes de commit

Usa **emojis + descripción** para que sea fácil identificar cada cambio:

| Tipo | Emoji | Ejemplo |
|------|-------|---------|
| Nuevo módulo | `✨` | `✨ Agregar módulo de reportes` |
| Corrección bug | `🐛` | `🐛 Fix error en filtro de inventario` |
| Refactor | `♻️` | `♻️ Separar lógica de salidas en módulos` |
| HTML | `🏗️` | `🏗️ Migrar config.html a estructura modular` |
| CSS | `💄` | `💄 Mejorar estilos móvil en inventario` |
| JS lógica | `⚡` | `⚡ Implementar AI scan en salidas.js` |
| Docs | `📝` | `📝 Actualizar README con instrucciones` |
| Seguridad | `🔐` | `🔐 Actualizar credenciales Supabase` |
| Dependencias | `📦` | `📦 Actualizar SheetJS a versión latest` |

---

## 🌿 PASO 4 — Trabajar con Ramas (para cambios grandes)

Cuando Claude trabaje en algo grande (nuevo módulo, rediseño), usa ramas:

```bash
# Crear y cambiar a nueva rama
git checkout -b feature/nuevo-modulo-paqueteria

# ... hacer cambios, commits ...

# Subir la rama
git push -u origin feature/nuevo-modulo-paqueteria

# Cuando esté listo, volver a main y fusionar
git checkout main
git merge feature/nuevo-modulo-paqueteria

# Subir main con los cambios
git push

# Eliminar la rama (ya no se necesita)
git branch -d feature/nuevo-modulo-paqueteria
```

### Ramas sugeridas para este proyecto:
```
main                          ← código estable, producción
feature/paqueteria            ← módulo de paquetería
feature/reportes-avanzados    ← mejoras en reportes
fix/login-auth                ← corrección de bugs
```

---

## ⬇️ PASO 5 — Descargar cambios (si trabajas en múltiples PCs)

```bash
# Traer últimos cambios de GitHub
git pull

# Si hay conflictos, Git te avisará — resolver manualmente
# luego: git add . → git commit → git push
```

---

## 🔖 PASO 6 — Versiones / Releases

Cuando el sistema esté listo para producción, crea un **tag de versión**:

```bash
# Crear versión 1.0
git tag -a v1.0 -m "🚀 Release v1.0 — WMS completo con AI Vision"
git push origin v1.0

# Ver todas las versiones
git tag
```

En GitHub ve a **Releases → Create a new release** y selecciona el tag para publicarlo formalmente.

---

## 🆘 PASO 7 — Comandos de emergencia

```bash
# ¿Subiste algo que no querías? — revertir último commit (sin borrar archivos)
git revert HEAD

# ¿Archivo dañado? — recuperar versión anterior del archivo
git checkout HEAD -- src/js/pages/inventario.js

# ¿Ver historial de cambios?
git log --oneline

# ¿Ver quién cambió qué línea?
git blame src/js/pages/salidas.js
```

---

## 📋 RESUMEN — Comandos más usados

```bash
git status                     # Ver qué cambió
git add .                      # Agregar todo
git commit -m "mensaje"        # Guardar cambio local
git push                       # Subir a GitHub
git pull                       # Descargar de GitHub
git log --oneline              # Historial
git checkout -b nombre-rama    # Nueva rama
```

---

## 🔁 Flujo con Claude (sesión a sesión)

Cada vez que trabajen en el proyecto:

```
1. git pull                        ← bajar últimos cambios
2. Claude modifica/crea archivos
3. Copiar archivos al folder local
4. git add .
5. git commit -m "descripción"
6. git push                        ← subir a GitHub
```

---

*Generado por IDEA SCAN WMS — Warehouse Manager System*
