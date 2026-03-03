-- ═══════════════════════════════════════════════════════════════
--  IDEA SCAN 2.0 — Warehouse Manager System
--  Supabase Schema: ideascan
--
--  INSTRUCCIONES:
--  1. Abre Supabase → SQL Editor
--  2. Pega TODO este archivo y ejecuta
--  3. Las tablas se crean en el schema "ideascan"
-- ═══════════════════════════════════════════════════════════════

-- Crear schema si no existe
CREATE SCHEMA IF NOT EXISTS ideascan;

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ───────────────────────────────────────────────────────────────
-- TABLA: clientes
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideascan.clientes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo          TEXT NOT NULL UNIQUE,               -- SAFRAN, MARTECH
  nombre          TEXT NOT NULL,
  modulo_entrada  TEXT DEFAULT 'ai_entry',            -- ai_entry | martech
  color           TEXT DEFAULT '#2d6ef5',             -- color del cliente en UI
  campos_captura  TEXT[] DEFAULT '{}',                -- campos personalizados del form
  activo          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────
-- TABLA: almacenes
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideascan.almacenes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id      UUID REFERENCES ideascan.clientes(id) ON DELETE SET NULL,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  direccion       TEXT,
  activo          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────
-- TABLA: usuarios
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideascan.usuarios (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_id         UUID UNIQUE,                        -- Supabase Auth UID (si usa Supabase Auth)
  username        TEXT NOT NULL UNIQUE,               -- nombre de usuario para login
  email           TEXT UNIQUE,                        -- email (puede ser interno @ideascan.wms)
  nombre          TEXT NOT NULL,
  nombre_display  TEXT,                               -- nombre corto para UI
  password_hash   TEXT,                               -- hash bcrypt (fallback login)
  rol             TEXT NOT NULL DEFAULT 'operador'    -- admin | supervisor | operador | cliente
                  CHECK (rol IN ('admin','supervisor','operador','cliente')),
  cliente_id      UUID REFERENCES ideascan.clientes(id) ON DELETE SET NULL,
  almacen_id      UUID REFERENCES ideascan.almacenes(id) ON DELETE SET NULL,
  color           TEXT DEFAULT '#2d6ef5',
  activo          BOOLEAN DEFAULT TRUE,
  ultimo_acceso   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────
-- TABLA: inventario
-- Tabla central del sistema — registra cada SKU/entrada
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideascan.inventario (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku             TEXT NOT NULL UNIQUE,               -- SAF2602001
  folio_entrada   TEXT,                               -- folio del lote de entrada
  cliente_id      UUID REFERENCES ideascan.clientes(id),
  almacen_id      UUID REFERENCES ideascan.almacenes(id),
  operador_id     UUID REFERENCES ideascan.usuarios(id),

  -- Datos del item
  numero_parte    TEXT,                               -- Part Number
  po              TEXT,                               -- Purchase Order
  descripcion     TEXT,
  cantidad        INTEGER DEFAULT 0,                  -- Cantidad de piezas
  bultos          INTEGER DEFAULT 1,                  -- Número de bultos/cajas
  tipo_bulto      TEXT DEFAULT 'Caja',                -- Caja | Tarima | Pallet | etc.
  peso            TEXT,                               -- Peso total (con unidad, ej: "3.5 kg")

  -- Logística
  tracking_number TEXT,
  carrier         TEXT,                               -- FedEx | UPS | DHL | etc.
  vendor          TEXT,
  origin          TEXT,                               -- País/ciudad de origen

  -- Maquinaria (solo módulo MARTECH)
  part_model      TEXT,
  serial_number   TEXT,
  inspection_no   TEXT,                               -- Folio de inspección MARTECH

  -- Ubicación en almacén
  zona            TEXT,                               -- zona del mapa
  ubicacion       TEXT,                               -- ubicación precisa (A1-B3)
  area            TEXT DEFAULT 'OPS',                 -- OPS | ISS | RMA | MRO

  -- Estado
  estado          TEXT DEFAULT 'activo'               -- activo | salida_parcial | salida_total | reservado
                  CHECK (estado IN ('activo','salida_parcial','salida_total','reservado')),
  activo          BOOLEAN DEFAULT TRUE,               -- false = eliminado lógico

  -- Imágenes (URLs de Supabase Storage)
  imagenes        TEXT[] DEFAULT '{}',

  fecha_entrada   TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_inventario_sku          ON ideascan.inventario(sku);
CREATE INDEX IF NOT EXISTS idx_inventario_cliente      ON ideascan.inventario(cliente_id);
CREATE INDEX IF NOT EXISTS idx_inventario_almacen      ON ideascan.inventario(almacen_id);
CREATE INDEX IF NOT EXISTS idx_inventario_estado       ON ideascan.inventario(estado);
CREATE INDEX IF NOT EXISTS idx_inventario_created      ON ideascan.inventario(created_at DESC);

-- ───────────────────────────────────────────────────────────────
-- TABLA: movimientos
-- Historial de movimientos: entradas y salidas
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideascan.movimientos (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo            TEXT NOT NULL                       -- entrada | salida | transferencia
                  CHECK (tipo IN ('entrada','salida','transferencia')),
  folio           TEXT,                               -- folio de la operación
  sku             TEXT,                               -- SKU relacionado
  descripcion     TEXT,
  cantidad        INTEGER DEFAULT 0,
  unidad          TEXT DEFAULT 'bultos',
  referencia      TEXT,                               -- seal, PO, manifiesto, etc.
  notas           TEXT,

  usuario_id      UUID REFERENCES ideascan.usuarios(id),
  cliente_id      UUID REFERENCES ideascan.clientes(id),
  almacen_id      UUID REFERENCES ideascan.almacenes(id),

  fecha           TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_tipo        ON ideascan.movimientos(tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_sku         ON ideascan.movimientos(sku);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha       ON ideascan.movimientos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_cliente     ON ideascan.movimientos(cliente_id);

-- ───────────────────────────────────────────────────────────────
-- TABLA: salidas_borradores
-- Manifiestos de salida guardados para continuar después
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideascan.salidas_borradores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio           TEXT NOT NULL,
  dept            TEXT,                               -- Departamento (SAFRAN, etc.)
  fecha_doc       TEXT,                               -- Fecha del documento manifiesto
  area            TEXT,                               -- OPS | ISS | RMA | MRO | 8106
  truck           TEXT,                               -- Hora de llegada del camión
  plates          TEXT,                               -- Placas del vehículo
  seal            TEXT,                               -- Número de sello (UL-XXXXX)

  entries         JSONB DEFAULT '[]',                 -- [{sku, bultos, found, scannedBultos}]
  estado          TEXT DEFAULT 'pendiente'            -- pendiente | en_proceso | completado
                  CHECK (estado IN ('pendiente','en_proceso','completado')),

  operador_id     UUID REFERENCES ideascan.usuarios(id),
  cliente_id      UUID REFERENCES ideascan.clientes(id),
  almacen_id      UUID REFERENCES ideascan.almacenes(id),

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salidas_borradores_estado   ON ideascan.salidas_borradores(estado);
CREATE INDEX IF NOT EXISTS idx_salidas_borradores_cliente  ON ideascan.salidas_borradores(cliente_id);

-- ───────────────────────────────────────────────────────────────
-- TABLA: ordenes
-- Órdenes de trabajo (entrada, salida, transferencia)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideascan.ordenes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio           TEXT NOT NULL UNIQUE,
  tipo            TEXT NOT NULL DEFAULT 'salida'      -- entrada | salida | transferencia
                  CHECK (tipo IN ('entrada','salida','transferencia')),
  estado          TEXT DEFAULT 'pendiente'            -- pendiente | en_proceso | completada | cancelada
                  CHECK (estado IN ('pendiente','en_proceso','completada','cancelada')),

  cliente_id      UUID REFERENCES ideascan.clientes(id),
  almacen_origen  UUID REFERENCES ideascan.almacenes(id),
  almacen_destino UUID REFERENCES ideascan.almacenes(id),
  operador_id     UUID REFERENCES ideascan.usuarios(id),

  referencia      TEXT,                               -- PO, documento externo
  transporte      TEXT,                               -- empresa de transporte
  numero_orden    TEXT,                               -- número de orden del cliente
  sello           TEXT,                               -- sello del camión
  notas           TEXT,

  confirmado          BOOLEAN DEFAULT FALSE,
  confirmado_at       TIMESTAMPTZ,
  fecha_completada    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ordenes_estado      ON ideascan.ordenes(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_cliente     ON ideascan.ordenes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_created     ON ideascan.ordenes(created_at DESC);

-- ───────────────────────────────────────────────────────────────
-- TABLA: orden_items
-- Items (SKUs) asociados a cada orden
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideascan.orden_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  orden_id        UUID NOT NULL REFERENCES ideascan.ordenes(id) ON DELETE CASCADE,
  sku             TEXT,
  numero_parte    TEXT,
  descripcion     TEXT,
  cantidad        INTEGER DEFAULT 1,
  bultos          INTEGER DEFAULT 1,
  estado          TEXT DEFAULT 'pendiente'            -- pendiente | confirmado | cancelado
                  CHECK (estado IN ('pendiente','confirmado','cancelado')),
  notas           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orden_items_orden   ON ideascan.orden_items(orden_id);

-- ───────────────────────────────────────────────────────────────
-- TABLA: paqueteria
-- Registro de paquetería (recibos FedEx/UPS/DHL sin SKU de inventario)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideascan.paqueteria (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  folio           TEXT,
  tracking_number TEXT,
  carrier         TEXT,                               -- FedEx | UPS | DHL | etc.
  descripcion     TEXT,
  destinatario    TEXT,
  remitente       TEXT,
  peso            TEXT,
  estado          TEXT DEFAULT 'recibido'             -- recibido | entregado | pendiente
                  CHECK (estado IN ('recibido','entregado','pendiente')),

  cliente_id      UUID REFERENCES ideascan.clientes(id),
  almacen_id      UUID REFERENCES ideascan.almacenes(id),
  operador_id     UUID REFERENCES ideascan.usuarios(id),

  imagenes        TEXT[] DEFAULT '{}',

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paqueteria_cliente  ON ideascan.paqueteria(cliente_id);
CREATE INDEX IF NOT EXISTS idx_paqueteria_created  ON ideascan.paqueteria(created_at DESC);

-- ───────────────────────────────────────────────────────────────
-- TABLA: zonas
-- Zonas del mapa del almacén (posición, tipo, capacidad)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideascan.zonas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  almacen_id      UUID NOT NULL REFERENCES ideascan.almacenes(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  codigo          TEXT,                               -- código corto: A1, B2, etc.
  tipo            TEXT DEFAULT 'almacenaje'           -- almacenaje | recepcion | despacho | cross_dock | refrigerado | restringido
                  CHECK (tipo IN ('almacenaje','recepcion','despacho','cross_dock','refrigerado','restringido')),
  color           TEXT DEFAULT '#3b82f6',

  -- Posición en el mapa (px)
  pos_x           INTEGER DEFAULT 0,
  pos_y           INTEGER DEFAULT 0,
  ancho           INTEGER DEFAULT 120,
  alto            INTEGER DEFAULT 80,

  -- Capacidad y ocupación
  capacidad       INTEGER DEFAULT 0,                  -- 0 = sin límite
  ocupacion       INTEGER DEFAULT 0,                  -- SKUs actuales en zona

  activo          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zonas_almacen  ON ideascan.zonas(almacen_id);

-- ───────────────────────────────────────────────────────────────
-- TABLA: alertas
-- Sistema de notificaciones internas
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideascan.alertas (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo            TEXT DEFAULT 'operacion'            -- operacion | sistema | inventario | seguridad
                  CHECK (tipo IN ('operacion','sistema','inventario','seguridad')),
  nivel           TEXT DEFAULT 'info'                 -- info | warning | error | success
                  CHECK (nivel IN ('info','warning','error','success')),
  titulo          TEXT NOT NULL,
  mensaje         TEXT,
  leida           BOOLEAN DEFAULT FALSE,

  usuario_id      UUID REFERENCES ideascan.usuarios(id),  -- destinatario (NULL = todos)
  cliente_id      UUID REFERENCES ideascan.clientes(id),

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alertas_leida     ON ideascan.alertas(leida);
CREATE INDEX IF NOT EXISTS idx_alertas_usuario   ON ideascan.alertas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_alertas_created   ON ideascan.alertas(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════
-- Habilitar RLS en todas las tablas
ALTER TABLE ideascan.clientes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideascan.almacenes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideascan.usuarios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideascan.inventario        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideascan.movimientos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideascan.salidas_borradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideascan.ordenes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideascan.orden_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideascan.paqueteria        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideascan.zonas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideascan.alertas           ENABLE ROW LEVEL SECURITY;

-- Política de acceso abierto con anon key (la app usa su propia lógica de sesión)
-- NOTA: Ajustar estas políticas según requerimientos de seguridad en producción
CREATE POLICY "Allow all for anon key" ON ideascan.clientes          FOR ALL USING (true);
CREATE POLICY "Allow all for anon key" ON ideascan.almacenes         FOR ALL USING (true);
CREATE POLICY "Allow all for anon key" ON ideascan.usuarios          FOR ALL USING (true);
CREATE POLICY "Allow all for anon key" ON ideascan.inventario        FOR ALL USING (true);
CREATE POLICY "Allow all for anon key" ON ideascan.movimientos       FOR ALL USING (true);
CREATE POLICY "Allow all for anon key" ON ideascan.salidas_borradores FOR ALL USING (true);
CREATE POLICY "Allow all for anon key" ON ideascan.ordenes           FOR ALL USING (true);
CREATE POLICY "Allow all for anon key" ON ideascan.orden_items       FOR ALL USING (true);
CREATE POLICY "Allow all for anon key" ON ideascan.paqueteria        FOR ALL USING (true);
CREATE POLICY "Allow all for anon key" ON ideascan.zonas             FOR ALL USING (true);
CREATE POLICY "Allow all for anon key" ON ideascan.alertas           FOR ALL USING (true);

-- ═══════════════════════════════════════════════════════════════
--  TRIGGER: updated_at automático
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION ideascan.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a tablas con updated_at
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['inventario','ordenes','salidas_borradores','paqueteria','zonas']
  LOOP
    EXECUTE format('
      CREATE TRIGGER trg_%s_updated_at
      BEFORE UPDATE ON ideascan.%s
      FOR EACH ROW EXECUTE FUNCTION ideascan.set_updated_at();
    ', t, t);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════
--  DATOS SEMILLA (SEED) — Datos de prueba iniciales
-- ═══════════════════════════════════════════════════════════════

-- Cliente: SAFRAN
INSERT INTO ideascan.clientes (codigo, nombre, modulo_entrada, color, campos_captura)
VALUES (
  'SAFRAN', 'Safran Aircraft Engines', 'ai_entry', '#0d2b7a',
  ARRAY['sku','numero_parte','descripcion','cantidad','bultos','tipo_bulto','tracking_number','carrier','vendor','peso','po','serial_number','origin']
)
ON CONFLICT (codigo) DO NOTHING;

-- Cliente: MARTECH
INSERT INTO ideascan.clientes (codigo, nombre, modulo_entrada, color, campos_captura)
VALUES (
  'MARTECH', 'Martech Industries', 'martech', '#22c77a',
  ARRAY['sku','numero_parte','descripcion','cantidad','bultos','tipo_bulto','part_model','serial_number','po','vendor','peso']
)
ON CONFLICT (codigo) DO NOTHING;

-- Almacén principal
INSERT INTO ideascan.almacenes (nombre, descripcion)
VALUES ('Almacén Central', 'Almacén principal de operaciones')
ON CONFLICT DO NOTHING;

-- Usuario admin
INSERT INTO ideascan.usuarios (username, email, nombre, nombre_display, rol, password_hash)
VALUES (
  'admin',
  'admin@ideascan.wms',
  'Administrador',
  'Admin',
  'admin',
  '$2b$10$placeholder_hash_here'  -- Reemplazar con hash real
)
ON CONFLICT (username) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
--  SUPABASE STORAGE — Buckets para imágenes
-- ═══════════════════════════════════════════════════════════════
-- Ejecutar en Supabase > Storage > New bucket
-- Nombre: "wms-images" — Public: true
-- O ejecutar estas queries en el SQL editor:

-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('wms-images', 'wms-images', true)
-- ON CONFLICT (id) DO NOTHING;

-- CREATE POLICY "Public read wms-images" ON storage.objects
-- FOR SELECT USING (bucket_id = 'wms-images');

-- CREATE POLICY "Anon upload wms-images" ON storage.objects
-- FOR INSERT WITH CHECK (bucket_id = 'wms-images');

-- ───────────────────────────────────────────────────────────────
-- MIGRATION: Campos adicionales en paqueteria
-- (Ejecutar si la tabla ya existe sin estos campos)
-- ───────────────────────────────────────────────────────────────
ALTER TABLE ideascan.paqueteria
  ADD COLUMN IF NOT EXISTS bultos        INT  DEFAULT 1,
  ADD COLUMN IF NOT EXISTS notas         TEXT,
  ADD COLUMN IF NOT EXISTS fecha_entrega TIMESTAMPTZ;
