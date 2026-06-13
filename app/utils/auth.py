"""
Utilidades de autenticación y autorización.

Exporta:
    require_auth   — decorador: requiere sesión activa
    require_role   — decorador: requiere rol específico
    serial         — convierte filas MySQL a tipos JSON serializables
"""
from functools import wraps
from datetime  import datetime
from flask     import session, jsonify


# ─────────────────────────────────────────────────────────────
# Utilidades de roles
# ─────────────────────────────────────────────────────────────

def role_level(role):
    """Devuelve nivel numérico del rol para comparaciones."""
    levels = {'usuario': 1, 'admin': 3}
    return levels.get(role, 0)

def has_admin_rights(role):
    return role == 'admin'

def has_supervisor_rights(role):
    return role in ('admin', 'supervisor')

def is_regular_user(role):
    return role == 'usuario'

# ─────────────────────────────────────────────────────────────
# Decoradores de acceso
# ─────────────────────────────────────────────────────────────

def require_auth(f):
    """Rechaza la petición con 401 si no hay sesión activa."""
    @wraps(f)
    def wrapped(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'No autenticado. Inicia sesión.'}), 401
        return f(*args, **kwargs)
    return wrapped


def require_role(*roles):
    """Rechaza con 401/403 si el usuario no tiene el rol requerido.

    Uso:
        @require_role('admin')
        @require_role('admin', 'usuario')
    """
    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'No autenticado. Inicia sesión.'}), 401
            
            if session.get('role') not in roles:
                return jsonify({'error': 'Permiso insuficiente para esta acción.'}), 403
            
            return f(*args, **kwargs)
        return wrapped
    return decorator


# ─────────────────────────────────────────────────────────────
# Serialización
# ─────────────────────────────────────────────────────────────

def serial(obj):
    """Convierte tipos no-JSON (Decimal, datetime) de forma recursiva."""
    if isinstance(obj, dict):
        return {k: serial(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [serial(i) for i in obj]
    if isinstance(obj, datetime):
        return obj.isoformat()
    if hasattr(obj, 'real'):        # Decimal de MySQL → float
        return float(obj)
    return obj
