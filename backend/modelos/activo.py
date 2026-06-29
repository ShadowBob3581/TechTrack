import psycopg2
import psycopg2.extras
from config import Conexion

class Activo:

    @staticmethod
    def obtener_todos():
        """Trae el listado maestro unificado mapeado con compatibilidad para activos.js"""
        db = Conexion.conectar()
        try:
            with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                query = """
                    SELECT 
                        ai.id AS id,
                        ai.id AS activo_individual_id,
                        ai.numero_serie,
                        ai.estado,
                        ai.created_at,
                        ma.id AS modelo_id,
                        ma.nombre AS nombre,
                        ma.nombre AS modelo_nombre,
                        ma.categoria,
                        ma.ubicacion_fisica,
                        ma.imagen_url,
                        'Genérico' AS marca
                    FROM activos_individuales ai
                    INNER JOIN modelos_activos ma ON ai.modelo_id = ma.id
                    ORDER BY ai.created_at DESC;
                """
                cursor.execute(query)
                return cursor.fetchall()
        finally:
            db.close()

    @staticmethod
    def obtener_por_id(activo_individual_id: int):
        db = Conexion.conectar()
        try:
            with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                query = """
                    SELECT 
                        ai.id AS id,
                        ai.id AS activo_individual_id,
                        ai.numero_serie,
                        ai.estado,
                        ma.id AS modelo_id,
                        ma.nombre AS nombre,
                        ma.nombre AS modelo_nombre,
                        ma.categoria,
                        ma.ubicacion_fisica,
                        ma.imagen_url,
                        'Genérico' AS marca
                    FROM activos_individuales ai
                    INNER JOIN modelos_activos ma ON ai.modelo_id = ma.id
                    WHERE ai.id = %s;
                """
                cursor.execute(query, (activo_individual_id,))
                return cursor.fetchone()
        finally:
            db.close()

    @staticmethod
    def obtener_categorias_unicas():
        """Busca las categorías registradas en la base de datos para el select de activos.js"""
        db = Conexion.conectar()
        try:
            with db.cursor() as cursor:
                cursor.execute("""
                    SELECT DISTINCT categoria 
                    FROM modelos_activos 
                    WHERE categoria IS NOT NULL AND categoria <> ''
                    ORDER BY categoria;
                """)
                filas = cursor.fetchall()
                
                # Si la base de datos no tiene categorías registradas, devolvemos un fallback seguro
                if not filas:
                    return ["Cómputo", "Electrónica", "Herramientas"]
                    
                return [row[0] for row in filas]
        except Exception as e:
            print(f"⚠️ [WARN] Error leyendo categorías dinámicas: {e}")
            return ["Cómputo", "Electrónica", "Herramientas"]
        finally:
            db.close()

    @staticmethod
    def crear(nombre, categoria, numero_serie, ubicacion_fisica, usuario_id, imagen_url=None, estado='disponible'):
        """Crea o vincula el modelo general e inserta la pieza física individual con su S/N"""
        db = Conexion.conectar()
        try:
            with db.cursor() as cursor:
                # 1. Normalizar el estado a minúsculas para que el ENUM de Postgres lo acepte sin romper
                estado_limpio = str(estado).lower() if estado else 'disponible'
                if estado_limpio not in ['disponible', 'prestado', 'mantenimiento', 'baja']:
                    estado_limpio = 'disponible'

                # 2. Verificar si el modelo general ya existe o registrarlo
                cursor.execute("SELECT id FROM modelos_activos WHERE nombre = %s", (nombre,))
                res_modelo = cursor.fetchone()
                
                if res_modelo:
                    modelo_id = res_modelo[0]
                    if imagen_url:
                        cursor.execute("UPDATE modelos_activos SET imagen_url = %s WHERE id = %s", (imagen_url, modelo_id))
                else:
                    # 🔑 SOLUClÓN: Si no mandan imagen_url, usamos la URL por defecto de tu migración en Python
                    # quitando por completo el COALESCE(..., DEFAULT) que rompía PostgreSQL
                    if not imagen_url or str(imagen_url).strip() == "":
                        imagen_url = 'https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?q=80&w=400'

                    query_modelo = """
                        INSERT INTO modelos_activos (nombre, categoria, ubicacion_fisica, imagen_url)
                        VALUES (%s, %s, %s, %s) RETURNING id;
                    """
                    cursor.execute(query_modelo, (nombre, categoria, ubicacion_fisica, imagen_url))
                    modelo_id = cursor.fetchone()[0]

                # 3. Insertar la existencia física real con su número de serie
                query_individual = """
                    INSERT INTO activos_individuales (modelo_id, numero_serie, estado)
                    VALUES (%s, %s, %s) RETURNING id;
                """
                cursor.execute(query_individual, (modelo_id, numero_serie, estado_limpio))
                new_individual_id = cursor.fetchone()[0]
                
                # 4. LOG: Alta de Activo en auditoría_movimientos
                cursor.execute("""
                    INSERT INTO auditoria_movimientos (activo_individual_id, usuario_id, accion, detalles)
                    VALUES (%s, %s, 'ALTA_ACTIVO', %s)
                """, (new_individual_id, usuario_id, f"Operador/Admin registró pieza S/N: {numero_serie} para el modelo {nombre}"))
                
                db.commit()
                return new_individual_id
        except psycopg2.Error as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def actualizar(activo_individual_id: int, datos: dict, usuario_id: int):
        """Actualiza propiedades del número de serie o los datos del catálogo del modelo vinculado"""
        db = Conexion.conectar()
        try:
            with db.cursor() as cursor:
                cursor.execute("SELECT modelo_id FROM activos_individuales WHERE id = %s", (activo_individual_id,))
                res = cursor.fetchone()
                if not res:
                    return False
                modelo_id = res[0]

                # Actualizar datos de la pieza física si vienen en el payload
                if 'numero_serie' in datos or 'estado' in datos:
                    sets_ai = []
                    vals_ai = []
                    if 'numero_serie' in datos:
                        sets_ai.append("numero_serie = %s")
                        vals_ai.append(datos['numero_serie'])
                    if 'estado' in datos:
                        sets_ai.append("estado = %s")
                        vals_ai.append(datos['estado'])
                    vals_ai.append(activo_individual_id)
                    cursor.execute(f"UPDATE activos_individuales SET {', '.join(sets_ai)} WHERE id = %s", vals_ai)

                # Actualizar datos del catálogo (modelo) si vienen en el payload
                campos_modelo = ['nombre', 'categoria', 'ubicacion_fisica', 'imagen_url']
                sets_m = []
                vals_m = []
                for campo in campos_modelo:
                    if campo in datos:
                        sets_m.append(f"{campo} = %s")
                        vals_m.append(datos[campo])
                
                if sets_m:
                    vals_m.append(modelo_id)
                    cursor.execute(f"UPDATE modelos_activos SET {', '.join(sets_m)} WHERE id = %s", vals_m)
                
                # LOG: Modificación
                cursor.execute("""
                    INSERT INTO auditoria_movimientos (activo_individual_id, usuario_id, accion, detalles)
                    VALUES (%s, %s, 'MODIFICACION_ACTIVO', 'Se actualizaron las especificaciones técnicas o parámetros visuales del ítem.')
                """, (activo_individual_id, usuario_id))
                
                db.commit()
                return True
        except psycopg2.Error as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def cambiar_estado(activo_individual_id: int, nuevo_estado: str, usuario_id: int):
        db = Conexion.conectar()
        try:
            with db.cursor() as cursor:
                cursor.execute(
                    "UPDATE activos_individuales SET estado = %s WHERE id = %s",
                    (nuevo_estado, activo_individual_id)
                )
                
                accion_log = 'INGRESO_MANTENIMIENTO' if nuevo_estado == 'mantenimiento' else 'MODIFICACION_ACTIVO'
                cursor.execute("""
                    INSERT INTO auditoria_movimientos (activo_individual_id, usuario_id, accion, detalles)
                    VALUES (%s, %s, %s, %s)
                """, (activo_individual_id, usuario_id, accion_log, f"Cambio de estado operativo manual a: {nuevo_estado.upper()}"))

                db.commit()
                return True
        finally:
            db.close()

    @staticmethod
    def eliminar(activo_individual_id: int, usuario_id: int):
        """Elimina la pieza física individual resguardando la integridad referencial"""
        db = Conexion.conectar()
        try:
            with db.cursor() as cursor:
                cursor.execute("""
                    SELECT ma.nombre, ai.numero_serie 
                    FROM activos_individuales ai
                    JOIN modelos_activos ma ON ai.modelo_id = ma.id 
                    WHERE ai.id = %s
                """, (activo_individual_id,))
                res = cursor.fetchone()
                nombre_equipo = f"{res[0]} (S/N: {res[1]})" if res else "Desconocido"

                # Eliminación física de la existencia con ese número de serie
                cursor.execute("DELETE FROM activos_individuales WHERE id = %s", (activo_individual_id,))
                
                # LOG: Guardado con la FK del activo en NULL de forma segura
                cursor.execute("""
                    INSERT INTO auditoria_movimientos (activo_individual_id, usuario_id, accion, detalles)
                    VALUES (NULL, %s, 'BAJA_ACTIVO', %s)
                """, (usuario_id, f"Baja física definitiva del inventario: {nombre_equipo}"))
                
                db.commit()
                return cursor.rowcount > 0
        except psycopg2.Error as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def metricas():
        """Calcula el resumen matemático exacto para las tarjetas KPI del Dashboard"""
        db = Conexion.conectar()
        try:
            with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute("SELECT estado, COUNT(*) AS total FROM activos_individuales GROUP BY estado")
                rows = cursor.fetchall()
                resultado = {'disponible': 0, 'prestado': 0, 'mantenimiento': 0, 'baja': 0, 'total': 0}
                for r in rows:
                    resultado[r['estado']] = r['total']
                    resultado['total'] += r['total']
                return resultado
        finally:
            db.close()