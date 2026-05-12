#!/bin/bash
# Replica Set Health Check Script
# Usage: ./verify-setup.sh

set -e

echo "🔍 MongoDB Replica Set Verification"
echo "==================================="
echo ""

PASS=0
FAIL=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check Docker daemon
if command -v docker &> /dev/null; then
  echo "✅ Docker installed"
  ((PASS++))
else
  echo "❌ Docker not found"
  ((FAIL++))
  exit 1
fi

# Check docker compose and create a helper function for either syntax
if docker compose version &> /dev/null; then
  compose() { docker compose "$@"; }
  echo "✅ Docker compose available"
  ((PASS++))
elif command -v docker-compose &> /dev/null; then
  compose() { docker-compose "$@"; }
  echo "✅ docker-compose available"
  ((PASS++))
else
  echo "❌ Docker compose not found"
  ((FAIL++))
  exit 1
fi

echo ""
echo "🐳 Checking containers..."

# Check if containers exist and are running
for container in mongo1 mongo2 mongo3 mongo-express; do
  if docker inspect "$container" >/dev/null 2>&1; then
    running=$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || echo "false")
    if [ "$running" = "true" ]; then
      echo "  ✅ $container running"
      ((PASS++))
    else
      echo "  ⚠️  $container exists but stopped (run: docker compose up -d)"
      ((FAIL++))
    fi
  else
    echo "  ❓  $container not created (run: ./start.sh)"
    ((FAIL++))
  fi
done

echo ""
echo "📊 Checking connectivity..."

# Try to ping MongoDB
PING_OK=$(docker exec mongo1 mongosh --quiet --eval "db.adminCommand('ping').ok" 2>/dev/null | tr -d '\r' | tail -n1)
if [ "$PING_OK" = "1" ]; then
  echo "  ✅ MongoDB responding"
  ((PASS++))
else
  echo "  ❌ MongoDB not responding"
  ((FAIL++))
fi

# Check replica set status
RS_OK=$(docker exec mongo1 mongosh --quiet --eval "rs.status().ok" 2>/dev/null | tr -d '\r' | tail -n1)
if [ "$RS_OK" = "1" ]; then
  echo "  ✅ Replica set configured"
  ((PASS++))
else
  echo "  ⚠️  Replica set may not be initialized"
fi

echo ""
echo "📚 Checking seed data..."

# Count users
USER_COUNT=$(docker exec mongo1 mongosh --quiet --eval "db.getSiblingDB('mongo_labs').users.countDocuments({})" 2>/dev/null | tr -d '\r' | tail -n1)
[ -z "$USER_COUNT" ] && USER_COUNT="0"
if [ "$USER_COUNT" = "3" ]; then
  echo "  ✅ Users table seeded ($USER_COUNT documents)"
  ((PASS++))
else
  echo "  ❌ Users not seeded (expected 3, got $USER_COUNT)"
  ((FAIL++))
fi

# Count products
PRODUCT_COUNT=$(docker exec mongo1 mongosh --quiet --eval "db.getSiblingDB('mongo_labs').products.countDocuments({})" 2>/dev/null | tr -d '\r' | tail -n1)
[ -z "$PRODUCT_COUNT" ] && PRODUCT_COUNT="0"
if [ "$PRODUCT_COUNT" = "3" ]; then
  echo "  ✅ Products table seeded ($PRODUCT_COUNT documents)"
  ((PASS++))
else
  echo "  ⚠️  Products may not be seeded (got $PRODUCT_COUNT)"
fi

# Count orders
ORDER_COUNT=$(docker exec mongo1 mongosh --quiet --eval "db.getSiblingDB('mongo_labs').orders.countDocuments({})" 2>/dev/null | tr -d '\r' | tail -n1)
[ -z "$ORDER_COUNT" ] && ORDER_COUNT="0"
if [ "$ORDER_COUNT" = "3" ]; then
  echo "  ✅ Orders table seeded ($ORDER_COUNT documents)"
  ((PASS++))
else
  echo "  ⚠️  Orders may not be seeded (got $ORDER_COUNT)"
fi

echo ""
echo "🔧 Checking ports..."

# Check port availability (cross-platform using Python socket)
while IFS=':' read -r port state; do
  if [ "$state" = "open" ]; then
    echo "  ✅ Port $port open"
    ((PASS++))
  else
    echo "  ⚠️  Port $port not listening"
  fi
done < <(python3 - <<'PY'
import socket
for port in (27017, 27018, 27019, 8081):
    s = socket.socket()
    s.settimeout(1)
    try:
        s.connect(("127.0.0.1", port))
        print(f"{port}:open")
    except Exception:
        print(f"{port}:closed")
    finally:
        s.close()
PY
)

echo ""
echo "🎓 Checking Jupyter setup..."

if [ -d "../notebooks" ]; then
  NOTEBOOKS=$(find ../notebooks -name "*.ipynb" | wc -l | tr -d '[:space:]')
  if [ "$NOTEBOOKS" = "11" ]; then
    echo "  ✅ All 11 Jupyter notebooks found"
    ((PASS++))
  else
    echo "  ⚠️  Found $NOTEBOOKS notebooks (expected 11)"
  fi
else
  echo "  ❌ Notebooks directory not found"
  ((FAIL++))
fi

echo ""
echo "=================================="
echo "✅ Passed: $PASS"
if [ $FAIL -gt 0 ]; then
  echo "❌ Failed: $FAIL"
  echo ""
  echo "🔧 To fix common issues:"
  echo "   docker compose down -v        # Clean everything"
  echo "   cd docker && ./start.sh        # Restart"
else
  echo ""
  echo "🎉 All checks passed!"
  echo ""
  echo "🚀 Next steps:"
  echo "   cd ../notebooks"
  echo "   jupyter notebook 01_database_basics.ipynb"
fi

