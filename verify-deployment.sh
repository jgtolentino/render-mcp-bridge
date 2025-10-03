#!/bin/bash
set -euo pipefail

# Render MCP Bridge Deployment Verification Script

echo "🔍 Render MCP Bridge - Deployment Verification"
echo "=============================================="
echo

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get URL from user
if [ -z "${1:-}" ]; then
  echo "Usage: ./verify-deployment.sh <your-render-url>"
  echo "Example: ./verify-deployment.sh https://mcp-bridge-abc123.onrender.com"
  echo
  echo "Or with custom domain:"
  echo "Example: ./verify-deployment.sh https://mcp.pulser-ai.app"
  exit 1
fi

BASE_URL="$1"
ERRORS=0

# Function to test endpoint
test_endpoint() {
  local name="$1"
  local method="$2"
  local path="$3"
  local expected_code="${4:-200}"
  local data="${5:-}"

  echo -n "Testing $name... "

  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$path" 2>&1)
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" \
      -d "$data" 2>&1)
  fi

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "$expected_code" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $http_code, expected $expected_code)"
    ERRORS=$((ERRORS + 1))
    return 1
  fi
}

# Function to test SSE stream
test_sse() {
  echo -n "Testing SSE stream... "

  # Connect to SSE and read first event (with timeout)
  timeout 5s curl -N -s "$BASE_URL/mcp/events" 2>&1 | head -n 4 > /tmp/sse_test.txt || true

  if grep -q "event: ping" /tmp/sse_test.txt; then
    echo -e "${GREEN}✓ PASS${NC} (receiving ping events)"
    rm -f /tmp/sse_test.txt
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (no ping events received)"
    ERRORS=$((ERRORS + 1))
    rm -f /tmp/sse_test.txt
    return 1
  fi
}

echo "Target: $BASE_URL"
echo

# Run tests
echo "1️⃣  Health Check"
test_endpoint "Health endpoint" "GET" "/healthz"
echo

echo "2️⃣  Service Info"
test_endpoint "Root endpoint" "GET" "/"
echo

echo "3️⃣  SSE Event Stream"
test_sse
echo

echo "4️⃣  MCP Tool Invocation"
test_endpoint "Invoke endpoint" "POST" "/mcp/invoke" "200" '{"tool":"echo","params":{"message":"test"}}'
echo

# Summary
echo "=============================================="
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  echo
  echo "Your MCP server is operational and ready for:"
  echo "  • DNS configuration (if using custom domain)"
  echo "  • ChatGPT connector integration"
  echo "  • Tool implementation"
  exit 0
else
  echo -e "${RED}❌ $ERRORS test(s) failed${NC}"
  echo
  echo "Check Render logs for details:"
  echo "  https://dashboard.render.com/"
  exit 1
fi
