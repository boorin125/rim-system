FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-retries=5
COPY . .
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate
RUN npm run build

FROM node:20-alpine AS production

ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
ARG APP_VERSION=1.0.0

RUN apk add --no-cache curl samba-client

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-retries=5 && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

ENV GIT_COMMIT=${GIT_COMMIT}
ENV BUILD_DATE=${BUILD_DATE}
ENV APP_VERSION=${APP_VERSION}

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=6 \
  CMD nc -z 127.0.0.1 3000 || exit 1

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
