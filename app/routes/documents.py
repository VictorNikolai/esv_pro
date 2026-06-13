"""
Rutas de generación de documentos.

Endpoints:
    GET /api/orders/<id>/document/constancia   — datos para Constancia de Ingreso
    GET /api/orders/<id>/document/cotizacion   — datos para Cotización (+ IGV)
"""
from datetime import datetime
from flask    import Blueprint, session, jsonify
from ..database   import get_db
from ..utils.auth import require_auth, serial
from ..utils.notif import crear_notif

documents_bp = Blueprint('documents', __name__)

TIPOS_VALIDOS = ('constancia', 'cotizacion')


@documents_bp.route('/orders/<int:oid>/document/<doc_type>')
@require_auth
def get_document(oid, doc_type):
    if doc_type not in TIPOS_VALIDOS:
        return jsonify({'error': f'Tipo inválido. Use: {TIPOS_VALIDOS}'}), 400

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

    if session.get('role') == 'usuario' and order['created_by'] != session.get('user_id'):
        cur.close(); db.close()
        return jsonify({'error': 'Acceso denegado: esta orden no te pertenece'}), 403

    cur.execute('''
        SELECT
            oi.*,
            cm.name AS method_name, cm.area, cm.magnitude, cm.tariff,
            cm.procedure_code, cm.icon
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

    # Registrar generación del documento
    cur2 = db.cursor()
    cur2.execute(
        'INSERT INTO documents (order_id, doc_type, doc_number, generated_by) '
        'VALUES (%s, %s, %s, %s)',
        (oid, doc_type, order['order_no'], session['user_id'])
    )

    # Notificar al creador de la orden si es distinto al que genera el doc
    if order['created_by'] != session['user_id']:
        label = 'Constancia de ingreso' if doc_type == 'constancia' else 'Cotización'
        crear_notif(
            cur2, order['created_by'], 'documento',
            f'{label} generada: {order["order_no"]}',
            f'Generada por {session["nombre"]}',
            referencia=order['order_no']
        )
        
    from ..utils.audit import log_audit
    log_audit(
        cur2, action="GENERATE_DOCUMENT", entity_type="work_orders", entity_id=oid, 
        details={"doc_type": doc_type, "order_no": order["order_no"]}
    )

    db.commit(); cur.close(); cur2.close(); db.close()

    return jsonify({
        'order':        serial(order),
        'instruments':  serial(instruments),
        'doc_type':     doc_type,
        'generated_at': datetime.now().isoformat(),
        'generated_by': session['nombre'],
    })
