#!/bin/sh
set -e

cd /app

mkdir -p /app/data

echo "Running database seed (includes auto-migrate)..."
node dist/db/seed.js

echo "Starting application..."
exec node dist/index.js
