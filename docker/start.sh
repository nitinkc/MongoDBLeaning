#!/bin/bash
# Quick start script for MongoDB Learning Labs
# Usage: ./start.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🍃 Starting MongoDB Learning Labs (3-node Replica Set)..."
echo ""

cd "$SCRIPT_DIR"

# Pull images first
echo "📦 Pulling Docker images..."
docker compose pull

# Start the cluster
echo "🚀 Starting containers..."
docker compose up -d

echo ""
echo "⏳ Waiting for replica set initialization (this may take 30-60 seconds)..."
sleep 15

# Check health
echo ""
echo "🔍 Checking cluster status..."
docker compose ps

echo ""
echo "✅ MongoDB Learning Labs is ready!"
echo ""
echo "   Primary:         mongodb://localhost:27017"
echo "   Secondary 1:     mongodb://localhost:27018"
echo "   Secondary 2:     mongodb://localhost:27019"
echo "   Replica Set URI: mongodb://localhost:27017,localhost:27018,localhost:27019/?replicaSet=rs0"
echo "   Mongo Express:   http://localhost:8081"
echo ""
echo "📚 Run labs:"
echo "   docker exec -it mongo1 mongosh --file /labs/01_database_basics.js"
echo ""
echo "🔧 Interactive shell:"
echo "   docker exec -it mongo1 mongosh"
echo ""
echo "🛑 Stop cluster:"
echo "   docker compose down"

