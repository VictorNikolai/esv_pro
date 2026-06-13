"""
Registro de nuevos usuarios — creación directa (activo inmediatamente).

Endpoints PÚBLICOS:
    POST /api/register           — registrar nuevo usuario
    GET  /api/register/check     — verificar disponibilidad
"""
import re
import psycopg2
from flask       import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash
from ..database   import get_db
from ..utils.auth import serial

register_bp = Blueprint('register', __name__)

RE_USERNAME = re.compile(r'^[a-zA-Z0-9._-]{3,30}$')
RE_EMAIL    = re.compile(r'^[\w.+-]+@[\w-]+\.[\w.-]+$')


@register_bp.route('/register', methods=['POST'])
def submit_register():
    """Crea el usuario directamente. Queda activo de inmediato con rol usuario."""
    data = request.get_json() or {}

    nombre    = data.get('nombre_completo', '').strip()
    username  = data.get('username', '').strip().lower()
    email     = data.get('email', '').strip().lower()
    dni       = data.get('dni', '').strip()
    empresa   = data.get('empresa', '').strip()
    cargo     = data.get('cargo', '').strip()
    telefono  = data.get('telefono', '').strip()
    depto     = data.get('departamento', '').strip()
    provincia = data.get('provincia', '').strip()
    distrito  = data.get('distrito', '').strip()
    password  = data.get('password', '')
    confirm   = data.get('confirm_password', '')

    # ─── Validaciones ──────────────────────────────────────────
    errors = {}
    if len(nombre) < 3:
        errors['nombre_completo'] = 'Mínimo 3 caracteres.'
    if not RE_USERNAME.match(username):
        errors['username'] = '3–30 caracteres: letras, números, punto y guion.'
    if not email or not RE_EMAIL.match(email):
        errors['email'] = 'Correo electrónico inválido.'
    if not cargo:
        errors['cargo'] = 'Cargo o puesto de trabajo requerido.'
    if len(password) < 8:
        errors['password'] = 'Mínimo 8 caracteres.'
    elif not any(c.isdigit() for c in password):
        errors['password'] = 'Debe incluir al menos un número.'
    if password != confirm:
        errors['confirm_password'] = 'Las contraseñas no coinciden.'

    if errors:
        return jsonify({'error': 'Revisa los campos marcados.', 'fields': errors}), 400

    db  = get_db()
    cur = db.cursor(dictionary=True)

    # Verificar unicidad de username
    cur.execute('SELECT 1 FROM users WHERE username = %s', (username,))
    if cur.fetchone():
        cur.close(); db.close()
        return jsonify({'field': 'username',
                        'error': f'El usuario "@{username}" ya está en uso.'}), 409

    # Verificar unicidad de email
    cur.execute('SELECT 1 FROM users WHERE email = %s', (email,))
    if cur.fetchone():
        cur.close(); db.close()
        return jsonify({'field': 'email',
                        'error': 'Este correo ya está registrado.'}), 409

    # Crear usuario directamente (active=1, rol=usuario)
    ph   = generate_password_hash(password)
    cur2 = db.cursor()
    try:
        cur2.execute(
            '''INSERT INTO users
                   (username, password_hash, nombre, role, email,
                    empresa, cargo, dni, telefono,
                    departamento, provincia, distrito, active)
               VALUES (%s,%s,%s,'usuario'::user_role_t,%s,%s,%s,%s,%s,%s,%s,%s,1)
               RETURNING id''',
            (username, ph, nombre, email,
             empresa, cargo, dni, telefono,
             depto, provincia, distrito)
        )
        new_id = cur2.fetchone()[0]
        db.commit()
    except psycopg2.IntegrityError:
        db.rollback(); cur.close(); cur2.close(); db.close()
        return jsonify({'error': 'El usuario o correo ya existe.'}), 409

    cur.close(); cur2.close(); db.close()
    return jsonify({
        'ok':       True,
        'id':       new_id,
        'username': username,
        'message':  'Cuenta creada exitosamente. Ya puedes iniciar sesión.'
    }), 201


@register_bp.route('/register/check')
def check_availability():
    """Verifica en tiempo real disponibilidad de usuario o correo."""
    field = request.args.get('field', '').strip()
    value = (request.args.get('value', '') or '').strip().lower()

    if not field or not value:
        return jsonify({'available': False}), 400

    db  = get_db()
    cur = db.cursor()

    if field == 'username':
        if not RE_USERNAME.match(value):
            cur.close(); db.close()
            return jsonify({'available': False, 'reason': 'Formato inválido'})
        cur.execute('SELECT 1 FROM users WHERE username = %s', (value,))
        if cur.fetchone():
            cur.close(); db.close()
            return jsonify({'available': False, 'reason': 'Usuario ya registrado'})

    elif field == 'email':
        if not RE_EMAIL.match(value):
            cur.close(); db.close()
            return jsonify({'available': False, 'reason': 'Formato inválido'})
        cur.execute('SELECT 1 FROM users WHERE email = %s', (value,))
        if cur.fetchone():
            cur.close(); db.close()
            return jsonify({'available': False, 'reason': 'Correo ya registrado'})
    else:
        cur.close(); db.close()
        return jsonify({'available': False}), 400

    cur.close(); db.close()
    return jsonify({'available': True})
