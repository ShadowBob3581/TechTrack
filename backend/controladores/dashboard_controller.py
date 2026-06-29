from flask import Blueprint, jsonify
# Importación consistente
from config import Conexion

dashboard_bp = Blueprint('dashboard_analitico', __name__)

@dashboard_bp.route('/metricas', methods=['GET'])
def obtener_metricas_dashboard():
    """Calcula y unifica métricas de inventario, demandas de alumnos y costos operativos"""
    db = Conexion.conectar()
    cursor = db.cursor()
    
    try:
        # 1. CÓMPUTO DE METRICAS SUPERIORES (KPIs)
        query_kpis = """
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE estado = 'disponible') as disponible,
                COUNT(*) FILTER (WHERE estado = 'prestado') as prestado,
                COUNT(*) FILTER (WHERE estado = 'mantenimiento') as mantenimiento
            FROM activos_individuales;
        """
        cursor.execute(query_kpis)
        res_kpis = cursor.fetchone()
        
        total_activos = res_kpis[0] or 0
        disponibles = res_kpis[1] or 0
        en_prestamiento = res_kpis[2] or 0
        en_mantenimiento = res_kpis[3] or 0

        # 2. GRAFICA: MODELOS MÁS SOLICITADOS
        query_demandas = """
            SELECT m.nombre, COUNT(p.id) as total_solicitudes
            FROM prestamos p
            JOIN activos_individuales a ON p.activo_individual_id = a.id
            JOIN modelos_activos m ON a.modelo_id = m.id
            GROUP BY m.nombre
            ORDER BY total_solicitudes DESC
            LIMIT 5;
        """
        cursor.execute(query_demandas)
        filas_demandas = cursor.fetchall()
        
        demandas_labels = [row[0] for row in filas_demandas]
        demandas_valores = [int(row[1]) for row in filas_demandas]

        # 3. GRAFICA: COSTOS MENSUALES
        query_costos = """
            SELECT 
                TO_CHAR(fecha_inicio, 'TMMon') as mes_texto,
                EXTRACT(MONTH FROM fecha_inicio) as mes_num,
                SUM(costo) as total_gastado
            FROM mantenimientos
            WHERE EXTRACT(YEAR FROM fecha_inicio) = 2026
            GROUP BY mes_texto, mes_num
            ORDER BY mes_num ASC;
        """
        cursor.execute(query_costos)
        filas_costos = cursor.fetchall()
        
        meses_mapeo = {1:"Ene", 2:"Feb", 3:"Mar", 4:"Abr", 5:"May", 6:"Jun", 7:"Jul", 8:"Ago", 9:"Sep", 10:"Oct", 11:"Nov", 12:"Dic"}
        costos_dict = {i: 0.00 for i in range(1, 13)}
        
        for row in filas_costos:
            mes_n = int(row[1])
            costos_dict[mes_n] = float(row[2] or 0.00)
                
        costos_meses = [meses_mapeo[m] for m in sorted(costos_dict.keys())]
        costos_valores = [costos_dict[m] for m in sorted(costos_dict.keys())]

        return jsonify({
            "activos": {"total": total_activos, "disponible": disponibles, "en_mantenimiento": en_mantenimiento},
            "prestamos": {"activos": en_prestamiento},
            "demandas": {"labels": demandas_labels, "valores": demandas_valores},
            "costos": {"meses": costos_meses, "valores": costos_valores}
        }), 200

    except Exception as e:
        print(f"❌ [ERROR DASHBOARD METRICAS]: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        db.close()

# ⏳ ENDPOINT: BITÁCORA DEL DASHBOARD CON METADATOS EXTENDIDOS
@dashboard_bp.route('/auditoria', methods=['GET'])
def obtener_auditoria_dashboard():
    """Retorna las últimas 10 acciones con ubicación e IP para el feed del dashboard"""
    db = Conexion.conectar()
    cursor = db.cursor()
    
    try:
        # 🚀 INTEGRACIÓN: Ahora incluimos ubicacion e ip_origen en la vista del dashboard
        query_auditoria = """
            SELECT 
                am.id,
                COALESCE(u.nombre, 'Sistema / Triggers') as usuario,
                am.accion,
                am.detalles,
                am.ubicacion,
                am.ip_origen,
                TO_CHAR(am.fecha_registro, 'YYYY-MM-DD HH24:MI:SS') as fecha
            FROM auditoria_movimientos am
            LEFT JOIN usuarios u ON am.usuario_id = u.id
            ORDER BY am.fecha_registro DESC
            LIMIT 10;
        """
        cursor.execute(query_auditoria)
        columnas = [desc[0] for desc in cursor.description]
        logs_auditoria = [dict(zip(columnas, row)) for row in cursor.fetchall()]
        
        return jsonify(logs_auditoria), 200

    except Exception as e:
        print(f"❌ [ERROR DASHBOARD AUDITORIA]: {str(e)}")
        return jsonify([]), 200
    finally:
        cursor.close()
        db.close()