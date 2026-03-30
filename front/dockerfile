# --- Estágio 1: Build (Construção) ---
FROM node:20-alpine AS build

WORKDIR /app

# Copia apenas os arquivos de dependência primeiro (para cachear o install)
COPY package.json package-lock.json* ./

# Instala as dependências
RUN npm install
RUN npm install -D vite-plugin-pwa

# Copia o resto do código fonte
COPY . .

# Compila o projeto (Gera a pasta /dist)
RUN npm run build

# --- Estágio 2: Servidor Web (Nginx) ---
FROM nginx:alpine

# Copia a configuração customizada do Nginx (criaremos abaixo)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos estáticos gerados no estágio anterior
# NOTA: Se seu projeto for Vite padrão, a pasta é /app/dist.
# Se for Create React App antigo, pode ser /app/build.
COPY --from=build /app/dist /usr/share/nginx/html

# Exposição da porta (Apenas documental, o Compose que manda)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
