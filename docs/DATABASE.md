# 🗄️ DATABASE — Supabase Schema `ideascan`

## Tablas principales

### `usuarios`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | ID único |
| username | text UNIQUE | Nombre de usuario |
| nombre | text | Nombre completo |
| password_hash | text | Hash de contraseña |
| rol | text | admin / supervisor / operador / cliente |
| cliente_id | uuid FK → clientes | Cliente asignado (nullable) |
| almacen_id | uuid FK → almacenes | Almacén asignado (nullable) |
| activo | bool | Cuenta activa |
| created_at | timestamptz | Fecha de creación |

### `clientes`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | ID único |
| codigo | text UNIQUE | Código corto (SAFRAN, MARTECH) |
| nombre | text | Nombre completo |
| modulo_entrada | text | ai_entry / martech |
| activo | bool | Cliente activo |

### `almacenes`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | ID único |
| cliente_id | uuid FK | Cliente propietario |
| nombre | text | Nombre del almacén |
| descripcion | text | Descripción / ubicación |

### `inventario`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | ID único |
| sku | text UNIQUE | SKU generado (SAF2602001) |
| folio_entrada | text | Folio de entrada |
| cliente_id | uuid FK | Cliente |
| almacen_id | uuid FK | Almacén |
| numero_parte | text | Part Number |
| po | text | Purchase Order |
| descripcion | text | Descripción del item |
| cantidad | int | Cantidad de piezas |
| bultos | int | Número de bultos |
| tipo_bulto | text | Caja / Tarima / etc. |
| tracking_number | text | Número de tracking |
| carrier | text | FedEx / UPS / DHL / etc. |
| vendor | text | Proveedor |
| peso | text | Peso total |
| part_model | text | Modelo (solo maquinaria) |
| serial_number | text | Número de serie |
| area | text | Área del almacén |
| status | text | activo / salida / transferencia |
| folio_salida | text | Referencia a la salida |
| created_at | timestamptz | Fecha de entrada |
| updated_at | timestamptz | Última actualización |

### `salidas`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | ID único |
| folio | text UNIQUE | Folio de salida |
| cliente_id | uuid FK | Cliente |
| almacen_id | uuid FK | Almacén |
| fecha | date | Fecha de salida |
| hora_salida | text | Hora programada |
| camion | text | Número de camión |
| placas | text | Placas del vehículo |
| dept | text | Departamento / destino |
| operador_id | uuid FK | Usuario que registró |
| status | text | pendiente / completo / parcial |
| items | jsonb | Array de SKUs y bultos |
| created_at | timestamptz | Fecha de registro |

### `ordenes`
| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid PK | ID único |
| folio | text UNIQUE | Folio de orden |
| cliente_id | uuid FK | Cliente |
| tipo | text | Tipo de orden |
| status | text | pendiente / en_proceso / completa |
| items | jsonb | Items de la orden |
| created_at | timestamptz | Fecha de creación |

---

## RLS (Row Level Security)

- **admin**: Acceso total a todas las tablas
- **supervisor**: SELECT en inventario, salidas, ordenes de su almacén
- **operador**: INSERT/SELECT en inventario; INSERT en salidas de su almacén
- **cliente**: SELECT solo en sus propios registros (cliente_id = auth.uid())

---

## Edge Functions

| Función | URL | Descripción |
|---|---|---|
| `ai-vision` | `/functions/v1/ai-vision` | Análisis de imágenes con Claude Vision |
