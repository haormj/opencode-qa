#!/bin/sh
set -e

cd /app

mkdir -p /app/data

echo "Running database migrations..."
node dist/db/migrate.js

echo "Running database seed..."
node dist/db/seed.js

echo "Starting application..."
exec node dist/index.js
