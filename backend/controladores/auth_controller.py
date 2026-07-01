import os
from flask import Blueprint, request, jsonify
from flask_cors import CORS  # 1. Importamos CORS para el Blueprint
from modelos.usuario import Usuario
# Importación corregida y consistente para conectar a PostgreSQL
from config import Conexion  

auth_bp = Blueprint('auth', __name__)

# 🚀 Aplicamos la misma lógica dinámica para el Blueprint
if os.getenv('FLASK_ENV') == 'production':
    origenes_permitidos = ["*"]
else:
    origenes_permitidos = ["http://127.0.0.1:5500", "http://localhost:5500"]

CORS(auth_bp, resources={
    r"/*": {
        "origins": origenes_permitidos,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

@auth_bp.route('/login', methods=['POST'])
def login():
    datos = request.get_json(silent=True)
    if not datos:
        return jsonify({"success": False, "message": "Cuerpo de la petición inválido."}), 400

    username = datos.get('usuario', '').strip()
    password = datos.get('password', '').strip()

    if not username or not password:
        return jsonify({"success": False, "message": "Falta usuario o contraseña."}), 400

    ip_origen = request.remote_addr  # 🌐 Rastrear IP del cliente
    lugar = 'Plataforma Digital'     # 📍 Ubicación lógica del evento
    usuario = Usuario.obtener_por_usuario(username)

    # Conexión rápida para registrar los logs de autenticación
    db = Conexion.conectar()
    cursor = db.cursor()

    try:
        if usuario and usuario.verificar_password(password):
            # 🔒 CONTROL DE ACCESO: Verificar si el operador ya fue aprobado por el Admin
            if hasattr(usuario, 'aprobado') and not usuario.aprobado:
                cursor.execute("""
                    INSERT INTO auditoria_movimientos (usuario_id, accion, detalles, ubicacion, ip_origen, fecha_registro)
                    VALUES (%s, 'LOGIN_BLOQUEADO', %s, %s, %s, CURRENT_TIMESTAMP);
                """, (usuario.id, f"El usuario {usuario.nombre} intentó ingresar sin aprobación del administrador.", lugar, ip_origen))
                db.commit()
                
                return jsonify({
                    "success": False, 
                    "message": "Tu cuenta está registrada pero aún no ha sido aprobada por un administrador."
                }), 403

            # 🟢 LOG: Login Exitoso con IP y Ubicación
            cursor.execute("""
                INSERT INTO auditoria_movimientos (usuario_id, accion, detalles, ubicacion, ip_origen, fecha_registro)
                VALUES (%s, 'LOGIN_SISTEMA', %s, %s, %s, CURRENT_TIMESTAMP);
            """, (usuario.id, f"El usuario {usuario.nombre} inició sesión exitosamente.", lugar, ip_origen))
            db.commit()

            return jsonify({
                "success": True,
                "nombre":  usuario.nombre,
                "rol":     usuario.rol,
                "id":      usuario.id,
                "token":   f"token_{usuario.rol}_{usuario.id}_tescha"
            }), 200

        # 🔴 LOG: Intento Fallido (Si el usuario existe pero la clave es incorrecta)
        if usuario:
            cursor.execute("""
                INSERT INTO auditoria_movimientos (usuario_id, accion, detalles, ubicacion, ip_origen, fecha_registro)
                VALUES (%s, 'LOGIN_FALLIDO', %s, %s, %s, CURRENT_TIMESTAMP);
            """, (usuario.id, f"Intento de inicio de sesión fallido para el usuario: {username}.", lugar, ip_origen))
            db.commit()

    finally:
        cursor.close()
        db.close()

    return jsonify({"success": False, "message": "Usuario o contraseña incorrectos."}), 401


# =========================================================================
# 3. ENDPOINTS REQUERIDOS POR LA BANDEJA DE OPERADORES Y USUARIOS
# =========================================================================

@auth_bp.route('/usuarios/pendientes', methods=['GET'])
def usuarios_pendientes():
    """Retorna la lista de usuarios que esperan la aprobación del Admin"""
    db = Conexion.conectar()
    cursor = db.cursor()
    try:
        query = """
            SELECT id, usuario, nombre, rol, created_at
            FROM usuarios 
            WHERE aprobado = FALSE OR aprobado IS NULL
            ORDER BY created_at DESC;
        """
        cursor.execute(query)
        filas = cursor.fetchall()
        
        resultados = []
        for row in filas:
            fecha_cruda = row[4]
            fecha_formateada = 'Reciente'
            if fecha_cruda and hasattr(fecha_cruda, 'strftime'):
                fecha_formateada = fecha_cruda.strftime('%Y-%m-%d %H:%M:%S')
            elif fecha_cruda:
                fecha_formateada = str(fecha_cruda)

            resultados.append({
                "id": row[0],
                "nombre": row[2],
                "correo": row[1],
                "rol": str(row[3]), 
                "fecha_registro": fecha_formateada
            })
        return jsonify(resultados), 200
    except Exception as e:
        print(f"❌ [ERROR INTERNO PENDIENTES]: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        db.close()


@auth_bp.route('/usuarios/activos', methods=['GET'])
def usuarios_activos():
    """Retorna la nómina digital de operadores ya autorizados"""
    db = Conexion.conectar()
    cursor = db.cursor()
    try:
        query = """
            SELECT id, usuario, nombre, rol
            FROM usuarios 
            WHERE aprobado = TRUE
            ORDER BY id ASC;
        """
        cursor.execute(query)
        filas = cursor.fetchall()
        
        resultados = []
        for row in filas:
            resultados.append({
                "id": row[0],
                "nombre": row[2],
                "correo": row[1],  
                "rol": str(row[3]), 
                "estatus": "Activo"
            })
        return jsonify(resultados), 200
    except Exception as e:
        print(f"❌ [ERROR INTERNO ACTIVOS]: {str(e)}")
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        db.close()


# =========================================================================
# 🔄 NUEVOS ENDPOINTS PARA EL DICTAMEN Y CONTROL DE CREDENCIALES
# =========================================================================

@auth_bp.route('/usuarios/dictaminar/<int:id>', methods=['POST', 'OPTIONS'])
def dictaminar_usuario(id):
    """Aprueba o rechaza el acceso de un operador en espera e inserta el movimiento en el log"""
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200

    ip_origen = request.remote_addr  # 🌐 Rastrear IP de origen
    lugar = 'Oficina de Administración'  # 📍 Ubicación del dictamen del Admin

    db = Conexion.conectar()
    cursor = db.cursor()
    try:
        datos = request.get_json(silent=True)
        if not datos:
            return jsonify({"error": "Datos JSON inválidos o ausentes"}), 400

        accion = datos.get('dictamen')  # 'aprobar' o 'rechazar'

        # Primero obtenemos los datos del usuario afectado para que el log sea descriptivo
        cursor.execute("SELECT nombre, usuario, rol FROM usuarios WHERE id = %s;", (id,))
        usuario_afectado = cursor.fetchone()
        
        nombre_usr = usuario_afectado[0] if usuario_afectado else f"ID {id}"
        correo_usr = usuario_afectado[1] if usuario_afectado else "N/A"
        rol_usr = usuario_afectado[2] if usuario_afectado else "N/A"

        if accion == 'aprobar':
            # 1. Aplicamos el cambio operativo
            query = "UPDATE usuarios SET aprobado = TRUE WHERE id = %s;"
            cursor.execute(query, (id,))
            
            # 2. 📝 REGISTRO EN LOG CON NUEVOS CAMPOS
            cursor.execute("""
                INSERT INTO auditoria_movimientos (usuario_id, accion, detalles, ubicacion, ip_origen, fecha_registro)
                VALUES (%s, 'APROBAR_OPERADOR', %s, %s, %s, CURRENT_TIMESTAMP);
            """, (id, f"El administrador aprobó la solicitud de acceso para {nombre_usr} ({correo_usr}) con el rango {rol_usr}.", lugar, ip_origen))

        elif accion == 'rechazar':
            # 1. 📝 REGISTRO EN LOG ANTES DE ELIMINAR EL REGISTRO FISICO
            cursor.execute("""
                INSERT INTO auditoria_movimientos (usuario_id, accion, detalles, ubicacion, ip_origen, fecha_registro)
                VALUES (%s, 'RECHAZAR_OPERADOR', %s, %s, %s, CURRENT_TIMESTAMP);
            """, (id, f"El administrador rechazó la solicitud de acceso de {nombre_usr} ({correo_usr}). Registro eliminado.", lugar, ip_origen))
            
            # 2. Aplicamos el cambio operativo
            query = "DELETE FROM usuarios WHERE id = %s;"
            cursor.execute(query, (id,))
        else:
            return jsonify({"error": "Dictamen no reconocido"}), 400

        db.commit()
        return jsonify({"success": True, "message": f"Usuario dictaminado con éxito: {accion}"}), 200

    except Exception as e:
        print(f"❌ [ERROR CRÍTICO DICTAMINAR CON LOG]: {str(e)}")
        db.rollback()
        return jsonify({"error": "Error interno al procesar el dictamen", "detalle": str(e)}), 500
    finally:
        cursor.close()
        db.close()


@auth_bp.route('/usuarios/revocar/<int:id>', methods=['POST', 'OPTIONS'])
def revocar_usuario(id):
    """Revoca las credenciales del operador (Baja lógica) e inserta el movimiento en el log"""
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200

    ip_origen = request.remote_addr  # 🌐 Rastrear IP de origen
    lugar = 'Oficina de Administración'  # 📍 Ubicación

    db = Conexion.conectar()
    cursor = db.cursor()
    try:
        cursor.execute("SELECT nombre, usuario FROM usuarios WHERE id = %s;", (id,))
        usuario_afectado = cursor.fetchone()
        nombre_usr = usuario_afectado[0] if usuario_afectado else f"ID {id}"
        correo_usr = usuario_afectado[1] if usuario_afectado else "N/A"

        # 1. Aplicamos la baja lógica operativa
        query = "UPDATE usuarios SET aprobado = FALSE WHERE id = %s;"
        cursor.execute(query, (id,))
        
        # 2. 📝 REGISTRO EN LOG DE REVOCACIÓN
        cursor.execute("""
            INSERT INTO auditoria_movimientos (usuario_id, accion, detalles, ubicacion, ip_origen, fecha_registro)
            VALUES (%s, 'REVOCAR_OPERADOR', %s, %s, %s, CURRENT_TIMESTAMP);
        """, (id, f"Se suspendieron las credenciales de ingreso para el operador {nombre_usr} ({correo_usr}).", lugar, ip_origen))
        
        db.commit()
        return jsonify({"success": True, "message": "Credenciales del operador revocadas"}), 200

    except Exception as e:
        print(f"❌ [ERROR CRÍTICO REVOCAR CON LOG]: {str(e)}")
        db.rollback()
        return jsonify({"error": "Error interno al revocar credenciales", "detalle": str(e)}), 500
    finally:
        cursor.close()
        db.close()


@auth_bp.route('/usuarios/cambiar-rol/<int:id>', methods=['POST', 'OPTIONS'])
def cambiar_rol_usuario(id):
    """Modifica el rol de un usuario activo ('administrador'/'operador') y añade registro detallado a auditoría"""
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200

    ip_origen = request.remote_addr  # 🌐 Rastrear IP de origen
    lugar = 'Oficina de Administración'  # 📍 Ubicación administrativa

    datos = request.get_json(silent=True)
    if not datos or 'rol' not in datos:
        return jsonify({"success": False, "message": "Faltan parámetros requeridos (rol)."}), 400

    rol_solicitado = datos.get('rol').strip().lower()

    # Mapeo estricto para encajar con el ENUM rol_usuario de PostgreSQL ('administrador' u 'operador')
    if rol_solicitado in ['admin', 'administrador']:
        nuevo_rol_enum = 'administrador'
    elif rol_solicitado in ['operador', 'user']:
        nuevo_rol_enum = 'operador'
    else:
        return jsonify({"success": False, "message": "El rol especificado no es un tipo válido para el sistema."}), 400

    db = Conexion.conectar()
    cursor = db.cursor()
    try:
        # 1. Validar existencia del usuario y guardar su estado actual para auditoría
        cursor.execute("SELECT nombre, usuario, rol FROM usuarios WHERE id = %s;", (id,))
        usuario_afectado = cursor.fetchone()
        
        if not usuario_afectado:
            return jsonify({"success": False, "message": "El usuario seleccionado no existe."}), 404

        nombre_usr, correo_usr, rol_anterior = usuario_afectado[0], usuario_afectado[1], str(usuario_afectado[2])

        # Evitar procesamiento y escrituras innecesarias en el log si el rol es el mismo
        if rol_anterior == nuevo_rol_enum:
            return jsonify({"success": True, "message": "El usuario ya cuenta con el rol especificado actualmente."}), 200

        # 2. Ejecutar la actualización en la tabla usuarios
        cursor.execute("UPDATE usuarios SET rol = %s WHERE id = %s;", (nuevo_rol_enum, id))

        # 3. 📝 REGISTRO EN AUDITORÍA DEL CONTROL DE ACCESO BASADO EN ROLES (RBAC)
        cursor.execute("""
            INSERT INTO auditoria_movimientos (usuario_id, accion, detalles, ubicacion, ip_origen, fecha_registro)
            VALUES (%s, 'CONTROL_RBAC', %s, %s, %s, CURRENT_TIMESTAMP);
        """, (id, f"Se modificaron los privilegios de {nombre_usr} ({correo_usr}). Rango actualizado de '{rol_anterior}' a '{nuevo_rol_enum}'.", lugar, ip_origen))

        db.commit()
        return jsonify({
            "success": True, 
            "message": f"El rol de {nombre_usr} ha sido cambiado exitosamente a '{nuevo_rol_enum}'."
        }), 200

    except Exception as e:
        print(f"❌ [ERROR CRÍTICO AL CAMBIAR ROL]: {str(e)}")
        db.rollback()
        return jsonify({"success": False, "message": "Error interno del servidor al procesar el cambio de rol.", "detalle": str(e)}), 500
    finally:
        cursor.close()
        db.close()


@auth_bp.route('/registro', methods=['POST', 'OPTIONS'])
def registro():
    """Registra un nuevo operador en la base de datos con aprobado = FALSE"""
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200

    datos = request.get_json(silent=True)
    if not datos:
        return jsonify({"success": False, "message": "Cuerpo de la petición inválido."}), 400

    nombre = datos.get('nombre', '').strip()
    username = datos.get('usuario', '').strip()
    password = datos.get('password', '').strip()

    if not nombre or not username or not password:
        return jsonify({"success": False, "message": "Faltan campos obligatorios."}), 400

    if Usuario.obtener_por_usuario(username):
        return jsonify({"success": False, "message": "El usuario o matrícula ya se encuentra registrado."}), 400

    ip_origen = request.remote_addr  # 🌐 Rastrear IP desde donde se registra
    lugar = 'Plataforma Digital'     # 📍 Ubicación

    db = Conexion.conectar()
    cursor = db.cursor()

    try:
        password_segura = password 
        if hasattr(Usuario, 'encriptar_password'):
            password_segura = Usuario.encriptar_password(password)
        elif hasattr(Usuario, 'generar_hash'):
            password_segura = Usuario.generar_hash(password)

        query_insert_usuario = """
            INSERT INTO usuarios (usuario, nombre, password, rol, aprobado, created_at)
            VALUES (%s, %s, %s, 'operador', FALSE, CURRENT_TIMESTAMP) RETURNING id;
        """
        cursor.execute(query_insert_usuario, (username, nombre, password_segura))
        nuevo_id = cursor.fetchone()[0]

        # 4. 📝 REGISTRO EN LOG AUDITORÍA CON IP REAL Y LUGAR LOGICO
        query_log = """
            INSERT INTO auditoria_movimientos (usuario_id, accion, detalles, ubicacion, ip_origen, fecha_registro)
            VALUES (%s, 'SOLICITUD_REGISTRO', %s, %s, %s, CURRENT_TIMESTAMP);
        """
        cursor.execute(query_log, (nuevo_id, f"El operador {nombre} ({username}) solicitó el registro.", lugar, ip_origen))
        
        db.commit()
        return jsonify({
            "success": True,
            "message": "¡Solicitud de registro enviada con éxito! Espera a que un administrador apruebe tu acceso."
        }), 201

    except Exception as e:
        print(f"❌ [ERROR CRÍTICO AL REGISTRAR]: {str(e)}")
        db.rollback()
        return jsonify({"success": False, "message": "Error interno del servidor al procesar el registro."}), 500
    finally:
        cursor.close()
        db.close()


@auth_bp.route('/usuarios/restablecer-password/<int:id>', methods=['POST', 'OPTIONS'])
def restablecer_password(id):
    """Permite al Admin cambiar de forma remota la contraseña de un operador y lo registra en auditoría"""
    if request.method == 'OPTIONS':
        return jsonify({"success": True}), 200

    datos = request.get_json(silent=True)
    if not datos or 'password' not in datos:
        return jsonify({"success": False, "message": "Falta la nueva contraseña en la petición."}), 400

    nueva_password = datos.get('password').strip()
    ip_origen = request.remote_addr  # 🌐 Rastrear IP
    lugar = 'Oficina de Administración'  # 📍 Ubicación
    
    db = Conexion.conectar()
    cursor = db.cursor()
    try:
        cursor.execute("SELECT nombre, usuario FROM usuarios WHERE id = %s;", (id,))
        usuario_afectado = cursor.fetchone()
        if not usuario_afectado:
            return jsonify({"success": False, "message": "El usuario seleccionado no existe."}), 404
            
        nombre_usr, correo_usr = usuario_afectado[0], usuario_afectado[1]

        password_encriptada = nueva_password
        if hasattr(Usuario, 'encriptar_password'):
            password_encriptada = Usuario.encriptar_password(nueva_password)
        elif hasattr(Usuario, 'generar_hash'):
            password_encriptada = Usuario.generar_hash(nueva_password)

        # 2. Actualizar credencial en la base de datos
        cursor.execute("UPDATE usuarios SET password = %s WHERE id = %s;", (password_encriptada, id))

        # 3. 📝 REGISTRO EN AUDITORÍA CON SUS NUEVOS PARÁMETROS
        cursor.execute("""
            INSERT INTO auditoria_movimientos (usuario_id, accion, detalles, ubicacion, ip_origen, fecha_registro)
            VALUES (%s, 'RESTABLECER_PASSWORD', %s, %s, %s, CURRENT_TIMESTAMP);
        """, (id, f"El administrador restableció la contraseña de acceso para {nombre_usr} ({correo_usr}).", lugar, ip_origen))

        db.commit()
        return jsonify({"success": True, "message": "Contraseña actualizada exitosamente."}), 200

    except Exception as e:
        print(f"❌ [ERROR CRÍTICO AL RESTABLECER BACKEND]: {str(e)}")
        db.rollback()
        return jsonify({"success": False, "message": "Error interno al reestablecer la contraseña."}), 500
    finally:
        cursor.close()
        db.close()