# OAuth2/OIDC Authentication Guide

Complete guide for implementing OAuth2/OIDC authentication with the MCP Bridge API.

## Table of Contents

- [Overview](#overview)
- [Authentication Flow](#authentication-flow)
- [Provider Setup](#provider-setup)
- [Client Integration](#client-integration)
- [Scopes & Permissions](#scopes--permissions)
- [Migration Guide](#migration-guide)
- [Troubleshooting](#troubleshooting)

---

## Overview

The MCP Bridge uses **Machine-to-Machine (M2M) OAuth2** with **RS256 JWT** tokens for authentication:

- **✅ Secure**: RS256 signature verification with public/private key pairs
- **✅ Scalable**: No shared secrets between clients
- **✅ Auditable**: Every request traced to specific client via `sub` claim
- **✅ Standard**: Compatible with Auth0, Okta, Keycloak, Supabase Auth

### Authentication Architecture

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   Client    │         │ OAuth Server │         │  MCP Bridge  │
└─────────────┘         └──────────────┘         └──────────────┘
      │                        │                        │
      │ 1. Request token       │                        │
      │ (client_id + secret)   │                        │
      ├───────────────────────>│                        │
      │                        │                        │
      │ 2. Return JWT token    │                        │
      │    (expires in 24h)    │                        │
      │<───────────────────────┤                        │
      │                        │                        │
      │ 3. API call with token │                        │
      │    Authorization: Bearer <token>                │
      ├────────────────────────────────────────────────>│
      │                        │                        │
      │                        │ 4. Verify signature    │
      │                        │    (fetch JWKS)        │
      │                        │<───────────────────────┤
      │                        │                        │
      │                        │ 5. Check aud, iss, exp │
      │                        │    (validate claims)   │
      │                        │                        │
      │ 6. Return API response │                        │
      │<────────────────────────────────────────────────┤
```

---

## Provider Setup

### Option A: Auth0 (Recommended)

**Step 1: Create API Resource**

1. Go to [Auth0 Dashboard](https://manage.auth0.com/) → **Applications** → **APIs**
2. Click **Create API**
   - **Name**: `MCP Bridge API`
   - **Identifier**: `mcp-api` (this is your `AUTH_AUDIENCE`)
   - **Signing Algorithm**: RS256
3. Click **Create**

**Step 2: Define Scopes**

In the API settings → **Permissions** tab:
- `mcp:search` - Search for documents
- `mcp:fetch` - Fetch document content
- `mcp:tools` - Execute MCP tools
- `mcp:tools:call` - Call specific tools
- `mcp:admin` - Admin access

**Step 3: Create M2M Application**

1. Go to **Applications** → **Applications** → **Create Application**
   - **Name**: `MCP Client`
   - **Type**: Machine to Machine Applications
   - **Authorize**: Select `MCP Bridge API`
2. Copy **Client ID** and **Client Secret** (save securely)
3. In **APIs** tab, grant scopes to application

**Step 4: Get Environment Variables**

```bash
AUTH_DOMAIN=your-tenant.auth0.com
AUTH_AUDIENCE=mcp-api
AUTH_ISSUER=https://your-tenant.auth0.com/
JWKS_URI=https://your-tenant.auth0.com/.well-known/jwks.json
```

### Option B: Supabase Auth

**Step 1: Enable JWT Verification**

1. Go to [Supabase Dashboard](https://app.supabase.com/) → Your Project
2. Navigate to **Authentication** → **Settings**
3. Note your **JWT Secret** (but we'll use JWKS instead for RS256)

**Step 2: Get Environment Variables**

```bash
AUTH_DOMAIN=<project-ref>.supabase.co
AUTH_AUDIENCE=authenticated
AUTH_ISSUER=https://<project-ref>.supabase.co/auth/v1
JWKS_URI=https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json
```

**Step 3: Create Service Role**

For M2M, use Supabase Service Role Key:
```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Then create custom token endpoint or use service role directly.

### Option C: Okta

**Step 1: Create Authorization Server**

1. Go to **Security** → **API** → **Authorization Servers**
2. Use `default` or create custom server
3. Note the **Issuer URI** (e.g., `https://dev-12345.okta.com/oauth2/default`)

**Step 2: Define Scopes**

Add custom scopes under **Scopes** tab

**Step 3: Create OAuth Client**

1. **Applications** → **Create App Integration**
   - **Sign-in method**: API Services
   - **Grant type**: Client Credentials
2. Copy **Client ID** and **Client Secret**

**Step 4: Environment Variables**

```bash
AUTH_DOMAIN=dev-12345.okta.com
AUTH_AUDIENCE=api://default
AUTH_ISSUER=https://dev-12345.okta.com/oauth2/default
JWKS_URI=https://dev-12345.okta.com/oauth2/default/v1/keys
```

---

## Client Integration

### Node.js / JavaScript

**Install dependencies:**
```bash
npm install axios
```

**Get token and call API:**
```javascript
const axios = require('axios');

// OAuth configuration
const AUTH_DOMAIN = 'your-tenant.auth0.com';
const CLIENT_ID = 'your-client-id';
const CLIENT_SECRET = 'your-client-secret';
const AUDIENCE = 'mcp-api';
const MCP_API_URL = 'https://mcp-server-njax.onrender.com';

// Step 1: Get access token
async function getAccessToken() {
  const response = await axios.post(`https://${AUTH_DOMAIN}/oauth/token`, {
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    audience: AUDIENCE
  });

  return response.data.access_token;
}

// Step 2: Call MCP API
async function callMcpApi() {
  const token = await getAccessToken();

  const response = await axios.post(`${MCP_API_URL}/mcp`, {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'search',
      arguments: { query: 'test' }
    },
    id: 1
  }, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  console.log('API Response:', response.data);
}

callMcpApi().catch(console.error);
```

### Python

**Install dependencies:**
```bash
pip install requests
```

**Implementation:**
```python
import requests

# OAuth configuration
AUTH_DOMAIN = 'your-tenant.auth0.com'
CLIENT_ID = 'your-client-id'
CLIENT_SECRET = 'your-client-secret'
AUDIENCE = 'mcp-api'
MCP_API_URL = 'https://mcp-server-njax.onrender.com'

# Step 1: Get access token
def get_access_token():
    response = requests.post(
        f'https://{AUTH_DOMAIN}/oauth/token',
        json={
            'grant_type': 'client_credentials',
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'audience': AUDIENCE
        }
    )
    response.raise_for_status()
    return response.json()['access_token']

# Step 2: Call MCP API
def call_mcp_api():
    token = get_access_token()

    response = requests.post(
        f'{MCP_API_URL}/mcp',
        json={
            'jsonrpc': '2.0',
            'method': 'tools/call',
            'params': {
                'name': 'search',
                'arguments': {'query': 'test'}
            },
            'id': 1
        },
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    )

    response.raise_for_status()
    print('API Response:', response.json())

if __name__ == '__main__':
    call_mcp_api()
```

### cURL

**Get token:**
```bash
# Store credentials
AUTH_DOMAIN=your-tenant.auth0.com
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
AUDIENCE=mcp-api

# Get access token
TOKEN=$(curl -s https://${AUTH_DOMAIN}/oauth/token \
  -H 'content-type: application/json' \
  -d "{
    \"grant_type\": \"client_credentials\",
    \"client_id\": \"${CLIENT_ID}\",
    \"client_secret\": \"${CLIENT_SECRET}\",
    \"audience\": \"${AUDIENCE}\"
  }" | jq -r .access_token)

echo "Token: ${TOKEN:0:20}..."
```

**Call API:**
```bash
# List available tools
curl -s https://mcp-server-njax.onrender.com/mcp \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }' | jq

# Call search tool
curl -s https://mcp-server-njax.onrender.com/mcp \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search",
      "arguments": {"query": "test"}
    },
    "id": 2
  }' | jq
```

### ChatGPT Integration

When using with OpenAI's ChatGPT Responses API:

```javascript
// OpenAI API request (not to MCP server directly)
{
  "model": "gpt-5",
  "tools": [{
    "type": "mcp",
    "server_url": "https://mcp-server-njax.onrender.com/mcp",
    "authorization": "<your-oauth-token>",  // OpenAI handles this
    "require_approval": "never"
  }]
}
```

**Note**: OpenAI validates the token in their API, then forwards authenticated requests to your MCP server.

---

## Scopes & Permissions

### Available Scopes

| Scope | Description | Use Case |
|-------|-------------|----------|
| `mcp:search` | Search for documents | Read-only search queries |
| `mcp:fetch` | Fetch document content | Read full document text |
| `mcp:read` | General read access | Broad read permissions |
| `mcp:process` | Process/transform data | OCR, data processing |
| `mcp:write` | Write/modify data | Create/update operations |
| `mcp:tools` | Execute any tool | General tool access |
| `mcp:tools:call` | Call specific tools | Granular tool execution |
| `mcp:admin` | Admin access | Full system access |
| `mcp:admin:read` | Admin read-only | Audit logs, monitoring |
| `mcp:admin:write` | Admin write | Configuration changes |

### Scope-Based Access Control

**In server.js**, add scope requirements to specific endpoints:

```javascript
const { authenticate } = require('./middleware/auth');
const { requireScopes } = require('./middleware/scopes');

// Require specific scopes
app.post('/mcp/search',
  authenticate(),
  requireScopes(['mcp:search', 'mcp:read'], { mode: 'any' }),
  searchHandler
);

// Admin-only endpoint
app.post('/mcp/admin',
  authenticate(),
  requireScopes(['mcp:admin']),
  adminHandler
);
```

### Token Inspection

Decoded JWT payload example:
```json
{
  "iss": "https://your-tenant.auth0.com/",
  "sub": "abc123@clients",
  "aud": "mcp-api",
  "iat": 1704700800,
  "exp": 1704787200,
  "scope": "mcp:search mcp:fetch mcp:tools",
  "jti": "unique-token-id",
  "azp": "client-app-id"
}
```

**Claims:**
- `sub`: Client identifier (use for rate limiting, audit logs)
- `scope`: Space-separated list of granted scopes
- `exp`: Expiration timestamp (Unix time)
- `jti`: Unique token ID (for revocation tracking)

---

## Migration Guide

### Phase 1: Enable Dual Authentication (Week 1)

**1. Keep existing Basic Auth working**

Set environment variable:
```bash
ENABLE_BASIC_AUTH_FALLBACK=true
BASIC_AUTH_USER=existing-username
BASIC_AUTH_PASS=existing-password
```

**2. Deploy with OAuth2 support**

The middleware will accept BOTH:
- `Authorization: Basic <base64>` (legacy)
- `Authorization: Bearer <jwt>` (new)

**3. Verify both methods work:**

```bash
# Test Basic Auth (legacy)
curl -u user:pass https://your-api.com/mcp -d '{"method":"tools/list","id":1}'

# Test Bearer token (new)
curl -H "Authorization: Bearer $TOKEN" https://your-api.com/mcp -d '{"method":"tools/list","id":1}'
```

### Phase 2: Migrate Clients (Week 2-3)

**1. Notify all clients:**

> Starting [DATE], we're upgrading to OAuth2 authentication.
> - Old method (Basic Auth) works until [DATE + 2 weeks]
> - New method required after [DATE + 2 weeks]
> - Follow migration guide: [URL]

**2. Provide migration support:**
- Share client examples (Node.js, Python, cURL)
- Provide test credentials for dev environment
- Monitor authentication logs for Basic Auth usage

**3. Track migration progress:**

```bash
# Count requests by auth method
grep "Basic Auth verified" server.log | wc -l
grep "JWT verified" server.log | wc -l
```

### Phase 3: Disable Basic Auth (Week 4+)

**1. When Basic Auth usage drops to 0:**

```bash
ENABLE_BASIC_AUTH_FALLBACK=false
```

**2. Remove Basic Auth credentials:**

```bash
# Unset in Render dashboard
unset BASIC_AUTH_USER
unset BASIC_AUTH_PASS
```

**3. Update documentation:**
- Remove Basic Auth references
- Mark OAuth2 as required

---

## Troubleshooting

### Error: "Missing Authorization header"

**Cause**: No `Authorization` header in request

**Fix**:
```bash
# Add Authorization header
curl -H "Authorization: Bearer $TOKEN" ...
```

### Error: "Invalid or expired token"

**Possible causes:**

1. **Token expired** (default: 24h)
   ```bash
   # Get new token
   TOKEN=$(curl -s https://$AUTH_DOMAIN/oauth/token ...)
   ```

2. **Wrong audience/issuer**
   ```bash
   # Verify env vars match OAuth provider
   echo $AUTH_AUDIENCE
   echo $AUTH_ISSUER
   ```

3. **Invalid signature**
   ```bash
   # Check JWKS URI is accessible
   curl -s $JWKS_URI | jq
   ```

### Error: "Missing required scopes"

**Cause**: Token doesn't have required scopes

**Fix**: Grant scopes in OAuth provider:
1. Auth0: **Applications** → **APIs** → Grant permissions
2. Okta: **Applications** → **Okta API Scopes**

**Verify token scopes:**
```bash
# Decode JWT (unsafe - for debugging only)
echo $TOKEN | cut -d. -f2 | base64 -d | jq .scope
```

### Error: "JWKS client not configured"

**Cause**: Missing `JWKS_URI` environment variable

**Fix**:
```bash
# Set JWKS URI in Render dashboard
JWKS_URI=https://your-tenant.auth0.com/.well-known/jwks.json
```

### Authentication Not Working (Development Mode)

**Symptom**: Server logs: `⚠️ Authentication not configured - allowing request (DEVELOPMENT MODE ONLY)`

**Cause**: No auth environment variables set

**Behavior**: In development, server allows all requests without authentication

**Fix for production**:
```bash
# Set ALL required auth variables
AUTH_DOMAIN=...
AUTH_AUDIENCE=...
AUTH_ISSUER=...
JWKS_URI=...
```

### Rate Limiting by Client

**Track requests per client** using `sub` claim:

```javascript
const rateLimit = new Map();

app.use((req, res, next) => {
  const clientId = req.auth?.sub || 'anonymous';

  const count = rateLimit.get(clientId) || 0;
  if (count > 100) {
    return res.status(429).json({ error: 'rate_limit_exceeded' });
  }

  rateLimit.set(clientId, count + 1);
  next();
});
```

### Audit Logging

**Log all authenticated requests:**

```javascript
app.post('/mcp', authenticate(), (req, res) => {
  // Log request for audit
  console.log({
    timestamp: new Date().toISOString(),
    client: req.auth.sub,
    scopes: req.auth.scopes,
    method: req.body.method,
    jti: req.auth.jti
  });

  // Process request...
});
```

---

## Additional Resources

- [OAuth 2.0 Specification](https://oauth.net/2/)
- [JWT.io - Decode tokens](https://jwt.io/)
- [Auth0 Documentation](https://auth0.com/docs/api/authentication)
- [Okta OAuth Guide](https://developer.okta.com/docs/guides/implement-oauth-for-okta/)
- [Supabase Auth](https://supabase.com/docs/guides/auth)

---

## Support

For issues or questions:
- Check [Troubleshooting](#troubleshooting) section
- Review server logs: `render logs -f`
- Create GitHub issue: [Repository Issues](https://github.com/jgtolentino/render-mcp-bridge/issues)
