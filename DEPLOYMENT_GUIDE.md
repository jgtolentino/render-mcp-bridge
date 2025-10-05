# OCR Service Deployment Guide

## ✅ What Was Done

1. **Updated `render.yaml` Blueprint** to include two services:
   - `mcp-server`: Node.js MCP Bridge (existing, already deployed)
   - `ocr-service`: Python/Docker OCR service (new)

2. **Committed and pushed** (commit: cbdbeb3)

3. **Created smoke test script** at `scripts/smoke-test-ocr.sh`

## 🚀 Next Steps

### Step 1: Sync Blueprint in Render Dashboard

Go to [Render Dashboard](https://dashboard.render.com) and follow these steps:

1. Navigate to **Blueprints** section
2. Find your `render-mcp-bridge` blueprint
3. Click **Sync Blueprint** button
4. Render will detect the new `ocr-service` and create it
5. Wait for deployment to complete (typically 2-3 minutes)

### Step 2: Configure Environment Variables

Once the `ocr-service` is created, set these environment variables in the Render Dashboard:

**For `ocr-service`:**
- `BASIC_AUTH_USER`: (choose a username, e.g., "ocr-admin")
- `BASIC_AUTH_PASS`: (generate a secure password)
- `PORT`: 10000 (already set via Blueprint)
- `OCR_LANG`: en (already set via Blueprint)

**For `mcp-server` (optional, if MCP proxies to OCR):**
- `OCR_BASE_URL`: https://ocr-service-[your-id].onrender.com
- `DOWNSTREAM_BASIC_AUTH_USER`: (same as ocr-service user)
- `DOWNSTREAM_BASIC_AUTH_PASS`: (same as ocr-service pass)

### Step 3: Verify Deployment

After deployment shows "Live" in Render Dashboard:

```bash
# Get the OCR service URL from Render Dashboard, then run:
export OCR_URL="https://ocr-service-[your-id].onrender.com"

# Test health endpoint (no auth required)
curl -s $OCR_URL/health | jq

# Should return:
# {
#   "ok": true,
#   "service": "ocr",
#   "time": "2025-10-05T..."
# }
```

### Step 4: Run Smoke Tests

```bash
# Set your credentials
export BASIC_AUTH_USER="your-username"
export BASIC_AUTH_PASS="your-password"

# Run smoke tests
./scripts/smoke-test-ocr.sh $OCR_URL $BASIC_AUTH_USER $BASIC_AUTH_PASS
```

### Step 5: Wire to Your API

Update your backend API environment variables:

```bash
OCR_BASE_URL=https://ocr-service-[your-id].onrender.com
OCR_BASIC_AUTH_USER=[same as above]
OCR_BASIC_AUTH_PASS=[same as above]
```

Then redeploy your API service.

## 🔒 Security Checklist

- ✅ OCR service has Basic Auth enabled
- ✅ OCR service is only called from backend (never from browser)
- ✅ No CORS configured on OCR service (backend-to-backend only)
- ✅ Credentials stored in Render environment variables (not in code)

## 📊 Cost Breakdown

**Current Setup:**
- MCP Server: $7/month (Starter)
- OCR Service: $7/month (Starter)
- **Total: $14/month**

**To Consolidate Later (Optional):**
- Unified Service: $7/month (Starter)
- Set both `OCR_BASE_URL` and `EXTRACT_BASE_URL` to the same unified service
- Shut down separate OCR service

## 🔧 Troubleshooting

### OCR service not appearing in Render
- Go to Dashboard → Blueprints → Sync Blueprint manually
- Check that `render.yaml` is at repo root
- Verify Blueprint is connected to correct GitHub repo

### Deployment stuck or failing
- Check Render build logs for errors
- Verify `services/ocr/Dockerfile` exists and is valid
- Ensure `services/ocr/app.py` and `requirements.txt` exist

### Health check failing
- Verify health check path is `/health` in Render settings
- Check that OCR service is listening on PORT environment variable
- Review application logs for startup errors

### 401/403 errors on all endpoints including /health
- Check that `/health` endpoint is NOT protected by auth
- Review `services/ocr/app.py` to ensure health check is public

## 📝 Testing Endpoints

### Health Check
```bash
curl https://ocr-service-[your-id].onrender.com/health
```

### OCR Endpoint (requires auth + file upload)
```bash
curl -u username:password \
  -F "file=@/path/to/receipt.jpg" \
  https://ocr-service-[your-id].onrender.com/ocr
```

### Expected Response
```json
{
  "text": "Extracted text from image...",
  "confidence": 0.95,
  "processing_time_ms": 234
}
```

## 🎯 Success Criteria

Deployment is successful when:
- [ ] OCR service shows "Live" in Render Dashboard
- [ ] Health check returns `{"ok": true}`
- [ ] OCR endpoint returns 401 without auth
- [ ] OCR endpoint processes images with valid auth
- [ ] Smoke tests all pass
- [ ] Backend API can call OCR service successfully
