# Explicación y funcionamiento del frontend

Este documento describe la estructura, el flujo de navegación, la lógica de interacción y la arquitectura del frontend del proyecto TechTrack.

## 1. Objetivo del frontend

El frontend es la capa de interacción visual del sistema. Su función es:

- mostrar la interfaz pública para consultar préstamos y activos;
- permitir el acceso de usuarios mediante login y registro;
- ofrecer paneles diferenciados para administradores y operadores;
- consumir la API del backend para mostrar datos, registrar movimientos y gestionar usuarios, incidencias e activos.

El frontend está servido por Nginx dentro del contenedor correspondiente y se comunica con el backend a través de la ruta /api.

---

## 2. Estructura general del frontend

La carpeta frontend está organizada así:

- css/: hojas de estilo del sistema.
- js/: scripts que controlan la lógica, navegación, autenticación y módulos funcionales.
- vistas/: páginas HTML principales y vistas parciales por rol.

### Archivos principales de entrada

- vistas/index.html: vista pública del catálogo de préstamos.
- vistas/login.html: pantalla de acceso y registro.
- vistas/admin.html: interfaz principal para administradores.
- vistas/operador.html: interfaz principal para operadores.

---

## 3. Organización por roles

El sistema tiene dos grandes experiencias de usuario:

### 3.1 Vista pública

La vista pública está enfocada a usuarios que consultan disponibilidad o información de préstamos.

- Se muestra un catálogo visual en 3D.
- Permite buscar activos o préstamos por texto.
- Redirige a la pantalla de acceso personal.

Archivo principal:
- vistas/index.html

Script asociado:
- js/carrusel3d.js

### 3.2 Vista de autenticación

La pantalla de login permite:

- iniciar sesión con usuario y contraseña;
- registrar una nueva cuenta de operador;
- redirigir automáticamente según el rol del usuario.

Archivo principal:
- vistas/login.html

Script asociado:
- js/auth.js

### 3.3 Panel administrativo

El administrador accede a una interfaz tipo SPA (Single Page Application) con navegación dinámica por hash.

Permite:

- ver métricas del sistema;
- administrar inventario;
- gestionar usuarios;
- revisar auditoría;
- importar datos masivamente.

Archivo principal:
- vistas/admin.html

Scripts asociados:
- js/admin_main.js
- js/dashboard.js
- js/activos.js
- js/usuarios.js
- js/auditoria.js
- js/importar.js

### 3.4 Panel de operador

El operador accede a una interfaz orientada a operaciones diarias.

Permite:

- ver el estado de préstamos y transacciones;
- registrar salidas de activos;
- gestionar tránsito de equipos;
- reportar incidencias.

Archivo principal:
- vistas/operador.html

Scripts asociados:
- js/oper_main.js
- js/oper_dashboard.js
- js/oper_transito.js
- js/oper_salida.js
- js/oper_incidencias.js

---

## 4. Funcionamiento general del frontend

El frontend funciona de forma reactiva y modular. En lugar de cargar varias páginas completas, se aprovecha una arquitectura basada en:

- HTML base cargado una vez;
- inyección dinámica del contenido principal;
- navegación por hash (#dashboard, #inventario, #usuarios, etc.);
- carga asíncrona de vistas parciales desde la carpeta vistas/admin o vistas/oper.

### Flujo de navegación

1. El usuario entra a la interfaz.
2. El script principal valida la sesión guardada en localStorage.
3. Dependiendo del rol, se redirige a admin.html o operador.html.
4. El router del panel carga la vista correspondiente según el hash de la URL.
5. Se ejecutan los scripts específicos del módulo cargado.

---

## 5. Autenticación y sesión

La autenticación se gestiona en el archivo js/auth.js.

### Qué hace

- captura el formulario de login;
- envía las credenciales al endpoint /api/auth/login;
- recibe una respuesta del backend;
- guarda en localStorage:
  - token
  - rol
  - nombre de usuario
  - id de usuario

### Comportamiento de seguridad

- si la cuenta está pendiente de aprobación, muestra un error 403;
- si el rol es admin, redirige a la vista de administración;
- si el rol es operador, redirige a la vista de operador;
- si la sesión no es válida, devuelve al usuario a login.

### Cierre de sesión

La función ejecutarCierreSesion limpia el almacenamiento local y redirige a login.html.

---

## 6. Arquitectura SPA del panel administrativo

El archivo js/admin_main.js es el centro de la interfaz administrativa.

### Funciones principales

- valida que exista una sesión activa y que el rol sea admin;
- construye la barra lateral o navbar premium;
- escucha cambios en la URL con hashchange;
- carga la vista correspondiente según la ruta;
- ejecuta el módulo específico asociado a cada vista.

### Enrutador de administración

Los módulos disponibles son:

- dashboard -> vista1_dashboard.html
- inventario -> vista2_inventario.html
- usuarios -> vista3_usuarios.html
- auditoria -> vista4_auditoria.html
- importacion -> vista5_importacion.html

Cada vista se carga dinámicamente dentro del contenedor principal del panel.

---

## 7. Arquitectura SPA del panel de operadores

El archivo js/oper_main.js gestiona la interfaz del operador.

### Funciones principales

- valida que exista una sesión activa y que el rol sea operador;
- construye el menú lateral personalizado;
- carga las vistas de:
  - dashboard
  - tránsito
  - salida
  - incidencias

Al igual que el módulo administrativo, usa navegación por hash para cargar sub-vistas sin recargar la página completa.

---

## 8. Integración con la API

El frontend no maneja la lógica de negocio directamente; delega esa responsabilidad al backend.

### Patrón de consumo

Los scripts usan fetch para enviar solicitudes a rutas del tipo:

- /api/auth/login
- /api/dashboard/metricas
- /api/activos
- /api/usuarios
- /api/prestamos
- /api/auditoria

### Manejo de respuestas

- si el backend responde con éxito, se actualiza el DOM;
- si hay error, se muestra un mensaje visual o se despliega una alerta;
- si no hay conexión, se muestra un estado de error controlado.

---

## 9. Estilos y experiencia visual

El frontend usa archivos CSS separados para mantener la interfaz organizada.

### Archivos de estilo principales

- css/variables.css: colores, tipografías y variables globales.
- css/componentes.css: estilos reutilizables para botones, formularios y tarjetas.
- css/dashboard.css: estilos del dashboard.
- css/navbar_premium.css: estilos del menú lateral premium.
- css/login.css: estilos de la pantalla de autenticación.
- css/activos.css, usuarios.css, auditoria.css, importar.css, operador.css, salida.css, retorno.css: estilos específicos por módulo.

### Características visuales

- tema oscuro por defecto;
- soporte para alternar entre tema oscuro y claro;
- interfaz visual moderna con componentes estilizados;
- uso de animaciones suaves para experiencia de usuario.

---

## 10. Módulos principales de JavaScript

### 10.1 auth.js

Responsable de:

- login;
- registro;
- manejo de sesión;
- redirección por rol;
- cierre de sesión.

### 10.2 dashboard.js

Responsable de:

- consultar métricas del backend;
- poblar KPIs del dashboard;
- renderizar gráficos con Chart.js.

### 10.3 admin_main.js

Responsable de:

- construir la interfaz de administración;
- controlar el enrutador SPA;
- cargar módulos según el hash.

### 10.4 oper_main.js

Responsable de:

- construir la interfaz de operador;
- controlar el enrutador de ventanilla;
- cargar módulos operativos.

### 10.5 carrusel3d.js

Responsable de:

- construir el catálogo interactivo público;
- permitir búsqueda y rotación visual de fichas.

### 10.6 módulos específicos

Los archivos:

- activos.js
- usuarios.js
- auditoria.js
- importar.js
- oper_transito.js
- oper_salida.js
- oper_incidencias.js

manejan la lógica detallada de cada módulo funcional.

---

## 11. Flujo completo de uso típico

### Escenario 1: Usuario público

1. El usuario entra a index.html.
2. Ve el catálogo de activos y préstamos.
3. Puede buscar o explorar.
4. Si desea ingresar, va a login.html.

### Escenario 2: Inicio de sesión de administrador

1. El usuario ingresa sus credenciales.
2. auth.js envía la información al backend.
3. Si las credenciales son correctas, se guarda el token y el rol.
4. Se redirige a admin.html.
5. admin_main.js carga el dashboard por defecto.
6. dashboard.js consulta métricas y muestra gráficos.

### Escenario 3: Inicio de sesión de operador

1. El usuario entra con sus credenciales.
2. El frontend guarda su rol como operador.
3. Se redirige a operador.html.
4. oper_main.js carga la vista por defecto.
5. El operador puede gestionar préstamos, transacciones e incidencias.

---

## 12. Ventajas de esta arquitectura

- separación clara entre estructura, estilo y lógica;
- mantenimiento más sencillo por módulos;
- navegación rápida sin recargar la página completa;
- rol-based access control desde el lado del cliente y del backend;
- escalabilidad para agregar nuevas vistas y módulos.

---

## 13. Resumen breve

El frontend completo del proyecto está compuesto por:

- una capa visual y estática servida por Nginx;
- un sistema de autenticación y sesión basado en localStorage;
- un modelo SPA para los paneles administrativos y operativos;
- módulos JavaScript que consumen la API del backend;
- estilos organizados por componentes y funcionalidades.

En conjunto, el frontend permite ofrecer una experiencia moderna, modular y orientada a la gestión de activos, préstamos y operaciones de soporte técnico.