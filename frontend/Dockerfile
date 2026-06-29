FROM nginx:1.25-alpine

# Limpiar los archivos estáticos por defecto de nginx
RUN rm -rf /usr/share/nginx/html/*

# Copiar todo el contenido de la carpeta frontend al contenedor de nginx
COPY . /usr/share/nginx/html

# Exponer puerto del servidor estático
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]