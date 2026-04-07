#!/bin/sh
set -e

cd /app

mkdir -p /app/data

echo "Initializing database..."
node dist/db/auto-init.js

echo "Running database seed..."
node dist/db/seed.js

echo "Starting application..."
exec node dist/index.js
