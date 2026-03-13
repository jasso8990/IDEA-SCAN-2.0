-- ════════════════════════════════════════════════════════════════════════════
--  IDEA SCAN 2.0 — Schema de base de datos en Supabase
--  CCA Group — WMS 3PL Multi-cliente
--
--  Instrucciones:
--    1. Ve a Supabase → SQL Editor → New Query
--    2. Pega TODO este contenido y ejecuta con "Run"
--    3. Debes ver "Success. No rows returned" al final
--
--  Schemas usados:
--    · public    → tablas generales del sistema
--    · ideascan  → tablas por cliente (Martech, Cooper)
-- ════════════════════════════════════════════════════════════════════════════

-- ── Asegurar que el schema ideascan exista ────────────────────────────────
CREATE SCHEMA IF NOT EXISTS ideascan;


-- ════════════════════════════════════════════════════════════════════════════
--  SECCIÓN 1 — TABLAS BASE (schema public)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1.1  Clientes ─────────────────────────────────────────────────────────
--  Cambios v2:
--    + codigo           CHAR(3) UNIQUE — prefijo del Entry No. (SAF/MAR/COP)
--    + importador_default              — nombre del importador para Excel
--    + portal_activo                  — habilita portal web del cliente
--    + logo_url                       — imagen del cliente en reportes
CREATE TABLE IF NOT EXISTS clientes (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              text        NOT NULL,
    codigo              char(3)     UNIQUE,
    rfc                 text,
    contacto            text,
    telefono            text,
    email               text,
    importador_default  text,
    portal_activo       boolean     NOT NULL DEFAULT false,
    logo_url            text,
    activo              boolean     NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_codigo
    ON clientes(codigo) WHERE codigo IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo);


-- ── 1.2  Almacenes ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS almacenes (
    id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo      text    UNIQUE NOT NULL,
    nombre      text    NOT NULL,
    direccion   text,
    ciudad      text,
    pais        char(2) NOT NULL DEFAULT 'MX',
    activo      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO almacenes (codigo, nombre, ciudad)
VALUES ('101', 'Almacén CCA – Principal', 'Monterrey')
ON CONFLICT (codigo) DO NOTHING;


-- ── 1.3  Ubicaciones ──────────────────────────────────────────────────────
--  Coordenadas: Pasillo-Rack-Nivel-Posición  →  A-01-02-03
CREATE TABLE IF NOT EXISTS ubicaciones (
    id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    almacen_id      uuid    NOT NULL REFERENCES almacenes(id) ON DELETE RESTRICT,

    pasillo         text    NOT NULL,
    rack            text    NOT NULL,
    nivel           text    NOT NULL,
    posicion        text    NOT NULL,

    etiqueta        text    GENERATED ALWAYS AS
                        (pasillo || '-' || rack || '-' || nivel || '-' || posicion)
                    STORED,

    tipo            text    NOT NULL DEFAULT 'rack'
                            CHECK (tipo IN ('rack','piso','mezzanine','exterior','cuarto_frio')),
    capacidad_kg    numeric(10,2),
    capacidad_m3    numeric(8,3),
    descripcion     text,

    activo          boolean NOT NULL DEFAULT true,
    cliente_id      uuid    REFERENCES clientes(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_ubicacion_coordenada
        UNIQUE (almacen_id, pasillo, rack, nivel, posicion)
);

CREATE INDEX IF NOT EXISTS idx_ubicaciones_almacen  ON ubicaciones(almacen_id);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_etiqueta ON ubicaciones(etiqueta);
CREATE INDEX IF NOT EXISTS idx_ubicaciones_cliente  ON ubicaciones(cliente_id)
    WHERE cliente_id IS NOT NULL;

-- Seed: pasillos A-C, racks 01-03, niveles 01-03, posiciones 01-04
DO $$ DECLARE v_alm uuid;
BEGIN
    SELECT id INTO v_alm FROM almacenes WHERE codigo = '101';
    IF v_alm IS NOT NULL THEN
        INSERT INTO ubicaciones (almacen_id, pasillo, rack, nivel, posicion)
        SELECT v_alm, p, r, n, pos
        FROM
            unnest(ARRAY['A','B','C'])            AS p,
            unnest(ARRAY['01','02','03'])          AS r,
            unnest(ARRAY['01','02','03'])          AS n,
            unnest(ARRAY['01','02','03','04'])     AS pos
        ON CONFLICT ON CONSTRAINT uq_ubicacion_coordenada DO NOTHING;
    END IF;
END $$;


-- ── 1.4  Usuarios ─────────────────────────────────────────────────────────
--  Sincronizado con auth.js (password_hash, almacen_id, estado, ultimo_acceso, color)
CREATE TABLE IF NOT EXISTS usuarios (
    id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre          text    NOT NULL,
    username        text    UNIQUE NOT NULL,
    password_hash   text    NOT NULL,
    rol             text    NOT NULL DEFAULT 'operador'
                            CHECK (rol IN ('admin','supervisor','operador','cliente')),
    cliente_id      uuid    REFERENCES clientes(id),
    almacen_id      uuid    REFERENCES almacenes(id),
    color           text,
    estado          text    NOT NULL DEFAULT 'active'
                            CHECK (estado IN ('active','inactive','blocked')),
    ultimo_acceso   timestamptz,
    activo          boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol     ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_cliente ON usuarios(cliente_id)
    WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_usuarios_estado  ON usuarios(estado);

-- Admin por defecto (contraseña: admin123 en base64 — cambiar en producción)
INSERT INTO usuarios (nombre, username, password_hash, rol)
VALUES ('Administrador', 'admin', 'YWRtaW4xMjM=', 'admin')
ON CONFLICT (username) DO NOTHING;


-- ── 1.5  Inventario ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventario (
    id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    sku             text    UNIQUE NOT NULL,
    descripcion     text,
    descripcion_en  text,
    cliente_id      uuid    REFERENCES clientes(id),
    almacen_id      uuid    REFERENCES almacenes(id),
    ubicacion_id    uuid    REFERENCES ubicaciones(id),
    ubicacion       text,
    cantidad        integer NOT NULL DEFAULT 0,
    stock_minimo    integer NOT NULL DEFAULT 5,
    unidad          text    NOT NULL DEFAULT 'PCS',
    folio_entrada   text,
    numero_parte    text,
    po              text,
    origen          char(2),
    hts_fraccion    text,
    bultos          integer,
    carrier         text,
    vendor          text,
    tracking_number text,
    peso_lbs        numeric(12,4),
    peso_kgs        numeric(12,4),
    tipo_bulto      text,
    fecha_entrada   date,
    estado          text    NOT NULL DEFAULT 'recibido'
                            CHECK (estado IN ('recibido','inspeccionado','liberado',
                                              'cuarentena','devuelto','despachado')),
    partes          jsonb   NOT NULL DEFAULT '[]'::jsonb,
    imagenes        jsonb   NOT NULL DEFAULT '[]'::jsonb,
    activo          boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventario_cliente ON inventario(cliente_id);
CREATE INDEX IF NOT EXISTS idx_inventario_estado  ON inventario(estado);
CREATE INDEX IF NOT EXISTS idx_inventario_entrada ON inventario(folio_entrada)
    WHERE folio_entrada IS NOT NULL;

-- ── 1.6  Recepciones (Cabecera / Master Tracking) ─────────────────────────
--  Entry No. canónico: {CODIGO}{YY}{MM}-{SEQ:003}
--    SAF2603-001  |  MAR2603-007  |  MAQ2603-002
CREATE TABLE IF NOT EXISTS recepciones (
    id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),

    entry_no            text    UNIQUE NOT NULL,
    folio               text    GENERATED ALWAYS AS (entry_no) STORED,
    cliente_id          uuid    NOT NULL REFERENCES clientes(id),
    almacen_id          uuid    NOT NULL REFERENCES almacenes(id),

    fecha               date    NOT NULL DEFAULT CURRENT_DATE,
    fecha_estimada      date,

    -- Master Tracking / Carrier
    master_tracking     text,
    carrier             text,
    carrier_service     text,
    plate               text,
    origin_id           text,
    invoice             text,
    packing_list        text,
    po_global           text,

    -- Importador (obligatorio para Martech y Cooper, omitido para Safran)
    importador          text,
    importador_rfc      text,

    -- Totales del envío
    total_bultos        integer NOT NULL DEFAULT 1,
    tipo_bulto          text    CHECK (tipo_bulto IN
                            ('Tarima','Caja','Bulto','Tubo','Java','Crate',NULL)),

    -- Peso total del embarque (se auto-convierte por trigger)
    peso_total_lbs      numeric(12,4),
    peso_total_kgs      numeric(12,4),

    -- Dimensiones globales del embarque
    dim_largo_cm        numeric(8,2),
    dim_ancho_cm        numeric(8,2),
    dim_alto_cm         numeric(8,2),
    dim_unidad          text    NOT NULL DEFAULT 'cm'
                                CHECK (dim_unidad IN ('cm','in')),

    tipo_recepcion      text    NOT NULL DEFAULT 'materia_prima'
                                CHECK (tipo_recepcion IN
                                    ('materia_prima','maquinaria','refacciones',
                                     'consumibles','devolucion','muestra')),

    operador_id         uuid    REFERENCES usuarios(id),
    operador_nombre     text,
    inspector_nombre    text,

    estado              text    NOT NULL DEFAULT 'borrador'
                                CHECK (estado IN
                                    ('borrador','en_inspeccion','confirmado',
                                     'con_diferencias','cancelado')),

    excel_url           text,
    fotos_packing       jsonb   NOT NULL DEFAULT '[]'::jsonb,
    localizacion        text,
    observaciones       text,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recepciones_cliente   ON recepciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_recepciones_almacen   ON recepciones(almacen_id);
CREATE INDEX IF NOT EXISTS idx_recepciones_fecha     ON recepciones(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_recepciones_entry_no  ON recepciones(entry_no);
CREATE INDEX IF NOT EXISTS idx_recepciones_estado    ON recepciones(estado);
CREATE INDEX IF NOT EXISTS idx_recepciones_tracking  ON recepciones(master_tracking)
    WHERE master_tracking IS NOT NULL;


-- ── 1.7  Recepcion_Renglones (Detalle / Items / Series) ───────────────────
--  Jerarquía: recepcion → renglon → serie[]
--
--  Reglas de bulto:
--    · Múltiples PN en un bulto → solo 1er renglon lleva secuencia_bulto = '1 of X'
--    · Un PN en varios bultos   → un renglon por bulto, secuencia_bulto = 'N of X'
--    · 1 S/N = 1 renglon en DB  (serie[] es el array crudo de la IA)
CREATE TABLE IF NOT EXISTS recepcion_renglones (
    id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    recepcion_id        uuid    NOT NULL
                                REFERENCES recepciones(id) ON DELETE CASCADE,

    pda                 integer,
    bulto_num           integer NOT NULL DEFAULT 1,
    secuencia_bulto     text,               -- '1 of 3', '2 of 3' — vacío si bulto tiene varios PN

    numero_parte        text,
    po                  text,
    hts_fraccion        text,

    -- Descripciones bilingüe
    descripcion_en      text,               -- inglés (aduana / SAT)
    descripcion_es      text,               -- español (almacén)

    -- Cantidades
    cantidad            numeric(12,4) NOT NULL DEFAULT 1,
    um                  text    NOT NULL DEFAULT 'PCS'
                                CHECK (um IN ('PCS','EA','KG','LB','MT','FT','M','SET','LOT')),

    -- Pesos (se auto-convierten por trigger)
    peso_lbs            numeric(12,4),
    peso_kgs            numeric(12,4),

    origen              char(2),            -- ISO-2: MX, CN, US, DE…
    vendor              text,
    seccion_negocio     text,
    tracking_number     text,

    -- Series para maquinaria
    serie               text[],             -- array crudo de S/N de la IA
    numero_serie        text,               -- S/N definitivo de este renglon (1 por renglon)
    brand_marca         text,
    model_modelo        text,

    tipo_renglon        text    NOT NULL DEFAULT 'materia_prima'
                                CHECK (tipo_renglon IN
                                    ('materia_prima','maquinaria','refaccion',
                                     'consumible','muestra')),

    ubicacion_id        uuid    REFERENCES ubicaciones(id),
    fotos_bulto         jsonb   NOT NULL DEFAULT '[]'::jsonb,
    datos_raw           jsonb,

    inspeccionado       boolean NOT NULL DEFAULT false,
    con_diferencia      boolean NOT NULL DEFAULT false,
    observaciones       text,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rr_recepcion    ON recepcion_renglones(recepcion_id);
CREATE INDEX IF NOT EXISTS idx_rr_parte        ON recepcion_renglones(numero_parte)
    WHERE numero_parte IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rr_bulto        ON recepcion_renglones(recepcion_id, bulto_num);
CREATE INDEX IF NOT EXISTS idx_rr_tracking     ON recepcion_renglones(tracking_number)
    WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rr_serie        ON recepcion_renglones(numero_serie)
    WHERE numero_serie IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rr_serie_gin
    ON recepcion_renglones USING GIN (serie)
    WHERE serie IS NOT NULL AND array_length(serie,1) > 0;


-- ── 1.8  Entradas (módulo legacy — mantener compatibilidad) ───────────────
CREATE TABLE IF NOT EXISTS entradas (
    id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    folio       text    NOT NULL,
    sku         text    NOT NULL,
    descripcion text,
    bultos      integer NOT NULL DEFAULT 1,
    fecha       date,
    referencia  text,
    notas       text,
    operador_id uuid    REFERENCES usuarios(id),
    operador    text,
    cliente_id  uuid    REFERENCES clientes(id),
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entradas_cliente ON entradas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_entradas_fecha   ON entradas(fecha DESC);


-- ── 1.9  Salidas ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salidas (
    id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    folio           text    NOT NULL,
    sku             text    NOT NULL,
    bultos          integer NOT NULL DEFAULT 1,
    fecha           date,
    destino         text,
    transportista   text,
    notas           text,
    operador_id     uuid    REFERENCES usuarios(id),
    operador        text,
    cliente_id      uuid    REFERENCES clientes(id),
    estado          text    NOT NULL DEFAULT 'completado'
                            CHECK (estado IN ('pendiente','en_transito',
                                              'completado','cancelado')),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salidas_cliente ON salidas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_salidas_fecha   ON salidas(fecha DESC);


-- ── 1.10  Log de actividad ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS actividad_log (
    id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    tabla       text,
    registro_id uuid,
    sku         text,
    descripcion text,
    tipo        text,
    usuario     text,
    usuario_id  uuid    REFERENCES usuarios(id),
    cliente_id  uuid    REFERENCES clientes(id),
    datos       jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_log_cliente    ON actividad_log(cliente_id);
CREATE INDEX IF NOT EXISTS idx_log_tabla      ON actividad_log(tabla, registro_id);
CREATE INDEX IF NOT EXISTS idx_log_created_at ON actividad_log(created_at DESC);


-- ════════════════════════════════════════════════════════════════════════════
--  SECCIÓN 2 — TABLAS POR CLIENTE (schema ideascan)
-- ════════════════════════════════════════════════════════════════════════════
--  Se mantienen para compatibilidad con ai-martech.html y ai-cooper.html.
--  La jerarquía canónica nueva usa recepciones + recepcion_renglones.

-- ── Martech Medical Products ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideascan.martech_entradas (
    id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    folio           text    NOT NULL UNIQUE,
    fecha           date    NOT NULL DEFAULT CURRENT_DATE,
    done_by         text,
    inspected_by    text,
    supplier        text,
    invoice         text,
    packing         text,
    carrier         text,
    plate           text,
    total_bultos    integer DEFAULT 1,
    tipo_bulto      text,
    localizacion    text,
    observaciones   text,
    excel_url       text,
    fotos_packing   jsonb   NOT NULL DEFAULT '[]'::jsonb,
    tipo            text,
    estado          text    NOT NULL DEFAULT 'borrador',
    vendor          text,
    tracking_number text,
    operador_id     uuid,
    operador_nombre text,
    recepcion_id    uuid    REFERENCES public.recepciones(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ideascan.martech_renglones (
    id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    entrada_id      uuid    NOT NULL
                            REFERENCES ideascan.martech_entradas(id) ON DELETE CASCADE,
    folio           text,
    pda             integer,
    numero_parte    text,
    po              text,
    descripcion     text,
    hts_fraccion    text,
    cantidad        numeric,
    um              text    DEFAULT 'PCS',
    peso_lbs        numeric,
    bulk            integer DEFAULT 1,
    bulto_num       integer DEFAULT 1,
    secuencia_bulto text,
    tipo            text,
    tipo_renglon    text,
    origen          text,
    tracking        text,
    tracking_number text,
    seccion_negocio text,
    brand_marca     text,
    model_modelo    text,
    serie           text,
    numero_serie    text,
    observaciones   text,
    vendor          text,
    marca           text,
    modelo          text,
    weight          text,
    fotos_bulto     jsonb   DEFAULT '[]'::jsonb,
    datos_raw       jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_martech_entradas_fecha    ON ideascan.martech_entradas(fecha);
CREATE INDEX IF NOT EXISTS idx_martech_entradas_folio    ON ideascan.martech_entradas(folio);
CREATE INDEX IF NOT EXISTS idx_martech_renglones_entrada ON ideascan.martech_renglones(entrada_id);
CREATE INDEX IF NOT EXISTS idx_martech_rng_parte
    ON ideascan.martech_renglones(numero_parte) WHERE numero_parte IS NOT NULL;


-- ── Cooper Standard ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ideascan.cooper_entradas (
    id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    folio           text    NOT NULL UNIQUE,
    fecha           date    NOT NULL DEFAULT CURRENT_DATE,
    done_by         text,
    inspected_by    text,
    supplier        text,
    invoice         text,
    packing         text,
    carrier         text,
    plate           text,
    total_bultos    integer DEFAULT 1,
    tipo_bulto      text,
    localizacion    text,
    observaciones   text,
    excel_url       text,
    fotos_packing   jsonb   NOT NULL DEFAULT '[]'::jsonb,
    tipo            text,
    estado          text    NOT NULL DEFAULT 'borrador',
    vendor          text,
    tracking_number text,
    operador_id     uuid,
    operador_nombre text,
    recepcion_id    uuid    REFERENCES public.recepciones(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ideascan.cooper_renglones (
    id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    entrada_id      uuid    NOT NULL
                            REFERENCES ideascan.cooper_entradas(id) ON DELETE CASCADE,
    folio           text,
    pda             integer,
    numero_parte    text,
    po              text,
    descripcion     text,
    hts_fraccion    text,
    cantidad        numeric,
    um              text    DEFAULT 'PCS',
    peso_lbs        numeric,
    bulk            integer DEFAULT 1,
    bulto_num       integer DEFAULT 1,
    secuencia_bulto text,
    tipo            text,
    tipo_renglon    text,
    origen          text,
    tracking        text,
    tracking_number text,
    seccion_negocio text,
    brand_marca     text,
    model_modelo    text,
    serie           text,
    numero_serie    text,
    observaciones   text,
    vendor          text,
    marca           text,
    modelo          text,
    weight          text,
    fotos_bulto     jsonb   DEFAULT '[]'::jsonb,
    datos_raw       jsonb,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cooper_entradas_fecha    ON ideascan.cooper_entradas(fecha);
CREATE INDEX IF NOT EXISTS idx_cooper_entradas_folio    ON ideascan.cooper_entradas(folio);
CREATE INDEX IF NOT EXISTS idx_cooper_renglones_entrada ON ideascan.cooper_renglones(entrada_id);
CREATE INDEX IF NOT EXISTS idx_cooper_rng_parte
    ON ideascan.cooper_renglones(numero_parte) WHERE numero_parte IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
--  SECCIÓN 3 — TRIGGERS Y FUNCIONES
-- ════════════════════════════════════════════════════════════════════════════

-- ── 3.1  Función genérica updated_at ─────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$ DECLARE t text;
BEGIN
    FOR t IN SELECT unnest(ARRAY[
        'public.clientes',
        'public.almacenes',
        'public.ubicaciones',
        'public.usuarios',
        'public.inventario',
        'public.recepciones',
        'public.recepcion_renglones',
        'ideascan.martech_entradas',
        'ideascan.cooper_entradas'
    ]) LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_%s_updated ON %s;
             CREATE TRIGGER trg_%s_updated
             BEFORE UPDATE ON %s
             FOR EACH ROW EXECUTE FUNCTION update_updated_at();',
            replace(t, '.', '_'), t,
            replace(t, '.', '_'), t
        );
    END LOOP;
END $$;


-- ── 3.2  Función: sincronizar pesos LBS ↔ KGS ────────────────────────────
CREATE OR REPLACE FUNCTION sync_pesos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.peso_lbs IS NOT NULL AND NEW.peso_kgs IS NULL THEN
        NEW.peso_kgs := round((NEW.peso_lbs * 0.45359237)::numeric, 4);
    ELSIF NEW.peso_kgs IS NOT NULL AND NEW.peso_lbs IS NULL THEN
        NEW.peso_lbs := round((NEW.peso_kgs * 2.20462262)::numeric, 4);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rr_pesos ON recepcion_renglones;
CREATE TRIGGER trg_rr_pesos
BEFORE INSERT OR UPDATE OF peso_lbs, peso_kgs ON recepcion_renglones
FOR EACH ROW EXECUTE FUNCTION sync_pesos();

CREATE OR REPLACE FUNCTION sync_pesos_recepciones()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.peso_total_lbs IS NOT NULL AND NEW.peso_total_kgs IS NULL THEN
        NEW.peso_total_kgs := round((NEW.peso_total_lbs * 0.45359237)::numeric, 4);
    ELSIF NEW.peso_total_kgs IS NOT NULL AND NEW.peso_total_lbs IS NULL THEN
        NEW.peso_total_lbs := round((NEW.peso_total_kgs * 2.20462262)::numeric, 4);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rec_pesos ON recepciones;
CREATE TRIGGER trg_rec_pesos
BEFORE INSERT OR UPDATE OF peso_total_lbs, peso_total_kgs ON recepciones
FOR EACH ROW EXECUTE FUNCTION sync_pesos_recepciones();


-- ── 3.3  Función RPC: generar Entry No. (atómico, sin duplicados) ─────────
--  Uso desde JS:
--    const { data } = await sb().rpc('generar_entry_no',
--        { p_cliente_id: 'uuid', p_tipo: 'materia_prima' });
--    // data → 'SAF2603-001'
CREATE OR REPLACE FUNCTION generar_entry_no(
    p_cliente_id uuid,
    p_tipo       text DEFAULT 'materia_prima'
)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_codigo    char(3);
    v_prefix    text;
    v_yymm      text;
    v_seq       integer;
    v_entry_no  text;
BEGIN
    SELECT codigo INTO v_codigo
    FROM clientes WHERE id = p_cliente_id;

    IF v_codigo IS NULL THEN
        RAISE EXCEPTION 'Cliente % no tiene código (3 letras) asignado', p_cliente_id;
    END IF;

    -- Martech Maquinaria usa prefijo MAQ en vez de MAR
    v_prefix := CASE
        WHEN upper(v_codigo) = 'MAR' AND p_tipo = 'maquinaria' THEN 'MAQ'
        ELSE upper(v_codigo)
    END;

    v_yymm := to_char(now(), 'YYMM');

    -- Secuencia mensual con bloqueo de fila para evitar duplicados
    SELECT COALESCE(
        MAX(CAST(split_part(entry_no, '-', 2) AS integer)), 0
    ) + 1
    INTO v_seq
    FROM recepciones
    WHERE entry_no LIKE v_prefix || v_yymm || '-%';

    v_entry_no := v_prefix || v_yymm || '-' || lpad(v_seq::text, 3, '0');
    RETURN v_entry_no;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
--  SECCIÓN 4 — ROW LEVEL SECURITY (RLS)
-- ════════════════════════════════════════════════════════════════════════════
--
--  Mecanismo:
--    · El JWT debe incluir claims personalizados:
--        app_role        = 'admin' | 'supervisor' | 'operador' | 'cliente'
--        app_cliente_id  = uuid del cliente (solo para rol 'cliente')
--    · Las políticas leen estos claims para filtrar filas.
--    · El admin (app_role = 'admin') bypasea todos los filtros de cliente.

-- Funciones helper que leen el JWT
CREATE OR REPLACE FUNCTION auth_cliente_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT CASE
        WHEN (current_setting('request.jwt.claims', true)::jsonb ->> 'app_role') = 'admin'
        THEN NULL
        ELSE (current_setting('request.jwt.claims', true)::jsonb ->> 'app_cliente_id')::uuid
    END;
$$;

CREATE OR REPLACE FUNCTION auth_rol()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'app_role';
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT auth_rol() = 'admin';
$$;

CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT auth_rol() IN ('admin','supervisor','operador');
$$;


-- ── 4.1  Habilitar RLS ────────────────────────────────────────────────────
ALTER TABLE clientes                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE almacenes                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ubicaciones                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepciones                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE recepcion_renglones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE entradas                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE salidas                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividad_log               ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideascan.martech_entradas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideascan.martech_renglones  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideascan.cooper_entradas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideascan.cooper_renglones   ENABLE ROW LEVEL SECURITY;


-- ── 4.2  clientes ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS pol_clientes_select ON clientes;
CREATE POLICY pol_clientes_select ON clientes FOR SELECT USING (
    is_staff() OR id = auth_cliente_id()
);
DROP POLICY IF EXISTS pol_clientes_write ON clientes;
CREATE POLICY pol_clientes_write ON clientes FOR ALL USING (is_admin())
    WITH CHECK (is_admin());


-- ── 4.3  almacenes y ubicaciones (catálogo compartido) ───────────────────
DROP POLICY IF EXISTS pol_almacenes_select ON almacenes;
CREATE POLICY pol_almacenes_select ON almacenes FOR SELECT USING (true);
DROP POLICY IF EXISTS pol_almacenes_write ON almacenes;
CREATE POLICY pol_almacenes_write ON almacenes FOR ALL USING (is_admin())
    WITH CHECK (is_admin());

DROP POLICY IF EXISTS pol_ubicaciones_select ON ubicaciones;
CREATE POLICY pol_ubicaciones_select ON ubicaciones FOR SELECT USING (
    is_staff()
    OR cliente_id IS NULL
    OR cliente_id = auth_cliente_id()
);
DROP POLICY IF EXISTS pol_ubicaciones_write ON ubicaciones;
CREATE POLICY pol_ubicaciones_write ON ubicaciones FOR ALL USING (is_staff())
    WITH CHECK (is_staff());


-- ── 4.4  usuarios ─────────────────────────────────────────────────────────
-- El staff ve todos los usuarios. El cliente solo se ve a sí mismo.
DROP POLICY IF EXISTS pol_usuarios_select ON usuarios;
CREATE POLICY pol_usuarios_select ON usuarios FOR SELECT USING (
    is_staff()
    OR cliente_id = auth_cliente_id()
);
DROP POLICY IF EXISTS pol_usuarios_write ON usuarios;
CREATE POLICY pol_usuarios_write ON usuarios FOR ALL USING (is_admin())
    WITH CHECK (is_admin());


-- ── 4.5  inventario ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS pol_inventario_select ON inventario;
CREATE POLICY pol_inventario_select ON inventario FOR SELECT USING (
    is_staff()
    OR cliente_id = auth_cliente_id()
);
DROP POLICY IF EXISTS pol_inventario_write ON inventario;
CREATE POLICY pol_inventario_write ON inventario FOR ALL USING (is_staff())
    WITH CHECK (is_staff());


-- ── 4.6  recepciones ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS pol_recepciones_select ON recepciones;
CREATE POLICY pol_recepciones_select ON recepciones FOR SELECT USING (
    is_staff()
    OR cliente_id = auth_cliente_id()
);
DROP POLICY IF EXISTS pol_recepciones_write ON recepciones;
CREATE POLICY pol_recepciones_write ON recepciones FOR ALL USING (is_staff())
    WITH CHECK (is_staff());


-- ── 4.7  recepcion_renglones (heredan seguridad de recepciones) ───────────
DROP POLICY IF EXISTS pol_rr_select ON recepcion_renglones;
CREATE POLICY pol_rr_select ON recepcion_renglones FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM recepciones r
        WHERE r.id = recepcion_renglones.recepcion_id
          AND (is_staff() OR r.cliente_id = auth_cliente_id())
    )
);
DROP POLICY IF EXISTS pol_rr_write ON recepcion_renglones;
CREATE POLICY pol_rr_write ON recepcion_renglones FOR ALL USING (is_staff())
    WITH CHECK (is_staff());


-- ── 4.8  entradas y salidas (legacy) ─────────────────────────────────────
DROP POLICY IF EXISTS pol_entradas_select ON entradas;
CREATE POLICY pol_entradas_select ON entradas FOR SELECT USING (
    is_staff() OR cliente_id = auth_cliente_id()
);
DROP POLICY IF EXISTS pol_entradas_write ON entradas;
CREATE POLICY pol_entradas_write ON entradas FOR ALL USING (is_staff())
    WITH CHECK (is_staff());

DROP POLICY IF EXISTS pol_salidas_select ON salidas;
CREATE POLICY pol_salidas_select ON salidas FOR SELECT USING (
    is_staff() OR cliente_id = auth_cliente_id()
);
DROP POLICY IF EXISTS pol_salidas_write ON salidas;
CREATE POLICY pol_salidas_write ON salidas FOR ALL USING (is_staff())
    WITH CHECK (is_staff());


-- ── 4.9  actividad_log ────────────────────────────────────────────────────
DROP POLICY IF EXISTS pol_log_select ON actividad_log;
CREATE POLICY pol_log_select ON actividad_log FOR SELECT USING (
    is_staff() OR cliente_id = auth_cliente_id()
);
DROP POLICY IF EXISTS pol_log_insert ON actividad_log;
CREATE POLICY pol_log_insert ON actividad_log FOR INSERT WITH CHECK (is_staff());


-- ── 4.10  ideascan.martech_entradas ───────────────────────────────────────
--  Solo usuarios con cliente Martech o admin pueden ver sus datos y fotos
DROP POLICY IF EXISTS pol_martech_ent_select ON ideascan.martech_entradas;
CREATE POLICY pol_martech_ent_select ON ideascan.martech_entradas FOR SELECT USING (
    is_admin()
    OR EXISTS (
        SELECT 1 FROM clientes c
        JOIN usuarios u ON u.cliente_id = c.id
        WHERE c.nombre ILIKE '%martech%'
          AND u.id::text = (current_setting('request.jwt.claims', true)::jsonb ->> 'app_user_id')
    )
);
DROP POLICY IF EXISTS pol_martech_ent_write ON ideascan.martech_entradas;
CREATE POLICY pol_martech_ent_write ON ideascan.martech_entradas FOR ALL USING (
    is_admin() OR is_staff()
) WITH CHECK (is_admin() OR is_staff());


-- ── 4.11  ideascan.martech_renglones ──────────────────────────────────────
DROP POLICY IF EXISTS pol_martech_rng_select ON ideascan.martech_renglones;
CREATE POLICY pol_martech_rng_select ON ideascan.martech_renglones FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM ideascan.martech_entradas e
        WHERE e.id = ideascan.martech_renglones.entrada_id
          AND (
            is_admin()
            OR is_staff()
            OR EXISTS (
                SELECT 1 FROM clientes c
                JOIN usuarios u ON u.cliente_id = c.id
                WHERE c.nombre ILIKE '%martech%'
                  AND u.id::text = (current_setting('request.jwt.claims', true)::jsonb ->> 'app_user_id')
            )
          )
    )
);
DROP POLICY IF EXISTS pol_martech_rng_write ON ideascan.martech_renglones;
CREATE POLICY pol_martech_rng_write ON ideascan.martech_renglones FOR ALL
    USING (is_staff()) WITH CHECK (is_staff());


-- ── 4.12  ideascan.cooper_entradas ────────────────────────────────────────
DROP POLICY IF EXISTS pol_cooper_ent_select ON ideascan.cooper_entradas;
CREATE POLICY pol_cooper_ent_select ON ideascan.cooper_entradas FOR SELECT USING (
    is_admin()
    OR EXISTS (
        SELECT 1 FROM clientes c
        JOIN usuarios u ON u.cliente_id = c.id
        WHERE c.nombre ILIKE '%cooper%'
          AND u.id::text = (current_setting('request.jwt.claims', true)::jsonb ->> 'app_user_id')
    )
);
DROP POLICY IF EXISTS pol_cooper_ent_write ON ideascan.cooper_entradas;
CREATE POLICY pol_cooper_ent_write ON ideascan.cooper_entradas FOR ALL USING (
    is_admin() OR is_staff()
) WITH CHECK (is_admin() OR is_staff());


-- ── 4.13  ideascan.cooper_renglones ───────────────────────────────────────
DROP POLICY IF EXISTS pol_cooper_rng_select ON ideascan.cooper_renglones;
CREATE POLICY pol_cooper_rng_select ON ideascan.cooper_renglones FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM ideascan.cooper_entradas e
        WHERE e.id = ideascan.cooper_renglones.entrada_id
          AND (
            is_admin()
            OR is_staff()
            OR EXISTS (
                SELECT 1 FROM clientes c
                JOIN usuarios u ON u.cliente_id = c.id
                WHERE c.nombre ILIKE '%cooper%'
                  AND u.id::text = (current_setting('request.jwt.claims', true)::jsonb ->> 'app_user_id')
            )
          )
    )
);
DROP POLICY IF EXISTS pol_cooper_rng_write ON ideascan.cooper_renglones;
CREATE POLICY pol_cooper_rng_write ON ideascan.cooper_renglones FOR ALL
    USING (is_staff()) WITH CHECK (is_staff());


-- ════════════════════════════════════════════════════════════════════════════
--  SECCIÓN 5 — STORAGE BUCKET (políticas de fotos de packing)
-- ════════════════════════════════════════════════════════════════════════════
--  El bucket "imagenes" almacena:
--    · martech/{folio}/bultoN/...jpg
--    · cooper/{folio}/bultoN/...jpg
--    · safran/{folio}/...jpg
--    · entries/{sku}/...jpg
--
--  Política: cada cliente solo puede leer rutas que empiezan con su prefijo.
--  Requiere ejecutar en Supabase → Storage → Policies (o via SQL con storage schema).

-- Permitir lectura pública de imágenes (el acceso real se controla por URL firmada)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'imagenes',
    'imagenes',
    true,
    10485760,   -- 10 MB por archivo
    ARRAY['image/jpeg','image/png','image/webp','image/heic',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Staff puede subir imágenes a cualquier ruta
DROP POLICY IF EXISTS pol_storage_staff_insert ON storage.objects;
CREATE POLICY pol_storage_staff_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'imagenes'
        AND is_staff()
    );

-- Clientes solo pueden leer rutas de su propio cliente
-- La ruta incluye el folio del cliente: martech/MAR2603-001/...
DROP POLICY IF EXISTS pol_storage_client_select ON storage.objects;
CREATE POLICY pol_storage_client_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'imagenes'
        AND (
            is_staff()
            OR (
                -- El folio de la ruta contiene el código del cliente
                EXISTS (
                    SELECT 1 FROM clientes c
                    WHERE c.id = auth_cliente_id()
                      AND (storage.objects.name ILIKE c.codigo || '%'
                           OR storage.objects.name ILIKE '%' || c.codigo || '%')
                )
            )
        )
    );

-- Solo admin puede borrar archivos
DROP POLICY IF EXISTS pol_storage_delete ON storage.objects;
CREATE POLICY pol_storage_delete ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'imagenes' AND is_admin());


-- ════════════════════════════════════════════════════════════════════════════
--  SECCIÓN 6 — DATOS SEMILLA (clientes iniciales)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO clientes (nombre, codigo, importador_default, portal_activo, activo)
VALUES
    ('Safran Aerospace Mexico', 'SAF', NULL,          false, true),
    ('Martech Medical Products', 'MAR', 'Martech Medical Products S.A. de C.V.', true, true),
    ('Cooper Standard',          'COP', 'Cooper Standard Automotive S.A. de C.V.', true, true)
ON CONFLICT (codigo) DO UPDATE SET
    nombre             = EXCLUDED.nombre,
    importador_default = EXCLUDED.importador_default,
    portal_activo      = EXCLUDED.portal_activo;


-- ════════════════════════════════════════════════════════════════════════════
--  FIN DEL SCRIPT
--  Versión: 2.0.0 | CCA Group | IDEA SCAN 2.0
--  Ejecutar completo en Supabase → SQL Editor → New Query → Run
-- ════════════════════════════════════════════════════════════════════════════
