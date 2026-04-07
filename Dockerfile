FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY package.json ./
COPY packages/frontend/package.json ./packages/frontend/
RUN npm install -w @opencode-qa/frontend

COPY packages/frontend ./packages/frontend
RUN npm run build -w @opencode-qa/frontend

FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY package.json ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/backend/drizzle.config.ts ./packages/backend/
RUN npm install -w @opencode-qa/backend

COPY packages/backend ./packages/backend
RUN npm run build -w @opencode-qa/backend
RUN npm run db:generate -w @opencode-qa/backend

FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY packages/backend/package.json ./packages/backend/
RUN npm install -w @opencode-qa/backend --omit=dev

COPY --from=backend-builder /app/packages/backend/dist ./dist
COPY --from=backend-builder /app/packages/backend/drizzle ./drizzle
COPY --from=frontend-builder /app/packages/frontend/dist ./public
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["docker-entrypoint.sh"]
