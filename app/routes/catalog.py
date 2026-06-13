"""
Rutas del catálogo de métodos acreditados.

Endpoints:
    GET    /api/catalog        — listar métodos con sus puntos
    POST   /api/catalog        — crear método    (admin)
    PUT    /api/catalog/<id>   — actualizar método (admin)
    DELETE /api/catalog/<id>   — desactivar método (admin)
"""
from datetime import datetime
from flask    import Blueprint, request, session, jsonify
from ..database   import get_db
from ..utils.auth import require_auth, require_role, serial
from ..utils.notif import notif_a_roles, notif_todos_usuarios

catalog_bp = Blueprint('catalog', __name__)


@catalog_bp.route('/catalog')
@require_auth
def get_catalog():
    from ..utils.auth import has_admin_rights
    is_admin = has_admin_rights(session['role'])
    show_all = request.args.get('all') == '1'

    db  = get_db()
    cur = db.cursor(dictionary=True)
    
    where_clause = "" if (is_admin and show_all) else "WHERE m.active = 1"

    cur.execute(f'''
        SELECT
            m.id, m.code, m.name, m.area, m.magnitude, m.icon,
            m.tariff, m.note, m.procedure_code,
            m.procedure_description, m.is_nominal, m.active, m.image_base64,
            STRING_AGG(p.point_label,    '||' ORDER BY p.sort_order) AS pts,
            STRING_AGG(COALESCE(p.uncertainty, ''), '||' ORDER BY p.sort_order) AS unc
        FROM catalog_methods m
        LEFT JOIN calibration_points p ON p.method_id = m.id
        {where_clause}
        GROUP BY m.id
        ORDER BY m.area, m.name
    ''')
    rows = cur.fetchall()
    cur.close(); db.close()

    result = []
    for m in rows:
        m['tariff']            = float(m['tariff'])
        m['is_nominal']        = bool(m['is_nominal'])
        m['points']            = m['pts'].split('||') if m['pts'] else []
        m['uncertainties']     = m['unc'].split('||') if m['unc'] else []
        del m['pts'], m['unc']
        result.append(m)

    return jsonify(serial(result))


@catalog_bp.route('/catalog', methods=['POST'])
@require_role('admin')
def add_method():
    data   = request.get_json() or {}
    name   = data.get('name', '').strip()
    area   = data.get('area', '').strip()
    mag    = data.get('magnitude', area)
    icon   = data.get('icon', 'gauge')
    tariff = float(data.get('tariff', 0))
    note   = data.get('note', '')
    proc   = data.get('procedure_code', '')
    desc   = data.get('procedure_description', '')
    nom    = int(data.get('is_nominal', 0))
    img    = data.get('image_base64', '')
    points = data.get('points', [])

    if not name or not points:
        return jsonify({'error': 'Nombre y puntos son requeridos'}), 400

    ts   = str(int(datetime.now().timestamp()))[-4:]
    code = name.lower().replace(' ', '-')[:16].strip('-') + '-' + ts

    db  = get_db(); cur = db.cursor()
    cur.execute(
        '''INSERT INTO catalog_methods
               (code, name, area, magnitude, icon, tariff, note,
                procedure_code, procedure_description, is_nominal, image_base64, updated_by)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
           RETURNING id''',
        (code, name, area, mag, icon, tariff, note, proc, desc, nom, img, session['user_id'])
    )
    mid = cur.fetchone()[0]

    for i, pt in enumerate(points):
        lbl = pt.get('label', pt) if isinstance(pt, dict) else str(pt)
        unc = pt.get('uncertainty', '') if isinstance(pt, dict) else ''
        cur.execute(
            'INSERT INTO calibration_points (method_id, point_label, uncertainty, sort_order) '
            'VALUES (%s,%s,%s,%s)',
            (mid, lbl, unc, i + 1)
        )

    # Notificar a TODOS los usuarios del sistema sobre cambio en catálogo
    notif_a_roles(
        db, ['usuario'], 'catalogo',
        f'Catálogo acreditado actualizado: nuevo método',
        f'«{name}» — Área: {area} · Tarifa: S/ {tariff:.2f} por punto',
        excluir_uid=session['user_id']
    )
    db.commit(); cur.close(); db.close()
    return jsonify({'id': mid, 'code': code}), 201


@catalog_bp.route('/catalog/<int:mid>', methods=['PUT'])
@require_role('admin')
def update_method(mid):
    data = request.get_json() or {}
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute(
            '''UPDATE catalog_methods
               SET name=%s, area=%s, magnitude=%s, icon=%s, tariff=%s, note=%s,
                   procedure_code=%s, procedure_description=%s, is_nominal=%s,
                   image_base64=%s, updated_by=%s
               WHERE id=%s''',
            (data.get('name'), data.get('area'),
             data.get('magnitude', data.get('area')),
             data.get('icon', 'gauge'), float(data.get('tariff', 0)),
             data.get('note', ''),
             data.get('procedure_code', ''),
             data.get('procedure_description', ''),
             int(data.get('is_nominal', 0)),
             data.get('image_base64', ''),
             session['user_id'], mid)
        )
        cur.execute('DELETE FROM calibration_points WHERE method_id = %s', (mid,))
        for i, pt in enumerate(data.get('points', [])):
            lbl = pt.get('label', pt) if isinstance(pt, dict) else str(pt)
            unc = pt.get('uncertainty', '') if isinstance(pt, dict) else ''
            cur.execute(
                'INSERT INTO calibration_points (method_id, point_label, uncertainty, sort_order)'
                ' VALUES (%s,%s,%s,%s)', (mid, lbl, unc, i + 1)
            )
        db.commit()   # liberar lock antes de notificar
        cur.close()
        cur2 = db.cursor(dictionary=True)
        cur2.execute('SELECT name, area FROM catalog_methods WHERE id = %s', (mid,))
        m = cur2.fetchone(); cur2.close()
        if m:
            notif_a_roles(
                db, ['usuario'], 'catalogo',
                'Catalogo acreditado actualizado',
                'Metodo ' + m['name'] + ' (Area: ' + m['area'] + ') fue modificado por el administrador.',
                excluir_uid=session['user_id']
            )
            db.commit()
    except Exception as exc:
        try: db.rollback()
        except Exception: pass
        return jsonify({'error': str(exc)}), 500
    finally:
        try: db.close()
        except Exception: pass
    return jsonify({'ok': True})


@catalog_bp.route('/catalog/<int:mid>', methods=['PATCH'])
@require_auth
def patch_method(mid):
    from ..utils.auth import has_admin_rights
    if not has_admin_rights(session['role']):
        return jsonify({'error': 'Sin permisos'}), 403
    data = request.get_json() or {}
    if 'active' not in data:
        return jsonify({'error': 'Campo no soportado'}), 400
    active = 1 if data['active'] else 0
    db = get_db(); cur = db.cursor()
    try:
        cur.execute('UPDATE catalog_methods SET active = %s WHERE id = %s', (active, mid))
        db.commit(); cur.close()
        cur2 = db.cursor(dictionary=True)
        cur2.execute('SELECT name FROM catalog_methods WHERE id = %s', (mid,))
        m = cur2.fetchone(); cur2.close()
        if m:
            estado = 'activado' if active else 'desactivado'
            notif_a_roles(
                db, ['usuario'], 'catalogo',
                'Catalogo acreditado actualizado',
                'Metodo ' + m['name'] + ' ha sido ' + estado + ' en el catalogo acreditado.',
                excluir_uid=session['user_id']
            )
            db.commit()
    except Exception as exc:
        try: db.rollback()
        except Exception: pass
        return jsonify({'error': str(exc)}), 500
    finally:
        try: db.close()
        except Exception: pass
    return jsonify({'ok': True})


@catalog_bp.route('/catalog/<int:mid>', methods=['DELETE'])
@require_role('admin')
def delete_method(mid):
    db  = get_db(); cur = db.cursor()
    cur.execute('UPDATE catalog_methods SET active = 0 WHERE id = %s', (mid,))
    db.commit(); cur.close(); db.close()
    return jsonify({'ok': True})
