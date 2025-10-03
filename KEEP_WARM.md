# Keep-Warm Solutions for Render Free Tier

## Problem
Render free-tier services sleep after 15 minutes of inactivity, causing:
- 30-60 second cold start on first request
- ChatGPT connector timeout during initial handshake
- Poor user experience

## Solutions

### Option 1: Local Keep-Warm Script (Free)

**Run on your machine:**
```bash
./keep-warm.sh https://mcp-server-njax.onrender.com
```

This pings `/healthz` every 5 minutes to keep the service warm.

**To run in background:**
```bash
nohup ./keep-warm.sh > keep-warm.log 2>&1 &
```

**To stop:**
```bash
pkill -f keep-warm.sh
```

---

### Option 2: Cron-Job.org (Free, Cloud-Based)

1. **Go to:** https://cron-job.org/
2. **Create free account**
3. **Create new cron job:**
   ```
   Title: Render MCP Keep-Warm
   URL: https://mcp-server-njax.onrender.com/healthz
   Schedule: */5 * * * * (every 5 minutes)
   Method: GET
   ```
4. **Save and enable**

**Pros:**
- ✅ No local script needed
- ✅ Works 24/7 automatically
- ✅ Free forever
- ✅ Email alerts on failures

---

### Option 3: UptimeRobot (Free, with Monitoring)

1. **Go to:** https://uptimerobot.com/
2. **Create free account** (50 monitors free)
3. **Add New Monitor:**
   ```
   Monitor Type: HTTP(s)
   Friendly Name: MCP Bridge
   URL: https://mcp-server-njax.onrender.com/healthz
   Monitoring Interval: 5 minutes
   ```
4. **Create Monitor**

**Pros:**
- ✅ Monitoring + alerting
- ✅ Status page
- ✅ Keeps service warm
- ✅ Free tier sufficient

---

### Option 4: GitHub Actions (Free, Git-Integrated)

Add `.github/workflows/keep-warm.yml`:

```yaml
name: Keep Warm

on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping server
        run: |
          response=$(curl -s -o /dev/null -w "%{http_code}" https://mcp-server-njax.onrender.com/healthz)
          if [ "$response" = "200" ]; then
            echo "✅ Server is warm (HTTP $response)"
          else
            echo "❌ Server ping failed (HTTP $response)"
            exit 1
          fi
```

**Pros:**
- ✅ No external service needed
- ✅ Version controlled
- ✅ Free for public repos

**Cons:**
- ❌ Requires GitHub repo
- ❌ 6-hour minimum interval for free tier

---

### Option 5: Upgrade to Render Starter Plan ($7/month)

**Benefits:**
- ✅ Always-on (no cold starts)
- ✅ Faster response times
- ✅ No keep-warm hacks needed
- ✅ Better for production

**Upgrade:**
1. Render Dashboard → Your Service
2. Settings → Instance Type
3. Select **Starter** ($7/month)
4. Confirm

---

## Recommended Solution

**For Testing/Development:**
- Use **Cron-Job.org** (easiest, no maintenance)

**For Production:**
- Use **Render Starter Plan** (reliable, professional)

---

## Verification

After setting up keep-warm, verify:

```bash
# Check server stays warm
curl https://mcp-server-njax.onrender.com/healthz
# Should respond in <200ms (not 30s)

# Monitor Render logs
# Should see regular health check requests every 5 min
```

---

## Cost Comparison

| Solution | Cost | Reliability | Maintenance |
|----------|------|-------------|-------------|
| Local Script | Free | Low | High |
| Cron-Job.org | Free | High | None |
| UptimeRobot | Free | High | None |
| GitHub Actions | Free | Medium | Low |
| Render Starter | $7/mo | Highest | None |

---

## Troubleshooting

**Keep-warm not working?**
- Check cron job is enabled
- Verify URL is correct
- Check Render logs for requests
- Ensure interval ≤ 14 minutes

**Still getting cold starts?**
- Render free tier may throttle aggressive pinging
- Consider upgrading to paid plan
- Check Render status page for incidents

---

## Next Steps

1. Choose a keep-warm solution
2. Set it up
3. Wait 15 minutes
4. Test response time:
   ```bash
   time curl https://mcp-server-njax.onrender.com/healthz
   ```
   Should be <200ms (not 30s)
5. Try ChatGPT connector again
