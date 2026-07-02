# Explicación del funcionamiento de Docker Compose, Dockerfiles y Nginx

Este proyecto utiliza contenedores Docker para separar la base de datos, el backend, el frontend y el gateway de entrada. La idea principal es que cada parte del sistema se ejecute de forma aislada, pero conectada a través de una red interna.

## 1. Arquitectura general

La infraestructura está definida en el archivo docker-compose.yml y está compuesta por cuatro servicios:

- database_service: base de datos PostgreSQL.
- backend_service: API Flask que expone la lógica del negocio.
- frontend_service: servidor estático Nginx que sirve los archivos HTML, CSS y JavaScript.
- gateway_service: reverse proxy Nginx que recibe las peticiones externas y las redirige al frontend o al backend.

Además, se usa un volumen llamado postgres_data para conservar los datos de PostgreSQL entre reinicios del contenedor.

---

## 2. Explicación de docker-compose.yml

El archivo docker-compose.yml define cómo se levantan y conectan los servicios del proyecto.

### 2.1 Servicio database_service

Este servicio usa la imagen oficial de PostgreSQL 15 en una versión ligera llamada alpine.

Funciones principales:
- Crea una base de datos PostgreSQL.
- Establece usuario y contraseña a partir de variables de entorno.
- Inicializa la estructura de la base de datos con el archivo schema_postgres.sql.
- Mantiene los datos persistidos en el volumen postgres_data.

Puntos importantes:
- Se conecta a la red interna trazabilidad_network.
- Expone el puerto 5432 internamente, no públicamente.

### 2.2 Servicio backend_service

Este servicio construye la imagen del backend a partir del directorio backend y su Dockerfile.

Funciones principales:
- Levanta la aplicación Flask.
- Usa Gunicorn como servidor WSGI de producción.
- Recibe variables de entorno como la URL de conexión a la base de datos y la clave secreta JWT.
- Depende del servicio de base de datos, por lo que espera a que PostgreSQL esté disponible antes de iniciar.

Puntos importantes:
- Se comunica con la base de datos a través de la red interna del compose.
- Escucha internamente en el puerto 5000.

### 2.3 Servicio frontend_service

Este servicio construye la imagen del frontend usando el directorio frontend y su Dockerfile.

Funciones principales:
- Sirve los archivos estáticos del proyecto: HTML, CSS, JS.
- Usa Nginx como servidor web.
- Se encarga de entregar la interfaz de usuario al navegador.

Puntos importantes:
- No expone el puerto 80 al host directamente.
- Se comunica con el gateway por la red interna.

### 2.4 Servicio gateway_service

Este servicio representa el punto de entrada del sistema.

Funciones principales:
- Recibe peticiones desde el puerto 80 del host.
- Redirige las peticiones a backend o frontend según la ruta.
- Permite que el usuario acceda a la aplicación a través de una sola URL.

Puntos importantes:
- Mapea el puerto 80 del host al puerto 80 del contenedor.
- Depende de frontend y backend para funcionar correctamente.

### 2.5 Redes y volúmenes

- La red trazabilidad_network permite la comunicación entre los contenedores.
- El volumen postgres_data garantiza que los datos de PostgreSQL no se pierdan al reiniciar el contenedor.

---

## 3. Explicación del backend Dockerfile

Ubicación: backend/Dockerfile

Este Dockerfile define cómo construir la imagen del backend.

### Pasos del Dockerfile

1. Base de imagen
   - Usa python:3.11-slim, una imagen ligera de Python.

2. Variables de entorno
   - PYTHONDONTWRITEBYTECODE=1 evita que Python genere archivos .pyc.
   - PYTHONUNBUFFERED=1 permite ver logs en tiempo real.

3. Directorio de trabajo
   - Se establece /app como carpeta de trabajo dentro del contenedor.

4. Instalación de dependencias del sistema
   - Instala herramientas necesarias para compilar paquetes como psycopg2 o librerías relacionadas con PostgreSQL.

5. Instalación de dependencias de Python
   - Copia requirements.txt e instala todas las dependencias mediante pip.

6. Copia del código fuente
   - Se copia todo el contenido del backend en el contenedor.

7. Exposición del puerto
   - Se expone el puerto 5000.

8. Inicio del servicio
   - Se ejecuta Gunicorn para lanzar la aplicación Flask.

### Objetivo principal

Este Dockerfile prepara un entorno Python listo para ejecutar la API de forma segura y eficiente en producción.

---

## 4. Explicación del frontend Dockerfile

Ubicación: frontend/Dockerfile

Este Dockerfile prepara un contenedor Nginx para servir los archivos estáticos del frontend.

### Pasos del Dockerfile

1. Base de imagen
   - Usa nginx:1.25-alpine, una imagen mínima y rápida de Nginx.

2. Copia de archivos estáticos
   - Se copian las carpetas css, js y vistas al directorio público de Nginx.

3. Exposición del puerto
   - Se expone el puerto 80.

4. Inicio del servidor
   - Se inicia Nginx en primer plano con la opción daemon off.

### Objetivo principal

Este contenedor sirve la interfaz del sistema sin necesidad de un servidor de aplicaciones como Flask para la parte visual.

---

## 5. Explicación del gateway Dockerfile

Ubicación: gateway/Dockerfile

Este Dockerfile prepara un contenedor adicional basado en Nginx para actuar como reverse proxy.

### Pasos del Dockerfile

1. Base de imagen
   - Usa nginx:1.25-alpine.

2. Eliminación del archivo de configuración por defecto
   - Se borra la configuración predeterminada de Nginx para reemplazarla por una propia.

3. Copia del archivo nginx.conf
   - Se copia la configuración personalizada al directorio de configuración de Nginx.

4. Exposición del puerto
   - Se expone el puerto 80.

5. Inicio del servicio
   - Se ejecuta Nginx en primer plano.

### Objetivo principal

Este contenedor centraliza el acceso a la aplicación y distribuye las peticiones a los servicios correctos.

---

## 6. Explicación de nginx.conf

Ubicación: gateway/nginx.conf

Este archivo define la lógica del reverse proxy.

### 6.1 Upstreams

Se definen dos grupos de servidores:

- frontend_cluster: apunta al servicio frontend_service en el puerto 80.
- backend_cluster: apunta al servicio backend_service en el puerto 5000.

Esto permite que Nginx reenvíe las solicitudes a los contenedores correctos usando nombres de servicio internos de Docker.

### 6.2 Servidor principal

El bloque server escucha en el puerto 80 y maneja todas las solicitudes entrantes.

### 6.3 Ruta /api/

Las peticiones que comienzan con /api/ se redirigen al backend.

Esto es útil porque el frontend puede llamar a endpoints del backend sin conocer directamente la IP o puerto del contenedor.

### 6.4 Ruta /

Todo lo demás se reenvía al frontend.

Esto permite que las vistas HTML, CSS y JS se sirvan correctamente desde el contenedor del frontend.

### 6.5 Configuraciones adicionales

- gzip on: activa compresión para mejorar el rendimiento.
- client_max_body_size 15M: permite subir archivos relativamente grandes, como importaciones o adjuntos.
- proxy_set_header: pasa información como el host y la IP real del cliente al backend.

---

## 7. Flujo de funcionamiento completo

1. El usuario accede a la aplicación mediante http://localhost.
2. El gateway_service recibe la solicitud.
3. Nginx decide si la ruta corresponde al frontend o al backend.
4. Si es una ruta de la interfaz, la redirige al frontend_service.
5. Si es una ruta de API, la redirige al backend_service.
6. El backend se conecta a PostgreSQL para consultar o guardar información.
7. Los datos se almacenan en el volumen postgres_data para persistencia.

---

## 8. Comandos útiles

Para construir y levantar los contenedores:

```bash
docker compose up --build
```

Para detenerlos:

```bash
docker compose down
```

Para ver los contenedores activos:

```bash
docker compose ps
```

---

## 9. Resumen breve

- docker-compose.yml organiza y levanta todos los servicios.
- Los Dockerfiles crean las imágenes del backend, frontend y gateway.
- nginx.conf define cómo se enrutan las peticiones entre frontend y backend.
- PostgreSQL se mantiene persistente mediante un volumen dedicado.