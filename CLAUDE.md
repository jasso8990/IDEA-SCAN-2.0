# CLAUDE.md — IDEA SCAN 2.0
> Ingeniero de referencia: Claude Sonnet | CCA Group — Warehouse Manager System (3PL)  
> Última actualización: 2026-03-13  
> Stack: Vanilla JS (ES2022) · Supabase (PostgreSQL + Storage) · GitHub Pages (PWA)
---
## 1. VISIÓN GENERAL DEL SISTEMA
IDEA SCAN 2.0 es un WMS (Warehouse Management System) 3PL multi-cliente desplegado como PWA estática en GitHub Pages. La base de datos vive en Supabase bajo el schema `ideascan`. La IA (Claude) se invoca únicamente a través de un **proxy seguro** (`ANTHROPIC_PROXY` → Supabase Edge Function `claude-proxy`); la API key **jamás** aparece en el código cliente.
### Clientes activos
| Cliente | Prefijo Entry | ¿Importador? | ¿Excel obligatorio? | Módulo IA |
|---------|--------------|-------------|----------------------|-----------|
| **Safran** | `SAF` | ❌ No se captura | ❌ No se genera | `ai-entry.html` |
| **Martech** | `MAR` / `MAQ` | ✅ Obligatorio | ✅ Obligatorio | `ai-martech.html` |
| **Cooper** | `COP` (inferido) | ✅ Obligatorio | ✅ Obligatorio | `ai-cooper.html` |
---
## 2. JERARQUÍA DE DATOS (regla de negocio principal)
```
Entrada (Master Tracking / Entry No.)
 └── Bultos individuales  [1..N]
      └── Items / Renglones  [por PN]
           └── Series / S/N  [3.1, 3.2 … 449]
```
- Una **Entrada** = un evento de recepción único, identificado por su `folio` / Entry No.
- Un **Bulto** = unidad física de transporte (caja, tarima, tubo, java, crate, bulto).
- Un **Renglon** = una línea de Part Number dentro de un bulto.
- Una **Serie** = número de serie (S/N) individual asociado a un renglon.
### Reglas de bultos
1. Si **múltiples partes (PN distintos)** llegan en el mismo bulto → solo el **primer renglon** de ese bulto lleva `bulk = 1`; los demás van vacíos en la columna Bulto.
2. Si **una parte viene en varios bultos** (ej. 3 cajas del mismo PN) → se usa la secuencia `"1 of X"` donde X es el total de bultos de esa parte. Cada caja es un renglon independiente con su propio `bulk_num`.
3. El campo `total_bultos` en la cabecera de la entrada refleja el **máximo** entre los bultos procesados y el total detectado en el label del carrier (`num_bultos` del JSON IA).
---
## 3. GENERACIÓN DEL ENTRY NO. (folio)
### Formato canónico
```
[PREFIJO_CLIENTE][YY][MM][SECUENCIA_3_DÍGITOS]
```
| Segmento | Descripción | Ejemplo |
|----------|-------------|---------|
| `PREFIJO` | Código del cliente en mayúsculas | `SAF`, `MAR`, `MAQ`, `COP` |
| `YY` | Año de 2 dígitos | `26` (→ 2026) |
| `MM` | Mes con zero-padding | `03` |
| `SEQ` | Contador correlativo de 3 dígitos, **se reinicia cada mes** | `001`, `002` … |
**Ejemplos reales:**
- `SAF2603001` — Safran, marzo 2026, primera entrada del mes
- `MAR2603007` — Martech Materia Prima, marzo 2026, séptima entrada
- `MAQ2603002` — Martech Maquinaria, marzo 2026, segunda entrada
- `COP2603001` — Cooper, primera entrada de marzo
### Implementación actual (`iniciarEntrada()` en `ai-martech.html`)
```js
const prefix = _tipoActual === 'maquinaria' ? 'MAQ' : 'MAR';
const yy = String(hoy.getFullYear()).slice(2);   // '26'
const mm = String(hoy.getMonth()+1).padStart(2,'0'); // '03'
const dd = String(hoy.getDate()).padStart(2,'0');     // '13' (solo informativo, no va en folio)
// Contar cuántas entradas existen con ese prefijo+YYMM en el mismo mes
const { count } = await sb()
  .from('martech_entradas')
  .select('*', { count: 'exact', head: true })
  .like('folio', `${prefix}-${yy}${mm}%`);
_folioActual = `${prefix}-${yy}${mm}-${String((count || 0) + 1).padStart(3, '0')}`;
```
> ⚠️ **El guion (`-`) es el separador real en DB.** La convención visual es `MAR-2603-001`.  
> ⚠️ El contador se basa en un `COUNT` de registros existentes — si se borra una entrada, el contador puede repetirse. Mejora sugerida: usar una secuencia SQL mensual.
---
## 4. REGLAS POR CLIENTE
### 4.1 Safran (`ai-entry.html`)
- **NO** se captura el campo `Importador` en ningún formulario.
- **NO** se genera ni descarga archivo Excel al confirmar la entrada.
- El folio sigue el formato `SAF-YYMM-SEQ`.
- El flujo IA usa `claude-haiku-4-5-20251001` con timeout de 45 s.
- La entrada Safran se registra directamente en `inventario` (tabla pública, schema `public`).
- Los usuarios con `cliente_nombre` que contiene `"safran"` ven el módulo `IA Scan` pero **no** ven `AI Martech` ni `AI Cooper`.
### 4.2 Martech (`ai-martech.html`)
- Campos **obligatorios** antes de confirmar: `Importador` (campo `vendor`/`supplier`), `Tipo de Bulto`, `Carrier`.
- Al confirmar → se **genera y sube** un archivo `.xlsx` al Storage de Supabase (`imagenes/{folio}/{folio}.xlsx`) y se guarda la URL en `martech_entradas.excel_url`.
- El usuario puede descargar el Excel desde la vista "Confirmado".
- Dos tipos de entrada:
  - **Materia Prima** (prefijo `MAR`): escaneo bulto por bulto con foto → IA extrae PO, PN, origen, cantidad, peso, tracking, vendor.
  - **Maquinaria** (prefijo `MAQ`): primero se escanea el packing list completo → IA detecta todos los PN → luego se escanea cada pieza individual para asociar su S/N y fotos.
- Las tablas propias son `ideascan.martech_entradas` y `ideascan.martech_renglones`.
### 4.3 Cooper (`ai-cooper.html`)
- Mismas reglas que Martech: `Importador` obligatorio, Excel obligatorio al confirmar.
- Tablas propias: `ideascan.cooper_entradas` y `ideascan.cooper_renglones`.
- Usuarios con `cliente_nombre` que contiene `"cooper"` ven solo `AI Cooper`.
---
## 5. FLUJOS DE ENTRADA DETALLADOS
### 5.1 Flujo Materia Prima (Martech / Cooper)
```
[+] Nueva Entrada
  → seleccionar tipo = "materia_prima"
  → iniciarEntrada() → crear borrador en BD
  → Para cada bulto físico:
      1. Tomar foto(s) del bulto (packing label, caja, invoice)
      2. procesarBultoMP() → callAI() → JSON con renglones
         JSON devuelve: po, pn, descripcion, origen, cantidad, weight, tracking, vendor
      3. Insertar renglones en `martech_renglones` con bulto_num = N
      4. Actualizar UI (bulto procesado ✅)
  → terminarEntradaMP()
  → cargarPreview() → tabla editable
  → seleccionar tipoBulto + carrier + tracking
  → confirmarEntrada()
      · subir Excel a Storage
      · update martech_entradas → estado = 'confirmado'
      · insert en inventario (registro maestro)
```
### 5.2 Flujo Maquinaria
```
[+] Nueva Entrada
  → seleccionar tipo = "maquinaria"
  → iniciarEntrada() → crear borrador
  → Paso 1: Tomar foto del Packing List completo
      analizarPacking() → IA detecta array de piezas (pn, descripcion, marca, modelo, cantidad)
  → Paso 2: Por cada pieza (renglon del packing):
      1. Tomar foto de la pieza/etiqueta
      2. procesarPieza() → IA identifica qué PN es → extrae S/N, marca, modelo
      3. Si tiene múltiples S/N → un renglon DB por cada S/N
  → terminarEntradaMAQ() → construir renglones finales
  → cargarPreview() → tabla editable
  → confirmarEntrada() (igual que MP)
```
### 5.3 Flujo Safran (IA Scan general)
```
[+] Nueva Entrada
  → auto-selecciona cliente Safran si el usuario no tiene cliente_id
  → tomar foto del producto/caja
  → callAI() → extrae SKU, descripción, código de barras
  → folio = ENT-{YY}{MM}-{SEQ} (sin prefijo SAF en la implementación actual del genFolio legacy)
  → insertar en inventario (tabla pública)
  → NO Excel, NO Importador
```
---
## 6. ESQUEMA DE BASE DE DATOS
### Schema `public` (tablas generales)
```sql
clientes     (id, nombre, rfc, contacto, telefono, email, activo)
usuarios     (id, nombre, username, password, rol, cliente_id→clientes, activo)
inventario   (id, sku, descripcion, cliente_id, cantidad, stock_minimo, ubicacion, unidad,
              folio_entrada, numero_parte, bultos, carrier, vendor, tracking_number,
              po, origin, fecha_entrada, estado, tipo_bulto, partes jsonb, imagenes jsonb)
entradas     (id, folio, sku, descripcion, bultos, fecha, referencia, notas,
              operador_id, operador, cliente_id)           -- módulo legacy
salidas      (id, folio, sku, bultos, fecha, destino, transportista, notas,
              operador_id, operador, cliente_id, estado)
actividad_log (id, sku, descripcion, tipo, usuario)
```
### Schema `ideascan` (tablas por cliente)
```sql
-- Martech
martech_entradas  (id, folio UNIQUE, fecha, done_by, inspected_by, supplier, invoice,
                   packing, carrier, plate, total_bultos, tipo_bulto, localizacion,
                   observaciones, excel_url, fotos_packing jsonb, estado, tipo,
                   vendor, tracking_number, operador_id, operador_nombre)
martech_renglones (id, entrada_id→martech_entradas CASCADE, folio, pda, numero_parte,
                   po, descripcion, hts_fraccion, cantidad, um, peso_lbs,
                   bulk, tipo, origen, tracking, seccion_negocio, brand_marca,
                   model_modelo, serie, observaciones,
                   -- campos extendidos del flujo IA:
                   bulto_num, tipo_renglon, pn, weight, tracking_number, vendor,
                   marca, modelo, numero_serie, fotos_bulto jsonb, datos_raw jsonb)
-- Cooper (estructura idéntica a Martech)
cooper_entradas   (id, folio UNIQUE, …)
cooper_renglones  (id, entrada_id→cooper_entradas CASCADE, …)
```
---
## 7. CONTROL DE ACCESO POR ROL
```
admin       → acceso total (todos los módulos + config)
supervisor  → base + salidas + paquetería + reportes (sin config)
operador    → base + salidas + paquetería + reportes (sin config)
cliente     → solo inventario propio + mis salidas + mi paquetería
```
### Navegación por cliente
| Módulo | Safran | Martech | Cooper | Admin/Interno |
|--------|--------|---------|--------|---------------|
| IA Scan (ai-entry) | ✅ | ❌ | ❌ | ✅ |
| AI Martech | ❌ | ✅ | ❌ | ✅ |
| AI Cooper | ❌ | ❌ | ✅ | ✅ |
| Salidas | ✅ | ✅ | ✅ | ✅ |
| Paquetería | ✅ | ✅ | ✅ | ✅ |
| Config | ❌ | ❌ | ❌ | ✅ (admin) |
---
## 8. INTEGRACIÓN DE IA (Claude)
### Configuración
- **Modelo producción**: `claude-sonnet-4-20250514` (Martech/Cooper)
- **Modelo legacy**: `claude-haiku-4-5-20251001` (Safran/ai-entry)
- **Proxy**: `ANTHROPIC_PROXY` = `https://{project}.supabase.co/functions/v1/claude-proxy`
- **Timeout**: 45 segundos con `AbortController`
- **max_tokens**: 2000 (para evitar JSON truncado)
### Compresión de imágenes (`compressImage()`)
| Modo | Max px | Calidad JPEG |
|------|--------|-------------|
| `texto` | 2200 | 88% |
| `normal` | 1600 | 82% |
| `thumb` | 900 | 75% |
### JSON de respuesta (Materia Prima)
```json
{
  "renglones": [
    { "po": "PO#", "pn": "Part Number exacto", "descripcion": "...",
      "sn": "S/N o null", "origen": "China", "cantidad": 5,
      "weight": "25.5 kg" }
  ],
  "tracking_number": "1Z...",
  "num_bultos": 3,
  "vendor": "Proveedor S.A.",
  "carrier": "DHL",
  "origin_id": "...",
  "po": "PO global"
}
```
### JSON de respuesta (Maquinaria — packing)
```json
{
  "vendor": "...", "po": "...", "tracking_number": "...",
  "carrier": "...", "num_bultos": 2,
  "piezas": [
    { "pn": "...", "descripcion": "...", "marca": "...", "modelo": "...",
      "cantidad": 1, "origen": "USA", "weight": "...", "po": "...", "sn": null }
  ]
}
```
### Normalización de origen
`normalizarOrigen()` convierte texto libre al código ISO de 2 letras (`China` → `CN`, `Mexico` → `MX`, `USA` → `US`). Si no hay coincidencia, toma las primeras 2 letras en mayúsculas.
---
## 9. ESTRUCTURA DE ARCHIVOS
```
IDEA-SCAN-2.0/
├── login.html          — Autenticación (sin layout app-shell)
├── dashboard.html      — KPIs y actividad reciente
├── inventario.html     — Inventario maestro + vista detalle Safran
├── entradas.html       — Módulo legacy de entradas (folio ENT-YYYYMMDD-RAND)
├── salidas.html        — Registro de salidas con escaneo QR/foto
├── ai-entry.html       — IA Scan para Safran ⚠️ lógica inline
├── ai-martech.html     — IA para Martech ⚠️ lógica inline (>2000 líneas)
├── ai-cooper.html      — IA para Cooper ⚠️ lógica inline
├── paqueteria.html     — Gestión de paquetería/envíos
├── reportes.html       — Exportación y reportes
├── config.html         — Admin: usuarios, clientes, configuración
├── supabase-schema.sql — DDL completo (ejecutar en Supabase SQL Editor)
├── manifest.json       — PWA manifest
├── sw.js               — Service Worker (caché offline)
└── src/
    ├── css/
    │   ├── base.css        — Variables CSS, tipografía (Exo 2, Inter, JetBrains Mono)
    │   ├── layout.css      — Sidebar, header, bottom-nav, app-shell
    │   ├── components.css  — Botones, cards, modales, badges, toasts
    │   └── utilities.css   — Helpers: spacing, flex, font, color
    └── js/
        ├── core/
        │   ├── config.js   — ⚠️ EDITAR: SUPABASE_URL + SUPABASE_KEY
        │   │               — sb() singleton, ROLES, getNavItems(), helpers fmtDate/fmtNum
        │   ├── auth.js     — requireAuth(), currentUser(), login/logout
        │   ├── nav.js      — renderSidebar(), renderBottomNav()
        │   └── camera.js   — Helpers de cámara/compresión
        └── pages/
            ├── dashboard.js
            ├── inventario.js
            ├── entradas.js   — Módulo legacy
            ├── salidas.js
            ├── reportes.js
            ├── config.js     — CRUD usuarios y clientes
            └── ai-entry.js   — ⚠️ VACÍO (legacy), ver ai-entry.html
```
---
## 10. PATRONES DE CÓDIGO A SEGUIR
### Queries Supabase
```js
// Siempre usar el cliente singleton sb() (schema ideascan por defecto)
const { data, error } = await sb()
  .from('martech_entradas')
  .select('*, martech_renglones(*)')
  .eq('id', id)
  .single();
if (error) { showToast('Error: ' + error.message, 'error'); return; }
```
### Toast de feedback
```js
showToast('Mensaje de éxito ✓', 'success');   // verde
showToast('Error al guardar', 'error');         // rojo
showToast('Información', '');                   // neutro
```
### Overlay de IA
```js
showAI('Procesando bulto 2...', 'La IA extrae PN, PO, S/N...');
// ... await callAI(...)
hideAI();
```
### Generación de folio (patrón canónico)
```js
async function generarFolio(prefix, tabla) {
  const hoy = new Date();
  const yy = String(hoy.getFullYear()).slice(2);
  const mm = String(hoy.getMonth() + 1).padStart(2, '0');
  const { count } = await sb()
    .from(tabla)
    .select('*', { count: 'exact', head: true })
    .like('folio', `${prefix}-${yy}${mm}%`);
  return `${prefix}-${yy}${mm}-${String((count || 0) + 1).padStart(3, '0')}`;
  // Resultado: "SAF-2603-001"
}
```
---
## 11. REGLAS DE NEGOCIO — RESUMEN RÁPIDO
| # | Regla | Detalle |
|---|-------|---------|
| BR-01 | Jerarquía de datos | Entrada → Bultos → Items/Series |
| BR-02 | Entry No. = prefijo+YY+MM+SEQ | SEQ se reinicia el 1° de cada mes |
| BR-03 | Safran: sin Importador | No hay campo supplier/vendor en su flujo |
| BR-04 | Safran: sin Excel | No se genera ni descarga .xlsx |
| BR-05 | Martech/Cooper: Importador obligatorio | Validar antes de confirmar |
| BR-06 | Martech/Cooper: Excel obligatorio | Se genera al confirmar y se sube a Storage |
| BR-07 | Bultos múltiples partes | Solo 1er renglon del bulto tiene `bulk=1` |
| BR-08 | Parte en múltiples bultos | Secuencia "1 of X" por cada bulto |
| BR-09 | Serie → renglon individual | Si 1 PN tiene N series → N renglones en DB |
| BR-10 | Tipo de bulto obligatorio | Tarima / Caja / Bulto / Tubo / Java / Crate |
| BR-11 | Acceso por cliente | Nav items filtrados por `cliente_nombre` en JWT |
| BR-12 | IA solo vía proxy | Nunca llamar `api.anthropic.com` desde el cliente |
| BR-13 | Imágenes en modo `texto` | Max 2200px, JPEG 88% para mejor OCR |
| BR-14 | Origen → código ISO 2 letras | `normalizarOrigen()` en todos los módulos |
---
## 12. CONFIGURACIÓN INICIAL (checklist)
- [ ] Crear proyecto en Supabase y obtener `SUPABASE_URL` + `SUPABASE_KEY`
- [ ] Ejecutar `supabase-schema.sql` en SQL Editor
- [ ] Editar `src/js/core/config.js` con las claves reales
- [ ] Crear Edge Function `claude-proxy` con la API key en Supabase Secrets
- [ ] Activar GitHub Pages → rama `main`, raíz `/`
- [ ] Crear bucket `imagenes` en Supabase Storage (público para lectura)
- [ ] Cambiar contraseña del usuario `admin` tras el primer acceso
---
## 13. DEUDA TÉCNICA CONOCIDA
1. **Lógica IA inline en HTML** — `ai-entry.html`, `ai-martech.html`, `ai-cooper.html` superan 1500 líneas cada uno. Refactorizar a módulos JS independientes.
2. **Contador de folio no atómico** — `COUNT + 1` puede generar duplicados bajo concurrencia. Migrar a `SEQUENCE` SQL o función RPC en Supabase.
3. **Contraseñas en texto plano** — La tabla `usuarios` almacena `password` en texto plano. Implementar hashing (bcrypt / Supabase Auth).
4. **RLS desactivado** — Row Level Security está deshabilitado en todas las tablas. Activar con políticas por `cliente_id` para producción.
5. **Rol `gerente` obsoleto** — Eliminado en `config.js` pero puede existir en registros viejos de BD. Migrar a `supervisor`.
6. **`entradas.js` es legacy** — El módulo `entradas.html` usa `genFolio()` con formato `ENT-YYYYMMDD-RAND` (aleatorio, no correlativo). No refleja las reglas de negocio actuales.
