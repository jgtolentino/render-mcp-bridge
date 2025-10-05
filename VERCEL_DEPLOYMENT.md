# Vercel API Deployment Guide

## ✅ API Deployed Successfully

**Production URL**: https://render-mcp-bridge-14u9jgsro-jake-tolentinos-projects-c0369c83.vercel.app

### Deployment Configuration

**Environment Variables Set** (Production):
- `SUPABASE_URL`: https://qtcxkbubqhmrdcnywpvy.supabase.co
- `SUPABASE_SERVICE_ROLE_KEY`: ✓ (from keychain)
- `OCR_BASE_URL`: https://mcp-server-njax.onrender.com
- `EXTRACT_BASE_URL`: https://mcp-server-njax.onrender.com

### API Endpoints

1. **Health Check**: `GET /health`
   - Returns: `{ok: true, service: "api", time: "2025-10-05T..."}`

2. **Instant OCR**: `POST /api/receipts/instant-ocr`
   - Body: `{storage_path, schema_name, user_id}`
   - Calls OCR → Extract → Returns combined result

### ⚠️ Deployment Protection

The deployment currently has Vercel Authentication enabled. To disable:

1. Go to [Vercel Dashboard](https://vercel.com/jake-tolentinos-projects-c0369c83/render-mcp-bridge/settings/deployment-protection)
2. Navigate to: Settings → Deployment Protection
3. Set to: **Standard Protection** (disable Vercel Authentication)
4. Save changes

### Custom Domain Setup (Optional)

To set up `api.w9studio.net`:

```bash
# Add domain
vercel domains add api.w9studio.net

# Set alias
vercel alias set render-mcp-bridge-14u9jgsro-jake-tolentinos-projects-c0369c83.vercel.app api.w9studio.net
```

Then add DNS record:
- Type: CNAME
- Name: api
- Value: cname.vercel-dns.com

### Testing

Once deployment protection is disabled:

```bash
# Health check
curl https://render-mcp-bridge-14u9jgsro-jake-tolentinos-projects-c0369c83.vercel.app/health

# Instant OCR (with external URL)
curl -X POST https://render-mcp-bridge-14u9jgsro-jake-tolentinos-projects-c0369c83.vercel.app/api/receipts/instant-ocr \
  -H 'Content-Type: application/json' \
  -d '{
    "storage_path": "https://upload.wikimedia.org/wikipedia/commons/1/14/ReceiptSwiss.jpg",
    "schema_name": "receipt_v1",
    "user_id": "00000000-0000-0000-0000-000000000001"
  }'
```

### Next Steps

1. **Disable Deployment Protection** (see above)
2. **Deploy UI** to Vercel with API URL
3. **Set up custom domains** (optional)
4. **Run end-to-end smoke tests**

### Architecture

```
UI (Vite/React)
  ↓ HTTPS
API (Vercel Serverless)
  ↓ Basic Auth
OCR Service (Render)
  ↓
Supabase (Storage + Database)
```

### Cost

- **Vercel**: Free tier (Hobby plan)
- **OCR**: $7/month (Render Starter)
- **Supabase**: Free tier

**Total**: $7/month
