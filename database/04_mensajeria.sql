-- ============================================================
--  ESV Sistema de Calibraciones
--  Migración 04 — Mensajería directa + roles simplificados
--  PostgreSQL
--
--  ORDEN DE EJECUCIÓN:
--    1. 00_crear_base.sql
--    2. 01_tablas_principales.sql
--    3. 02_tabla_notificaciones.sql
--    4. 03_tabla_solicitudes.sql
--    5. 04_mensajeria.sql         ← este archivo
--    6. python seed.py
--
--  IMPORTANTE: Ejecutar una sola vez. El CREATE TABLE IF NOT EXISTS
--  omite la creación si la tabla ya existe.
-- ============================================================

-- ─── 1. Ampliar el tipo ENUM de roles ────────────────────────
--  PostgreSQL no tiene ALTER TYPE ... MODIFY; se usan ADD VALUE.
--  IF NOT EXISTS evita error si se ejecuta más de una vez.

ALTER TYPE user_role_t ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE user_role_t ADD VALUE IF NOT EXISTS 'usuario';
ALTER TYPE user_role_t ADD VALUE IF NOT EXISTS 'supervisor';
COMMIT;

-- ─── 2. Migrar cuentas existentes ────────────────────────────
--  gerencia / responsable → admin
--  operador               → usuario

UPDATE users SET role = 'admin'::user_role_t
    WHERE role IN ('gerencia'::user_role_t, 'responsable'::user_role_t);

UPDATE users SET role = 'usuario'::user_role_t
    WHERE role = 'operador'::user_role_t;

-- ─── 3. Tabla de mensajería directa ──────────────────────────
CREATE TABLE IF NOT EXISTS messages (
    id               SERIAL        NOT NULL,
    sender_id        INT           NOT NULL,
    recipient_id     INT               NULL,
    subject          VARCHAR(255)  NOT NULL,
    body             TEXT              NULL,
    attachment_name  VARCHAR(255)      NULL,
    attachment_type  VARCHAR(120)      NULL,
    attachment_data  TEXT              NULL,
    is_read          SMALLINT      NOT NULL DEFAULT 0,
    created_at       TIMESTAMP     NOT NULL DEFAULT NOW(),

    PRIMARY KEY (id),
    CONSTRAINT fk_msg_sender
        FOREIGN KEY (sender_id)    REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_recipient
        FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_msg_recipient ON messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_msg_sender    ON messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_msg_created   ON messages (created_at);

-- ─── Verificación final ──────────────────────────────────────
SELECT
    'OK - Migración 04 aplicada correctamente.' AS resultado,
    (SELECT COUNT(*) FROM users WHERE role = 'admin')   AS admins,
    (SELECT COUNT(*) FROM users WHERE role = 'usuario') AS usuarios,
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_name   = 'messages'
       AND table_schema = 'public')                      AS tabla_messages;
