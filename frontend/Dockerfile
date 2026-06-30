FROM nginx:1.25-alpine

# 1. Copiamos las carpetas de estilos y lógica a sus rutas correspondientes
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

# 2. 🔥 LA CLAVE: Copiamos el CONTENIDO de vistas directamente a la raíz de Nginx
# Al usar el '/' al final de vistas/, indicamos que queremos su contenido interno
COPY vistas/ /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]