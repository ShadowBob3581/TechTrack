# backend/modelos/mantenimiento.py
import psycopg2
import psycopg2.extras
from config import Conexion

class Mantenimiento:

    @staticmethod
    def obtener_todos():
        """Trae el historial y estado actual de los mantenimientos para el Administrador"""
        db = Conexion.conectar()
        try:
            with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT 
                        m.id,
                        m.activo_individual_id,
                        m.descripcion_falla,
                        m.tecnico_responsable,
                        m.costo,
                        m.fecha_inicio,
                        m.fecha_fin,
                        ma.nombre       AS activo_nombre,
                        ai.numero_serie AS activo_serie
                    FROM mantenimientos m
                    JOIN activos_individuales ai ON m.activo_individual_id = ai.id
                    JOIN modelos_activos ma      ON ai.modelo_id = ma.id
                    ORDER BY m.fecha_inicio DESC
                """)
                return cursor.fetchall()
        finally:
            db.close()

    @staticmethod
    def crear(activo_individual_id, descripcion_falla, tecnico_responsable, usuario_id=1, costo=0.00):
        """Envía un número de serie físico al taller de reparaciones, actualizando su estado"""
        db = Conexion.conectar()
        try:
            with db.cursor() as cursor:
                # 1. Registrar la orden de mantenimiento
                cursor.execute("""
                    INSERT INTO mantenimientos
                        (activo_individual_id, descripcion_falla, tecnico_responsable, costo)
                    VALUES (%s, %s, %s, %s)
                """, (activo_individual_id, descripcion_falla, tecnico_responsable, costo))

                # 2. Actualizar el estado del hardware específico
                cursor.execute(
                    "UPDATE activos_individuales SET estado = 'mantenimiento' WHERE id = %s",
                    (activo_individual_id,)
                )

                # 3. LOG: Entrada a mantenimiento
                cursor.execute("""
                    INSERT INTO auditoria_movimientos (activo_individual_id, usuario_id, accion, detalles)
                    VALUES (%s, %s, 'INGRESO_MANTENIMIENTO', %s)
                """, (activo_individual_id, usuario_id, f"Equipo enviado a soporte por: {descripcion_falla}"))

                db.commit()
                return cursor.rowcount
        except psycopg2.Error as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def cerrar(mantenimiento_id: int, usuario_id: int = 1, costo_final: float = None):
        """Cierra la orden técnica, calcula los costos financieros y libera el hardware a 'disponible'"""
        db = Conexion.conectar()
        try:
            with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                # 1. Actualizar fechas y costos de la orden
                if costo_final is not None:
                    cursor.execute(
                        "UPDATE mantenimientos SET fecha_fin = NOW(), costo = %s WHERE id = %s",
                        (costo_final, mantenimiento_id)
                    )
                else:
                    cursor.execute(
                        "UPDATE mantenimientos SET fecha_fin = NOW() WHERE id = %s",
                        (mantenimiento_id,)
                    )

                # 2. Recuperar el activo_individual_id afectado para liberarlo
                cursor.execute(
                    "SELECT activo_individual_id FROM mantenimientos WHERE id = %s",
                    (mantenimiento_id,)
                )
                row = cursor.fetchone()
                
                if row:
                    activo_individual_id = row['activo_individual_id']
                    
                    # Regresar el equipo al flujo ordinario
                    cursor.execute(
                        "UPDATE activos_individuales SET estado = 'disponible' WHERE id = %s",
                        (activo_individual_id,)
                    )

                    # 3. LOG: Egreso e incorporación del hardware libre
                    cursor.execute("""
                        INSERT INTO auditoria_movimientos (activo_individual_id, usuario_id, accion, detalles)
                        VALUES (%s, %s, 'MODIFICACION_ACTIVO', %s)
                    """, (activo_individual_id, usuario_id, f"Mantenimiento #{mantenimiento_id} finalizado. Equipo de nuevo en estantería."))

                db.commit()
        except psycopg2.Error as e:
            db.rollback()
            raise e
        finally:
            db.close()