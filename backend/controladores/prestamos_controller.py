from flask import Blueprint, request, jsonify
from modelos.prestamo import Prestamo
from config import Conexion

prestamos_bp = Blueprint('prestamos', __name__)

# ── GET /api/prestamos ────────────────────────────────────────────────────────
@prestamos_bp.route('', methods=['GET'])
def listar():
    try:
        usuario_id = request.args.get('usuario_id', type=int)
        prestamos = Prestamo.obtener_por_operador(usuario_id) if usuario_id else Prestamo.obtener_todos()
        return jsonify(prestamos), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── POST /api/prestamos ───────────────────────────────────────────────────────
@prestamos_bp.route('', methods=['POST'])
def crear():
    datos = request.get_json(silent=True) or {}
    campos = ['activo_individual_id', 'usuario_operador_id', 'solicitante_matricula', 'fecha_devolucion_prevista']
    for c in campos:
        if not datos.get(c):
            return jsonify({"error": f"El campo '{c}' es requerido."}), 400

    ip_origen = request.remote_addr
    activo_id = datos['activo_individual_id']
    usuario_id = datos['usuario_operador_id']

    try:
        # 1. Crear el préstamo
        nuevo_id = Prestamo.crear(
            activo_individual_id=activo_id,
            usuario_operador_id=usuario_id,
            solicitante_matricula=datos['solicitante_matricula'],
            fecha_devolucion_prevista=datos['fecha_devolucion_prevista']
        )

        # 2. 📝 LOG DE AUDITORÍA: Salida de activo
        db = Conexion.conectar()
        cursor = db.cursor()
        cursor.execute("""
            INSERT INTO auditoria_movimientos 
                (activo_individual_id, usuario_id, accion, detalles, ubicacion, ip_origen, fecha_registro)
            VALUES (%s, %s, 'PRESTAMO_SALIDA', %s, 'Ventanilla de Activos', %s, CURRENT_TIMESTAMP);
        """, (activo_id, usuario_id, f"Préstamo otorgado a matrícula: {datos['solicitante_matricula']}", ip_origen))
        db.commit()
        cursor.close()
        db.close()

        return jsonify({"success": True, "id": nuevo_id}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── PUT /api/prestamos/<id>/devolver ─────────────────────────────────────────
@prestamos_bp.route('/<int:prestamo_id>/devolver', methods=['PUT'])
def devolver(prestamo_id):
    datos = request.get_json(silent=True) or {}
    usuario_id = datos.get('usuario_id', 1)
    checklist = datos.get('estado_retorno', 'Sin observaciones')
    ip_origen = request.remote_addr

    try:
        # 1. Obtener ID del activo antes de cerrar el préstamo para el log
        db = Conexion.conectar()
        cursor = db.cursor()
        cursor.execute("SELECT activo_individual_id FROM prestamos WHERE id = %s", (prestamo_id,))
        res = cursor.fetchone()
        activo_id = res[0] if res else None

        # 2. Registrar devolución
        Prestamo.registrar_devolucion(prestamo_id, checklist, usuario_id)

        # 3. 📝 LOG DE AUDITORÍA: Retorno de activo
        if activo_id:
            cursor.execute("""
                INSERT INTO auditoria_movimientos 
                    (activo_individual_id, usuario_id, accion, detalles, ubicacion, ip_origen, fecha_registro)
                VALUES (%s, %s, 'PRESTAMO_RETORNO', %s, 'Ventanilla de Activos', %s, CURRENT_TIMESTAMP);
            """, (activo_id, usuario_id, f"Devolución recibida. Checklist: {checklist}", ip_origen))
            db.commit()
        
        cursor.close()
        db.close()
        
        return jsonify({"success": True}), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500