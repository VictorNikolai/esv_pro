import json
from flask import session
from psycopg2.extras import Json

def log_audit(cur, action: str, entity_type: str, entity_id: str, details: dict = None):
    """
    Registra una acción en la bitácora de auditoría.
    Debe llamarse con un cursor activo antes de hacer db.commit().
    """
    user_id = session.get('user_id')
    if not user_id:
        return # No hay usuario en sesión, posible script automático
        
    cur.execute('''
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (%s, %s, %s, %s, %s)
    ''', (
        user_id,
        action,
        entity_type,
        str(entity_id),
        Json(details) if details else None
    ))
