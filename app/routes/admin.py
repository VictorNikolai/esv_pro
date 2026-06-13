"""
Panel de Administración
Endpoints protegidos, solo accesibles por rol 'admin'.

    GET  /api/admin/stats       — resumen de órdenes por estado
    GET  /api/admin/orders      — lista completa con filtrado
    GET  /api/admin/documents   — historial de documentos generados
    PATCH /api/admin/orders/<id>/status  — cambio de estado (admin)
"""
from flask      import Blueprint, session, jsonify, request
from ..database import get_db
from ..utils.auth import require_auth, serial, has_admin_rights, has_supervisor_rights
from ..utils.notif import crear_notif
from ..utils.audit import log_audit

admin_bp = Blueprint('admin', __name__)

ESTADOS = ('borrador', 'ingresado', 'cotizado', 'aprobado', 'en_proceso', 'finalizado')


def _admin_required():
    if not has_admin_rights(session.get('role')):
        return jsonify({'error': 'Acceso restringido. Solo administradores.'}), 403
    return None

def _supervisor_required():
    if not has_supervisor_rights(session.get('role')):
        return jsonify({'error': 'Acceso restringido al panel de administración'}), 403
    return None

# ── Gestión de Usuarios (Sólo Admin) ───────────────────────────────────────
@admin_bp.route('/admin/users')
@require_auth
def get_users():
    err = _admin_required()
    if err: return err
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute('''
        SELECT id, username, nombre, email, empresa, cargo, role, active, created_at
        FROM users
        ORDER BY created_at DESC
    ''')
    rows = cur.fetchall()
    cur.close(); db.close()
    return jsonify(serial(rows))

@admin_bp.route('/admin/users/<int:uid>', methods=['PATCH'])
@require_auth
def update_user(uid):
    err = _admin_required()
    if err: return err
    data = request.get_json() or {}
    role = data.get('role')
    active = data.get('active')
    
    if not role and active is None:
        return jsonify({'error': 'No hay datos para actualizar'}), 400
        
    updates = []; params = []
    if role:
        updates.append('role = %s::user_role_t'); params.append(role)
    if active is not None:
        updates.append('active = %s'); params.append(1 if active else 0)
        
    params.append(uid)
    
    db = get_db(); cur = db.cursor()
    cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", tuple(params))
    
    log_audit(
        cur,
        action="UPDATE_USER",
        entity_type="users",
        entity_id=uid,
        details={"role": role, "active": active}
    )
    
    db.commit()
    cur.close(); db.close()
    return jsonify({'ok': True})


# ── Estadísticas generales ─────────────────────────────────────────────────
@admin_bp.route('/admin/stats')
@require_auth
def get_stats():
    err = _supervisor_required()
    if err: return err

    db  = get_db()
    cur = db.cursor(dictionary=True)

    # Conteo por estado
    cur.execute('''
        SELECT status, COUNT(*) AS total,
               SUM(total_estimated) AS monto
        FROM work_orders
        GROUP BY status
        ORDER BY status
    ''')
    by_status = cur.fetchall()

    # Órdenes recientes (últimas 10)
    cur.execute('''
        SELECT o.id, o.order_no, o.status, o.total_estimated,
               o.created_at, c.empresa, u.nombre AS creator
        FROM work_orders o
        JOIN clients c ON c.id = o.client_id
        JOIN users   u ON u.id = o.created_by
        ORDER BY o.created_at DESC
        LIMIT 10
    ''')
    recent = cur.fetchall()

    # Total general
    cur.execute('SELECT COUNT(*) AS total, SUM(total_estimated) AS monto FROM work_orders')
    totals = cur.fetchone()

    # Documentos generados este mes
    cur.execute('''
        SELECT COUNT(*) AS total FROM documents
        WHERE date_trunc('month', generated_at) = date_trunc('month', NOW())
    ''')
    docs_mes = cur.fetchone()

    cur.close(); db.close()
    return jsonify({
        'by_status':  serial(by_status),
        'recent':     serial(recent),
        'totals':     serial(totals),
        'docs_mes':   docs_mes['total'],
    })


# ── Lista de órdenes (admin ve todas) ──────────────────────────────────
@admin_bp.route('/admin/orders')
@require_auth
def get_all_orders():
    err = _supervisor_required()
    if err: return err

    status_filter = request.args.get('status', '')
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 50))
    offset = (page - 1) * limit

    db  = get_db()
    cur = db.cursor(dictionary=True)

    where = 'WHERE o.status = %s' if status_filter in ESTADOS else ''
    base_params = [status_filter] if where else []

    # Get total count
    count_sql = f'SELECT COUNT(*) as total FROM work_orders o {where}'
    cur.execute(count_sql, tuple(base_params))
    total = cur.fetchone()['total']

    # Get paginated data
    data_sql = f'''
        SELECT o.id, o.order_no, o.status, o.total_estimated, o.notes,
               o.created_at, o.updated_at,
               c.empresa, c.ruc, c.contacto, c.telefono, c.email,
               u.nombre AS creator,
               (SELECT COUNT(*) FROM order_instruments WHERE order_id = o.id) AS n_items
        FROM work_orders o
        JOIN clients c ON c.id = o.client_id
        JOIN users   u ON u.id = o.created_by
        {where}
        ORDER BY o.updated_at DESC
        LIMIT %s OFFSET %s
    '''
    
    query_params = base_params + [limit, offset]
    cur.execute(data_sql, tuple(query_params))
    rows = cur.fetchall()
    
    cur.close(); db.close()
    
    return jsonify({
        'data': serial(rows),
        'total': total,
        'page': page,
        'limit': limit
    })


# ── Historial de documentos (constancias + cotizaciones) ──────────────────
@admin_bp.route('/admin/documents')
@require_auth
def get_documents():
    err = _supervisor_required()
    if err: return err

    db  = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute('''
        SELECT d.id, d.doc_type, d.doc_number, d.generated_at,
               o.id AS order_id, o.order_no, o.status, o.notes,
               c.empresa, c.ruc, c.contacto, c.telefono, c.email, c.direccion,
               u.nombre AS generated_by_name
        FROM documents d
        JOIN work_orders o ON o.id = d.order_id
        JOIN clients    c ON c.id  = o.client_id
        LEFT JOIN users u ON u.id  = d.generated_by
        ORDER BY d.generated_at DESC
        LIMIT 200
    ''')
    rows = cur.fetchall()
    cur.close(); db.close()
    return jsonify(serial(rows))


# ── Cambio de estado (admin) ───────────────────────────────
@admin_bp.route('/admin/orders/<int:oid>/status', methods=['PATCH'])
@require_auth
def change_status(oid):
    err = _supervisor_required()
    if err: return err

    data   = request.get_json() or {}
    nuevo  = data.get('status', '').strip()
    if nuevo not in ESTADOS:
        return jsonify({'error': f'Estado inválido. Valores: {", ".join(ESTADOS)}'}), 400

    db  = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute('SELECT id, created_by, order_no, status FROM work_orders WHERE id = %s', (oid,))
    order = cur.fetchone()
    if not order:
        cur.close(); db.close()
        return jsonify({'error': 'Orden no encontrada'}), 404

    anterior = order['status']
    cur2 = db.cursor()
    cur2.execute('UPDATE work_orders SET status = %s WHERE id = %s', (nuevo, oid))

    # Notificar al creador de la orden
    crear_notif(
        cur2, order['created_by'], 'estado',
        f'{order["order_no"]}: estado cambiado a {nuevo}',
        f'Por {session["nombre"]} desde el panel de administración',
        referencia=order['order_no']
    )
    
    # Audit log
    log_audit(
        cur2,
        action="CHANGE_ORDER_STATUS",
        entity_type="work_orders",
        entity_id=oid,
        details={"previous": anterior, "new": nuevo, "order_no": order["order_no"]}
    )

    db.commit()
    cur.close(); cur2.close(); db.close()
    return jsonify({'ok': True, 'previous': anterior, 'status': nuevo})

# ── Logs de Auditoría (admin) ───────────────────────────────
@admin_bp.route('/admin/audit')
@require_auth
def get_audit_logs():
    err = _supervisor_required()
    if err: return err

    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 100))
    offset = (page - 1) * limit

    db  = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute('SELECT COUNT(*) as total FROM audit_logs')
    total = cur.fetchone()['total']

    cur.execute('''
        SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at,
               u.nombre as user_name, u.role as user_role
        FROM audit_logs a
        JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC
        LIMIT %s OFFSET %s
    ''', (limit, offset))
    rows = cur.fetchall()
    cur.close(); db.close()
    
    return jsonify({
        'data': serial(rows),
        'total': total,
        'page': page,
        'limit': limit
    })
