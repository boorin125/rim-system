#!/bin/sh
set -e

echo "[entrypoint] Running prisma db push..."
npx prisma db push --accept-data-loss

echo "[entrypoint] Starting server..."
exec node dist/main.js
