# backend/modelos/prestamo.py
import psycopg2
import psycopg2.extras
from config import Conexion

class Prestamo:

    @staticmethod
    def obtener_todos():
        db = Conexion.conectar()
        try:
            with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT
                        p.id,
                        p.activo_individual_id,
                        p.usuario_operador_id,
                        p.solicitante_matricula AS usuario_nombre,
                        'No registrado' AS usuario_correo,
                        p.fecha_prestamo,
                        p.fecha_devolucion_prevista AS fecha_devolucion,
                        p.fecha_devolucion_real,
                        p.estado_retorno,
                        ma.nombre       AS activo_nombre,
                        ai.numero_serie AS activo_serie,
                        u.nombre        AS operador_nombre,
                        CASE 
                            WHEN p.fecha_devolucion_real IS NULL AND p.fecha_devolucion_prevista < NOW() THEN 'vencido'
                            WHEN p.fecha_devolucion_real IS NOT NULL THEN 'devuelto'
                            ELSE 'activo'
                        END AS estado
                    FROM prestamos p
                    JOIN activos_individuales ai ON p.activo_individual_id = ai.id
                    JOIN modelos_activos ma      ON ai.modelo_id = ma.id
                    JOIN usuarios u              ON p.usuario_operador_id = u.id
                    ORDER BY p.fecha_prestamo DESC
                """)
                return cursor.fetchall()
        finally:
            db.close()

    @staticmethod
    def obtener_por_operador(usuario_id: int):
        db = Conexion.conectar()
        try:
            with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT
                        p.id,
                        p.activo_individual_id,
                        p.usuario_operador_id,
                        p.solicitante_matricula AS usuario_nombre,
                        'No registrado' AS usuario_correo,
                        p.fecha_prestamo,
                        p.fecha_devolucion_prevista AS fecha_devolucion,
                        p.fecha_devolucion_real,
                        p.estado_retorno,
                        ma.nombre       AS activo_nombre,
                        ai.numero_serie AS activo_serie,
                        u.nombre        AS operador_nombre,
                        CASE 
                            WHEN p.fecha_devolucion_real IS NULL AND p.fecha_devolucion_prevista < NOW() THEN 'vencido'
                            WHEN p.fecha_devolucion_real IS NOT NULL THEN 'devuelto'
                            ELSE 'activo'
                        END AS estado
                    FROM prestamos p
                    JOIN activos_individuales ai ON p.activo_individual_id = ai.id
                    JOIN modelos_activos ma      ON ai.modelo_id = ma.id
                    JOIN usuarios u              ON p.usuario_operador_id = u.id
                    WHERE p.usuario_operador_id = %s
                    ORDER BY p.fecha_prestamo DESC
                """, (usuario_id,))
                return cursor.fetchall()
        finally:
            db.close()

    @staticmethod
    def crear(activo_individual_id, usuario_operador_id, solicitante_matricula, fecha_devolucion_prevista):
        db = Conexion.conectar()
        try:
            with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                # Bloqueo optimista/pesimista sobre la existencia física real por S/N
                cursor.execute(
                    "SELECT estado FROM activos_individuales WHERE id = %s FOR UPDATE",
                    (activo_individual_id,)
                )
                activo = cursor.fetchone()
                if not activo or activo['estado'] != 'disponible':
                    raise ValueError("La pieza o número de serie no está disponible para préstamo.")

                cursor.execute("""
                    INSERT INTO prestamos
                        (activo_individual_id, usuario_operador_id, solicitante_matricula, fecha_devolucion_prevista)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id
                """, (activo_individual_id, usuario_operador_id, solicitante_matricula, fecha_devolucion_prevista))
                prestamo_id = cursor.fetchone()['id']

                # Cambiar estado físico de la pieza
                cursor.execute(
                    "UPDATE activos_individuales SET estado = 'prestado' WHERE id = %s",
                    (activo_individual_id,)
                )

                # Auditoría apuntando a activo_individual_id
                cursor.execute("""
                    INSERT INTO auditoria_movimientos
                        (activo_individual_id, usuario_id, accion, detalles)
                    VALUES (%s, %s, 'PRESTAMO', %s)
                """, (
                    activo_individual_id,
                    usuario_operador_id,
                    f"Préstamo #{prestamo_id} registrado para matrícula {solicitante_matricula}"
                ))

                db.commit()
                return prestamo_id
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def registrar_devolucion(prestamo_id: int, estado_retorno: str, usuario_id: int):
        db = Conexion.conectar()
        try:
            with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute(
                    "SELECT activo_individual_id FROM prestamos WHERE id = %s", (prestamo_id,)
                )
                row = cursor.fetchone()
                if not row:
                    raise ValueError("Préstamo no encontrado.")
                activo_individual_id = row['activo_individual_id']

                cursor.execute("""
                    UPDATE prestamos
                    SET fecha_devolucion_real = NOW(),
                        estado_retorno        = %s
                    WHERE id = %s
                """, (estado_retorno, prestamo_id))

                # Retornar el estado físico de la existencia a disponible
                cursor.execute(
                    "UPDATE activos_individuales SET estado = 'disponible' WHERE id = %s",
                    (activo_individual_id,)
                )

                cursor.execute("""
                    INSERT INTO auditoria_movimientos
                        (activo_individual_id, usuario_id, accion, detalles)
                    VALUES (%s, %s, 'RETORNO', %s)
                """, (
                    activo_individual_id,
                    usuario_id,
                    f"Devolución del préstamo #{prestamo_id}. Condición retorno: {estado_retorno}"
                ))

                db.commit()
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @staticmethod
    def conteos():
        db = Conexion.conectar()
        try:
            with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT
                        COUNT(*) AS total,
                        COALESCE(SUM(CASE WHEN fecha_devolucion_real IS NULL AND fecha_devolucion_prevista < NOW() THEN 1 ELSE 0 END), 0) AS vencidos,
                        COALESCE(SUM(CASE WHEN fecha_devolucion_real IS NULL AND fecha_devolucion_prevista >= NOW() THEN 1 ELSE 0 END), 0) AS activos
                    FROM prestamos
                """)
                res = cursor.fetchone()
                # Asegurar formato seguro por si la tabla de préstamos está vacía en un inicio
                return {
                    "total": res["total"] if res else 0,
                    "vencidos": res["vencidos"] if res else 0,
                    "activos": res["activos"] if res else 0
                }
        finally:
            db.close()