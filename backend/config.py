import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

class Conexion:
    @classmethod
    def conectar(cls):
        """
        Devuelve una conexión activa a PostgreSQL.
        """
        try:
            connection = psycopg2.connect(
                host=os.getenv("DB_HOST", "db"),
                port=int(os.getenv("DB_PORT", "5432")),
                user=os.getenv("DB_USER", "appuser"),
                password=os.getenv("DB_PASSWORD", "apppass123"),
                dbname=os.getenv("DB_NAME", "trazabilidad_assets")
            )
            return connection
        except psycopg2.Error as e:
            print(f"[ERROR] Conexión a la base de datos fallida: {e}") 
            raise e

    @classmethod
    def inicializar_base_de_datos(cls):
        """
        Busca el archivo .sql en la carpeta 'database' (fuera de backend)
        y lo ejecuta automáticamente si las tablas no existen.
        """
        db = cls.conectar()
        try:
            with db.cursor() as cursor:
                # Verificar si la tabla usuarios ya existe para no duplicar esfuerzo
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' 
                        AND table_name = 'usuarios'
                    );
                """)
                tablas_existentes = cursor.fetchone()[0]

                if not tablas_existentes:
                    print("[INFO] Base de datos vacía. Detectando archivo SQL para inicializar...")
                    
                    # Subir un nivel desde 'backend' para encontrar la carpeta 'database'
                    ruta_sql = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'database'))
                    
                    # Buscar cualquier archivo .sql dentro de esa carpeta
                    archivos = [f for f in os.listdir(ruta_sql) if f.endswith('.sql')]
                    
                    if not archivos:
                        print("[ERROR] No se encontró ningún archivo .sql en la carpeta 'database'.")
                        return
                    
                    archivo_sql = os.path.join(ruta_sql, archivos[0])
                    print(f"[INFO] Ejecutando script original: {archivo_sql}")
                    
                    with open(archivo_sql, 'r', encoding='utf-8') as f:
                        script_sql = f.read()
                    
                    # Ejecutar el archivo de estructura y datos iniciales propios
                    cursor.execute(script_sql)
                    db.commit()
                    print("[ÉXITO] Estructura creada y datos iniciales cargados desde el archivo .sql.")
                else:
                    print("[INFO] Las tablas ya existen. Saltando inicialización.")
        except Exception as e:
            db.rollback()
            print(f"[ERROR] No se pudo inicializar la base de datos de forma automática: {e}")
        finally:
            db.close()