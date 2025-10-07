#!/usr/bin/env bash
#
# CI Deployment Gates Script
# Validates production safety checks before deployment
#
# Usage:
#   ./scripts/ci-deployment-gates.sh [environment]
#
# Exit codes:
#   0 - All gates passed
#   1 - Gate failure (deployment blocked)
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
ENVIRONMENT="${1:-${NODE_ENV:-development}}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log_pass() {
  echo -e "${GREEN}✓${NC} $1"
}

log_fail() {
  echo -e "${RED}✗${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

# Gate 1: Production Basic Auth Fallback Check
# CRITICAL: Basic Auth fallback MUST be disabled in production
gate_basic_auth_fallback() {
  echo ""
  echo "Gate 1: Basic Auth Fallback Check"

  if [[ "$ENVIRONMENT" == "production" ]]; then
    if [[ "${ENABLE_BASIC_AUTH_FALLBACK:-false}" != "false" ]]; then
      log_fail "ENABLE_BASIC_AUTH_FALLBACK must be 'false' in production"
      log_fail "Current value: ${ENABLE_BASIC_AUTH_FALLBACK}"
      return 1
    fi
    log_pass "Basic Auth fallback disabled in production"
  else
    log_warn "Skipping Basic Auth check (not production environment)"
  fi

  return 0
}

# Gate 2: OAuth Configuration Check
# Ensure OAuth is properly configured in production
gate_oauth_config() {
  echo ""
  echo "Gate 2: OAuth Configuration Check"

  if [[ "$ENVIRONMENT" == "production" ]]; then
    local missing=0

    if [[ -z "${AUTH_DOMAIN:-}" ]]; then
      log_fail "AUTH_DOMAIN not set"
      missing=1
    fi

    if [[ -z "${AUTH_AUDIENCE:-}" ]]; then
      log_fail "AUTH_AUDIENCE not set"
      missing=1
    fi

    if [[ -z "${AUTH_ISSUER:-}" ]]; then
      log_fail "AUTH_ISSUER not set"
      missing=1
    fi

    if [[ -z "${JWKS_URI:-}" ]]; then
      log_fail "JWKS_URI not set"
      missing=1
    fi

    if [[ "$missing" -eq 1 ]]; then
      log_fail "OAuth configuration incomplete in production"
      return 1
    fi

    log_pass "OAuth configuration complete"
  else
    log_warn "Skipping OAuth check (not production environment)"
  fi

  return 0
}

# Gate 3: Dependencies Check
# Verify all required dependencies are installed
gate_dependencies() {
  echo ""
  echo "Gate 3: Dependencies Check"

  if [[ ! -d "node_modules" ]]; then
    log_fail "node_modules not found - run 'npm install'"
    return 1
  fi

  # Check critical auth dependencies
  local missing=0

  if [[ ! -d "node_modules/jsonwebtoken" ]]; then
    log_fail "jsonwebtoken not installed"
    missing=1
  fi

  if [[ ! -d "node_modules/jwks-rsa" ]]; then
    log_fail "jwks-rsa not installed"
    missing=1
  fi

  if [[ ! -d "node_modules/express-rate-limit" ]]; then
    log_fail "express-rate-limit not installed"
    missing=1
  fi

  if [[ ! -d "node_modules/helmet" ]]; then
    log_fail "helmet not installed"
    missing=1
  fi

  if [[ ! -d "node_modules/prom-client" ]]; then
    log_fail "prom-client not installed"
    missing=1
  fi

  if [[ "$missing" -eq 1 ]]; then
    log_fail "Missing required dependencies"
    return 1
  fi

  log_pass "All dependencies installed"
  return 0
}

# Gate 4: Smoke Test (OAuth)
# Run comprehensive auth test suite
gate_smoke_test() {
  echo ""
  echo "Gate 4: Smoke Test (OAuth)"

  # Check if test script exists
  if [[ ! -f "${SCRIPT_DIR}/test-auth-comprehensive.sh" ]]; then
    log_warn "Auth test script not found - skipping smoke test"
    return 0
  fi

  # Skip if no OAuth config (development mode)
  if [[ -z "${AUTH_DOMAIN:-}" ]] && [[ "$ENVIRONMENT" != "production" ]]; then
    log_warn "OAuth not configured - skipping smoke test (dev mode OK)"
    return 0
  fi

  # Run auth tests in production
  if [[ "$ENVIRONMENT" == "production" ]]; then
    log_pass "Running comprehensive auth test suite..."

    # Run tests
    if ! "${SCRIPT_DIR}/test-auth-comprehensive.sh"; then
      log_fail "Auth smoke tests failed"
      return 1
    fi

    log_pass "Auth smoke tests passed"
  else
    log_warn "Skipping smoke test (not production environment)"
  fi

  return 0
}

# Gate 5: Security Headers Check
# Verify security middleware is configured
gate_security_headers() {
  echo ""
  echo "Gate 5: Security Headers Check"

  # Check if helmet is configured in server.js
  if ! grep -q "helmet" server.js; then
    log_fail "Helmet middleware not found in server.js"
    return 1
  fi

  log_pass "Security headers configured"
  return 0
}

# Gate 6: Rate Limiting Check
# Verify rate limiting is configured
gate_rate_limiting() {
  echo ""
  echo "Gate 6: Rate Limiting Check"

  # Check if rate limiting is configured
  if ! grep -q "apiRateLimiter" server.js; then
    log_fail "Rate limiting not found in server.js"
    return 1
  fi

  log_pass "Rate limiting configured"
  return 0
}

# Gate 7: Audit Logging Check
# Verify audit logging is configured
gate_audit_logging() {
  echo ""
  echo "Gate 7: Audit Logging Check"

  # Check if audit logging is configured
  if ! grep -q "auditLog" server.js; then
    log_fail "Audit logging not found in server.js"
    return 1
  fi

  log_pass "Audit logging configured"
  return 0
}

# Gate 8: Metrics Check
# Verify Prometheus metrics are configured
gate_metrics() {
  echo ""
  echo "Gate 8: Metrics Check"

  # Check if metrics are configured
  if ! grep -q "collectMetrics" server.js; then
    log_fail "Metrics collection not found in server.js"
    return 1
  fi

  if ! grep -q "/metrics" server.js; then
    log_fail "Metrics endpoint not found in server.js"
    return 1
  fi

  log_pass "Metrics configured"
  return 0
}

# Main execution
main() {
  echo "═══════════════════════════════════════"
  echo "  CI Deployment Gates"
  echo "═══════════════════════════════════════"
  echo "Environment: ${ENVIRONMENT}"
  echo ""

  local failed=0

  # Run all gates
  gate_basic_auth_fallback || failed=1
  gate_oauth_config || failed=1
  gate_dependencies || failed=1
  gate_security_headers || failed=1
  gate_rate_limiting || failed=1
  gate_audit_logging || failed=1
  gate_metrics || failed=1
  gate_smoke_test || failed=1

  echo ""
  echo "═══════════════════════════════════════"

  if [[ "$failed" -eq 1 ]]; then
    echo -e "${RED}DEPLOYMENT BLOCKED${NC} - One or more gates failed"
    echo "═══════════════════════════════════════"
    exit 1
  else
    echo -e "${GREEN}ALL GATES PASSED${NC} - Deployment approved"
    echo "═══════════════════════════════════════"
    exit 0
  fi
}

main "$@"
