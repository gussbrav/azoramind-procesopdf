# Stage 1: build React
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_URL = "/" porque nginx hace el proxy internamente
# Se puede sobreescribir con build-arg para cert/dev
ARG VITE_API_URL=/
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2: nginx para servir la SPA + proxy al backend
FROM nginx:alpine

# Config nginx con proxy a carlos-backend:8001
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
