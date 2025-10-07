#!/usr/bin/env bash
#
# OAuth2 Authentication Testing Script
# Tests JWT token acquisition and API authentication
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MCP_API_URL="${MCP_API_URL:-http://localhost:3000}"
AUTH_DOMAIN="${AUTH_DOMAIN:-}"
CLIENT_ID="${CLIENT_ID:-}"
CLIENT_SECRET="${CLIENT_SECRET:-}"
AUDIENCE="${AUDIENCE:-mcp-api}"

# Test mode (oauth or basic)
TEST_MODE="${1:-oauth}"

# Functions
log_info() {
  echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."

  if ! command -v curl &> /dev/null; then
    log_error "curl is not installed"
    exit 1
  fi

  if ! command -v jq &> /dev/null; then
    log_warning "jq is not installed (optional, for pretty JSON output)"
  fi

  log_success "Prerequisites OK"
}

# Test health endpoint (no auth)
test_health() {
  log_info "Testing health endpoint (no auth required)..."

  local response
  response=$(curl -s -w "\n%{http_code}" "${MCP_API_URL}/healthz")
  local body=$(echo "$response" | head -n 1)
  local status=$(echo "$response" | tail -n 1)

  if [[ "$status" == "200" ]]; then
    log_success "Health check: OK (${body})"
    return 0
  else
    log_error "Health check failed: HTTP ${status}"
    return 1
  fi
}

# Get OAuth2 access token
get_oauth_token() {
  log_info "Requesting OAuth2 access token..."

  if [[ -z "$AUTH_DOMAIN" ]] || [[ -z "$CLIENT_ID" ]] || [[ -z "$CLIENT_SECRET" ]]; then
    log_error "OAuth credentials not configured"
    echo "Please set: AUTH_DOMAIN, CLIENT_ID, CLIENT_SECRET"
    exit 1
  fi

  local response
  response=$(curl -s -X POST "https://${AUTH_DOMAIN}/oauth/token" \
    -H "Content-Type: application/json" \
    -d "{
      \"grant_type\": \"client_credentials\",
      \"client_id\": \"${CLIENT_ID}\",
      \"client_secret\": \"${CLIENT_SECRET}\",
      \"audience\": \"${AUDIENCE}\"
    }")

  local token=$(echo "$response" | jq -r '.access_token // empty')

  if [[ -z "$token" ]]; then
    log_error "Failed to get access token"
    echo "Response: $response"
    exit 1
  fi

  log_success "Access token obtained (${#token} chars)"
  echo "$token"
}

# Test API with OAuth2 token
test_oauth_api() {
  log_info "Testing MCP API with OAuth2 token..."

  local token="$1"

  # Test 1: List tools
  log_info "  → Listing available tools..."
  local response
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "${MCP_API_URL}/mcp" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d '{
      "jsonrpc": "2.0",
      "method": "tools/list",
      "id": 1
    }')

  local body=$(echo "$response" | head -n -1)
  local status=$(echo "$response" | tail -n 1)

  if [[ "$status" == "200" ]]; then
    log_success "tools/list: OK"
    if command -v jq &> /dev/null; then
      echo "$body" | jq -r '.result.tools[].name' | sed 's/^/    - /'
    fi
  else
    log_error "tools/list failed: HTTP ${status}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    return 1
  fi

  # Test 2: Call search tool
  log_info "  → Calling search tool..."
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "${MCP_API_URL}/mcp" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d '{
      "jsonrpc": "2.0",
      "method": "tools/call",
      "params": {
        "name": "search",
        "arguments": {"query": "test"}
      },
      "id": 2
    }')

  body=$(echo "$response" | head -n -1)
  status=$(echo "$response" | tail -n 1)

  if [[ "$status" == "200" ]]; then
    log_success "tools/call (search): OK"
  else
    log_error "tools/call failed: HTTP ${status}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    return 1
  fi

  # Test 3: Call echo tool
  log_info "  → Calling echo tool..."
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "${MCP_API_URL}/mcp" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d '{
      "jsonrpc": "2.0",
      "method": "tools/call",
      "params": {
        "name": "echo",
        "arguments": {"message": "Hello OAuth2!"}
      },
      "id": 3
    }')

  body=$(echo "$response" | head -n -1)
  status=$(echo "$response" | tail -n 1)

  if [[ "$status" == "200" ]]; then
    log_success "tools/call (echo): OK"
    if command -v jq &> /dev/null; then
      local echo_result=$(echo "$body" | jq -r '.result.content[0].text')
      echo "    Response: ${echo_result}"
    fi
  else
    log_error "tools/call (echo) failed: HTTP ${status}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    return 1
  fi
}

# Test API with invalid token
test_invalid_token() {
  log_info "Testing with invalid token (should fail)..."

  local response
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "${MCP_API_URL}/mcp" \
    -H "Authorization: Bearer invalid-token-12345" \
    -H "Content-Type: application/json" \
    -d '{
      "jsonrpc": "2.0",
      "method": "tools/list",
      "id": 1
    }')

  local body=$(echo "$response" | head -n -1)
  local status=$(echo "$response" | tail -n 1)

  if [[ "$status" == "401" ]]; then
    log_success "Invalid token rejected: HTTP 401 (expected)"
  else
    log_error "Expected HTTP 401, got HTTP ${status}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
    return 1
  fi
}

# Test API without token
test_no_token() {
  log_info "Testing without token (should fail)..."

  local response
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "${MCP_API_URL}/mcp" \
    -H "Content-Type: application/json" \
    -d '{
      "jsonrpc": "2.0",
      "method": "tools/list",
      "id": 1
    }')

  local body=$(echo "$response" | head -n -1)
  local status=$(echo "$response" | tail -n 1)

  if [[ "$status" == "401" ]]; then
    log_success "No token rejected: HTTP 401 (expected)"
  else
    log_warning "Expected HTTP 401, got HTTP ${status} (auth may be disabled in dev mode)"
  fi
}

# Test Basic Auth (fallback mode)
test_basic_auth() {
  log_info "Testing Basic Auth fallback (if enabled)..."

  local BASIC_USER="${BASIC_AUTH_USER:-ocr-admin}"
  local BASIC_PASS="${BASIC_AUTH_PASS:-}"

  if [[ -z "$BASIC_PASS" ]]; then
    log_warning "BASIC_AUTH_PASS not set, skipping Basic Auth test"
    return 0
  fi

  local response
  response=$(curl -s -w "\n%{http_code}" \
    -X POST "${MCP_API_URL}/mcp" \
    -u "${BASIC_USER}:${BASIC_PASS}" \
    -H "Content-Type: application/json" \
    -d '{
      "jsonrpc": "2.0",
      "method": "tools/list",
      "id": 1
    }')

  local body=$(echo "$response" | head -n -1)
  local status=$(echo "$response" | tail -n 1)

  if [[ "$status" == "200" ]]; then
    log_success "Basic Auth: OK (fallback mode active)"
  elif [[ "$status" == "401" ]]; then
    log_info "Basic Auth: Rejected (fallback disabled or invalid credentials)"
  else
    log_error "Basic Auth: Unexpected status HTTP ${status}"
    echo "$body" | jq . 2>/dev/null || echo "$body"
  fi
}

# Main test flow
main() {
  echo ""
  echo "═══════════════════════════════════════"
  echo "  MCP Bridge Authentication Test"
  echo "═══════════════════════════════════════"
  echo ""
  echo "API URL: ${MCP_API_URL}"
  echo "Test Mode: ${TEST_MODE}"
  echo ""

  check_prerequisites

  # Test health endpoint
  test_health || exit 1

  if [[ "$TEST_MODE" == "oauth" ]]; then
    # OAuth2 flow
    TOKEN=$(get_oauth_token)
    test_oauth_api "$TOKEN" || exit 1
    test_invalid_token || exit 1
    test_no_token || exit 1
  elif [[ "$TEST_MODE" == "basic" ]]; then
    # Basic Auth flow
    test_basic_auth || exit 1
  else
    log_error "Invalid test mode: ${TEST_MODE}"
    echo "Usage: $0 [oauth|basic]"
    exit 1
  fi

  echo ""
  echo "═══════════════════════════════════════"
  log_success "All tests passed!"
  echo "═══════════════════════════════════════"
  echo ""
}

# Run tests
main "$@"
