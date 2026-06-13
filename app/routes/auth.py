"""
Rutas de autenticación.

Endpoints:
    POST /api/login   — iniciar sesión
    POST /api/logout  — cerrar sesión
    GET  /api/me      — datos del usuario en sesión activa
"""
from flask import Blueprint, request, session, jsonify
from werkzeug.security import check_password_hash
from ..database   import get_db
from ..utils.auth import require_auth, serial
from ..extensions import limiter

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    data     = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Ingresa tu usuario y contraseña.'}), 400

    db  = get_db()
    cur = db.cursor(dictionary=True)

    # Buscar usuario activo en el sistema
    cur.execute(
        'SELECT * FROM users WHERE username = %s AND active = 1',
        (username,)
    )
    user = cur.fetchone()

    if not user or not check_password_hash(user['password_hash'], password):

        # Si el usuario no existe en el sistema, verificar si tiene un
        # registro pendiente o rechazado para dar un mensaje más claro.
        if not user:
            cur.execute(
                '''SELECT estado FROM user_requests
                   WHERE username = %s
                   ORDER BY created_at DESC
                   LIMIT 1''',
                (username,)
            )
            registro = cur.fetchone()
            cur.close(); db.close()

            if registro:
                mensajes = {
                    'pendiente': (
                        'Tu registro está en revisión. '
                        'El administrador activará tu cuenta en breve.'
                    ),
                    'rechazada': (
                        'Tu registro no fue aprobado. '
                        'Comunícate con el administrador del sistema.'
                    ),
                }
                return jsonify({
                    'error': mensajes.get(registro['estado'],
                                         'Usuario no encontrado.')
                }), 401

        cur.close(); db.close()
        return jsonify({'error': 'Usuario o contraseña incorrectos.'}), 401

    # Registrar último acceso
    cur2 = db.cursor()
    cur2.execute(
        'UPDATE users SET last_login = NOW() WHERE id = %s',
        (user['id'],)
    )
    db.commit()
    cur.close(); cur2.close(); db.close()

    # Crear sesión
    session.permanent  = True
    session['user_id'] = user['id']
    session['username']= user['username']
    session['nombre']  = user['nombre']
    session['role']    = user['role']

    return jsonify({
        'id':       user['id'],
        'username': user['username'],
        'nombre':   user['nombre'],
        'role':     user['role'],
        'email':    user['email'] or '',
    })


@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'ok': True})


@auth_bp.route('/me')
@require_auth
def me():
    return jsonify({
        'id':       session['user_id'],
        'username': session['username'],
        'nombre':   session['nombre'],
        'role':     session['role'],
    })


# ── Obtener datos del perfil propio ─────────────────────────────
@auth_bp.route('/users/me')
@require_auth
def get_me():
    db  = get_db(); cur = db.cursor(dictionary=True)
    cur.execute(
        "SELECT id, username, nombre, role, email, empresa, cargo, dni, telefono,"
        " departamento, provincia, distrito FROM users WHERE id = %s",
        (session['user_id'],)
    )
    user = cur.fetchone(); cur.close(); db.close()
    if not user:
        return jsonify({'error': 'Usuario no encontrado'}), 404
    return jsonify(serial(user))


# ── Actualizar perfil propio ─────────────────────────────────────
@auth_bp.route('/users/profile', methods=['PATCH'])
@require_auth
def update_profile():
    data = request.get_json() or {}
    uid  = session['user_id']
    ALLOWED = {'nombre', 'empresa', 'cargo', 'telefono', 'dni',
               'departamento', 'provincia', 'distrito'}
    updates = {k: v.strip() if isinstance(v, str) else v
               for k, v in data.items() if k in ALLOWED and v is not None}
    if not updates:
        return jsonify({'error': 'Sin campos válidos para actualizar'}), 400
    db  = get_db(); cur = db.cursor()
    set_clause = ', '.join(f'{k} = %s' for k in updates)
    values     = list(updates.values()) + [uid]
    cur.execute(f'UPDATE users SET {set_clause} WHERE id = %s', values)
    db.commit(); cur.close(); db.close()
    if 'nombre' in updates:
        session['nombre'] = updates['nombre']
    return jsonify({'ok': True, 'updated': list(updates.keys())})


# ── Cambiar contraseña ───────────────────────────────────────────
@auth_bp.route('/users/password', methods=['PATCH'])
@require_auth
def change_password():
    from werkzeug.security import check_password_hash, generate_password_hash
    data    = request.get_json() or {}
    current = data.get('current_password', '')
    new_pw  = data.get('new_password', '')
    if len(new_pw) < 8:
        return jsonify({'error': 'La nueva contraseña debe tener al menos 8 caracteres'}), 400
    db  = get_db(); cur = db.cursor(dictionary=True)
    cur.execute('SELECT password_hash FROM users WHERE id = %s', (session['user_id'],))
    user = cur.fetchone()
    if not user or not check_password_hash(user['password_hash'], current):
        cur.close(); db.close()
        return jsonify({'error': 'La contraseña actual no es correcta'}), 400
    cur2 = db.cursor()
    cur2.execute('UPDATE users SET password_hash = %s WHERE id = %s',
                 (generate_password_hash(new_pw), session['user_id']))
    db.commit(); cur.close(); cur2.close(); db.close()
    return jsonify({'ok': True})
