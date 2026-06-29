# backend/controladores/importacion_controller.py
from flask import Blueprint, jsonify, request
import csv
import json
import io
# Importación consistente con la arquitectura del ecosistema TechTrack
from config import Conexion

# Creamos el Blueprint con la semántica de la quinta vista
importacion_bp = Blueprint('importacion_modulo', __name__)

@importacion_bp.route('/ejecutar', methods=['POST'])
def importar_datos_masivos():
    """Recibe un archivo (CSV/JSON), la tabla destino y la estrategia ante duplicados"""
    
    # 🛡️ Control preliminar: Verificar que exista el archivo en la petición multiparte
    if 'file' not in request.files:
        return jsonify({"error": "No se ha adjuntado ningún archivo en la solicitud."}), 400
        
    archivo = request.files['file']
    target_table = request.form.get('target_table', 'activos').strip()
    strategy = request.form.get('strategy', 'ignore').strip()

    if archivo.filename == '':
        return jsonify({"error": "El archivo adjuntado no posee un nombre válido."}), 400

    # Determinar extensión del archivo subido
    extension = archivo.filename.split('.').pop().lower()
    registros = []

    # Parsear el stream del buffer binario de Flask según corresponda
    try:
        if extension == 'csv':
            stream = io.StringIO(archivo.stream.read().decode("UTF-8"), newline=None)
            lector_csv = csv.DictReader(stream)
            registros = [fila for fila in lector_csv]
        elif extension == 'json':
            registros = json.loads(archivo.stream.read().decode("UTF-8"))
        else:
            return jsonify({"error": "Extensión no soportada. Use únicamente .csv o .json"}), 400
    except Exception as e:
        print(f"❌ [PARSE FILE ERROR]: {str(e)}")
        return jsonify({"error": f"Error al procesar la estructura interna del archivo: {str(e)}"}), 400

    if not registros:
        return jsonify({"error": "El archivo se encuentra completamente vacío."}), 400

    # Conexión centralizada e inicio del bloque transaccional
    db = Conexion.conectar()
    cursor = db.cursor()
    
    registros_procesados = 0
    registros_omitidos = 0

    try:
        # =====================================================================
        # 1. INGESTA EN TABLA: ACTIVOS (Resuelve la jerarquía del catálogo)
        # =====================================================================
        if target_table == 'activos':
            for r in registros:
                nombre_modelo = r.get('nombre_modelo')
                categoria = r.get('categoria', 'Dispositivos Tech')
                ubicacion = r.get('ubicacion_fisica', 'Almacén Central')
                numero_serie = r.get('numero_serie')
                estado = r.get('estado', 'disponible')

                if not nombre_modelo or not numero_serie:
                    registros_omitidos += 1
                    continue

                # Paso A: Garantizar la existencia del modelo general
                query_modelo = """
                    INSERT INTO modelos_activos (nombre, categoria, ubicacion_fisica)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (nombre) DO UPDATE SET categoria = EXCLUDED.categoria
                    RETURNING id;
                """
                cursor.execute(query_modelo, (nombre_modelo, categoria, ubicacion))
                modelo_id = cursor.fetchone()[0]

                # Paso B: Insertar la unidad física con su número de serie
                if strategy == 'update':
                    query_activo = """
                        INSERT INTO activos_individuales (modelo_id, numero_serie, estado)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (numero_serie) DO UPDATE 
                        SET estado = EXCLUDED.estado, updated_at = CURRENT_TIMESTAMP;
                    """
                else:  # 'ignore'
                    query_activo = """
                        INSERT INTO activos_individuales (modelo_id, numero_serie, estado)
                        VALUES (%s, %s, %s)
                        ON CONFLICT (numero_serie) DO NOTHING;
                    """
                
                cursor.execute(query_activo, (modelo_id, numero_serie, estado))
                
                # Si el ON CONFLICT DO NOTHING saltó, rowcount será 0
                if cursor.rowcount == 0:
                    registros_omitidos += 1
                else:
                    registros_procesados += 1

        # =====================================================================
        # 2. INGESTA EN TABLA: REGISTRO DE USUARIOS
        # =====================================================================
        elif target_table == 'usuarios':
            for r in registros:
                usuario = r.get('usuario')
                nombre = r.get('nombre')
                password = r.get('password', 'user123')
                rol = r.get('rol', 'operador')
                aprobado = str(r.get('aprobado', 'false')).lower() in ['true', '1', 'yes']

                if not usuario or not nombre:
                    registros_omitidos += 1
                    continue

                if strategy == 'update':
                    query_usuario = """
                        INSERT INTO usuarios (usuario, nombre, password, rol, aprobado)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (usuario) DO UPDATE 
                        SET nombre = EXCLUDED.nombre, rol = EXCLUDED.rol, aprobado = EXCLUDED.aprobado;
                    """
                else:  # 'ignore'
                    query_usuario = """
                        INSERT INTO usuarios (usuario, nombre, password, rol, aprobado)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (usuario) DO NOTHING;
                    """

                cursor.execute(query_usuario, (usuario, nombre, password, rol, aprobado))
                
                if cursor.rowcount == 0:
                    registros_omitidos += 1
                else:
                    registros_procesados += 1

        else:
            return jsonify({"error": f"La entidad '{target_table}' no está mapeada para importaciones."}), 400

        # Si todo el bucle finaliza sin excepciones, confirmamos la transacción atómica
        db.commit()
        
        return jsonify({
            "mensaje": "Sincronización masiva de base de datos exitosa.",
            "registros_ingresados": registros_procesados,
            "registros_omitidos_o_conflictos": registros_omitidos
        }), 200

    except Exception as e:
        db.rollback()  # 🛡️ Garantía: Si falla una fila, revierte todo para evitar corrupción parcial
        print(f"❌ [FALLO EN TRANSACCIÓN INGESTA]: {str(e)}")
        return jsonify({"error": f"Fallo crítico transaccional: {str(e)}"}), 500
    finally:
        cursor.close()
        db.close()