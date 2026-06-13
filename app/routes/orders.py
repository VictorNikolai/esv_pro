"""
Rutas de órdenes de trabajo.

Endpoints:
    GET    /api/orders        — listar órdenes (filtradas por rol)
    POST   /api/orders        — crear orden
    GET    /api/orders/<id>   — detalle completo de una orden
    PUT    /api/orders/<id>   — actualizar estado / datos de cliente
    DELETE /api/orders/<id>   — eliminar orden
"""
from datetime import datetime
from flask    import Blueprint, request, session, jsonify
from ..database   import get_db
from ..utils.auth import require_auth, serial
from ..utils.notif import crear_notif, notif_a_roles

orders_bp = Blueprint('orders', __name__)


@orders_bp.route('/orders')
@require_auth
def list_orders():
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 50))
    offset = (page - 1) * limit

    db  = get_db(); cur = db.cursor(dictionary=True)
    
    role = session['role']
    where_clause = ''
    params = []
    
    if role != 'admin':
        where_clause = 'WHERE o.created_by = %s'
        params.append(session['user_id'])
        
    # Get total count
    count_sql = f'''
        SELECT COUNT(*) as total 
        FROM work_orders o 
        {where_clause}
    '''
    cur.execute(count_sql, tuple(params))
    total = cur.fetchone()['total']

    # Get paginated data
    data_sql = f'''
        SELECT
            o.*,
            c.empresa, c.ruc, c.contacto,
            u.nombre AS creator,
            (SELECT COUNT(*) FROM order_instruments WHERE order_id = o.id) AS n_items
        FROM work_orders o
        JOIN clients  c ON c.id = o.client_id
        JOIN users    u ON u.id = o.created_by
        {where_clause}
        ORDER BY o.updated_at DESC
        LIMIT %s OFFSET %s
    '''
    
    query_params = list(params) + [limit, offset]
    cur.execute(data_sql, tuple(query_params))
    rows = cur.fetchall()
    
    cur.close(); db.close()
    
    return jsonify({
        'data': serial(rows),
        'total': total,
        'page': page,
        'limit': limit
    })


@orders_bp.route('/orders', methods=['POST'])
@require_auth
def create_order():
    data     = request.get_json() or {}
    empresa  = data.get('empresa',  '').strip()
    ruc      = data.get('ruc',      '').strip()
    contacto = data.get('contacto', '').strip()
    email    = data.get('email',    '').strip()
    telefono = data.get('telefono', '').strip()
    direccion = data.get('direccion', '').strip()
    notas    = data.get('notes',    '').strip()

    db   = get_db()
    cur  = db.cursor(dictionary=True)
    cur2 = db.cursor()

    # Buscar o crear cliente
    if ruc:
        cur.execute('SELECT id FROM clients WHERE ruc = %s LIMIT 1', (ruc,))
        row = cur.fetchone()
    else:
        row = None

    if row:
        cid = row['id']
        cur2.execute(
            'UPDATE clients SET empresa=%s, contacto=%s, email=%s, telefono=%s, direccion=%s WHERE id=%s',
            (empresa, contacto, email, telefono, direccion, cid)
        )
    else:
        cur2.execute(
            'INSERT INTO clients (empresa, ruc, contacto, email, telefono, direccion, created_by) '
            'VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id',
            (empresa, ruc, contacto, email, telefono, direccion, session['user_id'])
        )
        cid = cur2.fetchone()[0]

    # Número de orden autoincremental por año
    cur2.execute(
        'SELECT COUNT(*) FROM work_orders '
        'WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())'
    )
    n        = cur2.fetchone()[0] + 1
    order_no = f"ESV-OT-{datetime.now().year}-{n:04d}"

    cur2.execute(
        'INSERT INTO work_orders (order_no, client_id, notes, created_by) '
        'VALUES (%s, %s, %s, %s) RETURNING id',
        (order_no, cid, notas, session['user_id'])
    )
    oid = cur2.fetchone()[0]

    # Notificar a admin
    notif_a_roles(
        db, ['admin'], 'orden',
        f'Nueva orden: {order_no}',
        f'Cliente: {empresa or "—"} · Creada por {session["nombre"]}',
        referencia=order_no,
        excluir_uid=session['user_id']
    )
    
    from ..utils.audit import log_audit
    log_audit(cur2, action="CREATE_ORDER", entity_type="work_orders", entity_id=oid, details={"order_no": order_no})
    
    db.commit()
    cur.close(); cur2.close(); db.close()
    return jsonify({'id': oid, 'order_no': order_no}), 201


@orders_bp.route('/orders/<int:oid>')
@require_auth
def get_order(oid):
    db  = get_db(); cur = db.cursor(dictionary=True)
    cur.execute('''
        SELECT
            o.*, c.empresa, c.ruc, c.contacto, c.email, c.telefono, c.direccion,
            u.nombre AS creator_name
        FROM work_orders o
        JOIN clients c ON c.id = o.client_id
        JOIN users   u ON u.id = o.created_by
        WHERE o.id = %s
    ''', (oid,))
    order = cur.fetchone()

    if not order:
        cur.close(); db.close()
        return jsonify({'error': 'Orden no encontrada'}), 404

    # Usuarios solo ven sus propias órdenes
    if session['role'] == 'usuario' and order['created_by'] != session['user_id']:
        cur.close(); db.close()
        return jsonify({'error': 'Sin acceso a esta orden'}), 403

    cur.execute('''
        SELECT
            oi.*,
            cm.name AS method_name, cm.area, cm.magnitude, cm.icon,
            cm.tariff, cm.procedure_code, cm.code AS method_code
        FROM order_instruments oi
        JOIN catalog_methods cm ON cm.id = oi.method_id
        WHERE oi.order_id = %s
        ORDER BY oi.sort_order, oi.id
    ''', (oid,))
    instruments = cur.fetchall()

    for instr in instruments:
        instr['tariff']   = float(instr['tariff'])
        instr['subtotal'] = float(instr['subtotal'])
        cur.execute(
            'SELECT point_label FROM instrument_points WHERE instrument_id = %s',
            (instr['id'],)
        )
        instr['selected_points'] = [r['point_label'] for r in cur.fetchall()]

    order['instruments'] = instruments
    cur.close(); db.close()
    return jsonify(serial(order))


@orders_bp.route('/orders/<int:oid>', methods=['PUT'])
@require_auth
def update_order(oid):
    data = request.get_json() or {}
    db   = get_db(); cur = db.cursor(dictionary=True)

    # Validación de propiedad y estado (Lógica de Negocio)
    cur.execute('SELECT created_by, order_no, status FROM work_orders WHERE id = %s', (oid,))
    order = cur.fetchone()
    
    if not order:
        cur.close(); db.close()
        return jsonify({'error': 'Orden no encontrada'}), 404
        
    if session.get('role') == 'usuario':
        if order['created_by'] != session.get('user_id'):
            cur.close(); db.close()
            return jsonify({'error': 'Acceso denegado: no puedes modificar esta orden'}), 403
        
        if order['status'] != 'borrador':
            cur.close(); db.close()
            return jsonify({'error': 'Acceso denegado: no puedes modificar una orden en proceso (ya no es borrador)'}), 403
            
        # Prevenir que el usuario envíe manualmente un cambio de estado
        if 'status' in data:
            del data['status']

    if 'status' in data:
        cur2 = db.cursor()
        cur2.execute('UPDATE work_orders SET status=%s::order_status_t WHERE id=%s',
                     (data['status'], oid))

        # Notificar al creador si es distinto al que cambia el estado
        cur.execute('SELECT created_by, order_no FROM work_orders WHERE id=%s', (oid,))
        row = cur.fetchone()
        if row and row['created_by'] != session['user_id']:
            cur2.execute(
                'INSERT INTO notifications (user_id, tipo, titulo, mensaje, referencia) '
                'VALUES (%s, %s, %s, %s, %s)',
                (row['created_by'], 'estado',
                 f'Estado de {row["order_no"]} → «{data["status"]}»',
                 f'Actualizado por {session["nombre"]}',
                 row['order_no'])
            )
            
        from ..utils.audit import log_audit
        log_audit(cur2, action="UPDATE_ORDER", entity_type="work_orders", entity_id=oid, details={"status": data["status"]})
        cur2.close()

    if 'notes' in data:
        db.cursor().execute(
            'UPDATE work_orders SET notes=%s WHERE id=%s', (data['notes'], oid)
        )

    # Actualizar datos del cliente
    # PostgreSQL no soporta UPDATE ... JOIN; se usa UPDATE ... FROM
    client_fields = {
        k: data[k] for k in ('empresa', 'ruc', 'contacto', 'email', 'telefono', 'direccion')
        if k in data
    }
    if client_fields:
        sets = ', '.join(f'{k} = %s' for k in client_fields)
        vals = list(client_fields.values()) + [oid]
        db.cursor().execute(
            f'UPDATE clients SET {sets} '
            f'FROM work_orders '
            f'WHERE work_orders.client_id = clients.id AND work_orders.id = %s',
            vals
        )

    db.commit(); cur.close(); db.close()
    return jsonify({'ok': True})
