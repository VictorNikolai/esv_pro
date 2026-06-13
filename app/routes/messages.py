"""
Mensajería directa ESV
Admin → Usuario y Usuario → Admin bidireccional.

GET  /api/messages               — mensajes del usuario actual
GET  /api/messages/unread        — conteo de no leídos
GET  /api/messages/users         — lista de usuarios (solo admin)
GET  /api/messages/conversation/<uid> — conversación con un usuario (admin)
POST /api/messages               — enviar mensaje
PATCH /api/messages/<id>/read    — marcar como leído
DELETE /api/messages/<id>        — eliminar (solo el remitente o admin)
"""
from flask      import Blueprint, session, jsonify, request
from ..database import get_db
from ..utils.auth  import require_auth, serial, has_admin_rights, has_supervisor_rights
from ..utils.notif import crear_notif
from ..extensions import socketio

messages_bp = Blueprint('messages', __name__)

MAX_ATTACH_BYTES = 8 * 1024 * 1024   # 8 MB en base64 ≈ 6 MB binario


# ── Lista de mensajes del usuario actual ──────────────────────
@messages_bp.route('/messages')
@require_auth
def list_messages():
    db  = get_db(); cur = db.cursor(dictionary=True)
    uid = session['user_id']

    if has_supervisor_rights(session['role']):
        # Admin/Supervisor ve todos los mensajes que le enviaron
        cur.execute('''
            SELECT m.id, m.subject, m.body, m.is_read, m.created_at,
                   m.attachment_name, m.attachment_type,
                   s.id AS sender_id, s.nombre AS sender_name, s.role AS sender_role,
                   r.id AS recipient_id, r.nombre AS recipient_name
            FROM messages m
            JOIN users s ON s.id = m.sender_id
            LEFT JOIN users r ON r.id = m.recipient_id
            WHERE m.sender_id = %s OR m.recipient_id = %s OR m.recipient_id IS NULL
            ORDER BY m.created_at DESC
            LIMIT 300
        ''', (uid, uid))
    else:
        # Usuario ve sólo sus mensajes
        cur.execute('''
            SELECT m.id, m.subject, m.body, m.is_read, m.created_at,
                   m.attachment_name, m.attachment_type,
                   s.id AS sender_id, s.nombre AS sender_name,
                   r.id AS recipient_id, r.nombre AS recipient_name
            FROM messages m
            JOIN users s ON s.id = m.sender_id
            LEFT JOIN users r ON r.id = m.recipient_id
            WHERE m.recipient_id = %s OR (m.recipient_id IS NULL AND m.sender_id != %s)
               OR m.sender_id = %s
            ORDER BY m.created_at DESC
            LIMIT 200
        ''', (uid, uid, uid))

    rows = cur.fetchall()
    cur.close(); db.close()
    return jsonify(serial(rows))


# ── Conteo de no leídos ───────────────────────────────────────
@messages_bp.route('/messages/unread')
@require_auth
def unread_count():
    db  = get_db(); cur = db.cursor(dictionary=True)
    uid = session['user_id']
    cur.execute('''
        SELECT COUNT(*) AS cnt FROM messages
        WHERE (recipient_id = %s OR recipient_id IS NULL)
          AND sender_id != %s AND is_read = 0
    ''', (uid, uid))
    n = cur.fetchone()['cnt']
    cur.close(); db.close()
    return jsonify({'unread': n})


# ── Lista de usuarios (solo admin/supervisor) ───────────────────────────
@messages_bp.route('/messages/users')
@require_auth
def list_users():
    if not has_supervisor_rights(session['role']):
        return jsonify({'error': 'No tienes permisos para ver esta lista'}), 403

    db  = get_db(); cur = db.cursor(dictionary=True)
    cur.execute('''
        SELECT u.id, u.username, u.nombre, u.email, u.empresa, u.cargo,
               u.created_at, u.last_login, u.active,
               (SELECT COUNT(*) FROM messages m
                WHERE (m.sender_id = u.id OR m.recipient_id = u.id)
                  AND m.is_read = 0) AS unread_count,
               (SELECT MAX(m.created_at) FROM messages m
                WHERE m.sender_id = u.id OR m.recipient_id = u.id) AS last_msg_at
        FROM users u
        WHERE u.role = 'usuario' AND u.active = 1
        ORDER BY last_msg_at DESC, u.nombre ASC
    ''')
    rows = cur.fetchall()
    cur.close(); db.close()
    return jsonify(serial(rows))


# ── Conversación con un usuario específico (admin/supervisor) ──────────
@messages_bp.route('/messages/conversation/<int:uid>')
@require_auth
def get_conversation(uid):
    me = session['user_id']

    db  = get_db(); cur = db.cursor(dictionary=True)
    cur.execute('''
        SELECT m.id, m.subject, m.body, m.is_read, m.created_at,
               m.attachment_name, m.attachment_type, m.attachment_data,
               s.id AS sender_id, s.nombre AS sender_name, s.role AS sender_role
        FROM messages m
        JOIN users s ON s.id = m.sender_id
        WHERE (m.sender_id = %s AND m.recipient_id = %s)
           OR (m.sender_id = %s AND m.recipient_id = %s)
           OR (m.recipient_id IS NULL AND (m.sender_id = %s OR m.sender_id = %s))
        ORDER BY m.created_at ASC
    ''', (me, uid, uid, me, me, uid))
    rows = cur.fetchall()

    # Marcar todos como leídos
    cur2 = db.cursor()
    cur2.execute('''
        UPDATE messages SET is_read = 1
        WHERE recipient_id = %s AND sender_id = %s AND is_read = 0
    ''', (me, uid))
    db.commit()
    cur.close(); cur2.close(); db.close()
    return jsonify(serial(rows))


# ── Adjunto de un mensaje específico ─────────────────────────
@messages_bp.route('/messages/<int:mid>/attachment')
@require_auth
def get_attachment(mid):
    from flask import send_from_directory, current_app
    import os
    db  = get_db(); cur = db.cursor(dictionary=True)
    uid = session['user_id']
    cur.execute('''
        SELECT attachment_name, file_path
        FROM messages
        WHERE id = %s AND (sender_id = %s OR recipient_id = %s OR recipient_id IS NULL)
    ''', (mid, uid, uid))
    row = cur.fetchone()
    cur.close(); db.close()
    if not row or not row['file_path']:
        return jsonify({'error': 'Adjunto no encontrado'}), 404
        
    directory = os.path.join(current_app.root_path, '..', 'uploads')
    return send_from_directory(directory, row['file_path'], download_name=row['attachment_name'])


# ── Enviar mensaje ────────────────────────────────────────────
@messages_bp.route('/messages', methods=['POST'])
@require_auth
def send_message():
    import uuid, os
    from flask import current_app
    from werkzeug.utils import secure_filename
    
    # Manejar FormData en lugar de JSON
    body = request.form.get('body', '').strip()
    recipient_id_str = request.form.get('recipient_id')
    recipient_id = int(recipient_id_str) if recipient_id_str and recipient_id_str != 'null' else None
    subject = request.form.get('subject', '').strip()
    
    file = request.files.get('attachment')
    
    if not body and not file:
        return jsonify({'error': 'El mensaje no puede estar vacío'}), 400

    sender_id    = session['user_id']
    
    # Sólo admin/supervisor puede difundir a todos
    if recipient_id is None and not has_supervisor_rights(session['role']):
        return jsonify({'error': 'Solo admin/supervisor puede enviar a todos'}), 403

    att_name = None
    att_type = None
    file_path = None
    
    if file and file.filename:
        # Validar tamaño límite
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
        if size > MAX_ATTACH_BYTES:
            return jsonify({'error': 'El adjunto supera el límite de 6 MB'}), 413
            
        att_name = secure_filename(file.filename)
        att_type = file.content_type
        
        upload_folder = os.path.join(current_app.root_path, '..', 'uploads', 'attachments')
        os.makedirs(upload_folder, exist_ok=True)
        unique_filename = f"{uuid.uuid4().hex}_{att_name}"
        save_path = os.path.join(upload_folder, unique_filename)
        file.save(save_path)
        file_path = f"attachments/{unique_filename}"

    db  = get_db(); cur = db.cursor(dictionary=True)
    
    # Validar que los usuarios normales solo puedan enviar mensajes a administradores
    if session.get('role') == 'usuario' and recipient_id:
        cur.execute('SELECT role FROM users WHERE id = %s', (recipient_id,))
        rec = cur.fetchone()
        if not rec or rec['role'] not in ('admin', 'supervisor'):
            cur.close(); db.close()
            return jsonify({'error': 'Solo puedes enviar mensajes al personal autorizado (Administrador)'}), 403

    cur.close(); cur = db.cursor()
    cur.execute('''
        INSERT INTO messages
            (sender_id, recipient_id, subject, body,
             attachment_name, attachment_type, file_path)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    ''', (sender_id, recipient_id,
          subject,
          body,
          att_name, att_type, file_path))
    new_id = cur.fetchone()[0]

    # Datos del mensaje para emitir por WebSocket
    msg_data = {
        'id': new_id,
        'sender_id': sender_id,
        'sender_name': session['nombre'],
        'recipient_id': recipient_id,
        'subject': subject,
        'body': body,
        'attachment_name': att_name
    }

    # Notificación interna al destinatario
    if recipient_id:
        socketio.emit('nuevo_mensaje', msg_data, room=f"user_{recipient_id}")
        crear_notif(cur, recipient_id, 'mensaje',
                    f'Nuevo mensaje de {session["nombre"]}',
                    subject or body[:80],
                    referencia='mensajería')
    else:
        # Broadcast: notificar a todos los usuarios activos
        cur2 = db.cursor(dictionary=True)
        cur2.execute(
            "SELECT id FROM users WHERE role = 'usuario' AND active = 1"
        )
        for u in cur2.fetchall():
            socketio.emit('nuevo_mensaje', msg_data, room=f"user_{u['id']}")
            crear_notif(cur, u['id'], 'mensaje',
                        f'Mensaje general de {session["nombre"]}',
                        subject or body[:80],
                        referencia='mensajería')
        cur2.close()

    db.commit(); cur.close(); db.close()
    return jsonify({'ok': True, 'id': new_id}), 201


# ── Marcar como leído ─────────────────────────────────────────
@messages_bp.route('/messages/<int:mid>/read', methods=['PATCH'])
@require_auth
def mark_read(mid):
    db  = get_db(); cur = db.cursor()
    cur.execute('UPDATE messages SET is_read = 1 WHERE id = %s AND recipient_id = %s',
                (mid, session['user_id']))
    db.commit(); cur.close(); db.close()
    return jsonify({'ok': True})


# ── ID del administrador (para que el usuario abra la conversación) ───────────
@messages_bp.route('/messages/admin-info')
@require_auth
def get_admin_info():
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute(
        "SELECT id, nombre, cargo FROM users "
        "WHERE role = 'admin' AND active=1 "
        "ORDER BY id ASC LIMIT 1"
    )
    admin = cur.fetchone()
    cur.close()
    db.close()
    if not admin:
        return jsonify({'error': 'Admin no encontrado'}), 404
    return jsonify(serial(admin) if admin else {})


# ── Eliminar mensaje ──────────────────────────────────────────
@messages_bp.route('/messages/<int:mid>', methods=['DELETE'])
@require_auth
def delete_message(mid):
    db  = get_db(); cur = db.cursor(dictionary=True)
    cur.execute('SELECT sender_id FROM messages WHERE id = %s', (mid,))
    msg = cur.fetchone()
    if not msg:
        cur.close(); db.close()
        return jsonify({'error': 'Mensaje no encontrado'}), 404
    if msg['sender_id'] != session['user_id'] and not has_admin_rights(session['role']):
        cur.close(); db.close()
        return jsonify({'error': 'Sin permisos'}), 403
    cur2 = db.cursor()
    cur2.execute('DELETE FROM messages WHERE id = %s', (mid,))
    db.commit(); cur.close(); cur2.close(); db.close()
    return jsonify({'ok': True})
