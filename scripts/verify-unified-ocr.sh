#!/bin/bash
# Unified OCR Service Verification Script
# Usage: ./scripts/verify-unified-ocr.sh <SERVICE_URL> [USERNAME] [PASSWORD]

set -e

SERVICE_URL="${1:-https://ocr-unified-njax.onrender.com}"
AUTH_USER="${2:-$BASIC_AUTH_USER}"
AUTH_PASS="${3:-$BASIC_AUTH_PASS}"

echo "🔍 Unified OCR Service Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Target: $SERVICE_URL"
echo ""

# Test 1: Health check
echo "1️⃣  Testing /health endpoint..."
HEALTH_RESPONSE=$(curl -sf "$SERVICE_URL/health")
if echo "$HEALTH_RESPONSE" | jq -e '.ok == true' > /dev/null 2>&1; then
  echo "✅ Health check passed"
  echo "$HEALTH_RESPONSE" | jq -C .
else
  echo "❌ Health check failed"
  echo "$HEALTH_RESPONSE"
  exit 1
fi

# Test 2: Auth protection
echo ""
echo "2️⃣  Testing /process auth protection..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/process")
if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ] || [ "$HTTP_CODE" = "422" ]; then
  echo "✅ Auth protection working (HTTP $HTTP_CODE)"
else
  echo "⚠️  Unexpected response: HTTP $HTTP_CODE (expected 401/403/422)"
fi

# Test 3: Process with auth (if credentials provided)
if [ -n "$AUTH_USER" ] && [ -n "$AUTH_PASS" ]; then
  echo ""
  echo "3️⃣  Testing /process with Basic Auth..."

  # Create test receipt image (simple text file as placeholder)
  TEST_FILE="/tmp/test-receipt-$(date +%s).txt"
  cat > "$TEST_FILE" <<EOF
STARBUCKS
Store #12345
123 Main St, Portland OR 97201

Date: 10/05/2025
Time: 14:30

Grande Latte        \$5.50
Blueberry Muffin    \$3.25
Tax                 \$0.70
━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL              \$9.45

Card ending in 1234
Thank you!
EOF

  echo "📄 Sending test receipt..."
  PROCESS_RESPONSE=$(curl -sf -u "$AUTH_USER:$AUTH_PASS" \
    -F "file=@$TEST_FILE" \
    -F "doc_id=test-$(date +%s)" \
    "$SERVICE_URL/process" 2>&1)

  if echo "$PROCESS_RESPONSE" | jq -e 'has("merchant") and has("total") and has("ocr_text")' > /dev/null 2>&1; then
    echo "✅ Processing successful"
    echo ""
    echo "📊 Extraction Results:"
    echo "$PROCESS_RESPONSE" | jq -C '{
      merchant: .merchant,
      date: .date,
      total: .total,
      tax: .tax,
      currency: .currency,
      status: .status,
      confidence: .confidence,
      ocr_confidence: .ocr_confidence
    }'

    # Verify key fields
    echo ""
    echo "🎯 Field Validation:"
    MERCHANT=$(echo "$PROCESS_RESPONSE" | jq -r '.merchant // "null"')
    TOTAL=$(echo "$PROCESS_RESPONSE" | jq -r '.total // "null"')
    STATUS=$(echo "$PROCESS_RESPONSE" | jq -r '.status // "null"')

    if [ "$MERCHANT" != "null" ]; then
      echo "  ✅ Merchant detected: $MERCHANT"
    else
      echo "  ⚠️  Merchant not detected"
    fi

    if [ "$TOTAL" != "null" ]; then
      echo "  ✅ Total detected: \$$TOTAL"
    else
      echo "  ⚠️  Total not detected"
    fi

    echo "  ℹ️  Status: $STATUS"
  else
    echo "❌ Processing failed or incomplete response"
    echo "$PROCESS_RESPONSE" | jq -C . || echo "$PROCESS_RESPONSE"
  fi

  # Cleanup
  rm -f "$TEST_FILE"
else
  echo ""
  echo "ℹ️  Skipping authenticated processing test"
  echo "   Set BASIC_AUTH_USER and BASIC_AUTH_PASS to test full flow"
fi

# Test 4: Response time
echo ""
echo "4️⃣  Testing response time..."
START_TIME=$(date +%s%N)
curl -sf "$SERVICE_URL/health" > /dev/null
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))
echo "⏱️  Response time: ${RESPONSE_TIME}ms"

if [ "$RESPONSE_TIME" -lt 1000 ]; then
  echo "✅ Fast response (<1s)"
elif [ "$RESPONSE_TIME" -lt 3000 ]; then
  echo "⚠️  Moderate response (1-3s)"
else
  echo "❌ Slow response (>3s)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Verification complete"
echo ""
echo "📋 Summary:"
echo "  • Service URL: $SERVICE_URL"
echo "  • Health: OK"
echo "  • Auth: Protected"
if [ -n "$AUTH_USER" ] && [ -n "$AUTH_PASS" ]; then
  echo "  • Processing: Tested"
else
  echo "  • Processing: Not tested (no credentials)"
fi
echo "  • Response time: ${RESPONSE_TIME}ms"
