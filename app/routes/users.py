"""
Rutas de gestión de usuarios.

Endpoints:
    GET  /api/users        — listar usuarios (admin)
    POST /api/users        — crear usuario    (admin)
    PUT  /api/users/<id>   — editar usuario   (admin)
"""
import psycopg2
from flask import Blueprint, request, session, jsonify
from werkzeug.security import generate_password_hash
from ..database   import get_db
from ..utils.auth import require_role, serial
from ..utils.notif import notif_a_roles

users_bp = Blueprint('users', __name__)


@users_bp.route('/users')
@require_role('admin')
def list_users():
    db  = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute(
        'SELECT id, username, nombre, role, email, active, created_at '
        'FROM users ORDER BY role, nombre'
    )
    rows = cur.fetchall()
    cur.close(); db.close()
    return jsonify(serial(rows))


@users_bp.route('/users', methods=['POST'])
@require_role('admin')
def create_user():
    data     = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    nombre   = data.get('nombre',   '').strip()
    role     = data.get('role',     'usuario')
    email    = data.get('email',    '').strip()

    if not all([username, password, nombre]):
        return jsonify({'error': 'Username, contraseña y nombre son requeridos'}), 400
    if role not in ('admin', 'usuario'):
        return jsonify({'error': 'Rol inválido'}), 400

    ph = generate_password_hash(password)
    db = get_db(); cur = db.cursor()
    try:
        cur.execute(
            'INSERT INTO users (username, password_hash, nombre, role, email) '
            'VALUES (%s, %s, %s, %s::user_role_t, %s) RETURNING id',
            (username, ph, nombre, role, email)
        )
        uid = cur.fetchone()[0]
        db.commit()

        # Notificar a admin sobre el nuevo usuario
        notif_a_roles(
            db, ['admin'], 'usuario',
            f'Nuevo usuario registrado: {nombre} ({role})',
            f'Username: {username} · Creado por {session["nombre"]}',
            excluir_uid=session['user_id']
        )
        db.commit()
    except psycopg2.IntegrityError:
        db.rollback()
        cur.close(); db.close()
        return jsonify({'error': f'El usuario "{username}" ya existe'}), 409

    cur.close(); db.close()
    return jsonify({'id': uid, 'username': username}), 201


@users_bp.route('/users/<int:uid>', methods=['PUT'])
@require_role('admin')
def update_user(uid):
    data = request.get_json() or {}
    db   = get_db(); cur = db.cursor()
    fields, vals = [], []

    for col in ('nombre', 'email'):
        if col in data:
            fields.append(f'{col} = %s')
            vals.append(data[col])
    if 'role' in data:
        fields.append('role = %s::user_role_t')
        vals.append(data['role'])
    if 'active' in data:
        fields.append('active = %s')
        vals.append(int(data['active']))
    if data.get('password'):
        fields.append('password_hash = %s')
        vals.append(generate_password_hash(data['password']))

    if fields:
        vals.append(uid)
        cur.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = %s", vals)
        db.commit()

    cur.close(); db.close()
    return jsonify({'ok': True})
