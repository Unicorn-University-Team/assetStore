# One Dockerfile for every backend service. Build from the repository root (npm workspaces):
#   docker build -f services/Dockerfile --build-arg SERVICE=catalog .
ARG SERVICE

FROM node:24-alpine AS build
ARG SERVICE
WORKDIR /app
# Manifests first: `npm ci` stays cached until dependencies change.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY services/identity/package.json services/identity/
COPY services/catalog/package.json services/catalog/
COPY services/community/package.json services/community/
RUN npm ci --ignore-scripts -w @assetstore/shared -w "@assetstore/${SERVICE}"
COPY packages/shared packages/shared
COPY services/${SERVICE} services/${SERVICE}
RUN npm run build -w @assetstore/shared && npm run build -w "@assetstore/${SERVICE}"

FROM node:24-alpine
ARG SERVICE
ENV NODE_ENV=production NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY services/identity/package.json services/identity/
COPY services/catalog/package.json services/catalog/
COPY services/community/package.json services/community/
# --ignore-scripts skips the root postinstall (it needs dev tools); Prisma's schema engine
# for `migrate deploy` is then fetched by rebuilding just @prisma/engines.
RUN npm ci --omit=dev --ignore-scripts -w "@assetstore/${SERVICE}" \
  && npm rebuild @prisma/engines \
  && npm cache clean --force
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/services/${SERVICE}/dist services/${SERVICE}/dist
COPY services/${SERVICE}/prisma services/${SERVICE}/prisma
COPY services/${SERVICE}/prisma.config.ts services/${SERVICE}/
WORKDIR /app/services/${SERVICE}
USER node
EXPOSE 3000
# Apply pending database migrations, then start the service.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
