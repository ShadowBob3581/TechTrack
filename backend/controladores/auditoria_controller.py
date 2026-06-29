# backend/controladores/auditoria_controller.py
from flask import Blueprint, jsonify, request
# Importación consistente con activos_controller
from config import Conexion

# Creamos el Blueprint con la semántica correcta de auditoría
auditoria_bp = Blueprint('auditoria_modulo', __name__)

@auditoria_bp.route('/logs', methods=['GET'])
def obtener_logs_periciales():
    """Retorna los registros de la caja negra formateados para auditoria.js"""
    
    db = Conexion.conectar()
    cursor = db.cursor()
    try:
        # 🚀 MODIFICACIÓN: Añadimos a.ubicacion y a.ip_origen a la consulta SQL
        query = """
            SELECT 
                a.fecha_registro,
                COALESCE(u.nombre, 'Sistema / Trigger') as usuario_nombre,
                COALESCE(u.rol::text, 'automático') as usuario_rol,
                a.accion,
                a.detalles,
                m.nombre as activo_nombre,
                a.ubicacion,
                a.ip_origen
            FROM auditoria_movimientos a
            LEFT JOIN usuarios u ON a.usuario_id = u.id
            LEFT JOIN activos_individuales act ON a.activo_individual_id = act.id
            LEFT JOIN modelos_activos m ON act.modelo_id = m.id
            ORDER BY a.fecha_registro DESC;
        """
        cursor.execute(query)
        filas = cursor.fetchall()
        
        payload = []
        for row in filas:
            fecha_cruda = row[0]
            # Formato ISO que tu JS procesará con el .replace('T', ' ')
            fecha_iso = fecha_cruda.isoformat() if hasattr(fecha_cruda, 'isoformat') else str(fecha_cruda)
            
            # Mapeamos limpiamente cada columna de la base de datos a su propiedad del JSON
            payload.append({
                "fecha_registro": fecha_iso,
                "usuario_nombre": row[1],
                "usuario_rol": row[2],
                "accion": row[3],
                "detalles": row[4],
                "activo_nombre": row[5] or "Inventario General",
                "ubicacion": row[6],   # 📍 Nueva propiedad enviada al JS
                "ip_origen": row[7]     # 🌐 Nueva propiedad enviada al JS (IP real)
            })
            
        return jsonify(payload), 200

    except Exception as e:
        print(f"❌ [ERROR CAJA NEGRA]: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        db.close()