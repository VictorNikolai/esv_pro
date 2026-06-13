"""
Rutas de instrumentos dentro de una orden de trabajo.

Endpoints:
    POST   /api/orders/<oid>/instruments            — agregar instrumento
    PUT    /api/orders/<oid>/instruments/<iid>      — actualizar instrumento
    DELETE /api/orders/<oid>/instruments/<iid>      — quitar instrumento
"""
from flask import Blueprint, request, session, jsonify
from ..database   import get_db
from ..utils.auth import require_auth

instruments_bp = Blueprint('instruments', __name__)


def _recalcular_total(cur, oid):
    """Recalcula total_estimated de la orden."""
    cur.execute(
        '''UPDATE work_orders
           SET total_estimated = (
               SELECT COALESCE(SUM(subtotal - descuento), 0)
               FROM order_instruments
               WHERE order_id = %s
           )
           WHERE id = %s''',
        (oid, oid)
    )


@instruments_bp.route('/orders/<int:oid>/instruments', methods=['POST'])
@require_auth
def add_instrument(oid):
    data   = request.get_json() or {}
    mid    = data.get('method_id')
    points = data.get('points', [])
    lugar  = data.get('lugar_atencion', 'LABORATORIO').strip() or 'LABORATORIO'
    tipo   = data.get('tipo_servicio',  'ACREDITADO').strip()  or 'ACREDITADO'
    dsc    = float(data.get('descuento', 0))

    db  = get_db(); cur = db.cursor(dictionary=True)

    cur.execute('SELECT created_by, status FROM work_orders WHERE id = %s', (oid,))
    order = cur.fetchone()
    if not order:
        cur.close(); db.close()
        return jsonify({'error': 'Orden no encontrada'}), 404
    if session.get('role') == 'usuario':
        if order['created_by'] != session.get('user_id'):
            cur.close(); db.close()
            return jsonify({'error': 'Acceso denegado: no puedes agregar instrumentos a esta orden'}), 403
        if order['status'] != 'borrador':
            cur.close(); db.close()
            return jsonify({'error': 'Acceso denegado: no puedes agregar instrumentos a una orden en proceso'}), 403

    cur.execute(
        'SELECT tariff FROM catalog_methods WHERE id = %s AND active = 1',
        (mid,)
    )
    method = cur.fetchone()
    if not method:
        cur.close(); db.close()
        return jsonify({'error': 'Método no encontrado en el catálogo'}), 404

    tariff   = float(method['tariff'])
    subtotal = tariff * len(points)

    cur2 = db.cursor()
    cur2.execute(
        'SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM order_instruments WHERE order_id = %s',
        (oid,)
    )
    sort_n = cur2.fetchone()[0]

    cur2.execute(
        '''INSERT INTO order_instruments
               (order_id, method_id, serie, marca, modelo, alcance,
                division_escala, exactitud, identificacion, indicaciones,
                lugar_atencion, tipo_servicio, descuento, subtotal, sort_order)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
           RETURNING id''',
        (oid, mid,
         data.get('serie', ''),    data.get('marca', ''),
         data.get('modelo', ''),   data.get('alcance', ''),
         data.get('division', ''), data.get('exactitud', ''),
         data.get('identificacion', ''), data.get('indicaciones', ''),
         lugar, tipo, dsc, subtotal, sort_n)
    )
    iid = cur2.fetchone()[0]

    for pt in points:
        cur2.execute(
            'INSERT INTO instrument_points (instrument_id, point_label) VALUES (%s, %s)',
            (iid, pt)
        )

    _recalcular_total(cur2, oid)
    db.commit(); cur.close(); cur2.close(); db.close()
    return jsonify({'id': iid, 'subtotal': subtotal}), 201


@instruments_bp.route('/orders/<int:oid>/instruments/<int:iid>', methods=['PUT'])
@require_auth
def update_instrument(oid, iid):
    data   = request.get_json() or {}
    points = data.get('points', [])
    lugar  = data.get('lugar_atencion', 'LABORATORIO').strip() or 'LABORATORIO'
    tipo   = data.get('tipo_servicio',  'ACREDITADO').strip()  or 'ACREDITADO'
    dsc    = float(data.get('descuento', 0))

    db  = get_db(); cur = db.cursor(dictionary=True)

    cur.execute('SELECT created_by, status FROM work_orders WHERE id = %s', (oid,))
    order = cur.fetchone()
    if not order:
        cur.close(); db.close()
        return jsonify({'error': 'Orden no encontrada'}), 404
    if session.get('role') == 'usuario':
        if order['created_by'] != session.get('user_id'):
            cur.close(); db.close()
            return jsonify({'error': 'Acceso denegado: no puedes editar instrumentos de esta orden'}), 403
        if order['status'] != 'borrador':
            cur.close(); db.close()
            return jsonify({'error': 'Acceso denegado: no puedes editar instrumentos en una orden en proceso'}), 403

    cur.execute(
        '''SELECT cm.tariff
           FROM order_instruments oi
           JOIN catalog_methods cm ON cm.id = oi.method_id
           WHERE oi.id = %s AND oi.order_id = %s''',
        (iid, oid)
    )
    row = cur.fetchone()
    if not row:
        cur.close(); db.close()
        return jsonify({'error': 'Instrumento no encontrado en esta orden'}), 404

    tariff   = float(row['tariff'])
    subtotal = tariff * len(points)

    cur2 = db.cursor()
    cur2.execute(
        '''UPDATE order_instruments
           SET serie=%s, marca=%s, modelo=%s, alcance=%s,
               division_escala=%s, exactitud=%s, identificacion=%s,
               indicaciones=%s, lugar_atencion=%s, tipo_servicio=%s,
               descuento=%s, subtotal=%s
           WHERE id=%s AND order_id=%s''',
        (data.get('serie', ''),    data.get('marca', ''),
         data.get('modelo', ''),   data.get('alcance', ''),
         data.get('division', ''), data.get('exactitud', ''),
         data.get('identificacion', ''), data.get('indicaciones', ''),
         lugar, tipo, dsc, subtotal, iid, oid)
    )
    cur2.execute(
        'DELETE FROM instrument_points WHERE instrument_id = %s', (iid,)
    )
    for pt in points:
        cur2.execute(
            'INSERT INTO instrument_points (instrument_id, point_label) VALUES (%s, %s)',
            (iid, pt)
        )

    _recalcular_total(cur2, oid)
    db.commit(); cur.close(); cur2.close(); db.close()
    return jsonify({'ok': True, 'subtotal': subtotal})


@instruments_bp.route('/orders/<int:oid>/instruments/<int:iid>', methods=['DELETE'])
@require_auth
def remove_instrument(oid, iid):
    db  = get_db(); cur = db.cursor(dictionary=True)
    
    cur.execute('SELECT created_by, status FROM work_orders WHERE id = %s', (oid,))
    order = cur.fetchone()
    if not order:
        cur.close(); db.close()
        return jsonify({'error': 'Orden no encontrada'}), 404
    if session.get('role') == 'usuario':
        if order['created_by'] != session.get('user_id'):
            cur.close(); db.close()
            return jsonify({'error': 'Acceso denegado: no puedes borrar instrumentos de esta orden'}), 403
        if order['status'] != 'borrador':
            cur.close(); db.close()
            return jsonify({'error': 'Acceso denegado: no puedes borrar instrumentos de una orden en proceso'}), 403

    cur.close()
    cur = db.cursor()
    cur.execute(
        'DELETE FROM order_instruments WHERE id = %s AND order_id = %s',
        (iid, oid)
    )
    _recalcular_total(cur, oid)
    db.commit(); cur.close(); db.close()
    return jsonify({'ok': True})
