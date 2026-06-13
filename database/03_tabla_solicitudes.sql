-- ============================================================
--  PASO 3: Tabla de solicitudes de registro de usuarios
--  PostgreSQL
--  ──────────────────────────────────────────────────────────
--  Ejecutar DESPUÉS de 01 y 02.
--
--  psql:  \i database/03_tabla_solicitudes.sql
-- ============================================================

DROP TABLE IF EXISTS user_requests CASCADE;
DROP TYPE IF EXISTS req_rol_t    CASCADE;
DROP TYPE IF EXISTS req_estado_t CASCADE;

CREATE TYPE req_rol_t AS ENUM ('operador', 'responsable');

CREATE TYPE req_estado_t AS ENUM ('pendiente', 'aprobada', 'rechazada');

CREATE TABLE IF NOT EXISTS user_requests (
    id              SERIAL         PRIMARY KEY,
    nombre_completo VARCHAR(150)   NOT NULL,
    username        VARCHAR(50)    NOT NULL,
    email           VARCHAR(120)   NOT NULL,
    telefono        VARCHAR(30),
    dni             VARCHAR(20),
    cargo           VARCHAR(100)   NOT NULL,
    area_trabajo    VARCHAR(80),
    rol_solicitado  req_rol_t      NOT NULL DEFAULT 'operador',
    password_hash   VARCHAR(255)   NOT NULL,
    motivo          TEXT,
    estado          req_estado_t   NOT NULL DEFAULT 'pendiente',
    notas_revision  TEXT,
    revisado_por    INT,
    revisado_at     TIMESTAMP,
    created_at      TIMESTAMP      NOT NULL DEFAULT NOW(),
    FOREIGN KEY (revisado_por) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_requests_estado
    ON user_requests (estado, created_at DESC);
