from flask import Blueprint, request, jsonify
from modelos.activo import Activo
# Importamos tu clase o módulo de conexión para registrar los movimientos extendidos
from config import Conexion 

activos_bp = Blueprint('activos', __name__)

# ── GET /api/activos ─────────────────────────────────────────────────────────
@activos_bp.route('', methods=['GET'])
def listar():
    try:
        activos = Activo.obtener_todos()
        return jsonify(activos), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── GET /api/activos/categorias ──────────────────────────────────────────────
@activos_bp.route('/categorias', methods=['GET'])
def obtener_categorias():
    try:
        categorias = Activo.obtener_categorias_unicas()
        return jsonify(categorias), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── POST /api/activos/bulk ───────────────────────────────────────────────────
@activos_bp.route('/bulk', methods=['POST'])
def carga_masiva_bulk():
    lote = request.get_json(silent=True) or []
    if not isinstance(lote, list) or len(lote) == 0:
        return jsonify({"error": "El lote de datos está vacío o es inválido."}), 400

    ip_origen = request.remote_addr  # 🌐 Rastrear IP de origen
    db = Conexion.conectar()
    cursor = db.cursor()

    try:
        usuario_id = lote[0].get('usuario_id', 1)  # 👤 Quién lo hizo
        insertados = 0
        
        for item in lote:
            if not item.get('nombre') or not item.get('numero_serie'):
                continue
                
            nuevo_id = Activo.crear(
                nombre=item['nombre'],
                categoria=item['categoria'],
                numero_serie=item['numero_serie'],
                ubicacion_fisica=item['ubicacion_fisica'],
                usuario_id=usuario_id,
                imagen_url=None,
                estado=item.get('estado', 'disponible')
            )
            insertados += 1
            
            # 📝 INSERCIÓN LIMPIA EN LAS NUEVAS COLUMNAS DE AUDITORÍA
            accion = 'ALTA_MASIVA_BULK'
            descripcion = f"Carga masiva del equipo: {item['nombre']} (S/N: {item['numero_serie']})"
            lugar = item['ubicacion_fisica'] # 📍 El lugar

            cursor.execute("""
                INSERT INTO auditoria_movimientos 
                    (activo_individual_id, usuario_id, accion, detalles, ubicacion, ip_origen, fecha_registro)
                VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP);
            """, (nuevo_id, usuario_id, accion, descripcion, lugar, ip_origen))
            
        db.commit()
        return jsonify({"success": True, "procesados": insertados}), 201
    except Exception as e:
        db.rollback()
        print(f"❌ [BULK ERROR]: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        db.close()

# ── GET /api/activos/<id> ────────────────────────────────────────────────────
@activos_bp.route('/<int:activo_id>', methods=['GET'])
def detalle(activo_id):
    activo = Activo.obtener_por_id(activo_id)
    if not activo:
        return jsonify({"error": "Activo no encontrado."}), 404
    return jsonify(activo), 200

# ── POST /api/activos ────────────────────────────────────────────────────────
@activos_bp.route('', methods=['POST'])
def crear():
    datos = request.get_json(silent=True) or {}
    campos_requeridos = ['nombre', 'categoria', 'numero_serie', 'ubicacion_fisica']
    for campo in campos_requeridos:
        if not datos.get(campo):
            return jsonify({"error": f"El campo '{campo}' es requerido."}), 400
            
    ip_origen = request.remote_addr  # 🌐 Rastrear IP de origen
    usuario_id = datos.get('usuario_id', 1)  # 👤 Quién lo hizo
    lugar = datos['ubicacion_fisica']  # 📍 El lugar

    try:
        estado_formateado = str(datos.get('estado', 'disponible')).lower()

        nuevo_id = Activo.crear(
            nombre=datos['nombre'],
            categoria=datos['categoria'],
            numero_serie=datos['numero_serie'],
            ubicacion_fisica=lugar,
            usuario_id=usuario_id,
            imagen_url=datos.get('imagen_url'),
            estado=estado_formateado
        )

        # 📝 REGISTRO EN LA TABLA DE AUDITORÍA CON SUS NUEVOS CAMPOS
        db = Conexion.conectar()
        cursor = db.cursor()
        
        accion = 'REGISTRO_ACTIVO'
        descripcion = f"Alta de activo: {datos['nombre']} con número de serie {datos['numero_serie']}."

        cursor.execute("""
            INSERT INTO auditoria_movimientos 
                (activo_individual_id, usuario_id, accion, detalles, ubicacion, ip_origen, fecha_registro)
            VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP);
        """, (nuevo_id, usuario_id, accion, descripcion, lugar, ip_origen))
        
        db.commit()
        cursor.close()
        db.close()

        return jsonify({"success": True, "id": nuevo_id}), 201
    except Exception as e:
        print(f"❌ [POST CREAR ERROR]: {str(e)}")
        return jsonify({"error": str(e)}), 500

# ── PUT /api/activos/<id> ────────────────────────────────────────────────────
@activos_bp.route('/<int:activo_id>', methods=['PUT'])
def actualizar(activo_id):
    datos = request.get_json(silent=True) or {}
    ip_origen = request.remote_addr  # 🌐 Rastrear IP de origen
    usuario_id = datos.get('usuario_id', 1)  # 👤 Quién lo hizo
    lugar = datos.get('ubicacion_fisica', 'Ubicación no alterada')  # 📍 El lugar

    try:
        ok = Activo.actualizar(activo_id, datos, usuario_id)
        if not ok:
            return jsonify({"error": "Activo no encontrado o sin cambios."}), 404

        # 📝 REGISTRO DE MODIFICACIÓN EN AUDITORÍA
        db = Conexion.conectar()
        cursor = db.cursor()
        
        accion = 'EDICION_INVENTARIO'
        descripcion = f"Se actualizaron los datos o parámetros del activo con ID: {activo_id}."

        cursor.execute("""
            INSERT INTO auditoria_movimientos 
                (activo_individual_id, usuario_id, accion, detalles, ubicacion, ip_origen, fecha_registro)
            VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP);
        """, (activo_id, usuario_id, accion, descripcion, lugar, ip_origen))
        
        db.commit()
        cursor.close()
        db.close()

        return jsonify({"success": True}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ── DELETE /api/activos/<id> ─────────────────────────────────────────────────
@activos_bp.route('/<int:activo_id>', methods=['DELETE'])
def eliminar(activo_id):
    """Baja lógica impecable vinculada al ENUM 'baja' de PostgreSQL"""
    datos = request.get_json(silent=True) or {}
    ip_origen = request.remote_addr  # 🌐 Rastrear IP de origen
    usuario_id = datos.get('usuario_id', 1)  # 👤 Quién lo hizo

    try:
        payload_baja = {"estado": "baja"}
        
        # Primero recuperamos la última ubicación conocida del activo para no perder el rastro del lugar
        activo_data = Activo.obtener_por_id(activo_id)
        lugar = activo_data.get('ubicacion_fisica', 'Almacén de Bajas') if activo_data else 'Desconocido'

        ok = Activo.actualizar(activo_id, payload_baja, usuario_id)
        if not ok:
            return jsonify({"error": "El activo tecnológico no existe."}), 404
            
        # 📝 REGISTRO DE LA BAJA LOGICA EN LA CAJA NEGRA
        db = Conexion.conectar()
        cursor = db.cursor()
        
        accion = 'BAJA_HARDWARE'
        descripcion = f"Baja lógica del sistema. Estado del activo cambiado permanentemente a 'baja'."

        cursor.execute("""
            INSERT INTO auditoria_movimientos 
                (activo_individual_id, usuario_id, accion, detalles, ubicacion, ip_origen, fecha_registro)
            VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP);
        """, (activo_id, usuario_id, accion, descripcion, lugar, ip_origen))
        
        db.commit()
        cursor.close()
        db.close()
            
        return jsonify({"success": True, "message": "Activo dado de baja en la base de datos."}), 200
    except Exception as e:
        print(f"❌ [DELETE -> UPDATE ERROR]: {str(e)}")
        return jsonify({"error": "Error interno del servidor al procesar la baja"}), 500