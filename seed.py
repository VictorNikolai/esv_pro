"""
Ex Scientia Veritas — Inicialización del sistema.
Crea la cuenta de administrador principal.

ORDEN DE EJECUCIÓN (una sola vez):
    1. Ejecutar en psql o pgAdmin los archivos SQL en orden:
          database/00_crear_base.sql
          database/01_tablas_principales.sql
          database/02_tabla_notificaciones.sql
          database/03_tabla_solicitudes.sql
          database/04_mensajeria.sql
    2. python seed.py                ← este script

Uso posterior:
    python run.py
"""
import os, sys
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash
import psycopg2

load_dotenv()

DB_CONFIG = dict(
    host     = os.getenv('DB_HOST', '127.0.0.1'),
    port     = int(os.getenv('DB_PORT', 5432)),
    user     = os.getenv('DB_USER', 'postgres'),
    password = os.getenv('DB_PASS', '123456'),
    dbname   = os.getenv('DB_NAME', 'esv_calibraciones'),
)

ADMIN = {
    'username': 'admin',
    'password': 'AdminESV2026!',
    'nombre':   'Administrador ESV',
    'role':     'admin',
    'email':    'admin@esv.pe',
    'empresa':  'Ex Scientia Veritas',
    'cargo':    'Administrador del Sistema',
}


def check_role_enum(cur):
    """Verifica que el tipo ENUM de roles ya incluya 'admin'."""
    cur.execute("""
        SELECT enumlabel
        FROM pg_enum
        JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
        WHERE pg_type.typname = 'user_role_t'
    """)
    values = [row[0] for row in cur.fetchall()]
    if 'admin' not in values:
        print('\n  [ERROR] El valor "admin" no está en el tipo user_role_t.')
        print('    Debes ejecutar primero database/04_mensajeria.sql.')
        print('    Después vuelve a correr:  python seed.py\n')
        return False
    return True


def seed():
    print('\n  ESV — Inicializando cuenta de administrador...\n')
    try:
        db  = psycopg2.connect(**DB_CONFIG)
        cur = db.cursor()
    except psycopg2.OperationalError as e:
        print(f'  [ERROR] No se pudo conectar a PostgreSQL: {e}')
        print('    Verifica el archivo .env y que PostgreSQL esté activo.\n')
        sys.exit(1)
    except UnicodeDecodeError:
        print('  [ERROR] PostgreSQL rechazó la conexión y no se pudo mostrar el mensaje exacto por un problema de tildes (UnicodeDecodeError).')
        print('    La causa más común de esto es:')
        print('      1. Contraseña incorrecta. AÚN NO HAS CREADO el archivo .env.')
        print('         Por favor, copia el archivo .env.example, nómbralo .env y pon tu contraseña correcta en DB_PASS.')
        print('      2. O la base de datos "esv_calibraciones" no ha sido creada en pgAdmin.\n')
        sys.exit(1)

    # Verificar que el ENUM ya fue actualizado
    if not check_role_enum(cur):
        cur.close(); db.close()
        sys.exit(1)

    ph = generate_password_hash(ADMIN['password'])

    # UPSERT: inserta o actualiza si el username ya existe
    cur.execute('''
        INSERT INTO users (username, password_hash, nombre, role, email, empresa, cargo, active)
        VALUES (%s, %s, %s, %s::user_role_t, %s, %s, %s, 1)
        ON CONFLICT (username) DO UPDATE
            SET password_hash = EXCLUDED.password_hash,
                nombre        = EXCLUDED.nombre,
                role          = EXCLUDED.role,
                email         = EXCLUDED.email,
                empresa       = EXCLUDED.empresa,
                cargo         = EXCLUDED.cargo
    ''', (ADMIN['username'], ph, ADMIN['nombre'], ADMIN['role'],
          ADMIN['email'], ADMIN['empresa'], ADMIN['cargo']))

    # Usuarios de prueba
    ph_test = generate_password_hash('12345678')
    test_users = [
        ('c.ruiz', ph_test, 'Carlos Ruiz', 'usuario', 'carlos@laboratorioruiz.com', 'Laboratorios Ruiz SAC', 'Jefe de Calidad'),
        ('m.vargas', ph_test, 'Maria Vargas', 'usuario', 'mvargas@acme.pe', 'Industrias ACME', 'Gerente de Producción'),
        ('l.mendoza', ph_test, 'Luis Mendoza', 'supervisor', 'lmendoza@esv.pe', 'Ex Scientia Veritas', 'Revisor Interno')
    ]
    
    for u in test_users:
        cur.execute('''
            INSERT INTO users (username, password_hash, nombre, role, email, empresa, cargo, active)
            VALUES (%s, %s, %s, %s::user_role_t, %s, %s, %s, 1)
            ON CONFLICT (username) DO NOTHING
        ''', u)

    # Ajustes iniciales
    settings_data = [
        ('company_name', 'EX SCIENTIA VERITAS'),
        ('company_ruc', '20554508112'),
        ('company_address', 'Av. Alfredo Mendiola 3520 - Independencia, Lima'),
        ('pdf_footer', 'EX SCIENTIA VERITAS · Laboratorio de Metrología · Sistema de Calibraciones ISO/IEC 17025'),
        ('quote_template_html', '''<div class="conditions" style="page-break-inside: avoid;">
  <h2>Consideraciones Generales del Servicio</h2>
  <div class="cond-grid">
    <div class="cond-card">
      <h4>1. Condiciones del Servicio</h4>
      <table class="cond-mini-table">
        <tr><td>Tiempo de Entrega</td><td>04 días máximo</td></tr>
        <tr><td>Forma de Pago</td><td>100 % Adelantado</td></tr>
        <tr><td>Validez de la Oferta</td><td>15 días</td></tr>
        <tr><td>Garantía</td><td>1 año por fallas de fábrica</td></tr>
        <tr><td>Entregable</td><td>Certificado de calibración</td></tr>
      </table>
    </div>
    <div class="cond-card">
      <h4>2. Requisitos para el Servicio</h4>
      <ul>
        <li>Razón social del solicitante y N° de R.U.C.</li>
        <li>Nombre y cargo del representante</li>
        <li>Dirección para el certificado</li>
        <li>Teléfono de referencia</li>
        <li>Nombre, marca y modelo del equipo</li>
        <li>Código del equipo a calibrar</li>
        <li>Puntos de calibración (si se requiere)</li>
      </ul>
    </div>
    <div class="cond-card">
      <h4>3. Aceptación de la Cotización</h4>
      <p>La aceptación se realizará mediante una orden de compra/servicio o correo electrónico. Implica la conformidad con todas las condiciones descritas.</p>
    </div>
    <div class="cond-card">
      <h4>4. Condiciones de Pago</h4>
      <p>Los precios unitarios no incluyen IGV. Todo pago en dólares se realizará con el tipo de cambio de la SUNAT al día de emisión de la factura.</p>
    </div>
  </div>
  <div class="bank-section">
    <h4>Cuentas Bancarias</h4>
    <table class="bank-table">
      <thead>
        <tr><th>Banco</th><th>Moneda</th><th>N° de Cuenta</th><th>Código Interbancario (CCI)</th></tr>
      </thead>
      <tbody>
        <tr><td>Banco Interbank</td><td>M.N. (PEN)</td><td>200-3006641693</td><td>003-200-003006641693-31</td></tr>
        <tr><td>Banco de la Nación <em>(Detracción D.L. 940 - 12%)</em></td><td>M.N. (PEN)</td><td>00046150171</td><td>-</td></tr>
      </tbody>
    </table>
  </div>
  <div class="cond-grid">
    <div class="cond-card">
      <h4>5. Programación de Servicios</h4>
      <p>ESV enviará la Orden de Trabajo con la fecha programada. El solicitante deberá revisar la información y dar conformidad dentro de 48 horas.</p>
    </div>
    <div class="cond-card">
      <h4>6. Servicios en Instalaciones del Cliente</h4>
      <p>El equipo y patrones deberán estar disponibles en la fecha programada. El cliente debe indicar los requisitos para el ingreso del personal técnico.</p>
    </div>
    <div class="cond-card full">
      <h4>7. Servicios en Instalaciones de EX SCIENTIA VERITAS</h4>
      <p>Recepción de instrumentos: lunes a viernes de 09:00 a.m. a 05:30 p.m. Los equipos deben entregarse en su caja o estuche de protección. EX SCIENTIA VERITAS se reserva el derecho de recibir o no el objeto según su estado de protección.</p>
    </div>
    <div class="cond-card full">
      <h4>8. Imparcialidad y Confidencialidad</h4>
      <p>Los servicios se realizan dentro de un marco de confidencialidad, imparcialidad, independencia y competencia técnica. El laboratorio podrá validar certificados vía online.</p>
    </div>
  </div>
</div>''')
    ]
    for s_key, s_val in settings_data:
        cur.execute('''
            INSERT INTO settings (key, value)
            VALUES (%s, %s)
            ON CONFLICT (key) DO NOTHING
        ''', (s_key, s_val))

    db.commit()
    cur.close(); db.close()

    print(f'  [OK]  Usuario:    admin')
    print(f'  [OK]  Contraseña: AdminESV2026!')
    print(f'  [OK]  Rol:        admin (acceso total al panel de administración)')
    print()
    print('  Usuarios de prueba creados (Contraseña: 12345678):')
    print('    - c.ruiz (Cliente)')
    print('    - m.vargas (Cliente)')
    print('    - l.mendoza (Supervisor)')
    print()
    print('  Los usuarios normales se registran desde el formulario de registro.')
    print('  Inicia el servidor con:  python run.py\n')


if __name__ == '__main__':
    seed()
