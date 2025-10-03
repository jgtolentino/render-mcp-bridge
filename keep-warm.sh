#!/bin/bash
# Keep Render free-tier service warm by pinging every 5 minutes
# Run this locally or use cron-job.org

URL="${1:-https://mcp-server-njax.onrender.com}"

echo "🔥 Starting keep-warm for: $URL"
echo "⏰ Ping interval: 5 minutes"
echo "💡 Press Ctrl+C to stop"
echo ""

while true; do
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  response=$(curl -s -o /dev/null -w "%{http_code}" "$URL/healthz")

  if [ "$response" = "200" ]; then
    echo "[$timestamp] ✅ Ping successful (HTTP $response)"
  else
    echo "[$timestamp] ❌ Ping failed (HTTP $response)"
  fi

  sleep 300  # 5 minutes
done
