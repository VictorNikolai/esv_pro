"""
Rutas de notificaciones del sistema.

Endpoints:
    GET  /api/notifications           — listar notificaciones del usuario
    POST /api/notifications/read      — marcar todas como leídas
    PUT  /api/notifications/<id>/read — marcar una como leída
"""
from flask import Blueprint, session, jsonify
from ..database   import get_db
from ..utils.auth import require_auth, serial

notifications_bp = Blueprint('notifications', __name__)


@notifications_bp.route('/notifications')
@require_auth
def get_notifications():
    db  = get_db(); cur = db.cursor(dictionary=True)
    cur.execute(
        '''SELECT * FROM notifications
           WHERE user_id = %s
           ORDER BY leida ASC, created_at DESC
           LIMIT 30''',
        (session['user_id'],)
    )
    rows   = cur.fetchall()
    unread = sum(1 for r in rows if not r['leida'])
    cur.close(); db.close()
    return jsonify({'notifications': serial(rows), 'unread': unread})


@notifications_bp.route('/notifications/read', methods=['POST'])
@require_auth
def mark_all_read():
    db  = get_db(); cur = db.cursor()
    cur.execute(
        'UPDATE notifications SET leida = 1 WHERE user_id = %s',
        (session['user_id'],)
    )
    db.commit(); cur.close(); db.close()
    return jsonify({'ok': True})


@notifications_bp.route('/notifications/<int:nid>/read', methods=['PUT'])
@require_auth
def mark_one_read(nid):
    db  = get_db(); cur = db.cursor()
    cur.execute(
        'UPDATE notifications SET leida = 1 WHERE id = %s AND user_id = %s',
        (nid, session['user_id'])
    )
    db.commit(); cur.close(); db.close()
    return jsonify({'ok': True})
