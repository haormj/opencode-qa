FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY packages/frontend/package.json ./packages/frontend/
WORKDIR /app/packages/frontend
RUN npm install

COPY packages/frontend ./
RUN npm run build

FROM node:20-alpine AS backend-builder

WORKDIR /app

COPY packages/backend/package.json ./packages/backend/
WORKDIR /app/packages/backend
RUN npm install

COPY packages/backend ./
RUN npm run build

FROM node:20-alpine

WORKDIR /app/packages/backend

COPY packages/backend/package.json ./
RUN npm install --omit=dev

COPY --from=backend-builder /app/packages/backend/dist ./dist
COPY --from=backend-builder /app/packages/backend/scripts ./dist/scripts
COPY --from=backend-builder /app/packages/backend/drizzle ./drizzle
COPY --from=frontend-builder /app/packages/frontend/dist ./public

RUN mkdir -p data

EXPOSE 8000

CMD ["node", "dist/index.js"]
