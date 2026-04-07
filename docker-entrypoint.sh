#!/bin/sh
set -e

cd /app/packages/backend

mkdir -p data

echo "Starting application..."
exec node dist/index.js
