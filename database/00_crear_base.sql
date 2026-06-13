-- ============================================================
--  Ex Scientia Veritas — Sistema de Calibraciones
--  PASO 0: Crear la base de datos PostgreSQL
--  ──────────────────────────────────────────────────────────
--  Ejecutar UNA SOLA VEZ como superusuario (postgres) desde
--  psql o pgAdmin ANTES de los demás scripts.
--
--  psql:
--    psql -U postgres -f 00_crear_base.sql
--
--  Después conectar a la base:
--    \c esv_calibraciones
--  Y ejecutar los siguientes scripts en orden.
-- ============================================================

DROP DATABASE IF EXISTS esv_calibraciones;

CREATE DATABASE esv_calibraciones
    ENCODING    'UTF8'
    LC_COLLATE  = 'es_PE.UTF-8'
    LC_CTYPE    = 'es_PE.UTF-8'
    TEMPLATE    = template0;

-- Si el locale es_PE.UTF-8 no está instalado en tu sistema,
-- usa la siguiente línea alternativa:
-- CREATE DATABASE esv_calibraciones ENCODING 'UTF8' TEMPLATE template0;

\c esv_calibraciones

-- Verificación
SELECT current_database() AS base_activa, pg_encoding_to_char(encoding) AS encoding
FROM pg_database WHERE datname = current_database();
