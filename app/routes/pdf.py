from flask import Blueprint, session, jsonify, render_template, make_response, current_app, request
from ..database import get_db
from ..utils.auth import require_auth
from ..utils.notif import crear_notif
from ..extensions import socketio
import os
import base64
from playwright.sync_api import sync_playwright
import threading

pdf_bp = Blueprint('pdf', __name__)
pdf_semaphore = threading.Semaphore(2)
TIPOS_VALIDOS = ('constancia', 'cotizacion')

def generate_pdf_worker(app, html_str, doc_id, user_id, doc_label, base_no, footer_html):
    with app.app_context():
        pdf_bytes = None
        try:
            with pdf_semaphore:
                with sync_playwright() as p:
                    browser = p.chromium.launch(headless=True)
                    page = browser.new_page()
                    page.set_content(html_str)
                    pdf_bytes = page.pdf(
                        format="A4",
                        print_background=True,
                        display_header_footer=True,
                        header_template="<span></span>",
                        footer_template=footer_html,
                        margin={"top": "10mm", "bottom": "14mm", "left": "12mm", "right": "12mm"}
                    )
                    browser.close()
        except Exception as e:
            print(f"Error generating PDF: {e}")

        if pdf_bytes:
            db = get_db()
            cur = db.cursor()
            cur.execute('UPDATE documents SET file_data = %s WHERE id = %s', (pdf_bytes, doc_id))
            db.commit()
            cur.close()
            db.close()
            socketio.emit('pdf_ready', {'doc_id': doc_id, 'doc_label': doc_label, 'base_no': base_no}, room=f"user_{user_id}")
        else:
            socketio.emit('pdf_error', {'msg': f"Error al generar {doc_label}"}, room=f"user_{user_id}")

@pdf_bp.route('/orders/<int:oid>/pdf/<doc_type>', methods=['GET', 'POST'])
@require_auth
def generate_pdf(oid, doc_type):
    if doc_type not in TIPOS_VALIDOS:
        return jsonify({'error': f'Tipo inválido. Use: {TIPOS_VALIDOS}'}), 400

    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute('''
        SELECT
            o.*, c.empresa, c.ruc, c.contacto, c.email, c.telefono, c.direccion
        FROM work_orders o
        JOIN clients c ON c.id = o.client_id
        WHERE o.id = %s
    ''', (oid,))
    order = cur.fetchone()

    if not order:
        cur.close(); db.close()
        return jsonify({'error': 'Orden no encontrada'}), 404

    if session.get('role') == 'usuario' and order['created_by'] != session.get('user_id'):
        cur.close(); db.close()
        return jsonify({'error': 'Acceso denegado: no puedes generar documentos de esta orden'}), 403

    cur.execute('''
        SELECT
            oi.*,
            cm.name AS method_name, cm.area, cm.magnitude, cm.tariff,
            cm.procedure_code, cm.icon, cm.image_base64, cm.procedure_description
        FROM order_instruments oi
        JOIN catalog_methods cm ON cm.id = oi.method_id
        WHERE oi.order_id = %s
        ORDER BY oi.sort_order, oi.id
    ''', (oid,))
    instruments = cur.fetchall()

    quote_methods_dict = {}

    for instr in instruments:
        instr['tariff'] = float(instr['tariff'])
        instr['subtotal'] = float(instr['subtotal'])
        cur.execute(
            'SELECT point_label FROM instrument_points WHERE instrument_id = %s',
            (instr['id'],)
        )
        instr['selected_points'] = [r['point_label'] for r in cur.fetchall()]

        if instr['method_id'] not in quote_methods_dict:
            quote_methods_dict[instr['method_id']] = {
                'name': instr['method_name'],
                'image_base64': instr['image_base64'],
                'procedure_description': instr['procedure_description']
            }

    quote_methods = list(quote_methods_dict.values())

    subtotal = sum(i['subtotal'] for i in instruments)
    igv = subtotal * 0.18
    total = subtotal + igv

    def _numero_a_letras(numero):
        parte_entera = int(numero)
        parte_decimal = int(round((numero - parte_entera) * 100))
        return f"{parte_entera} y {parte_decimal:02d}/100 SOLES"

    # Cargar settings globales
    cur.execute('SELECT key, value FROM settings')
    settings_dict = {r['key']: r['value'] for r in cur.fetchall()}

    client = {
        'empresa':   order['empresa'],
        'ruc':       order['ruc'],
        'contacto':  order['contacto'],
        'email':     order['email'],
        'telefono':  order['telefono'],
        'direccion': order['direccion']
    }

    base_no = order['order_no']
    if doc_type == 'constancia':
        doc_label = 'Constancia de Ingreso'
        doc_no = f"CI-{base_no}"
    else:
        doc_label = 'Cotización'
        doc_no = f"COT-{base_no}"

    fecha = order['created_at'].strftime('%d de %B, %Y') if hasattr(order['created_at'], 'strftime') else str(order['created_at'])[:10]

    cur2 = db.cursor()
    cur2.execute(
        'INSERT INTO documents (order_id, doc_type, doc_number, generated_by) '
        'VALUES (%s, %s, %s, %s) RETURNING id',
        (oid, doc_type, doc_no, session['user_id'])
    )
    doc_id = cur2.fetchone()[0]
    
    if order['created_by'] != session['user_id']:
        crear_notif(cur2, order['created_by'], 'documento',
                    f'{doc_label} PDF generada: {base_no}',
                    f'Por {session["nombre"]}', base_no)
    db.commit()
    cur.close(); cur2.close(); db.close()

    logo_val = settings_dict.get('logo_url', '')
    if not logo_val or logo_val.startswith('/static/') or logo_val == 'logo.jpg':
        try:
            logo_path = os.path.join(current_app.root_path, 'static', 'logo.jpg')
            with open(logo_path, 'rb') as f:
                settings_dict['logo_url'] = 'data:image/jpeg;base64,' + base64.b64encode(f.read()).decode('utf-8')
        except Exception as e:
            pass

    html_str = render_template(
        'pdf_document.html',
        order=order, instruments=instruments, client=client, doc_type=doc_type,
        doc_label=doc_label, doc_number=doc_no, fecha=fecha, subtotal=subtotal,
        igv=igv, total=total, monto_letras=_numero_a_letras(total),
        settings=settings_dict, quote_methods=quote_methods
    )

    footer_text = settings_dict.get('pdf_footer', 'Laboratorio de Metrología')
    footer_html = f"""
    <div style="font-size: 8px; color: #888; font-family: sans-serif; width: 100%; display: flex; justify-content: space-between; padding: 0 12mm;">
      <span>{footer_text}</span>
      <span>Pág. <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>
    """

    if request.method == 'POST' or request.args.get('async'):
        socketio.start_background_task(
            generate_pdf_worker,
            current_app._get_current_object(),
            html_str, doc_id, session['user_id'], doc_label, base_no, footer_html
        )
        return jsonify({'ok': True, 'msg': f'Generando {doc_label} en segundo plano...'})
    else:
        # Fallback sincrono para GET normal
        with pdf_semaphore:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                page = browser.new_page()
                page.set_content(html_str)
                pdf_bytes = page.pdf(
                    format="A4", print_background=True, display_header_footer=True,
                    header_template="<span></span>", footer_template=footer_html,
                    margin={"top": "10mm", "bottom": "14mm", "left": "12mm", "right": "12mm"}
                )
                browser.close()
            
            # Guardamos la copia síncrona en DB también
            db = get_db(); cur = db.cursor()
            cur.execute('UPDATE documents SET file_data = %s WHERE id = %s', (pdf_bytes, doc_id))
            db.commit(); cur.close(); db.close()

        filename = f'{doc_type}-{base_no}.pdf'
        response = make_response(pdf_bytes)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
        response.headers['Content-Length'] = len(pdf_bytes)
        return response

@pdf_bp.route('/documents/<int:doc_id>/download')
@require_auth
def download_pdf(doc_id):
    db = get_db()
    cur = db.cursor(dictionary=True)
    cur.execute('''
        SELECT d.doc_type, d.doc_number, d.file_data, o.created_by 
        FROM documents d
        JOIN work_orders o ON d.order_id = o.id
        WHERE d.id = %s
    ''', (doc_id,))
    doc = cur.fetchone()
    cur.close(); db.close()
    
    if not doc or not doc['file_data']:
        return "Documento no encontrado o aún generándose", 404

    if session.get('role') == 'usuario' and doc['created_by'] != session.get('user_id'):
        return "Acceso denegado: no tienes permiso para descargar este documento", 403

    filename = f"{doc['doc_type']}-{doc['doc_number'].replace('/', '-')}.pdf"
    response = make_response(bytes(doc['file_data']))
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = f'attachment; filename="{filename}"'
    response.headers['Content-Length'] = len(doc['file_data'])
    return response
