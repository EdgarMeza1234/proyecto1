# Dockerfile - Backend Node.js
# Sistema de Reparación - backend
FROM node:20-bookworm-slim

# Herramientas para compilar better-sqlite3 (módulo nativo)
RUN apt-get update && apt-get install -y python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias primero (mejor cache de Docker)
COPY package*.json ./
RUN npm install --omit=dev

# Copiar código
COPY . .

EXPOSE 4001
CMD ["node", "server.js"]
