-- ============================================================
--  Ex Scientia Veritas — Sistema de Calibraciones
--  ESQUEMA COMPLETO v3.0 — PostgreSQL
--  ──────────────────────────────────────────────────────────
--  Instrucciones psql:
--    \c esv_calibraciones
--    \i database/01_tablas_principales.sql
--
--  O desde pgAdmin: abrir el archivo y ejecutar (F5).
--
--  ¡ATENCIÓN! Borra y recrea todas las tablas.
--  Ejecutar seed.py después para crear los usuarios.
-- ============================================================

-- ─── TIPOS ENUM ───────────────────────────────────────────────
-- Se definen antes de las tablas que los usan.

DROP TYPE IF EXISTS user_role_t       CASCADE;
DROP TYPE IF EXISTS order_status_t    CASCADE;
DROP TYPE IF EXISTS doc_type_t        CASCADE;

CREATE TYPE user_role_t AS ENUM (
    'operador', 'responsable', 'gerencia',
    'admin', 'usuario', 'supervisor'
);

CREATE TYPE order_status_t AS ENUM (
    'borrador', 'ingresado', 'cotizado', 'aprobado', 'en_proceso', 'finalizado'
);

CREATE TYPE doc_type_t AS ENUM (
    'constancia', 'cotizacion'
);

-- ─── FUNCIÓN TRIGGER para updated_at ─────────────────────────
-- PostgreSQL no tiene ON UPDATE CURRENT_TIMESTAMP;
-- se usa un trigger genérico que reutilizamos en todas las tablas.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ─── BORRAR TABLAS PREVIAS (en orden inverso de dependencias) ─
DROP TABLE IF EXISTS documents         CASCADE;
DROP TABLE IF EXISTS instrument_points CASCADE;
DROP TABLE IF EXISTS order_instruments CASCADE;
DROP TABLE IF EXISTS work_orders       CASCADE;
DROP TABLE IF EXISTS clients           CASCADE;
DROP TABLE IF EXISTS calibration_points CASCADE;
DROP TABLE IF EXISTS catalog_methods   CASCADE;
DROP TABLE IF EXISTS users             CASCADE;
DROP TABLE IF EXISTS settings          CASCADE;

-- ─── 1. USUARIOS ──────────────────────────────────────────────
CREATE TABLE users (
    id            SERIAL        PRIMARY KEY,
    username      VARCHAR(50)   NOT NULL,
    password_hash VARCHAR(255)  NOT NULL,
    nombre        VARCHAR(120)  NOT NULL,
    role          user_role_t   NOT NULL DEFAULT 'operador',
    email         VARCHAR(120),
    empresa       VARCHAR(200),
    cargo         VARCHAR(100),
    dni           VARCHAR(20),
    telefono      VARCHAR(30),
    departamento  VARCHAR(80),
    provincia     VARCHAR(80),
    distrito      VARCHAR(80),
    active        SMALLINT      NOT NULL DEFAULT 1,
    last_login    TIMESTAMP,
    created_at    TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_username UNIQUE (username),
    CONSTRAINT uq_users_email    UNIQUE (email)
);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON COLUMN users.empresa      IS 'Empresa o institución del usuario';
COMMENT ON COLUMN users.cargo        IS 'Cargo o puesto de trabajo';

COMMENT ON COLUMN users.dni          IS 'DNI o documento de identidad';
COMMENT ON COLUMN users.departamento IS 'Departamento (Perú)';
COMMENT ON COLUMN users.provincia    IS 'Provincia (Perú)';
COMMENT ON COLUMN users.distrito     IS 'Distrito (Perú)';
COMMENT ON COLUMN users.last_login   IS 'Último inicio de sesión';

-- ─── 2. CATÁLOGO DE MÉTODOS ───────────────────────────────────
CREATE TABLE catalog_methods (
    id                    SERIAL        PRIMARY KEY,
    code                  VARCHAR(40)   NOT NULL,
    name                  VARCHAR(180)  NOT NULL,
    area                  VARCHAR(80)   NOT NULL,
    magnitude             VARCHAR(80),
    icon                  VARCHAR(30)   NOT NULL DEFAULT 'gauge',
    tariff                DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    note                  TEXT,
    procedure_code        VARCHAR(80),
    procedure_description TEXT,
    is_nominal            SMALLINT      NOT NULL DEFAULT 0,
    active                SMALLINT      NOT NULL DEFAULT 1,
    updated_by            INT,
    created_at            TIMESTAMP     NOT NULL DEFAULT NOW(),
    image_base64          TEXT,
    CONSTRAINT uq_catalog_code UNIQUE (code),
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

COMMENT ON COLUMN catalog_methods.procedure_code        IS 'Código corto del procedimiento';
COMMENT ON COLUMN catalog_methods.procedure_description IS 'Descripción completa del procedimiento para cotizaciones';
COMMENT ON COLUMN catalog_methods.is_nominal            IS '1 = mostrar Valor Nominal cuando hay 1 punto seleccionado';

-- ─── 3. PUNTOS DE CALIBRACIÓN ─────────────────────────────────
CREATE TABLE calibration_points (
    id          SERIAL       PRIMARY KEY,
    method_id   INT          NOT NULL,
    point_label VARCHAR(120) NOT NULL,
    uncertainty VARCHAR(100),
    sort_order  INT          NOT NULL DEFAULT 0,
    FOREIGN KEY (method_id) REFERENCES catalog_methods(id) ON DELETE CASCADE
);

-- ─── 4. CLIENTES ──────────────────────────────────────────────
CREATE TABLE clients (
    id         SERIAL       PRIMARY KEY,
    empresa    VARCHAR(200) NOT NULL,
    ruc        VARCHAR(20),
    contacto   VARCHAR(120),
    email      VARCHAR(120),
    telefono   VARCHAR(30),
    direccion  TEXT,
    created_by INT,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 5. ÓRDENES DE TRABAJO ────────────────────────────────────
CREATE TABLE work_orders (
    id               SERIAL        PRIMARY KEY,
    order_no         VARCHAR(40)   NOT NULL,
    client_id        INT           NOT NULL,
    status           order_status_t NOT NULL DEFAULT 'borrador',
    total_estimated  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    notes            TEXT,
    created_by       INT           NOT NULL,
    created_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_order_no UNIQUE (order_no),
    FOREIGN KEY (client_id)  REFERENCES clients(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TRIGGER trg_workorders_updated_at
    BEFORE UPDATE ON work_orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── 6. INSTRUMENTOS POR ORDEN ────────────────────────────────
CREATE TABLE order_instruments (
    id              SERIAL        PRIMARY KEY,
    order_id        INT           NOT NULL,
    method_id       INT           NOT NULL,
    serie           VARCHAR(100),
    marca           VARCHAR(100),
    modelo          VARCHAR(100),
    alcance         VARCHAR(200),
    division_escala VARCHAR(100),
    exactitud       VARCHAR(100),
    identificacion  VARCHAR(100),
    indicaciones    TEXT,
    lugar_atencion  VARCHAR(60)   NOT NULL DEFAULT 'LABORATORIO',
    tipo_servicio   VARCHAR(40)   NOT NULL DEFAULT 'ACREDITADO',
    descuento       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    subtotal        DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    sort_order      INT           NOT NULL DEFAULT 0,
    FOREIGN KEY (order_id)  REFERENCES work_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (method_id) REFERENCES catalog_methods(id)
);

-- ─── 7. PUNTOS SELECCIONADOS POR INSTRUMENTO ──────────────────
CREATE TABLE instrument_points (
    id            SERIAL       PRIMARY KEY,
    instrument_id INT          NOT NULL,
    point_label   VARCHAR(120) NOT NULL,
    FOREIGN KEY (instrument_id) REFERENCES order_instruments(id) ON DELETE CASCADE
);

-- ─── 8. DOCUMENTOS GENERADOS ──────────────────────────────────
CREATE TABLE documents (
    id           SERIAL      PRIMARY KEY,
    order_id     INT         NOT NULL,
    doc_type     doc_type_t  NOT NULL,
    doc_number   VARCHAR(60),
    generated_by INT,
    generated_at TIMESTAMP   NOT NULL DEFAULT NOW(),
    FOREIGN KEY (order_id)     REFERENCES work_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ─── ÍNDICES DE RENDIMIENTO ───────────────────────────────────
CREATE INDEX idx_orders_creator   ON work_orders (created_by, updated_at DESC);
CREATE INDEX idx_orders_client    ON work_orders (client_id);
CREATE INDEX idx_oi_order         ON order_instruments (order_id, sort_order);
CREATE INDEX idx_cp_method        ON calibration_points (method_id, sort_order);
CREATE INDEX idx_ip_instrument    ON instrument_points (instrument_id);
CREATE INDEX idx_docs_order       ON documents (order_id);
CREATE INDEX idx_clients_ruc      ON clients (ruc);
CREATE INDEX idx_catalog_area     ON catalog_methods (area, active);

-- ─── 9. AJUSTES DEL SISTEMA ───────────────────────────────────
CREATE TABLE settings (
    key   VARCHAR(50) PRIMARY KEY,
    value TEXT
);


-- CATÁLOGO COMPLETO — 50 instrumentos acreditados
-- ============================================================
-- QUÍMICA
INSERT INTO catalog_methods (code,name,area,magnitude,icon,tariff,procedure_code) VALUES
('quim-phmetro','pHmetro','Química','pH','flask',350,'INACAL PC-020'),
('quim-cond-sin','Conductímetro (Sin Compensación)','Química','Conductividad','flask',280,'INACAL PC-022'),
('quim-cond-con','Conductímetro (Con Compensación)','Química','Conductividad','flask',300,'INACAL PC-022'),
('quim-oximetro','Oxímetro (O₂ Disuelto)','Química','O₂ Disuelto','flask',320,'MV-LQ-01'),
('quim-turbidimetro','Turbidímetro','Química','Turbidez','flask',290,'MV-LQ-05');

-- DIMENSIONAL
INSERT INTO catalog_methods (code,name,area,magnitude,icon,tariff,procedure_code) VALUES
('dim-calib-dig','Calibrador Digital','Dimensional','Longitud','ruler',130,'INACAL PC-012'),
('dim-calib-ver','Calibrador Vernier / Analógico','Dimensional','Longitud','ruler',120,'INACAL PC-012'),
('dim-micro-dig','Micrómetro Exterior (Digital)','Dimensional','Longitud','ruler',160,'CEM-Spain DI-005'),
('dim-micro-ana','Micrómetro Exterior (Analógico)','Dimensional','Longitud','ruler',140,'CEM-Spain DI-005'),
('dim-tamiz','Tamiz','Dimensional','Abertura de malla','ruler',200,'MV-LD-02'),
('dim-cinta','Cinta Métrica','Dimensional','Longitud','ruler',110,'MV-LD-01');

-- MECÁNICA
INSERT INTO catalog_methods (code,name,area,magnitude,icon,tariff,procedure_code) VALUES
('mec-manometro','Manómetro','Mecánica','Presión','gauge',140,'CEM-Spain ME-003'),
('mec-barometro','Barómetro','Mecánica','Presión','gauge',180,'INACAL PC-024'),
('mec-anemometro','Anemómetro (Velocidad de Aire)','Mecánica','Velocidad','gauge',200,'MV-LM-02'),
('mec-flujometro','Flujómetro de Gas (Caudal)','Mecánica','Caudal','gauge',220,'CEM-Spain ME-009'),
('mec-hivol','Hi Vol (Caudal)','Mecánica','Caudal Vol.','gauge',250,'MV-LM-01'),
('mec-variflow','Variflow (Caudal)','Mecánica','Caudal Vol.','gauge',240,'MV-LM-03');

-- CANTIDAD DE FLUIDO
INSERT INTO catalog_methods (code,name,area,magnitude,icon,tariff,procedure_code) VALUES
('cf-bureta','Bureta','Cantidad de Fluido','Volumen','flask',120,'INACAL PC-015'),
('cf-pipeta-12g','Pipeta (1 y 2 Golpes)','Cantidad de Fluido','Volumen','flask',100,'INACAL PC-015'),
('cf-matraz-aforo','Matraz de Un Aforo','Cantidad de Fluido','Volumen','flask',110,'INACAL PC-015'),
('cf-pipeta-grad','Pipeta Graduada','Cantidad de Fluido','Volumen','flask',95,'INACAL PC-015'),
('cf-picnometro','Picnómetro','Cantidad de Fluido','Volumen','flask',130,'INACAL PC-015'),
('cf-probeta','Probeta Graduada','Cantidad de Fluido','Volumen','flask',90,'INACAL PC-015'),
('cf-imhoff','Cono Imhoff','Cantidad de Fluido','Volumen','flask',150,'INACAL PC-015'),
('cf-micropipeta','Micropipeta de Pistón','Cantidad de Fluido','Volumen µL','flask',180,'INACAL PC-027'),
('cf-pluvio-ana','Pluviómetro Analógico','Cantidad de Fluido','Lluvia','drop',200,'MV-LCF-05'),
('cf-pluvio-dig','Pluviómetro Digital','Cantidad de Fluido','Lluvia','drop',220,'MV-LCF-05');

-- MASA, FUERZA Y DISPOSITIVOS DE PESAJE
INSERT INTO catalog_methods (code,name,area,magnitude,icon,tariff,procedure_code) VALUES
('mf-bal-clase1','Balanza Clase I (Analítica)','Masa, Fuerza y Pesaje','Masa','scale',250,'INDECOPI/SNM PC-011'),
('mf-bal-clase2','Balanza Clase II (Precisión)','Masa, Fuerza y Pesaje','Masa','scale',180,'INDECOPI/SNM PC-011'),
('mf-bal-clase34','Balanza Clase III & IV','Masa, Fuerza y Pesaje','Masa','scale',130,'INACAL PC-001'),
('mf-pesas-m2m3','Pesas OIML Clase M2/M3','Masa, Fuerza y Pesaje','Masa','weight',70,'INACAL PC-008'),
('mf-pesas-m1','Pesas OIML Clase M1','Masa, Fuerza y Pesaje','Masa','weight',85,'INDECOPI/SNM PC-016'),
('mf-pesas-f1f2','Pesas OIML Clase F1 & F2','Masa, Fuerza y Pesaje','Masa','weight',95,'INDECOPI/SNM PC-016'),
('mf-traccion','Máquina de Ensayo de Tracción','Masa, Fuerza y Pesaje','Fuerza','press',550,'ISO 7500-1'),
('mf-compresion','Máquina de Compresión','Masa, Fuerza y Pesaje','Fuerza','press',450,'ISO 7500-1');

-- TERMODINÁMICA
INSERT INTO catalog_methods (code,name,area,magnitude,icon,tariff,procedure_code) VALUES
('termo-dig','Termómetro Digital','Termodinámica','Temperatura','thermo',90,'CEM-Spain TH-001'),
('termo-ir','Termómetro IR (Infrarrojo)','Termodinámica','Temperatura','thermo',120,'CEM-Spain TH-002'),
('termo-bano','Baño Termostático','Termodinámica','Temperatura','thermo',200,'INDECOPI/SNM PC-019'),
('termo-estufa','Estufa / Horno / Cámara / Incubadora','Termodinámica','Temperatura','thermo',220,'INDECOPI/SNM PC-018'),
('termo-autoclave','Autoclave','Termodinámica','Temperatura','press',250,'INDECOPI/SNM PC-006'),
('termo-termohig','Termohigrómetro / Psicrómetro','Termodinámica','Temp. y HR','drop',180,'INACAL PC-026');

-- TIEMPO Y FRECUENCIA
INSERT INTO catalog_methods (code,name,area,magnitude,icon,tariff,procedure_code) VALUES
('tf-cronometro','Cronómetro / Contador de Tiempo','Tiempo y Frecuencia','Tiempo','clock',80,'MV-LTF-01'),
('tf-centrifuga','Centrífuga (RPM)','Tiempo y Frecuencia','Frecuencia','clock',150,'MV-LTF-02');

-- ÓPTICA
INSERT INTO catalog_methods (code,name,area,magnitude,icon,tariff,procedure_code) VALUES
('op-refractometro','Refractómetro','Óptica','Grados Brix','flask',200,'MV-LO-01'),
('op-espect-long','Espectrofotómetro (Longitud de Onda)','Óptica','Longitud de onda nm','flask',350,'INM-Colombia M6-01-F-01'),
('op-espect-abs440','Espectrofotómetro (Absorbancia 440nm)','Óptica','Absorbancia A','flask',320,'INM-Colombia M6-01-F-01'),
('op-espect-abs465','Espectrofotómetro (Absorbancia 465nm)','Óptica','Absorbancia A','flask',320,'INM-Colombia M6-01-F-01'),
('op-espect-abs546','Espectrofotómetro (Absorbancia 546.1nm)','Óptica','Absorbancia A','flask',320,'INM-Colombia M6-01-F-01'),
('op-espect-abs590','Espectrofotómetro (Absorbancia 590nm)','Óptica','Absorbancia A','flask',320,'INM-Colombia M6-01-F-01'),
('op-espect-abs635','Espectrofotómetro (Absorbancia 635nm)','Óptica','Absorbancia A','flask',320,'INM-Colombia M6-01-F-01');

-- ============================================================
-- PUNTOS DE CALIBRACIÓN (todos los instrumentos)
-- ============================================================
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'4 pH','0.012 pH',1 FROM catalog_methods WHERE code='quim-phmetro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'7 pH','0.012 pH',2 FROM catalog_methods WHERE code='quim-phmetro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 pH','0.012 pH',3 FROM catalog_methods WHERE code='quim-phmetro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 µS/cm','0.62 µS/cm',1 FROM catalog_methods WHERE code='quim-cond-sin';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 µS/cm','0.62 µS/cm',2 FROM catalog_methods WHERE code='quim-cond-sin';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 µS/cm','2.1 µS/cm',3 FROM catalog_methods WHERE code='quim-cond-sin';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 000 µS/cm','5.3 µS/cm',4 FROM catalog_methods WHERE code='quim-cond-sin';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 413 µS/cm','5.8 µS/cm',5 FROM catalog_methods WHERE code='quim-cond-sin';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 000 µS/cm','30 µS/cm',6 FROM catalog_methods WHERE code='quim-cond-sin';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 000 µS/cm','360 µS/cm',7 FROM catalog_methods WHERE code='quim-cond-sin';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 µS/cm','0.62 µS/cm',1 FROM catalog_methods WHERE code='quim-cond-con';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 µS/cm','0.62 µS/cm',2 FROM catalog_methods WHERE code='quim-cond-con';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 µS/cm','2.1 µS/cm',3 FROM catalog_methods WHERE code='quim-cond-con';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 000 µS/cm','6 µS/cm',4 FROM catalog_methods WHERE code='quim-cond-con';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 413 µS/cm','7.1 µS/cm',5 FROM catalog_methods WHERE code='quim-cond-con';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 000 µS/cm','30 µS/cm',6 FROM catalog_methods WHERE code='quim-cond-con';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 000 µS/cm','360 µS/cm',7 FROM catalog_methods WHERE code='quim-cond-con';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0 mg/L','0.11 mg/L',1 FROM catalog_methods WHERE code='quim-oximetro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'8.3 mg/L','0.21 mg/L',2 FROM catalog_methods WHERE code='quim-oximetro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 NTU','0.061 NTU',1 FROM catalog_methods WHERE code='quim-turbidimetro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'5 NTU','0.071 NTU',2 FROM catalog_methods WHERE code='quim-turbidimetro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'20 NTU','0.4 NTU',3 FROM catalog_methods WHERE code='quim-turbidimetro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 NTU','2 NTU',4 FROM catalog_methods WHERE code='quim-turbidimetro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'500 NTU','5 NTU',5 FROM catalog_methods WHERE code='quim-turbidimetro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1000 NTU','6 NTU',6 FROM catalog_methods WHERE code='quim-turbidimetro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 300 mm','(5.8e-2+0.0048e-2·L) µm',1 FROM catalog_methods WHERE code='dim-calib-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 300 mm','(12e-2+0.0042e-2·L) µm',1 FROM catalog_methods WHERE code='dim-calib-ver';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0 a 25 mm','0.58 µm',1 FROM catalog_methods WHERE code='dim-micro-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'25 a 50 mm','0.6 µm',2 FROM catalog_methods WHERE code='dim-micro-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'50 a 75 mm','0.6 µm',3 FROM catalog_methods WHERE code='dim-micro-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'75 a 100 mm','0.64 µm',4 FROM catalog_methods WHERE code='dim-micro-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 a 150 mm','0.6 µm',5 FROM catalog_methods WHERE code='dim-micro-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'150 a 200 mm','0.64 µm',6 FROM catalog_methods WHERE code='dim-micro-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'200 a 250 mm','0.75 µm',7 FROM catalog_methods WHERE code='dim-micro-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'250 a 300 mm','0.81 µm',8 FROM catalog_methods WHERE code='dim-micro-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'300 a 400 mm','0.79 µm',9 FROM catalog_methods WHERE code='dim-micro-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'400 a 500 mm','0.86 µm',10 FROM catalog_methods WHERE code='dim-micro-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'500 a 600 mm','1.2 µm',11 FROM catalog_methods WHERE code='dim-micro-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 175 mm','1.1 µm',1 FROM catalog_methods WHERE code='dim-micro-ana';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'175 a 325 mm','1.8 µm',2 FROM catalog_methods WHERE code='dim-micro-ana';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'325 a 600 mm','3.1 µm',3 FROM catalog_methods WHERE code='dim-micro-ana';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 20 µm','1.7 µm',1 FROM catalog_methods WHERE code='dim-tamiz';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'20 µm a 125 mm','17 µm',2 FROM catalog_methods WHERE code='dim-tamiz';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 1 m','0.26 mm',1 FROM catalog_methods WHERE code='dim-cinta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 a 3 m','0.32 mm',2 FROM catalog_methods WHERE code='dim-cinta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'3 a 20 m','0.44 mm',3 FROM catalog_methods WHERE code='dim-cinta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'20 a 30 m','0.56 mm',4 FROM catalog_methods WHERE code='dim-cinta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'30 a 50 m','0.71 mm',5 FROM catalog_methods WHERE code='dim-cinta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'50 a 100 m','1.2 mm',6 FROM catalog_methods WHERE code='dim-cinta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0 a 0.6 bar','0.00014 bar',1 FROM catalog_methods WHERE code='mec-manometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0 a 16 bar','0.012 bar',2 FROM catalog_methods WHERE code='mec-manometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0 a 700 bar','0.09 bar',3 FROM catalog_methods WHERE code='mec-manometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'500 a 1100 mbar','0.32 mbar',1 FROM catalog_methods WHERE code='mec-barometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.5 a 1 m/s','0.12 m/s',1 FROM catalog_methods WHERE code='mec-anemometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 a 2 m/s','0.13 m/s',2 FROM catalog_methods WHERE code='mec-anemometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'2 a 5 m/s','0.17 m/s',3 FROM catalog_methods WHERE code='mec-anemometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'5 a 10 m/s','0.27 m/s',4 FROM catalog_methods WHERE code='mec-anemometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 a 15 m/s','0.28 m/s',5 FROM catalog_methods WHERE code='mec-anemometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'15 a 20 m/s','0.29 m/s',6 FROM catalog_methods WHERE code='mec-anemometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'20 a 25 m/s','0.48 m/s',7 FROM catalog_methods WHERE code='mec-anemometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.05 a 0.1 L/min','0.003 L/min',1 FROM catalog_methods WHERE code='mec-flujometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.1 a 1 L/min','0.0059 L/min',2 FROM catalog_methods WHERE code='mec-flujometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 a 5 L/min','0.013 L/min',3 FROM catalog_methods WHERE code='mec-flujometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'5 a 10 L/min','0.053 L/min',4 FROM catalog_methods WHERE code='mec-flujometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 a 20 L/min','0.11 L/min',5 FROM catalog_methods WHERE code='mec-flujometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'20 a 30 L/min','0.11 L/min',6 FROM catalog_methods WHERE code='mec-flujometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.8 a 1.6 m³/min','0.03 m³/min',1 FROM catalog_methods WHERE code='mec-hivol';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.75 a 1.5 m³/min','0.006 m³/min',1 FROM catalog_methods WHERE code='mec-variflow';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 1 mL','0.0012 mL',1 FROM catalog_methods WHERE code='cf-bureta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 a 2 mL','0.0013 mL',2 FROM catalog_methods WHERE code='cf-bureta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'2 a 5 mL','0.0017 mL',3 FROM catalog_methods WHERE code='cf-bureta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'5 a 10 mL','0.0017 mL',4 FROM catalog_methods WHERE code='cf-bureta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 a 25 mL','0.0035 mL',5 FROM catalog_methods WHERE code='cf-bureta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'25 a 50 mL','0.0052 mL',6 FROM catalog_methods WHERE code='cf-bureta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'50 a 100 mL','0.0075 mL',7 FROM catalog_methods WHERE code='cf-bureta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 mL','0.0009 mL',1 FROM catalog_methods WHERE code='cf-pipeta-12g';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'2 mL','0.0016 mL',2 FROM catalog_methods WHERE code='cf-pipeta-12g';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'5 mL','0.0023 mL',3 FROM catalog_methods WHERE code='cf-pipeta-12g';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 mL','0.0024 mL',4 FROM catalog_methods WHERE code='cf-pipeta-12g';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'25 mL','0.0031 mL',5 FROM catalog_methods WHERE code='cf-pipeta-12g';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'50 mL','0.0054 mL',6 FROM catalog_methods WHERE code='cf-pipeta-12g';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 mL','0.007 mL',7 FROM catalog_methods WHERE code='cf-pipeta-12g';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 mL','0.0034 mL',1 FROM catalog_methods WHERE code='cf-matraz-aforo';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'5 mL','0.0045 mL',2 FROM catalog_methods WHERE code='cf-matraz-aforo';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 mL','0.0049 mL',3 FROM catalog_methods WHERE code='cf-matraz-aforo';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'25 mL','0.0054 mL',4 FROM catalog_methods WHERE code='cf-matraz-aforo';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'50 mL','0.0073 mL',5 FROM catalog_methods WHERE code='cf-matraz-aforo';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 mL','0.0094 mL',6 FROM catalog_methods WHERE code='cf-matraz-aforo';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'250 mL','0.029 mL',7 FROM catalog_methods WHERE code='cf-matraz-aforo';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'500 mL','0.034 mL',8 FROM catalog_methods WHERE code='cf-matraz-aforo';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 000 mL','0.14 mL',9 FROM catalog_methods WHERE code='cf-matraz-aforo';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'2 000 mL','0.18 mL',10 FROM catalog_methods WHERE code='cf-matraz-aforo';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 0.5 mL','0.0013 mL',1 FROM catalog_methods WHERE code='cf-pipeta-grad';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.5 a 1 mL','0.0013 mL',2 FROM catalog_methods WHERE code='cf-pipeta-grad';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 a 2 mL','0.0015 mL',3 FROM catalog_methods WHERE code='cf-pipeta-grad';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'2 a 5 mL','0.0018 mL',4 FROM catalog_methods WHERE code='cf-pipeta-grad';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'5 a 10 mL','0.0029 mL',5 FROM catalog_methods WHERE code='cf-pipeta-grad';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 a 25 mL','0.0057 mL',6 FROM catalog_methods WHERE code='cf-pipeta-grad';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 mL','0.001 mL',1 FROM catalog_methods WHERE code='cf-picnometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'25 mL','0.0014 mL',2 FROM catalog_methods WHERE code='cf-picnometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'50 mL','0.0024 mL',3 FROM catalog_methods WHERE code='cf-picnometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 mL','0.0042 mL',4 FROM catalog_methods WHERE code='cf-picnometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 5 mL','0.012 mL',1 FROM catalog_methods WHERE code='cf-probeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'5 a 10 mL','0.013 mL',2 FROM catalog_methods WHERE code='cf-probeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 a 25 mL','0.016 mL',3 FROM catalog_methods WHERE code='cf-probeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'25 a 50 mL','0.031 mL',4 FROM catalog_methods WHERE code='cf-probeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'50 a 100 mL','0.041 mL',5 FROM catalog_methods WHERE code='cf-probeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 a 250 mL','0.07 mL',6 FROM catalog_methods WHERE code='cf-probeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'250 a 500 mL','0.28 mL',7 FROM catalog_methods WHERE code='cf-probeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'500 a 1000 mL','0.44 mL',8 FROM catalog_methods WHERE code='cf-probeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1000 a 2000 mL','0.61 mL',9 FROM catalog_methods WHERE code='cf-probeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 1000 mL','0.048 mL',1 FROM catalog_methods WHERE code='cf-imhoff';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 10 µL','0.074 µL',1 FROM catalog_methods WHERE code='cf-micropipeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 a 20 µL','0.11 µL',2 FROM catalog_methods WHERE code='cf-micropipeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'20 a 50 µL','0.17 µL',3 FROM catalog_methods WHERE code='cf-micropipeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'50 a 100 µL','0.21 µL',4 FROM catalog_methods WHERE code='cf-micropipeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 a 200 µL','0.28 µL',5 FROM catalog_methods WHERE code='cf-micropipeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'200 a 500 µL','1.5 µL',6 FROM catalog_methods WHERE code='cf-micropipeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'500 a 1000 µL','2 µL',7 FROM catalog_methods WHERE code='cf-micropipeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1000 a 2500 µL','6.5 µL',8 FROM catalog_methods WHERE code='cf-micropipeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'2500 a 5000 µL','6.9 µL',9 FROM catalog_methods WHERE code='cf-micropipeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'5000 a 10000 µL','14 µL',10 FROM catalog_methods WHERE code='cf-micropipeta';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 500 mm','0.5 mm',1 FROM catalog_methods WHERE code='cf-pluvio-ana';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 500 mm','0.75 mm',1 FROM catalog_methods WHERE code='cf-pluvio-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 2.1 g (Res. 0.000001 g)',NULL,1 FROM catalog_methods WHERE code='mf-bal-clase1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 22 g (Res. 0.000002 g)',NULL,2 FROM catalog_methods WHERE code='mf-bal-clase1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 51 g (Res. 0.0001 g)',NULL,3 FROM catalog_methods WHERE code='mf-bal-clase1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 120 g (Res. 0.0001 g)',NULL,4 FROM catalog_methods WHERE code='mf-bal-clase1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 220 g (Res. 0.0001 g)',NULL,5 FROM catalog_methods WHERE code='mf-bal-clase1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 500 g (Res. 0.001 g)',NULL,6 FROM catalog_methods WHERE code='mf-bal-clase1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 300 g (Res. 0.001 g)',NULL,1 FROM catalog_methods WHERE code='mf-bal-clase2';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 2000 g (Res. 0.01 g)',NULL,2 FROM catalog_methods WHERE code='mf-bal-clase2';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 6200 g (Res. 0.1 g)',NULL,3 FROM catalog_methods WHERE code='mf-bal-clase2';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 15000 g (Res. 0.1 g)',NULL,4 FROM catalog_methods WHERE code='mf-bal-clase2';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 30000 g (Res. 0.1 g)',NULL,5 FROM catalog_methods WHERE code='mf-bal-clase2';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 15 kg (Res. 0.01 kg)',NULL,1 FROM catalog_methods WHERE code='mf-bal-clase34';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 40 kg (Res. 5 g)',NULL,2 FROM catalog_methods WHERE code='mf-bal-clase34';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 300 kg (Res. 0.05 kg)',NULL,3 FROM catalog_methods WHERE code='mf-bal-clase34';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 500 kg (Res. 0.05 kg)',NULL,4 FROM catalog_methods WHERE code='mf-bal-clase34';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'Hasta 1500 kg (Res. 0.2 kg)',NULL,5 FROM catalog_methods WHERE code='mf-bal-clase34';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 mg','0.15 mg',1 FROM catalog_methods WHERE code='mf-pesas-m2m3';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'500 mg','0.16 mg',2 FROM catalog_methods WHERE code='mf-pesas-m2m3';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 g','0.21 mg',3 FROM catalog_methods WHERE code='mf-pesas-m2m3';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'5 g','0.83 mg',4 FROM catalog_methods WHERE code='mf-pesas-m2m3';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 g','0.84 mg',5 FROM catalog_methods WHERE code='mf-pesas-m2m3';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'50 g','0.82 mg',6 FROM catalog_methods WHERE code='mf-pesas-m2m3';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 g','0.87 mg',7 FROM catalog_methods WHERE code='mf-pesas-m2m3';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'500 g','9.3 mg',8 FROM catalog_methods WHERE code='mf-pesas-m2m3';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 kg','21 mg',9 FROM catalog_methods WHERE code='mf-pesas-m2m3';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'5 kg','0.12 g',10 FROM catalog_methods WHERE code='mf-pesas-m2m3';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 kg','0.27 g',11 FROM catalog_methods WHERE code='mf-pesas-m2m3';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'25 kg','0.92 g',12 FROM catalog_methods WHERE code='mf-pesas-m2m3';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 mg','0.011 mg',1 FROM catalog_methods WHERE code='mf-pesas-m1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'5 mg','0.01 mg',2 FROM catalog_methods WHERE code='mf-pesas-m1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 mg','0.01 mg',3 FROM catalog_methods WHERE code='mf-pesas-m1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 mg','0.013 mg',4 FROM catalog_methods WHERE code='mf-pesas-m1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'500 mg','0.027 mg',5 FROM catalog_methods WHERE code='mf-pesas-m1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 g','0.023 mg',6 FROM catalog_methods WHERE code='mf-pesas-m1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 g','0.023 mg',7 FROM catalog_methods WHERE code='mf-pesas-m1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 g','0.099 mg',8 FROM catalog_methods WHERE code='mf-pesas-m1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 kg','1.1 mg',9 FROM catalog_methods WHERE code='mf-pesas-m1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'5 kg','12 mg',10 FROM catalog_methods WHERE code='mf-pesas-m1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 kg','86 mg',11 FROM catalog_methods WHERE code='mf-pesas-m1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'20 kg','89 mg',12 FROM catalog_methods WHERE code='mf-pesas-m1';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 mg','0.0022 mg',1 FROM catalog_methods WHERE code='mf-pesas-f1f2';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 mg','0.0022 mg',2 FROM catalog_methods WHERE code='mf-pesas-f1f2';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 mg','0.0096 mg',3 FROM catalog_methods WHERE code='mf-pesas-f1f2';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'500 mg','0.011 mg',4 FROM catalog_methods WHERE code='mf-pesas-f1f2';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 g','0.013 mg',5 FROM catalog_methods WHERE code='mf-pesas-f1f2';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 g','0.022 mg',6 FROM catalog_methods WHERE code='mf-pesas-f1f2';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 g','0.1 mg',7 FROM catalog_methods WHERE code='mf-pesas-f1f2';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'500 g','0.33 mg',8 FROM catalog_methods WHERE code='mf-pesas-f1f2';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 kg','1 mg',9 FROM catalog_methods WHERE code='mf-pesas-f1f2';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'2 kg','1.5 mg',10 FROM catalog_methods WHERE code='mf-pesas-f1f2';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 N a 500 N','0.0042% lectura',1 FROM catalog_methods WHERE code='mf-traccion';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.5 kN a 5 kN','0.041% lectura',2 FROM catalog_methods WHERE code='mf-traccion';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'5 kN a 50 kN','0.022% lectura',3 FROM catalog_methods WHERE code='mf-traccion';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'50 kN a 500 kN','0.033% lectura',4 FROM catalog_methods WHERE code='mf-traccion';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.1 kN a 0.5 kN','0.052% lectura',1 FROM catalog_methods WHERE code='mf-compresion';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.5 kN a 5 kN','0.024% lectura',2 FROM catalog_methods WHERE code='mf-compresion';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'5 kN a 50 kN','0.022% lectura',3 FROM catalog_methods WHERE code='mf-compresion';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'50 kN a 200 kN','0.04% lectura',4 FROM catalog_methods WHERE code='mf-compresion';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'200 kN a 2000 kN','0.06% lectura',5 FROM catalog_methods WHERE code='mf-compresion';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'-30 °C a 20 °C','0.027 °C',1 FROM catalog_methods WHERE code='termo-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'30 °C a 120 °C','0.029 °C',2 FROM catalog_methods WHERE code='termo-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'130 °C a 250 °C','0.033 °C',3 FROM catalog_methods WHERE code='termo-dig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'-10 °C a 100 °C','1.6 °C',1 FROM catalog_methods WHERE code='termo-ir';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'100 °C a 200 °C','2.7 °C',2 FROM catalog_methods WHERE code='termo-ir';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'200 °C a 300 °C','4.6 °C',3 FROM catalog_methods WHERE code='termo-ir';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'300 °C a 400 °C','4.6 °C',4 FROM catalog_methods WHERE code='termo-ir';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'400 °C a 500 °C','4.6 °C',5 FROM catalog_methods WHERE code='termo-ir';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'-30 °C a 65 °C','0.1 °C',1 FROM catalog_methods WHERE code='termo-bano';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'65 °C a 250 °C','0.1 °C',2 FROM catalog_methods WHERE code='termo-bano';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'-30 °C a 250 °C','0.1 °C',1 FROM catalog_methods WHERE code='termo-estufa';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'250 °C a 600 °C','1.6 °C',2 FROM catalog_methods WHERE code='termo-estufa';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'600 °C a 1000 °C','2.1 °C',3 FROM catalog_methods WHERE code='termo-estufa';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'95 °C a 181 °C','0.12 °C',1 FROM catalog_methods WHERE code='termo-autoclave';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 °C a 40 °C (Temperatura)','0.3 °C',1 FROM catalog_methods WHERE code='termo-termohig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'20 %HR a 90 %HR (Humedad Rel.)','1.8 %HR',2 FROM catalog_methods WHERE code='termo-termohig';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1 s a 10 min','0.06 s',1 FROM catalog_methods WHERE code='tf-cronometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 min a 3 h','0.08 s',2 FROM catalog_methods WHERE code='tf-cronometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'3 h a 9 h','0.08 s',3 FROM catalog_methods WHERE code='tf-cronometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'10 a 89900 rpm','2.2 rpm',1 FROM catalog_methods WHERE code='tf-centrifuga';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0 °Brix','0.12 °Brix',1 FROM catalog_methods WHERE code='op-refractometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'12 °Brix','0.08 °Brix',2 FROM catalog_methods WHERE code='op-refractometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'20 °Brix','0.14 °Brix',3 FROM catalog_methods WHERE code='op-refractometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'30 °Brix','0.14 °Brix',4 FROM catalog_methods WHERE code='op-refractometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'50 °Brix','0.14 °Brix',5 FROM catalog_methods WHERE code='op-refractometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'60 °Brix','0.14 °Brix',6 FROM catalog_methods WHERE code='op-refractometro';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'279.35 nm','0.21 nm',1 FROM catalog_methods WHERE code='op-espect-long';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'360.85 nm','0.21 nm',2 FROM catalog_methods WHERE code='op-espect-long';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'453.6 nm','0.21 nm',3 FROM catalog_methods WHERE code='op-espect-long';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'536.45 nm','0.21 nm',4 FROM catalog_methods WHERE code='op-espect-long';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'637.65 nm','0.21 nm',5 FROM catalog_methods WHERE code='op-espect-long';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.2662 A (440nm)','0.0025 A',1 FROM catalog_methods WHERE code='op-espect-abs440';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.5284 A (440nm)','0.0029 A',2 FROM catalog_methods WHERE code='op-espect-abs440';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1.0809 A (440nm)','0.0068 A',3 FROM catalog_methods WHERE code='op-espect-abs440';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.2410 A (465nm)','0.0025 A',1 FROM catalog_methods WHERE code='op-espect-abs465';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.4859 A (465nm)','0.0029 A',2 FROM catalog_methods WHERE code='op-espect-abs465';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1.0013 A (465nm)','0.0068 A',3 FROM catalog_methods WHERE code='op-espect-abs465';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.2524 A (546.1nm)','0.0025 A',1 FROM catalog_methods WHERE code='op-espect-abs546';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.5005 A (546.1nm)','0.0029 A',2 FROM catalog_methods WHERE code='op-espect-abs546';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1.0141 A (546.1nm)','0.0035 A',3 FROM catalog_methods WHERE code='op-espect-abs546';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.2880 A (590nm)','0.0025 A',1 FROM catalog_methods WHERE code='op-espect-abs590';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.5579 A (590nm)','0.0035 A',2 FROM catalog_methods WHERE code='op-espect-abs590';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1.0855 A (590nm)','0.0069 A',3 FROM catalog_methods WHERE code='op-espect-abs590';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.2918 A (635nm)','0.0025 A',1 FROM catalog_methods WHERE code='op-espect-abs635';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'0.5547 A (635nm)','0.0035 A',2 FROM catalog_methods WHERE code='op-espect-abs635';
INSERT INTO calibration_points (method_id,point_label,uncertainty,sort_order) SELECT id,'1.0511 A (635nm)','0.0069 A',3 FROM catalog_methods WHERE code='op-espect-abs635';


-- ─── DESCRIPCIONES DE PROCEDIMIENTO ──────────────────────────
UPDATE catalog_methods SET procedure_description='PC-020 Procedimiento para la Calibración de Medidores de pH. 2da Ed. 2017. INACAL', is_nominal=0 WHERE code='quim-phmetro';
UPDATE catalog_methods SET procedure_description='PC-022 Procedimiento para la calibración de medidores de conductividad electrolítica. 2da Edición. 2023. INACAL-DA', is_nominal=0 WHERE code='quim-cond-sin';
UPDATE catalog_methods SET procedure_description='PC-022 Procedimiento para la calibración de medidores de conductividad electrolítica. 2da Edición. 2023. INACAL-DA', is_nominal=0 WHERE code='quim-cond-con';
UPDATE catalog_methods SET procedure_description='MV-LQ-01 Procedimiento para la calibración de medidores de Oxígeno disuelto. 2025. EX SCIENTIA VERITAS', is_nominal=0 WHERE code='quim-oximetro';
UPDATE catalog_methods SET procedure_description='MV-LQ-05 Procedimiento para calibración de turbidímetros. Rev. 00. EX SCIENTIA VERITAS', is_nominal=0 WHERE code='quim-turbidimetro';
UPDATE catalog_methods SET procedure_description='PC-012 Procedimiento de calibración de Pie de Rey. 5ta Edición 2012. INACAL', is_nominal=1 WHERE code='dim-calib-dig';
UPDATE catalog_methods SET procedure_description='PC-012 Procedimiento de calibración de Pie de Rey (Vernier/Analógico). 5ta Edición 2012. INACAL', is_nominal=1 WHERE code='dim-calib-ver';
UPDATE catalog_methods SET procedure_description='DI-005 Procedimiento para la calibración de micrómetros de dos contacto. Edición digital 1. CEM-España', is_nominal=0 WHERE code='dim-micro-dig';
UPDATE catalog_methods SET procedure_description='DI-005 Procedimiento para la calibración de micrómetros de dos contacto. Edición digital 1. CEM-España', is_nominal=0 WHERE code='dim-micro-ana';
UPDATE catalog_methods SET procedure_description='MV-LD-02 Procedimiento de calibración para tamices. 2023. EX SCIENTIA VERITAS', is_nominal=0 WHERE code='dim-tamiz';
UPDATE catalog_methods SET procedure_description='MV-LD-01 Procedimiento para la Calibración de Cintas métricas según OIML R35. EX SCIENTIA VERITAS', is_nominal=0 WHERE code='dim-cinta';
UPDATE catalog_methods SET procedure_description='ME-003 Procedimiento para la calibración de manómetros. Edición digital 3-2019. CEM-España', is_nominal=0 WHERE code='mec-manometro';
UPDATE catalog_methods SET procedure_description='PC-024 Calibración de Instrumentos de medición - Presión absoluta. INACAL', is_nominal=1 WHERE code='mec-barometro';
UPDATE catalog_methods SET procedure_description='MV-LM-02 Procedimiento para la calibración de anemómetros. EX SCIENTIA VERITAS', is_nominal=0 WHERE code='mec-anemometro';
UPDATE catalog_methods SET procedure_description='ME-009 Procedimiento para la calibración de Caudalímetros de Gases. CEM-España. 2008', is_nominal=0 WHERE code='mec-flujometro';
UPDATE catalog_methods SET procedure_description='MV-LCF-01 Procedimiento para la calibración de muestreadores de alto volumen (Hi Vol). 2023. EX SCIENTIA VERITAS', is_nominal=1 WHERE code='mec-hivol';
UPDATE catalog_methods SET procedure_description='MV-LCF-02 Procedimiento para la calibración de calibradores de flujo variable (Variflow). 2025. EX SCIENTIA VERITAS', is_nominal=1 WHERE code='mec-variflow';
UPDATE catalog_methods SET procedure_description='PC-015 Procedimiento de calibración para Material volumétrico de vidrio y plástico. Edición 5ta: 2017 INACAL', is_nominal=0 WHERE code='cf-bureta';
UPDATE catalog_methods SET procedure_description='PC-015 Procedimiento de calibración para Material volumétrico de vidrio y plástico. Edición 5ta: 2017 INACAL', is_nominal=0 WHERE code='cf-pipeta-12g';
UPDATE catalog_methods SET procedure_description='PC-015 Procedimiento de calibración para Material volumétrico de vidrio y plástico. Edición 5ta: 2017 INACAL', is_nominal=1 WHERE code='cf-matraz-aforo';
UPDATE catalog_methods SET procedure_description='PC-015 Procedimiento de calibración para Material volumétrico de vidrio y plástico. Edición 5ta: 2017 INACAL', is_nominal=0 WHERE code='cf-pipeta-grad';
UPDATE catalog_methods SET procedure_description='PC-015 Procedimiento de calibración para Material volumétrico de vidrio y plástico. Edición 5ta: 2017 INACAL', is_nominal=0 WHERE code='cf-picnometro';
UPDATE catalog_methods SET procedure_description='PC-015 Procedimiento de calibración para Material volumétrico de vidrio y plástico. Edición 5ta: 2017 INACAL', is_nominal=0 WHERE code='cf-probeta';
UPDATE catalog_methods SET procedure_description='PC-015 Procedimiento de calibración para Material volumétrico de vidrio y plástico. Edición 5ta: 2017 INACAL', is_nominal=1 WHERE code='cf-imhoff';
UPDATE catalog_methods SET procedure_description='PC-027 Procedimiento para la calibración de pipetas de pistón. Primera Edición - Marzo 2019. INACAL', is_nominal=0 WHERE code='cf-micropipeta';
UPDATE catalog_methods SET procedure_description='MV-LCF-05 Procedimiento de calibración para Pluviómetros. EX SCIENTIA VERITAS', is_nominal=1 WHERE code='cf-pluvio-ana';
UPDATE catalog_methods SET procedure_description='MV-LCF-05 Procedimiento de calibración para Pluviómetros. EX SCIENTIA VERITAS', is_nominal=1 WHERE code='cf-pluvio-dig';
UPDATE catalog_methods SET procedure_description='PC-011 Procedimiento para la calibración de balanzas clase I y II. INDECOPI 4ta. Ed. Abril 2010', is_nominal=0 WHERE code='mf-bal-clase1';
UPDATE catalog_methods SET procedure_description='PC-011 Procedimiento para la calibración de balanzas clase I y II. INDECOPI 4ta. Ed. Abril 2010', is_nominal=0 WHERE code='mf-bal-clase2';
UPDATE catalog_methods SET procedure_description='PC-001 Procedimiento para la calibración de instrumentos de pesaje clase III y IV. INACAL 1ra Edición. Mayo 2019', is_nominal=0 WHERE code='mf-bal-clase34';
UPDATE catalog_methods SET procedure_description='PC-008 Procedimiento para la calibración de pesas de clase de exactitud M2 y M3. NMP 004:2007. INACAL', is_nominal=0 WHERE code='mf-pesas-m2m3';
UPDATE catalog_methods SET procedure_description='PC-016 Procedimiento para calibración de pesas de precisión Clase M1. INDECOPI SNM, 2da Edición, 2015', is_nominal=0 WHERE code='mf-pesas-m1';
UPDATE catalog_methods SET procedure_description='PC-016 Procedimiento para calibración de pesas de precisión Clase F1 y F2. INDECOPI SNM, 2da Edición, 2015', is_nominal=0 WHERE code='mf-pesas-f1f2';
UPDATE catalog_methods SET procedure_description='ISO 7500-1:2018 Materiales metálicos - Calibración de máquinas de ensayo estático uniaxial (Tracción)', is_nominal=0 WHERE code='mf-traccion';
UPDATE catalog_methods SET procedure_description='ISO 7500-1:2018 Materiales metálicos - Calibración de máquinas de ensayo estático uniaxial (Compresión)', is_nominal=0 WHERE code='mf-compresion';
UPDATE catalog_methods SET procedure_description='TH-001 Procedimiento para la calibración de termómetros digitales. 2da Edición 2019. CEM-España', is_nominal=0 WHERE code='termo-dig';
UPDATE catalog_methods SET procedure_description='TH-002 Procedimiento para la calibración de termómetros de radiación infrarroja. 1ra Ed. Digital. CEM-España', is_nominal=0 WHERE code='termo-ir';
UPDATE catalog_methods SET procedure_description='PC-019 Procedimiento para la calibración de Baños Termostáticos. INDECOPI/SNM Primera Edición - Abril 2009', is_nominal=0 WHERE code='termo-bano';
UPDATE catalog_methods SET procedure_description='PC-018 Procedimiento para la calibración de medios isotermos con aire (Estufas/Hornos). INDECOPI/SNM 2da. Edición 2009', is_nominal=0 WHERE code='termo-estufa';
UPDATE catalog_methods SET procedure_description='PC-006 Procedimiento para la Calibración de Autoclave. INDECOPI 2da. Edición 2008', is_nominal=0 WHERE code='termo-autoclave';
UPDATE catalog_methods SET procedure_description='PC-026 Procedimiento para la calibración de hidrómetros y termómetros ambientales. 2019. INACAL', is_nominal=0 WHERE code='termo-termohig';
UPDATE catalog_methods SET procedure_description='MV-LTF-01 Procedimiento para calibración de contadores de tiempo. EX SCIENTIA VERITAS', is_nominal=0 WHERE code='tf-cronometro';
UPDATE catalog_methods SET procedure_description='MV-LTF-02 Procedimiento para la calibración de equipos rotativos (RPM). EX SCIENTIA VERITAS', is_nominal=0 WHERE code='tf-centrifuga';
UPDATE catalog_methods SET procedure_description='MV-LQ-04 Procedimiento para calibración de refractómetros. Rev. 00. EX SCIENTIA VERITAS', is_nominal=0 WHERE code='op-refractometro';
UPDATE catalog_methods SET procedure_description='M6-01-F-01 Guía de calibración de espectrofotómetros UV-Vis (Longitud de Onda). Rev. 01:2021. INM Colombia', is_nominal=0 WHERE code='op-espect-long';
UPDATE catalog_methods SET procedure_description='M6-01-F-01 Guía de calibración de espectrofotómetros UV-Vis (Absorbancia 440nm). Rev. 01:2021. INM Colombia', is_nominal=0 WHERE code='op-espect-abs440';
UPDATE catalog_methods SET procedure_description='M6-01-F-01 Guía de calibración de espectrofotómetros UV-Vis (Absorbancia 465nm). Rev. 01:2021. INM Colombia', is_nominal=0 WHERE code='op-espect-abs465';
UPDATE catalog_methods SET procedure_description='M6-01-F-01 Guía de calibración de espectrofotómetros UV-Vis (Absorbancia 546.1nm). Rev. 01:2021. INM Colombia', is_nominal=0 WHERE code='op-espect-abs546';
UPDATE catalog_methods SET procedure_description='M6-01-F-01 Guía de calibración de espectrofotómetros UV-Vis (Absorbancia 590nm). Rev. 01:2021. INM Colombia', is_nominal=0 WHERE code='op-espect-abs590';
UPDATE catalog_methods SET procedure_description='M6-01-F-01 Guía de calibración de espectrofotómetros UV-Vis (Absorbancia 635nm). Rev. 01:2021. INM Colombia', is_nominal=0 WHERE code='op-espect-abs635';
