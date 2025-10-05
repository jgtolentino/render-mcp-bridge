# OCR Services Deployment Guide

Complete guide for deploying instant receipt OCR pipeline to Render.

## Overview

This system provides instant (2-3 second) receipt processing with:
- Text extraction via PaddleOCR
- Field extraction (merchant, date, total, tax)
- Visual grounding (bounding boxes for each field)
- Supabase integration for storage and database

## Architecture

```
Client Upload → API → Supabase Storage
                 ↓
              OCR Service (PaddleOCR)
                 ↓
              Extract Service (Rules-based)
                 ↓
              Supabase Database (te.receipt_ocr)
```

## Prerequisites

- Render account
- Supabase project: `qtcxkbubqhmrdcnywpvy.supabase.co`
- GitHub repository: `jgtolentino/render-mcp-bridge`
- Database migration applied (see below)

## Step 1: Database Migration

Apply the `030_receipt_ocr.sql` migration to create the table:

```bash
# Set connection string
export POSTGRES_URL="postgres://postgres.qtcxkbubqhmrdcnywpvy:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres"

# Apply migration
psql "$POSTGRES_URL" -f db/migrations/030_receipt_ocr.sql
```

**Verification**:
```sql
-- Check table exists
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'te' AND table_name = 'receipt_ocr';

-- Check RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'te' AND tablename = 'receipt_ocr';
```

## Step 2: Supabase Storage Setup

Create storage bucket for receipts:

1. Go to Supabase Dashboard → Storage
2. Create new bucket: `receipts`
3. Set to **Private** (use signed URLs)
4. Configure RLS policies:

```sql
-- Allow service role to upload
CREATE POLICY "Service can upload receipts"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'receipts');

-- Allow service role to read
CREATE POLICY "Service can read receipts"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'receipts');
```

## Step 3: Deploy to Render

### Option A: Blueprint Deployment (Recommended)

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Click "New +" → "Blueprint"**
3. **Select Repository**: `jgtolentino/render-mcp-bridge`
4. **Render Auto-Detects** `render.yaml`:
   - OCR Service (Python/Docker)
   - Extract Service (Python/Docker)

5. **Configure Environment Variables**:

   **OCR Service**:
   ```
   OCR_LANG=en
   BASIC_AUTH_USER=admin
   BASIC_AUTH_PASS=<secure-password>
   ```

   **Extract Service**:
   ```
   BASIC_AUTH_USER=admin
   BASIC_AUTH_PASS=<secure-password>
   ```

6. **Click "Apply"** and wait 5-10 minutes for Docker builds

### Option B: Manual Service Creation

**OCR Service**:
1. New Web Service
2. Build from Dockerfile: `services/ocr/Dockerfile`
3. Docker context: `services/ocr`
4. Health check path: `/health`
5. Set environment variables (see above)

**Extract Service**:
1. New Web Service
2. Build from Dockerfile: `services/extract/Dockerfile`
3. Docker context: `services/extract`
4. Health check path: `/health`
5. Set environment variables (see above)

## Step 4: Verify Deployment

### Health Checks

```bash
# OCR Service
curl https://ocr-service-xxxx.onrender.com/health
# Expected: {"ok": true, "service": "ocr", "lang": "en", "auth_enabled": true}

# Extract Service
curl https://extract-service-xxxx.onrender.com/health
# Expected: {"ok": true, "service": "extract"}
```

### Test OCR Service

```bash
# Create test image
curl -o sample-receipt.jpg https://example.com/receipt.jpg

# Test OCR with Basic Auth
curl -X POST https://ocr-service-xxxx.onrender.com/ocr \
  -u admin:password \
  -F "file=@sample-receipt.jpg" \
  -F "doc_id=test123"

# Expected response:
{
  "doc_id": "test123",
  "text": "Starbucks Coffee Receipt...",
  "words": [
    {
      "text": "Starbucks",
      "confidence": 0.98,
      "box": [[10,20], [100,20], [100,40], [10,40]]
    }
  ],
  "confidence": 0.95
}
```

### Test Extract Service

```bash
curl -X POST https://extract-service-xxxx.onrender.com/extract \
  -u admin:password \
  -H "Content-Type: application/json" \
  -d '{
    "ocr": {
      "text": "Starbucks Coffee Total: $12.50 Tax: $1.25 Date: 01/15/2025",
      "words": []
    }
  }'

# Expected response:
{
  "merchant": "Starbucks",
  "date": "2025-01-15",
  "total": 12.50,
  "tax": 1.25,
  "currency": "USD",
  "confidence": 0.92,
  "status": "extracted",
  "grounding": {...}
}
```

## Step 5: Deploy API Service (Coming Soon)

The API orchestrator service will be added to `render.yaml`:

```yaml
services:
  - type: web
    name: api-service
    env: node
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: SUPABASE_URL
        value: https://qtcxkbubqhmrdcnywpvy.supabase.co
      - key: SUPABASE_SERVICE_ROLE_KEY
        sync: false
      - key: OCR_BASE_URL
        value: https://ocr-service-xxxx.onrender.com
      - key: EXTRACT_BASE_URL
        value: https://extract-service-xxxx.onrender.com
```

## Step 6: Test End-to-End

Once API service is deployed:

```bash
# Upload receipt via API
curl -X POST https://api-xxxx.onrender.com/api/receipts/instant-ocr \
  -F "file=@receipt.jpg" \
  -F "receipt_id=550e8400-e29b-41d4-a716-446655440000"

# Expected response:
{
  "ok": true,
  "storage_path": "receipts/2025/01/xxx.jpg",
  "ocr": {
    "text": "...",
    "confidence": 0.95
  },
  "extracted": {
    "merchant": "Starbucks",
    "date": "2025-01-15",
    "total": 12.50,
    "tax": 1.25,
    "currency": "USD",
    "status": "extracted",
    "confidence": 0.92
  },
  "grounding": {...}
}
```

## Monitoring

### Render Dashboard

Monitor the following metrics:
- **Health Status**: All services should show "Live"
- **Response Time**: OCR ~2-3s, Extract ~500ms
- **Error Rate**: Should be <1%
- **Memory Usage**: ~200-400MB per service
- **CPU Usage**: Spikes during OCR, idle otherwise

### Logs

View logs in Render Dashboard:
```bash
# Or use Render CLI
render logs -s ocr-service -f
render logs -s extract-service -f
```

### Alerts

Set up alerts in Render for:
- Service goes down
- Response time > 10s
- Error rate > 5%
- Memory usage > 80%

## Performance Tuning

### OCR Service

```python
# In services/ocr/app.py
ocr = PaddleOCR(
    use_angle_cls=True,      # Enable angle classification (slower but more accurate)
    lang='en',               # Language: en, ch, fr, de, es, pt, ru, ar, hi, etc.
    use_gpu=False,           # GPU not available on Render Starter
    show_log=False,          # Disable verbose logging
    det_db_thresh=0.3,       # Text detection threshold (lower = more sensitive)
    det_db_box_thresh=0.5,   # Box detection threshold
    rec_batch_num=6          # Batch size for recognition (higher = faster but more memory)
)
```

### Extract Service

```python
# In services/extract/app.py

# Adjust regex patterns for better merchant extraction
MERCHANT_PATTERNS = [
    r'^([A-Z][A-Za-z\s&.]{2,30})',  # Company name at start
    r'([A-Z][A-Za-z\s&.]{2,30})\n',  # Company name before newline
    # Add more patterns...
]

# Adjust confidence scoring
def calculate_confidence(fields):
    weights = {
        'merchant': 0.3,
        'date': 0.2,
        'total': 0.4,  # Total is most important
        'tax': 0.1
    }
    # Score based on field presence and validation
```

## Troubleshooting

### Low OCR Confidence (<70%)

**Causes**:
- Poor image quality (< 300 DPI)
- Rotated or skewed image
- Low contrast
- Wrong language setting

**Solutions**:
```python
# Try different OCR language
OCR_LANG=english  # vs 'en'

# Adjust detection thresholds
det_db_thresh=0.2  # Lower = more sensitive (default: 0.3)

# Enable debug logging temporarily
show_log=True
```

### Extract Service Missing Fields

**Causes**:
- Unusual receipt format
- Poor OCR quality
- Regex patterns don't match

**Solutions**:
1. Check OCR output first:
   ```bash
   curl -X POST .../ocr -F "file=@receipt.jpg"
   # Verify text quality
   ```

2. Update regex patterns in `services/extract/app.py`

3. Add fuzzy matching:
   ```python
   from fuzzywuzzy import fuzz
   # Match "Total:", "TOTAL", "Tot:", etc.
   ```

### Database Write Failures

**Causes**:
- RLS policies blocking writes
- Invalid data types
- Foreign key constraint (receipt_id doesn't exist)

**Solutions**:
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'receipt_ocr';

-- Test direct insert with service role
INSERT INTO te.receipt_ocr (storage_path, ocr_text, status)
VALUES ('test.jpg', 'test', 'processing');
```

### Services Won't Start

**Check Render logs for**:
```bash
# Python dependency issues
ModuleNotFoundError: No module named 'paddleocr'
→ Verify requirements.txt and Dockerfile

# Port binding issues
Address already in use
→ Check Dockerfile EXPOSE port matches CMD

# Memory limits
Killed (OOM)
→ Upgrade to higher plan or optimize memory usage
```

## Cost Optimization

### Current Setup
- OCR Service: Starter ($7/mo) - 512MB RAM
- Extract Service: Starter ($7/mo) - 512MB RAM
- **Total: $14/mo**

### Free Tier Option
Render offers **750 free hours/month** on Starter plan:
- If services idle most of the time: **Free**
- If processing <25 receipts/hour: ~**$3-5/mo**

### Scaling Options

**For higher volume**:
- Upgrade to Standard ($25/mo) - 2GB RAM, faster CPU
- Add autoscaling (min 1, max 3 instances)
- Estimated: $25-75/mo depending on load

**For GPU acceleration**:
- Not available on Render
- Consider AWS Lambda + ECS for GPU OCR (~$50-150/mo)

## Security Best Practices

1. **Rotate Basic Auth credentials** regularly:
   ```bash
   # Generate secure password
   openssl rand -base64 32
   ```

2. **Use Supabase RLS** to restrict data access:
   ```sql
   -- Users can only see their own receipts
   CREATE POLICY "Users see own receipts"
   ON te.receipt_ocr FOR SELECT
   USING (
     EXISTS (
       SELECT 1 FROM te.receipts r
       WHERE r.id = receipt_ocr.receipt_id
       AND r.owner_id = auth.uid()
     )
   );
   ```

3. **Monitor for abuse**:
   - Rate limiting (1 request/second per IP)
   - File size limits (max 10MB)
   - Validate file types (only images)

4. **Secure storage**:
   - Use signed URLs (10 min expiry)
   - Enable versioning in Supabase Storage
   - Regular backups of database

## Next Steps

1. ✅ Services deployed and healthy
2. ⏳ Deploy API orchestrator service
3. ⏳ Integrate with frontend (concur-ui-revive)
4. ⏳ Add E2E tests
5. ⏳ Setup monitoring and alerts
6. ⏳ Optimize performance based on real usage

## Support

- **Render Status**: https://status.render.com
- **Supabase Status**: https://status.supabase.com
- **GitHub Issues**: https://github.com/jgtolentino/render-mcp-bridge/issues
