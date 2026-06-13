"""
Helpers para crear notificaciones internas del sistema.

Uso típico dentro de un endpoint:
    from ..utils.notif import crear_notif, notif_a_roles

    # Notificar a UN usuario específico
    crear_notif(cur, user_id=5, tipo='estado',
                titulo='Orden actualizada', referencia='ESV-OT-2026-0012')

    # Notificar a TODOS los usuarios del rol 'usuario'
    notif_a_roles(db, ['usuario'], tipo='orden',
                  titulo='Nueva orden creada', referencia=order_no,
                  excluir_uid=session['user_id'])
"""
from ..extensions import socketio


def crear_notif(cur, user_id, tipo, titulo, mensaje='', referencia=''):
    """Inserta una notificación para un usuario.

    Nota: el caller debe hacer db.commit() después.

    Args:
        cur:        Cursor MySQL ya abierto.
        user_id:    ID del usuario receptor.
        tipo:       Categoría ('orden' | 'estado' | 'documento' |
                    'catalogo' | 'usuario' | 'sistema').
        titulo:     Texto corto visible en el panel (máx. 200 chars).
        mensaje:    Detalle adicional (opcional).
        referencia: N.º de orden u otro identificador (opcional).
    """
    cur.execute(
        '''INSERT INTO notifications
               (user_id, tipo, titulo, mensaje, referencia)
           VALUES (%s, %s, %s, %s, %s)''',
        (user_id, tipo, titulo[:200], mensaje, referencia)
    )
    
    # Emitir evento a la sala del usuario
    socketio.emit('nueva_notificacion', {
        'tipo': tipo,
        'titulo': titulo[:200],
        'mensaje': mensaje,
        'referencia': referencia
    }, room=f"user_{user_id}")


def notif_a_roles(db, roles, tipo, titulo,
                  mensaje='', referencia='', excluir_uid=None):
    """Notifica a todos los usuarios activos con los roles indicados.

    Args:
        db:          Conexión MySQL abierta (sin cerrar).
        roles:       Lista de roles, p.ej. ['admin', 'usuario'].
        excluir_uid: ID del usuario que ejecuta la acción (no se notifica
                     a sí mismo).
    """
    cur = db.cursor(dictionary=True)
    ph  = ', '.join(['%s'] * len(roles))
    cur.execute(
        f'SELECT id FROM users WHERE role IN ({ph}) AND active = 1',
        roles
    )
    user_ids = [r['id'] for r in cur.fetchall() if r['id'] != excluir_uid]
    cur.close()

    if not user_ids:
        return

    cur2 = db.cursor()
    for uid in user_ids:
        crear_notif(cur2, uid, tipo, titulo, mensaje, referencia)
    cur2.close()

def notif_todos_usuarios(db, tipo, titulo, mensaje='', referencia='', excluir_uid=None):
    """Notifica a todos los usuarios activos con rol 'usuario'."""
    notif_a_roles(db, ['usuario'], tipo, titulo, mensaje, referencia, excluir_uid)
