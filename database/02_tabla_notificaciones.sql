-- ============================================================
--  PASO 2: Tabla de notificaciones del sistema ESV
--  PostgreSQL
--  ──────────────────────────────────────────────────────────
--  Ejecutar DESPUÉS de 01_tablas_principales.sql
--
--  psql:  \i database/02_tabla_notificaciones.sql
-- ============================================================

DROP TYPE IF EXISTS notif_tipo_t CASCADE;

CREATE TYPE notif_tipo_t AS ENUM (
    'orden',
    'estado',
    'documento',
    'catalogo',
    'usuario',
    'sistema',
    'mensaje'
);

CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL         PRIMARY KEY,
    user_id     INT            NOT NULL,
    tipo        notif_tipo_t   NOT NULL DEFAULT 'sistema',
    titulo      VARCHAR(200)   NOT NULL,
    mensaje     TEXT,
    referencia  VARCHAR(80),
    leida       SMALLINT       NOT NULL DEFAULT 0,
    created_at  TIMESTAMP      NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notif_user_leida
    ON notifications (user_id, leida, created_at DESC);
