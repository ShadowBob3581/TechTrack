# backend/modelos/usuario.py
import psycopg2
import psycopg2.extras
from config import Conexion

class Usuario:
    def __init__(self, id, usuario, nombre, password, rol, aprobado=False):
        self.id       = id
        self.usuario  = usuario
        self.nombre   = nombre
        self.password = password
        self.rol      = rol
        self.aprobado = aprobado  # Mapeo del flag booleano de autorización

    def verificar_password(self, password_ingresada: str) -> bool:
        return self.password == password_ingresada

    @classmethod
    def obtener_por_usuario(cls, username: str):
        """Busca un usuario activo o pendiente por su identificador de cuenta"""
        db = Conexion.conectar()
        try:
            with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute(
                    "SELECT id, usuario, nombre, password, rol, aprobado "
                    "FROM usuarios WHERE usuario = %s LIMIT 1",
                    (username,)
                )
                row = cursor.fetchone()
                if row:
                    return cls(**row)
                return None
        except psycopg2.Error as e:
            print(f"[ERROR] Usuario.obtener_por_usuario: {e}")
            return None
        finally:
            db.close()

    @staticmethod
    def obtener_pendientes():
        """Obtiene la lista de nuevos operadores que esperan autorización del Admin"""
        db = Conexion.conectar()
        try:
            with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute(
                    "SELECT id, usuario, nombre, rol, aprobado "
                    "FROM usuarios WHERE aprobado = FALSE AND rol = 'operador' "
                    "ORDER BY id ASC"
                )
                return cursor.fetchall()
        finally:
            db.close()

    @staticmethod
    def actualizar_aprobacion(usuario_id: int, estado_aprobacion: bool):
        """Aprueba o deniega/remueve el acceso de un operador en el sistema"""
        db = Conexion.conectar()
        try:
            with db.cursor() as cursor:
                cursor.execute(
                    "UPDATE usuarios SET aprobado = %s WHERE id = %s",
                    (estado_aprobacion, usuario_id)
                )
                db.commit()
                return cursor.rowcount > 0
        except psycopg2.Error as e:
            db.rollback()
            raise e
        finally:
            db.close()

    @classmethod
    def obtain_por_usuario(cls, username: str):
        """Alias de compatibilidad para evitar roturas de referencias antiguas"""
        return cls.obtener_por_usuario(username)