-- ═══════════════════════════════════════════════════════
-- IDEA SCAN 2.0 — Schema de base de datos en Supabase
-- Ejecuta este SQL en: Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════

-- ── Clientes ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre     text NOT NULL,
  rfc        text,
  contacto   text,
  telefono   text,
  email      text,
  activo     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ── Usuarios ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre      text NOT NULL,
  username    text UNIQUE NOT NULL,
  password    text NOT NULL,
  rol         text DEFAULT 'operador' CHECK (rol IN ('admin','gerente','operador','cliente')),
  cliente_id  uuid REFERENCES clientes(id),
  activo      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ── Inventario ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventario (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sku          text UNIQUE NOT NULL,
  descripcion  text,
  cliente_id   uuid REFERENCES clientes(id),
  cantidad     integer DEFAULT 0,
  stock_minimo integer DEFAULT 5,
  ubicacion    text,
  unidad       text DEFAULT 'pieza',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- ── Entradas ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entradas (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  folio        text NOT NULL,
  sku          text NOT NULL,
  descripcion  text,
  bultos       integer NOT NULL DEFAULT 1,
  fecha        date,
  referencia   text,
  notas        text,
  operador_id  uuid REFERENCES usuarios(id),
  operador     text,
  cliente_id   uuid REFERENCES clientes(id),
  created_at   timestamptz DEFAULT now()
);

-- ── Salidas ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salidas (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  folio          text NOT NULL,
  sku            text NOT NULL,
  bultos         integer NOT NULL DEFAULT 1,
  fecha          date,
  destino        text,
  transportista  text,
  notas          text,
  operador_id    uuid REFERENCES usuarios(id),
  operador       text,
  cliente_id     uuid REFERENCES clientes(id),
  estado         text DEFAULT 'completado',
  created_at     timestamptz DEFAULT now()
);

-- ── Log de actividad ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS actividad_log (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sku          text,
  descripcion  text,
  tipo         text,
  usuario      text,
  created_at   timestamptz DEFAULT now()
);

-- ── Trigger: updated_at en inventario ────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inv_updated
BEFORE UPDATE ON inventario
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Usuario admin por defecto ─────────────────────────────
-- Contraseña: admin123 (cámbiala después)
INSERT INTO usuarios (nombre, username, password, rol)
VALUES ('Administrador', 'admin', 'admin123', 'admin')
ON CONFLICT (username) DO NOTHING;

-- ── RLS: Desactivar para desarrollo (activar en producción)
ALTER TABLE clientes     DISABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios     DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventario   DISABLE ROW LEVEL SECURITY;
ALTER TABLE entradas     DISABLE ROW LEVEL SECURITY;
ALTER TABLE salidas      DISABLE ROW LEVEL SECURITY;
ALTER TABLE actividad_log DISABLE ROW LEVEL SECURITY;
