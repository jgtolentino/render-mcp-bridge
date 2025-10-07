#!/usr/bin/env bash
#
# Comprehensive OAuth2 Authentication Test Suite
# Tests all auth scenarios as specified in gaps/fixes
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
MCP_API_URL="${MCP_API_URL:-http://localhost:3000}"
AUTH_DOMAIN="${AUTH_DOMAIN:-}"
CLIENT_ID="${CLIENT_ID:-}"
CLIENT_SECRET="${CLIENT_SECRET:-}"
AUDIENCE="${AUDIENCE:-mcp-api}"

PASSED=0
FAILED=0

log_pass() {
  echo -e "${GREEN}✓${NC} $1"
  ((PASSED++))
}

log_fail() {
  echo -e "${RED}✗${NC} $1"
  ((FAILED++))
}

# Test 1: No token → 401
test_no_token() {
  echo "Test 1: No token → 401"

  local response
  response=$(curl -si -X POST "${MCP_API_URL}/mcp" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{}' 2>/dev/null)

  if echo "$response" | grep -q "401"; then
    log_pass "No token correctly rejected with 401"
  else
    log_fail "Expected 401, got: $(echo "$response" | head -1)"
  fi
}

# Test 2: Wrong audience → 401
test_wrong_aud() {
  echo ""
  echo "Test 2: Wrong audience → 401"

  if [[ -z "$AUTH_DOMAIN" ]]; then
    echo "  Skipped (no AUTH_DOMAIN configured)"
    return
  fi

  # Get token with wrong audience
  local token
  token=$(curl -s -X POST "https://${AUTH_DOMAIN}/oauth/token" \
    -H "Content-Type: application/json" \
    -d "{
      \"grant_type\": \"client_credentials\",
      \"client_id\": \"${CLIENT_ID}\",
      \"client_secret\": \"${CLIENT_SECRET}\",
      \"audience\": \"wrong-audience\"
    }" | jq -r '.access_token // empty' 2>/dev/null)

  if [[ -z "$token" ]]; then
    echo "  Skipped (could not get token with wrong audience)"
    return
  fi

  local response
  response=$(curl -si -X POST "${MCP_API_URL}/mcp" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{}' 2>/dev/null)

  if echo "$response" | grep -q "401"; then
    log_pass "Wrong audience correctly rejected with 401"
  else
    log_fail "Expected 401 for wrong audience"
  fi
}

# Test 3: Missing scope → 403
test_missing_scope() {
  echo ""
  echo "Test 3: Missing scope (tools.read only) → 403"

  if [[ -z "$AUTH_DOMAIN" ]]; then
    echo "  Skipped (no AUTH_DOMAIN configured)"
    return
  fi

  # Get token with only read scope (needs tools.exec for /mcp)
  local token
  token=$(curl -s -X POST "https://${AUTH_DOMAIN}/oauth/token" \
    -H "Content-Type: application/json" \
    -d "{
      \"grant_type\": \"client_credentials\",
      \"client_id\": \"${CLIENT_ID}\",
      \"client_secret\": \"${CLIENT_SECRET}\",
      \"audience\": \"${AUDIENCE}\",
      \"scope\": \"mcp:tools.read\"
    }" | jq -r '.access_token // empty' 2>/dev/null)

  if [[ -z "$token" ]]; then
    echo "  Skipped (could not get token with read-only scope)"
    return
  fi

  local response
  response=$(curl -si -X POST "${MCP_API_URL}/mcp" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' 2>/dev/null)

  if echo "$response" | grep -q "403"; then
    log_pass "Missing scope correctly rejected with 403"
  else
    log_fail "Expected 403 for missing scope"
  fi
}

# Test 4: Happy path (correct token + scope) → 200
test_happy_path() {
  echo ""
  echo "Test 4: Happy path (correct token + scope) → 200"

  if [[ -z "$AUTH_DOMAIN" ]]; then
    echo "  Skipped (no AUTH_DOMAIN configured)"
    return
  fi

  # Get token with correct scope
  local token
  token=$(curl -s -X POST "https://${AUTH_DOMAIN}/oauth/token" \
    -H "Content-Type: application/json" \
    -d "{
      \"grant_type\": \"client_credentials\",
      \"client_id\": \"${CLIENT_ID}\",
      \"client_secret\": \"${CLIENT_SECRET}\",
      \"audience\": \"${AUDIENCE}\",
      \"scope\": \"mcp:tools.exec\"
    }" | jq -r '.access_token // empty' 2>/dev/null)

  if [[ -z "$token" ]]; then
    log_fail "Could not get access token"
    return
  fi

  local response
  response=$(curl -s -X POST "${MCP_API_URL}/mcp" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","method":"tools/list","id":1}')

  if echo "$response" | jq -e '.result' >/dev/null 2>&1; then
    log_pass "Happy path successful (200 with valid response)"
    echo "  Available tools:"
    echo "$response" | jq -r '.result.tools[].name' 2>/dev/null | sed 's/^/    - /'
  else
    log_fail "Expected valid JSON-RPC response"
  fi
}

# Test 5: Expired token → 401
test_expired_token() {
  echo ""
  echo "Test 5: Expired token → 401"

  # Fake expired token (invalid signature, will fail)
  local expired_token="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0IiwiZXhwIjoxfQ.invalid"

  local response
  response=$(curl -si -X POST "${MCP_API_URL}/mcp" \
    -H "Authorization: Bearer ${expired_token}" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{}' 2>/dev/null)

  if echo "$response" | grep -q "401"; then
    log_pass "Expired/invalid token correctly rejected with 401"
  else
    log_fail "Expected 401 for expired token"
  fi
}

# Test 6: Health endpoints (no auth required)
test_health_endpoints() {
  echo ""
  echo "Test 6: Health endpoints (no auth)"

  # /healthz
  local health_response
  health_response=$(curl -s "${MCP_API_URL}/healthz")

  if [[ "$health_response" == "ok" ]]; then
    log_pass "/healthz accessible without auth"
  else
    log_fail "/healthz failed"
  fi

  # /readyz
  local ready_response
  ready_response=$(curl -s -w "\n%{http_code}" "${MCP_API_URL}/readyz")
  local ready_body=$(echo "$ready_response" | head -n -1)
  local ready_status=$(echo "$ready_response" | tail -n 1)

  if [[ "$ready_status" == "200" ]] || [[ "$ready_status" == "503" ]]; then
    log_pass "/readyz accessible without auth (status: ${ready_status})"
  else
    log_fail "/readyz unexpected status: ${ready_status}"
  fi
}

# Test 7: Metrics endpoint (requires admin scope)
test_metrics_endpoint() {
  echo ""
  echo "Test 7: Metrics endpoint (requires admin)"

  if [[ -z "$AUTH_DOMAIN" ]]; then
    echo "  Skipped (no AUTH_DOMAIN configured)"
    return
  fi

  # Try without token → 401
  local response
  response=$(curl -si "${MCP_API_URL}/metrics" 2>/dev/null)

  if echo "$response" | grep -q "401"; then
    log_pass "Metrics endpoint requires auth (401 without token)"
  else
    log_fail "Expected 401 for metrics without token"
  fi

  # Try with non-admin token → 403
  local token
  token=$(curl -s -X POST "https://${AUTH_DOMAIN}/oauth/token" \
    -H "Content-Type: application/json" \
    -d "{
      \"grant_type\": \"client_credentials\",
      \"client_id\": \"${CLIENT_ID}\",
      \"client_secret\": \"${CLIENT_SECRET}\",
      \"audience\": \"${AUDIENCE}\",
      \"scope\": \"mcp:tools.exec\"
    }" | jq -r '.access_token // empty' 2>/dev/null)

  if [[ -n "$token" ]]; then
    response=$(curl -si -H "Authorization: Bearer ${token}" \
      "${MCP_API_URL}/metrics" 2>/dev/null)

    if echo "$response" | grep -q "403"; then
      log_pass "Metrics endpoint rejects non-admin (403)"
    else
      log_fail "Expected 403 for non-admin accessing metrics"
    fi
  fi
}

# Test 8: Rate limiting
test_rate_limiting() {
  echo ""
  echo "Test 8: Rate limiting (100 req/min)"

  if [[ -z "$AUTH_DOMAIN" ]]; then
    echo "  Skipped (no AUTH_DOMAIN configured)"
    return
  fi

  # Get token
  local token
  token=$(curl -s -X POST "https://${AUTH_DOMAIN}/oauth/token" \
    -H "Content-Type: application/json" \
    -d "{
      \"grant_type\": \"client_credentials\",
      \"client_id\": \"${CLIENT_ID}\",
      \"client_secret\": \"${CLIENT_SECRET}\",
      \"audience\": \"${AUDIENCE}\",
      \"scope\": \"mcp:tools.exec\"
    }" | jq -r '.access_token // empty' 2>/dev/null)

  if [[ -z "$token" ]]; then
    echo "  Skipped (could not get token)"
    return
  fi

  echo "  Sending 105 requests (limit: 100/min)..."

  local rate_limited=0
  for i in {1..105}; do
    local response
    response=$(curl -s -w "\n%{http_code}" -X POST "${MCP_API_URL}/mcp" \
      -H "Authorization: Bearer ${token}" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json, text/event-stream" \
      -d '{"jsonrpc":"2.0","method":"tools/list","id":1}')

    local status=$(echo "$response" | tail -n 1)
    if [[ "$status" == "429" ]]; then
      rate_limited=1
      break
    fi

    # Show progress every 20 requests
    if (( i % 20 == 0 )); then
      echo "    $i requests sent..."
    fi
  done

  if [[ "$rate_limited" == "1" ]]; then
    log_pass "Rate limiting enforced (429 after limit exceeded)"
  else
    log_fail "Rate limiting not enforced (expected 429)"
  fi
}

# Main
main() {
  echo "═══════════════════════════════════════"
  echo "  Comprehensive Auth Test Suite"
  echo "═══════════════════════════════════════"
  echo "API URL: ${MCP_API_URL}"
  echo ""

  test_no_token
  test_expired_token
  test_health_endpoints

  # OAuth-specific tests (skip if not configured)
  if [[ -n "$AUTH_DOMAIN" ]]; then
    test_wrong_aud
    test_missing_scope
    test_happy_path
    test_metrics_endpoint
    test_rate_limiting
  else
    echo ""
    echo "⚠️  OAuth tests skipped (AUTH_DOMAIN not set)"
    echo "   Set AUTH_DOMAIN, CLIENT_ID, CLIENT_SECRET to run full tests"
  fi

  echo ""
  echo "═══════════════════════════════════════"
  echo "Results: ${GREEN}${PASSED} passed${NC}, ${RED}${FAILED} failed${NC}"
  echo "═══════════════════════════════════════"

  if [[ "$FAILED" -gt 0 ]]; then
    exit 1
  fi
}

main "$@"
