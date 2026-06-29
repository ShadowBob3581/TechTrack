# backend/modelos/auditoria.py
import psycopg2
import psycopg2.extras
from config import Conexion

class Auditoria:

    @staticmethod
    def registrar(activo_individual_id, usuario_id, accion: str, detalles: str):
        """Permite registrar logs manuales desde cualquier punto del backend"""
        db = Conexion.conectar()
        try:
            with db.cursor() as cursor:
                cursor.execute("""
                    INSERT INTO auditoria_movimientos
                        (activo_individual_id, usuario_id, accion, detalles)
                    VALUES (%s, %s, %s, %s)
                """, (activo_individual_id, usuario_id, accion.upper(), detalles))
                db.commit()
        except psycopg2.Error as e:
            db.rollback()
            print(f"[ERROR] Auditoria.registrar: {e}")
        finally:
            db.close()

    @staticmethod
    def obtener_todos(limite: int = 100):
        """Trae el historial completo de auditoría cruzando con los nuevos modelos y series físicas"""
        db = Conexion.conectar()
        try:
            with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT
                        am.id,
                        am.accion,
                        am.detalles,
                        am.fecha_registro,
                        am.usuario_id,
                        am.activo_individual_id,
                        COALESCE(u.nombre, 'Sistema / Interno') AS usuario_nombre,
                        COALESCE(u.rol, 'N/A') AS usuario_rol,
                        COALESCE(ma.nombre, 'Sistema / No aplica') AS activo_nombre,
                        COALESCE(ai.numero_serie, 'N/A') AS activo_serie
                    FROM auditoria_movimientos am
                    LEFT JOIN usuarios u ON am.usuario_id = u.id
                    LEFT JOIN activos_individuales ai ON am.activo_individual_id = ai.id
                    LEFT JOIN modelos_activos ma ON ai.modelo_id = ma.id
                    ORDER BY am.fecha_registro DESC
                    LIMIT %s
                """, (limite,))
                return cursor.fetchall()
        finally:
            db.close()