# OAuth2 Migration Guide

Quick reference for migrating from Basic Auth to OAuth2/OIDC authentication.

## Migration Timeline

| Phase | Duration | Status | Actions |
|-------|----------|--------|---------|
| **Phase 1: Dual Auth** | Week 1 | Deploy | Both Basic Auth + OAuth2 work |
| **Phase 2: Client Migration** | Week 2-3 | Migrate | Clients switch to OAuth2 |
| **Phase 3: OAuth Only** | Week 4+ | Complete | Remove Basic Auth |

---

## Phase 1: Enable Dual Authentication

### 1. Deploy Updated Server

```bash
# All new code is deployed
git pull origin main
npm install
```

### 2. Configure Environment Variables

**In Render Dashboard → Environment:**

```bash
# OAuth2 Configuration (required for production)
AUTH_DOMAIN=your-tenant.auth0.com
AUTH_AUDIENCE=mcp-api
AUTH_ISSUER=https://your-tenant.auth0.com/
JWKS_URI=https://your-tenant.auth0.com/.well-known/jwks.json

# Keep Basic Auth during migration (temporary)
ENABLE_BASIC_AUTH_FALLBACK=true
BASIC_AUTH_USER=existing-username
BASIC_AUTH_PASS=existing-password
```

### 3. Verify Both Methods Work

**Test Basic Auth (legacy):**
```bash
curl -u user:pass https://your-api.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

**Test OAuth2 (new):**
```bash
# Get token
TOKEN=$(curl -s https://your-tenant.auth0.com/oauth/token \
  -H 'content-type: application/json' \
  -d '{"grant_type":"client_credentials","client_id":"xxx","client_secret":"yyy","audience":"mcp-api"}' \
  | jq -r .access_token)

# Call API
curl https://your-api.onrender.com/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

---

## Phase 2: Migrate Clients

### Client Communication Template

**Subject**: Action Required: Migrate to OAuth2 Authentication by [DATE]

**Body**:
> Hello,
>
> We're upgrading our API security to OAuth2/OIDC authentication. This provides better security and eliminates shared password management.
>
> **Timeline:**
> - **Now - [DATE]**: Both Basic Auth and OAuth2 work
> - **After [DATE]**: OAuth2 required (Basic Auth disabled)
>
> **Migration Steps:**
> 1. Get OAuth credentials: [LINK TO PROVIDER]
> 2. Update your integration: [LINK TO DOCS/AUTH.md]
> 3. Test in development environment
> 4. Deploy to production
>
> **Support:**
> - Documentation: [LINK]
> - Example code: [LINK]
> - Questions: [CONTACT]
>
> Thank you!

### Track Migration Progress

**Monitor authentication logs:**
```bash
# In Render Dashboard → Logs
# Look for these messages:

✅ JWT verified - sub: client-123
⚠️  Basic Auth verified (fallback mode)
```

**Count by auth method:**
```bash
# Basic Auth usage (should decrease to 0)
grep "Basic Auth verified" logs | wc -l

# OAuth2 usage (should increase)
grep "JWT verified" logs | wc -l
```

### Client-Specific Guidance

**Node.js clients:**
- Install: `npm install axios`
- Code: See `docs/AUTH.md#nodejs--javascript`
- Estimated time: 15 minutes

**Python clients:**
- Install: `pip install requests`
- Code: See `docs/AUTH.md#python`
- Estimated time: 15 minutes

**cURL/bash scripts:**
- No installation required
- Code: See `docs/AUTH.md#curl`
- Estimated time: 10 minutes

---

## Phase 3: Disable Basic Auth

### When to Proceed

✅ All criteria met:
- [ ] All clients contacted (100%)
- [ ] Zero Basic Auth requests in past 7 days
- [ ] OAuth2 requests stable
- [ ] No support tickets related to auth

### Disable Basic Auth

**1. Update environment variable:**
```bash
ENABLE_BASIC_AUTH_FALLBACK=false
```

**2. Remove credentials (optional):**
```bash
# In Render Dashboard → Environment
# Delete:
BASIC_AUTH_USER
BASIC_AUTH_PASS
```

**3. Redeploy service**

**4. Verify:**
```bash
# Basic Auth should now fail
curl -u user:pass https://your-api.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Expected: HTTP 401 {"error":"unauthorized","message":"Invalid Authorization header format"}
```

---

## Rollback Plan

### If Issues Arise

**Emergency rollback to Basic Auth only:**

1. **Disable OAuth temporarily:**
```bash
# Remove OAuth env vars (keep backup)
unset AUTH_DOMAIN
unset AUTH_AUDIENCE
unset AUTH_ISSUER
unset JWKS_URI

# Keep Basic Auth enabled
ENABLE_BASIC_AUTH_FALLBACK=true
```

2. **Redeploy**

3. **Investigate issue**

4. **Re-enable OAuth when resolved**

### Common Issues

**OAuth provider down:**
- Switch to fallback mode temporarily
- Monitor provider status page

**Client integration bugs:**
- Extend migration deadline
- Provide hands-on support
- Share working examples

**Performance issues:**
- Check JWKS caching (10min default)
- Monitor JWT verification latency
- Scale up if needed

---

## Post-Migration

### Monitoring

**Key metrics:**
- Authentication success rate: >99%
- JWT verification latency: <50ms
- JWKS cache hit rate: >95%
- Failed auth attempts: <1%

**Dashboards:**
```bash
# In Render Dashboard → Metrics
- Request rate by auth method
- Error rate (401 Unauthorized)
- Response time percentiles
```

### Security Audit

**Verify security posture:**
- [ ] No hardcoded secrets in code
- [ ] OAuth credentials rotated regularly (90 days)
- [ ] Scopes properly enforced
- [ ] Rate limiting per client (`sub` claim)
- [ ] Audit logging enabled

### Documentation Updates

**Update docs to reflect OAuth-only:**
- Remove Basic Auth sections
- Mark OAuth as required (not optional)
- Update examples to show OAuth only
- Add troubleshooting for OAuth issues

---

## Success Criteria

✅ **Migration successful when:**
- 100% of requests use OAuth2
- Zero authentication-related support tickets
- <1% failed auth attempts
- Documentation updated
- Basic Auth fully disabled

---

## Support Resources

- **OAuth2 Documentation**: `docs/AUTH.md`
- **Testing Script**: `scripts/test-auth.sh`
- **Environment Template**: `.env.example`
- **GitHub Issues**: [Repository Link]
- **Emergency Contact**: [Your Contact Info]
