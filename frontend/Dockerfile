FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Caddy serves the static build; its config comes from deploy/Caddyfile (mounted by docker-compose.yml).
FROM caddy:2-alpine
COPY --from=build /app/dist /srv
