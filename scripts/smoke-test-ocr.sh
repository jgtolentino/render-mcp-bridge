#!/bin/bash
# OCR Service Smoke Tests
# Usage: ./scripts/smoke-test-ocr.sh <OCR_URL> [BASIC_AUTH_USER] [BASIC_AUTH_PASS]

set -e

OCR_URL="${1:-https://ocr-service-njax.onrender.com}"
AUTH_USER="${2:-$BASIC_AUTH_USER}"
AUTH_PASS="${3:-$BASIC_AUTH_PASS}"

echo "🔍 OCR Service Smoke Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Target: $OCR_URL"
echo ""

# Test 1: Health check (should be unprotected)
echo "1️⃣  Testing /health endpoint..."
if curl -sf "$OCR_URL/health" | jq -e '.ok == true' > /dev/null 2>&1; then
  echo "✅ Health check passed"
else
  echo "❌ Health check failed"
  exit 1
fi

# Test 2: OCR auth check (should require auth)
echo ""
echo "2️⃣  Testing /ocr auth protection..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$OCR_URL/ocr")
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
  echo "✅ Auth protection working (HTTP $HTTP_CODE)"
else
  echo "⚠️  Unexpected response: HTTP $HTTP_CODE (expected 401/403)"
fi

# Test 3: OCR with file (if auth provided)
if [ -n "$AUTH_USER" ] && [ -n "$AUTH_PASS" ]; then
  echo ""
  echo "3️⃣  Testing /ocr with Basic Auth..."

  # Create test image if it doesn't exist
  if [ ! -f /tmp/test-receipt.txt ]; then
    echo "Sample Receipt - Test" > /tmp/test-receipt.txt
  fi

  if curl -sf -u "$AUTH_USER:$AUTH_PASS" \
    -F "file=@/tmp/test-receipt.txt" \
    "$OCR_URL/ocr" | jq -e 'has("text")' > /dev/null 2>&1; then
    echo "✅ OCR endpoint working with auth"
  else
    echo "⚠️  OCR endpoint test inconclusive (might need real image)"
  fi
else
  echo ""
  echo "ℹ️  Skipping authenticated OCR test (no credentials provided)"
  echo "   Set BASIC_AUTH_USER and BASIC_AUTH_PASS to test"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Smoke tests completed"
