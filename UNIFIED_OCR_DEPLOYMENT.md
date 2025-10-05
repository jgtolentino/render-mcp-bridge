# Unified OCR Service Deployment Guide

## ✅ Consolidation Complete

**Commit**: 493fee7
**Cost Savings**: $14/mo → $7/mo (50% reduction)

### What Changed

**Before**: Two separate services
- `ocr-service` - OCR only
- `extract-service` - Extraction only
- **Cost**: 2 × $7 = $14/month

**After**: Single unified service
- `ocr-unified` - OCR + Extraction in one call
- **Cost**: 1 × $7 = $7/month

---

## 🚀 Deployment Steps

### Step 1: Sync Blueprint in Render Dashboard

1. Go to [Render Dashboard → Blueprints](https://dashboard.render.com/blueprints)
2. Find `render-mcp-bridge` blueprint
3. Click **"Sync Blueprint"**
4. Render will create the `ocr-unified` service
5. Wait 2-3 minutes for deployment

### Step 2: Configure Environment Variables

Once `ocr-unified` service is created, set these in Render Dashboard:

**Required**:
- `BASIC_AUTH_USER` - Choose a username (e.g., "ocr-admin")
- `BASIC_AUTH_PASS` - Generate a secure password

**Automatically Set** (via Blueprint):
- `PORT` = 10000
- `OCR_LANG` = en

### Step 3: Test Deployment

```bash
# Get service URL from Render Dashboard
export OCR_URL="https://ocr-unified-[your-id].onrender.com"

# Test health endpoint (no auth required)
curl -s $OCR_URL/health | jq
# Expected: {"ok": true, "service": "ocr-unified", "lang": "en", "auth_enabled": true}

# Test auth protection
curl -s $OCR_URL/process
# Expected: HTTP 401 Unauthorized

# Test with credentials (replace with your actual credentials)
export BASIC_AUTH_USER="your-username"
export BASIC_AUTH_PASS="your-password"

# Create a test image
echo "RECEIPT TEST" > /tmp/test.txt

# Test full OCR + extraction
curl -s -u $BASIC_AUTH_USER:$BASIC_AUTH_PASS \
  -F "file=@/tmp/test.txt" \
  $OCR_URL/process | jq
```

---

## 🔌 API Integration

### Single Endpoint Architecture

The unified service exposes one endpoint that does everything:

**POST /process**
- Accepts: Multipart file upload
- Returns: OCR text + extracted fields in one response

### Example Request

```bash
curl -X POST https://ocr-unified-[id].onrender.com/process \
  -u username:password \
  -F "file=@receipt.jpg" \
  -F "doc_id=optional-tracking-id"
```

### Example Response

```json
{
  "merchant": "Starbucks",
  "date": "2025-10-05",
  "total": 12.50,
  "tax": 1.00,
  "currency": "USD",
  "confidence": 100.0,
  "grounding": {
    "merchant": [[10, 20], [100, 20], [100, 40], [10, 40]],
    "date": [[10, 50], [80, 50], [80, 65], [10, 65]],
    "total": [[150, 200], [200, 200], [200, 220], [150, 220]]
  },
  "status": "extracted",
  "ocr_text": "Starbucks\n2025-10-05\nTotal: $12.50",
  "ocr_confidence": 0.98
}
```

### Backend API Configuration

Update your backend service environment variables:

```bash
OCR_UNIFIED_URL=https://ocr-unified-[your-id].onrender.com
OCR_AUTH_USER=[your username]
OCR_AUTH_PASS=[your password]
```

### Backend Code Example

```python
import requests

def process_receipt(image_bytes, doc_id=None):
    """Process receipt with unified OCR service"""
    url = f"{OCR_UNIFIED_URL}/process"
    auth = (OCR_AUTH_USER, OCR_AUTH_PASS)

    files = {"file": ("receipt.jpg", image_bytes, "image/jpeg")}
    data = {"doc_id": doc_id} if doc_id else {}

    response = requests.post(url, auth=auth, files=files, data=data)
    response.raise_for_status()

    return response.json()
```

---

## 🔒 Security Configuration

### Authentication
- ✅ Basic Auth enabled on all `/process` endpoints
- ✅ Health check `/health` is public (no auth)
- ✅ Credentials stored in Render environment variables

### CORS
- ⚠️ Currently allows all origins (`allow_origins=["*"]`)
- **Recommendation**: Restrict to your backend API domain only

To disable CORS (backend-to-backend only):

```python
# In services/ocr-unified/app.py
# Comment out or remove the CORS middleware
# app.add_middleware(CORSMiddleware, ...)
```

### Network Security
- ✅ Service is backend-only (not called from browser)
- ✅ HTTPS enforced by Render
- ✅ No sensitive data logged

---

## 📊 Performance & Monitoring

### Expected Performance
- **Cold start**: 5-10 seconds (first request after idle)
- **Warm requests**: 1-3 seconds per receipt
- **Throughput**: ~10 receipts/minute (Starter plan)

### Health Monitoring

```bash
# Automated health check script
while true; do
  STATUS=$(curl -sf $OCR_URL/health | jq -r .ok)
  if [ "$STATUS" = "true" ]; then
    echo "✅ $(date) - Service healthy"
  else
    echo "❌ $(date) - Service down"
  fi
  sleep 60
done
```

### Render Monitoring

Render provides built-in monitoring:
- **Metrics**: CPU, memory, request rate
- **Logs**: Application logs and errors
- **Alerts**: Configure via Render Dashboard

---

## 🐛 Troubleshooting

### Service not appearing after Blueprint sync
1. Check Render Dashboard → Services for `ocr-unified`
2. Verify GitHub repo is connected to Blueprint
3. Check Blueprint sync logs for errors
4. Try manual sync: Dashboard → Blueprints → Sync

### Build failures
1. Check Render build logs for specific errors
2. Verify `services/ocr-unified/Dockerfile` exists
3. Ensure `app.py` and `requirements.txt` are in `services/ocr-unified/`
4. Check Docker build context is set to `services/ocr-unified`

### Health check failing
1. Verify health check path is `/health` (not `/healthz`)
2. Check application logs for startup errors
3. Ensure app is listening on `$PORT` environment variable
4. Verify Python dependencies installed correctly

### 401 errors on all endpoints
1. Verify Basic Auth credentials are set in Render
2. Test with correct username:password format
3. Check Authorization header format: `Basic base64(user:pass)`
4. Ensure `/health` endpoint is NOT protected by auth

### Slow OCR processing
1. Check if service is on Starter plan (limited CPU)
2. Monitor Render metrics for CPU/memory usage
3. Consider upgrading to Standard plan for better performance
4. Optimize image size before sending (resize to max 2000px)

### PaddleOCR errors
1. Check that image format is supported (JPEG, PNG, TIFF)
2. Verify image is not corrupted
3. Check application logs for specific OCR errors
4. Ensure sufficient memory (PaddleOCR needs ~500MB)

---

## 🎯 Success Criteria

✅ Deployment is successful when:

- [ ] Service shows "Live" in Render Dashboard
- [ ] Health check returns `{"ok": true}`
- [ ] `/process` endpoint returns 401 without auth
- [ ] `/process` endpoint processes images with valid auth
- [ ] Response includes all fields: merchant, date, total, tax, currency
- [ ] Backend API successfully calls unified service
- [ ] No errors in Render logs

---

## 📝 Next Steps

### Immediate
1. Sync Blueprint in Render Dashboard
2. Set environment variables
3. Test endpoints with smoke tests
4. Update backend API configuration

### Future Improvements
1. **Add caching**: Cache OCR results for duplicate images
2. **Add queue**: Process receipts asynchronously for better performance
3. **Add metrics**: Track processing time, success rate, field accuracy
4. **Improve extraction**: Add more merchant patterns, better date parsing
5. **Add validation**: Validate extracted data against business rules
6. **Add audit log**: Log all OCR requests for compliance

---

## 🔗 Related Documentation

- [Render Blueprint Spec](https://render.com/docs/blueprint-spec)
- [PaddleOCR Documentation](https://github.com/PaddlePaddle/PaddleOCR)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

---

**Questions?** Check Render logs or contact your DevOps team.
