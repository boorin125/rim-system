# rim-updater — built on the server by setup-updater.sh (not pushed to Docker Hub)
FROM node:20-alpine
RUN apk add --no-cache docker-cli docker-cli-compose
WORKDIR /updater
COPY updater.mjs server.mjs ./
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3090/health >/dev/null || exit 1
CMD ["node", "server.mjs"]
