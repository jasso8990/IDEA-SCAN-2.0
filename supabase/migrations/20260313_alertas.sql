-- ════════════════════════════════════════════════════════════════════════════
--  Migration: 20260313_alertas.sql
--  IDEA SCAN 2.0 — CCA Group
--
--  Crea la tabla "alertas" requerida por la Edge Function check-sla.
--  Ejecutar en Supabase → SQL Editor → New Query → Run
-- ════════════════════════════════════════════════════════════════════════════

-- ── Tabla de alertas ──────────────────────────────────────────────────────
--  Almacena alertas operativas generadas por cron jobs y procesos automáticos.
CREATE TABLE IF NOT EXISTS alertas (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Clasificación
    tipo            text        NOT NULL,
    -- Tipos conocidos:
    --   'sla_vencido'       → entrada sin completar > 24h
    --   'stock_minimo'      → inventario por debajo del stock_minimo
    --   'diferencia_bultos' → bultos recibidos ≠ bultos declarados
    --   'ai_baja_confianza' → IA devolvió confianza < 70 en algún renglon

    severidad       text        NOT NULL DEFAULT 'warning'
                                CHECK (severidad IN ('info','warning','critical')),

    -- Contenido
    titulo          text        NOT NULL,
    mensaje         text        NOT NULL,

    -- Referencias
    recepcion_id    uuid        REFERENCES recepciones(id) ON DELETE SET NULL,
    cliente_id      uuid        REFERENCES clientes(id)   ON DELETE SET NULL,

    -- Datos adicionales (JSON libre para cada tipo de alerta)
    datos           jsonb       NOT NULL DEFAULT '{}'::jsonb,

    -- Estado de resolución
    resuelta        boolean     NOT NULL DEFAULT false,
    resuelta_at     timestamptz,
    resuelta_por    uuid        REFERENCES usuarios(id),
    nota_resolucion text,

    -- Notificaciones
    notificado      boolean     NOT NULL DEFAULT false,
    notificado_at   timestamptz,

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ── Índices ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_alertas_tipo         ON alertas(tipo);
CREATE INDEX IF NOT EXISTS idx_alertas_severidad    ON alertas(severidad);
CREATE INDEX IF NOT EXISTS idx_alertas_resuelta     ON alertas(resuelta) WHERE resuelta = false;
CREATE INDEX IF NOT EXISTS idx_alertas_recepcion    ON alertas(recepcion_id)
    WHERE recepcion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alertas_cliente      ON alertas(cliente_id)
    WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_alertas_created_at   ON alertas(created_at DESC);

-- Índice compuesto: búsqueda de alertas activas por entry (para evitar duplicados)
CREATE INDEX IF NOT EXISTS idx_alertas_dedup
    ON alertas(recepcion_id, tipo, resuelta)
    WHERE resuelta = false AND recepcion_id IS NOT NULL;

-- ── Trigger updated_at ────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_alertas_updated ON alertas;
CREATE TRIGGER trg_alertas_updated
BEFORE UPDATE ON alertas
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;

-- Staff ve todas las alertas
DROP POLICY IF EXISTS pol_alertas_staff_select ON alertas;
CREATE POLICY pol_alertas_staff_select ON alertas FOR SELECT USING (is_staff());

-- Clientes ven solo sus propias alertas
DROP POLICY IF EXISTS pol_alertas_cliente_select ON alertas;
CREATE POLICY pol_alertas_cliente_select ON alertas FOR SELECT USING (
    cliente_id = auth_cliente_id()
);

-- Solo staff puede insertar/actualizar alertas
DROP POLICY IF EXISTS pol_alertas_write ON alertas;
CREATE POLICY pol_alertas_write ON alertas FOR ALL
    USING (is_staff())
    WITH CHECK (is_staff());

-- ── Datos de ejemplo (comentados — descomentar para testing) ──────────────
/*
INSERT INTO alertas (tipo, severidad, titulo, mensaje, datos)
VALUES (
    'sla_vencido',
    'warning',
    'SLA VENCIDO: TEST2603-001',
    'Alerta de prueba generada manualmente.',
    '{"entry_no": "TEST2603-001", "horas_abiertas": 25, "sla_horas": 24}'::jsonb
);
*/
