import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from controladores.auth_controller import auth_bp
from controladores.activos_controller import activos_bp
from controladores.prestamos_controller import prestamos_bp
from controladores.dashboard_controller import dashboard_bp
from controladores.auditoria_controller import auditoria_bp
from config import Conexion  # Tu clase de conexión que maneja PostgreSQL
from controladores.importacion_controller import importacion_bp
import psycopg2.extras

app = Flask(__name__)

# 🚀 Detectamos si estamos en producción (Docker) o local
if os.getenv('FLASK_ENV') == 'production':
    # En producción con Nginx, el origen puede ser el mismo dominio o cualquier IP pública
    origenes_permitidos = ["*"] 
else:
    # Tus orígenes locales de Live Server
    origenes_permitidos = ["http://127.0.0.1:5500", "http://localhost:5500"]

CORS(app, resources={
    r"/api/*": {
        "origins": origenes_permitidos,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization", "Access-Control-Allow-Headers"],
        "supports_credentials": True
    }
})

# Registrar todos los blueprints con sus prefijos de ruta
app.register_blueprint(auth_bp,      url_prefix='/api/auth')
app.register_blueprint(activos_bp,   url_prefix='/api/activos')
app.register_blueprint(prestamos_bp, url_prefix='/api/prestamos')
app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
app.register_blueprint(auditoria_bp, url_prefix='/api/auditoria')
app.register_blueprint(importacion_bp, url_prefix='/api/importacion')

def _obtener_cursor_seguro():
    """
    Inspecciona la clase Conexion de forma dinámica para extraer el cursor de PostgreSQL
    """
    for metodo_nombre in ['obtener_conexion', 'conectar', 'get_connection', 'get_conn']:
        if hasattr(Conexion, metodo_nombre):
            metodo = getattr(Conexion, metodo_nombre)
            try:
                if callable(metodo):
                    res = metodo()
                    if hasattr(res, 'cursor'): return res.cursor()
            except:
                continue

    instancia = Conexion()
    
    for atributo in ['conexion', 'conn', '_conexion', '_conn', 'db']:
        if hasattr(instancia, atributo):
            obj = getattr(instancia, atributo)
            if hasattr(obj, 'cursor'): return obj.cursor()
                
    for metodo_nombre in ['obtener_conexion', 'conectar', 'get_connection', 'cursor']:
        if hasattr(instancia, metodo_nombre):
            metodo = getattr(instancia, metodo_nombre)
            try:
                if callable(metodo):
                    res = metodo()
                    if metodo_nombre == 'cursor': return res
                    if hasattr(res, 'cursor'): return res.cursor()
            except:
                continue

    if hasattr(instancia, 'cursor') and callable(getattr(instancia, 'cursor')):
        return instancia.cursor()
        
    raise RuntimeError("No se pudo mapear el cursor desde la clase Conexion. Revisa la estructura de config.py")

# =========================================================================
# FUNCIÓN AUXILIAR DE AUDITORÍA DESDE FLASK
# =========================================================================
def registrar_auditoria_flask(cursor, activo_individual_id, accion, detalles):
    """
    Inserta manualmente una fila en la tabla de auditoria_movimientos 
    capturando el usuario actual y la IP real desde el request de Flask.
    """
    try:
        # 1. Capturar la IP real del cliente
        ip_origen = request.headers.get('X-Forwarded-For', request.remote_addr)
        if ip_origen and ',' in ip_origen:
            ip_origen = ip_origen.split(',')[0].strip()
        
        # 2. Capturar el ID del usuario actual (ajústalo a tu sistema de auth, ej: request.user_id o desde headers)
        usuario_id = getattr(request, 'user_id', None)
        if not usuario_id:
            usuario_id = request.headers.get('X-User-Id', None) # Alternativa temporal si no usas middlewares

        # 3. Buscar ubicación física del activo de forma dinámica para el reporte
        v_ubicacion = 'Laboratorio / Almacén Central'
        if activo_individual_id:
            query_ub = """
                SELECT m.ubicacion_fisica FROM modelos_activos m
                JOIN activos_individuales ai ON m.id = ai.modelo_id
                WHERE ai.id = %s LIMIT 1;
            """
            cursor.execute(query_ub, (activo_individual_id,))
            res_ub = cursor.fetchone()
            if res_ub:
                v_ubicacion = res_ub[0]

        # 4. Insertar en tu tabla de auditoría original
        query_audit = """
            INSERT INTO auditoria_movimientos (activo_individual_id, usuario_id, accion, detalles, ubicacion, ip_origen)
            VALUES (%s, %s, %s, %s, %s, %s);
        """
        cursor.execute(query_audit, (activo_individual_id, usuario_id, accion, detalles, v_ubicacion, ip_origen or '127.0.0.1'))
    except Exception as audit_err:
        # Evitamos que un fallo al escribir la bitácora rompa la operación principal, sólo lo printeamos
        print(f"⚠️ Error registrando auditoría en Flask: {str(audit_err)}")


@app.route('/api/health')
def health():
    return {'status': 'ok', 'mensaje': 'Backend corriendo correctamente'}, 200

# =========================================================================
# VISTA PÚBLICA DEL CARRUSEL: DISPOSITIVOS AGRUPADOS POR MODELO
# =========================================================================
@app.route('/api/public/carrusel', methods=['GET'])
def obtener_carrusel_publico():
    try:
        cursor = _obtener_cursor_seguro()
        query = """
            SELECT 
                m.id AS modelo_id,
                m.nombre AS activo_nombre,
                m.categoria,
                m.ubicacion_fisica,
                m.imagen_url,
                COUNT(a.id) AS total_existencias,
                COUNT(CASE WHEN a.estado = 'disponible' THEN 1 END) AS disponibles
            FROM modelos_activos m
            LEFT JOIN activos_individuales a ON m.id = a.modelo_id
            GROUP BY m.id, m.nombre, m.categoria, m.ubicacion_fisica, m.imagen_url
            ORDER BY m.nombre ASC;
        """
        cursor.execute(query)
        filas = cursor.fetchall()
        columnas = [desc[0] for desc in cursor.description]
        
        resultados = [dict(zip(columnas, row)) for row in filas]
        cursor.close()
        return jsonify(resultados), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =========================================================================
# GESTIÓN DE CATEGORÍAS
# =========================================================================
@app.route('/api/activos/categorias', methods=['GET'])
def obtener_categorias_unicas():
    try:
        cursor = _obtener_cursor_seguro()
        query = "SELECT DISTINCT categoria FROM modelos_activos WHERE categoria IS NOT NULL ORDER BY categoria ASC;"
        cursor.execute(query)
        categorias = [row[0] for row in cursor.fetchall()]
        cursor.close()
        return jsonify(categorias), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# =========================================================================
# MÓDULO DE MANTENIMIENTOS
# =========================================================================
@app.route('/api/mantenimientos', methods=['GET'])
def obtener_mantenimientos_activos():
    try:
        cursor = _obtener_cursor_seguro()
        query = """
            SELECT 
                m.id AS mantenimiento_id, 
                m.activo_individual_id, 
                m.descripcion_falla, 
                m.tecnico_responsable, 
                CAST(m.costo AS FLOAT) as costo, 
                m.fecha_inicio,
                m.fecha_fin,
                ai.numero_serie, 
                ai.estado AS estado_actual_serial,
                ma.nombre AS activo_nombre, 
                ma.categoria, 
                ma.ubicacion_fisica
            FROM mantenimientos m
            JOIN activos_individuales ai ON m.activo_individual_id = ai.id
            JOIN modelos_activos ma ON ai.modelo_id = ma.id
            WHERE m.fecha_fin IS NULL;
        """
        cursor.execute(query)
        filas = cursor.fetchall()
        
        columnas = [desc[0] for desc in cursor.description]
        resultados = []
        for row in filas:
            reg = dict(zip(columnas, row))
            if reg.get('fecha_inicio') and hasattr(reg['fecha_inicio'], 'strftime'):
                reg['fecha_inicio'] = reg['fecha_inicio'].strftime('%Y-%m-%d %H:%M:%S')
            resultados.append(reg)
        
        cursor.close()
        return jsonify(resultados), 200
    except Exception as e:
        return jsonify({"error_back": str(e)}), 500

@app.route('/api/mantenimientos', methods=['POST'])
def registrar_mantenimiento():
    try:
        data = request.json
        cursor = _obtener_cursor_seguro()
        conn = cursor.connection
        
        # 1. Insertar reporte en la bitácora de mantenimientos
        query_maint = """
            INSERT INTO mantenimientos (activo_individual_id, descripcion_falla, tecnico_responsable, costo)
            VALUES (%s, %s, %s, %s);
        """
        cursor.execute(query_maint, (data['activo_individual_id'], data['descripcion_falla'], data['tecnico_responsable'], data['costo']))
        
        # 2. Mover el estado de la pieza física específica a 'mantenimiento'
        query_asset = "UPDATE activos_individuales SET estado = 'mantenimiento' WHERE id = %s;"
        cursor.execute(query_asset, (data['activo_individual_id'],))
        
        # ---> !NUEVO: Guardar Auditoría detallada desde Flask con IP y Usuario Real
        detalles_log = f"Registro de mantenimiento preventivo/correctivo. Falla: {data['descripcion_falla']}. Técnico: {data['tecnico_responsable']}"
        registrar_auditoria_flask(cursor, data['activo_individual_id'], 'APP_REGISTRO_MANTENIMIENTO', detalles_log)
        
        conn.commit()
        cursor.close()
        return jsonify({"success": True}), 201
    except Exception as e:
        if 'conn' in locals(): conn.rollback()
        return jsonify({"error": str(e)}), 500

@app.route('/api/mantenimientos/cerrar/<int:id>', methods=['PUT'])
def cerrar_mantenimiento_orden(id):
    try:
        data = request.json
        cursor = _obtener_cursor_seguro()
        conn = cursor.connection
        
        # 1. Marcar fecha_fin y costo definitivo en mantenimientos
        query_maint = """
            UPDATE mantenimientos 
            SET fecha_fin = CURRENT_TIMESTAMP, costo = %s 
            WHERE id = %s RETURNING activo_individual_id;
        """
        cursor.execute(query_maint, (data['costo_final'], id))
        activo_individual_id = cursor.fetchone()[0]
        
        # 2. Devolver el activo físico al estado deseado
        nuevo_estado = data.get('estado_destino', 'disponible')
        query_asset = "UPDATE activos_individuales SET estado = %s WHERE id = %s;"
        cursor.execute(query_asset, (nuevo_estado, activo_individual_id))
        
        # ---> !NUEVO: Guardar Auditoría detallada desde Flask al cerrar la orden
        detalles_log = f"Orden de mantenimiento #{id} cerrada. Costo final: ${data['costo_final']}. Estado de retorno: {nuevo_estado}"
        registrar_auditoria_flask(cursor, activo_individual_id, 'APP_CIERRE_MANTENIMIENTO', detalles_log)
        
        conn.commit()
        cursor.close()
        return jsonify({"success": True}), 200
    except Exception as e:
        if 'conn' in locals(): conn.rollback()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    if hasattr(Conexion, 'inicializar_base_de_datos'):
        Conexion.inicializar_base_de_datos()
    app.run(host='0.0.0.0', port=5000, debug=True)