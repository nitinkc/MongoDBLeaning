#!/bin/bash
# Quick start script for MongoDB Learning Labs
# Usage: ./start.sh [--clean] [--logs]
#   --clean : Remove volumes and start fresh
#   --logs  : Tail logs after startup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLEAN=false
LOGS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --clean) CLEAN=true; shift ;;
    --logs) LOGS=true; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

cd "$SCRIPT_DIR"

if [ "$CLEAN" = true ]; then
  echo "🗑️  Cleaning up existing volumes..."
  docker compose down -v 2>/dev/null || true
fi

echo "🍃 Starting MongoDB Learning Labs (3-node Replica Set)..."
echo ""

# Pull images
echo "📦 Pulling Docker images..."
docker compose pull --quiet

# Start the cluster
echo "🚀 Starting containers..."
docker compose up -d

echo ""
echo "⏳ Waiting for initialization (this may take 30-60 seconds)..."
echo ""

# Wait for primary to be ready
MAX_ATTEMPTS=60
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  if docker exec mongo1 mongosh --port 27017 --eval "db.adminCommand('ping').ok" --quiet >/dev/null 2>&1; then
    echo "✅ Primary node is ready"
    break
  fi
  echo -n "."
  ATTEMPT=$((ATTEMPT + 1))
  sleep 1
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
  echo "❌ Timeout: MongoDB did not start in time"
  echo "Try: docker compose logs mongo1"
  exit 1
fi

# Wait for one-shot init container to complete successfully
echo "⏳ Waiting for mongo-init to finish..."
MAX_INIT_ATTEMPTS=60
INIT_ATTEMPT=0
while [ $INIT_ATTEMPT -lt $MAX_INIT_ATTEMPTS ]; do
  INIT_STATE=$(docker inspect -f '{{.State.Status}}' mongo-init 2>/dev/null || echo "missing")
  INIT_EXIT=$(docker inspect -f '{{.State.ExitCode}}' mongo-init 2>/dev/null || echo "1")

  if [ "$INIT_STATE" = "exited" ] && [ "$INIT_EXIT" = "0" ]; then
    echo "✅ mongo-init completed"
    break
  fi

  if [ "$INIT_STATE" = "exited" ] && [ "$INIT_EXIT" != "0" ]; then
    echo "❌ mongo-init failed (exit code $INIT_EXIT)"
    echo "Try: docker compose logs --no-color mongo-init"
    exit 1
  fi

  INIT_ATTEMPT=$((INIT_ATTEMPT + 1))
  sleep 1
done

if [ $INIT_ATTEMPT -eq $MAX_INIT_ATTEMPTS ]; then
  echo "❌ Timeout: mongo-init did not finish in time"
  echo "Try: docker compose logs --no-color mongo-init"
  exit 1
fi

echo ""
echo "🔍 Checking cluster status..."
docker compose ps

echo ""
echo "✅ MongoDB Learning Labs is ready!"
echo ""
echo "📊 Admin Dashboard:  http://localhost:8081"
echo ""
echo "🔌 Connection URIs:"
echo "   Host (safe): mongosh 'mongodb://127.0.0.1:27017/mongo_labs?directConnection=true'"
echo "   Docker net:  docker exec -it mongo1 mongosh 'mongodb://localhost:27017/mongo_labs?replicaSet=rs0'"
echo ""
echo "📚 Run Jupyter labs:"
echo "   cd .. && jupyter notebook notebooks/01_database_basics.ipynb"
echo ""
echo "🔧 Interactive mongosh shell:"
echo "   docker exec -it mongo1 mongosh 'mongodb://localhost:27017/mongo_labs?replicaSet=rs0'"
echo ""
echo "📖 View initialization logs:"
echo "   docker compose logs mongo-init"
echo ""
echo "🛑 Stop the cluster:"
echo "   docker compose down"
echo ""
echo "🗑️  Remove data and start fresh:"
echo "   docker compose down -v && ./start.sh"
echo ""

if [ "$LOGS" = true ]; then
  echo "📺 Tailing logs (Ctrl+C to exit)..."
  docker compose logs -f
fi

