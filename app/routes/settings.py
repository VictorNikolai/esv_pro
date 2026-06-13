from flask import Blueprint, jsonify, request
from ..database import get_db
from ..utils.auth import require_auth, has_admin_rights

settings_bp = Blueprint('settings', __name__)

@settings_bp.route('/settings', methods=['GET'])
@require_auth
def get_settings():
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute('SELECT key, value FROM settings')
    rows = cur.fetchall()
    cur.close()
    db.close()
    
    settings_dict = {row['key']: row['value'] for row in rows}
    return jsonify(settings_dict)

@settings_bp.route('/settings', methods=['POST'])
@require_auth
def update_settings():
    from flask import session
    if not has_admin_rights(session.get('role')):
        return jsonify({'error': 'Acceso denegado'}), 403
        
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
        
    db = get_db()
    cur = db.cursor()
    for key, value in data.items():
        cur.execute(
            'INSERT INTO settings (key, value) VALUES (%s, %s) '
            'ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
            (key, str(value))
        )
    db.commit()
    cur.close()
    db.close()
    return jsonify({'ok': True, 'msg': 'Ajustes guardados correctamente'})
