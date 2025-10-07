# OAuth2/OIDC Authentication - Quick Reference

**Status**: ✅ Implemented (January 2025)

## Quick Start

### 1. Get OAuth Credentials

**Auth0 (Recommended):**
```
1. Create API: audience="mcp-api", algorithm=RS256
2. Create M2M app: Get client_id + client_secret
3. Grant scopes: mcp:search, mcp:fetch, mcp:tools
```

### 2. Configure Environment

```bash
AUTH_DOMAIN=your-tenant.auth0.com
AUTH_AUDIENCE=mcp-api
AUTH_ISSUER=https://your-tenant.auth0.com/
JWKS_URI=https://your-tenant.auth0.com/.well-known/jwks.json
```

### 3. Get Token & Call API

```bash
# Get access token
TOKEN=$(curl -s https://$AUTH_DOMAIN/oauth/token \
  -H 'content-type: application/json' \
  -d "{
    \"grant_type\": \"client_credentials\",
    \"client_id\": \"$CLIENT_ID\",
    \"client_secret\": \"$CLIENT_SECRET\",
    \"audience\": \"$AUDIENCE\"
  }" | jq -r .access_token)

# Call MCP API
curl -X POST https://mcp-server-njax.onrender.com/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

---

## File Structure

```
render-mcp-bridge/
├── middleware/
│   ├── auth.js          # JWT verification (RS256 + JWKS)
│   ├── bearer.js        # Token extraction utilities
│   └── scopes.js        # Scope validation helpers
│
├── docs/
│   ├── AUTH.md          # Complete auth guide (270+ lines)
│   └── MIGRATION.md     # Migration from Basic Auth
│
├── scripts/
│   └── test-auth.sh     # Automated testing script
│
├── .env.example         # Environment variable template
├── render.yaml          # Render deployment config (updated)
└── server.js            # Auth middleware integrated (lines 6-7, 303-317)
```

---

## Documentation

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **docs/AUTH.md** | Complete authentication guide | First-time setup, client integration |
| **docs/MIGRATION.md** | Migration from Basic Auth | Upgrading existing deployments |
| **OAUTH_IMPLEMENTATION_SUMMARY.md** | Technical implementation details | Understanding system architecture |
| **.env.example** | Environment variable reference | Configuring deployment |

---

## Testing

```bash
# Local testing
npm start
./scripts/test-auth.sh oauth

# Test specific scenarios
./scripts/test-auth.sh basic  # Basic Auth fallback
```

---

## Available Scopes

**Read Operations:**
- `mcp:search` - Search documents
- `mcp:fetch` - Fetch document content
- `mcp:read` - General read access

**Write Operations:**
- `mcp:process` - Process/transform data
- `mcp:write` - Write/modify data

**Tool Execution:**
- `mcp:tools` - Execute any tool
- `mcp:tools:call` - Call specific tools

**Admin Operations:**
- `mcp:admin` - Full admin access
- `mcp:admin:read` - Admin read-only
- `mcp:admin:write` - Admin configuration

---

## Migration Path

**Week 1: Dual Auth**
- Both Basic Auth + OAuth2 work
- Set `ENABLE_BASIC_AUTH_FALLBACK=true`

**Week 2-3: Client Migration**
- Clients switch to OAuth2
- Monitor adoption via logs

**Week 4+: OAuth Only**
- Set `ENABLE_BASIC_AUTH_FALLBACK=false`
- Remove Basic Auth credentials

---

## Support

**Common Issues:**
- Missing header → Add `Authorization: Bearer <token>`
- Expired token → Get new token (24h expiry)
- Missing scopes → Grant in OAuth provider
- JWKS error → Verify `JWKS_URI` is set

**Resources:**
- 📖 Full guide: `docs/AUTH.md`
- 🔄 Migration: `docs/MIGRATION.md`
- 🧪 Testing: `scripts/test-auth.sh`
- ⚙️ Config: `.env.example`

---

## Architecture

```
┌─────────────┐    1. Get Token      ┌──────────────┐
│   Client    │ ───────────────────> │ OAuth Server │
└─────────────┘                       └──────────────┘
      │
      │ 2. API Call (Bearer Token)
      │
      v
┌─────────────┐
│  MCP Bridge │
├─────────────┤
│ 3. Verify   │ <─── Fetch JWKS ──────────┐
│    Signature│                            │
│ 4. Check    │                            │
│    Claims   │                            │
│ 5. Validate │                            │
│    Scopes   │                            │
├─────────────┤                            │
│ 6. Process  │                            │
│    Request  │                            │
└─────────────┘                            │
```

**Security Features:**
- ✅ RS256 signature verification
- ✅ JWKS-based public key retrieval
- ✅ Audience/issuer/expiration validation
- ✅ Scope-based authorization
- ✅ Token caching (<50ms verification)
- ✅ Audit logging (sub, scopes, jti)

---

## Implementation Details

**Dependencies:**
- `jsonwebtoken@9.0.2` - JWT verification
- `jwks-rsa@3.2.0` - JWKS client with caching

**Performance:**
- JWT verification: <50ms (with JWKS caching)
- JWKS cache TTL: 10 minutes
- Token expiry: 24 hours (configurable)

**Security:**
- No shared secrets between clients
- Asymmetric key verification (RS256)
- Per-client identification via `sub` claim
- Rate limiting ready (by client)

---

## Next Steps

1. **Setup**: Configure OAuth provider
2. **Deploy**: Set Render environment variables
3. **Test**: Run `./scripts/test-auth.sh oauth`
4. **Migrate**: Follow `docs/MIGRATION.md`
5. **Monitor**: Track auth metrics and errors

**Time to production**: ~1 day

---

For complete details, see:
- **Full Documentation**: `docs/AUTH.md`
- **Implementation Summary**: `OAUTH_IMPLEMENTATION_SUMMARY.md`
