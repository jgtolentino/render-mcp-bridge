# Render MCP Bridge - Claude Instructions

## Project Path
**Canonical Location:** `/Users/tbwa/Documents/GitHub/render-mcp-bridge`

When starting work on this project, always verify you're in the correct directory:
```bash
cd /Users/tbwa/Documents/GitHub/render-mcp-bridge
pwd  # Should output the path above
```

## Quick Reference
- **Repository:** https://github.com/jgtolentino/render-mcp-bridge.git
- **Purpose:** MCP bridge server for Render.com deployment
- **Stack:** Node.js, Express, PostgreSQL, Supabase

## Project Structure
```
render-mcp-bridge/
├── server.js              # Main Express server
├── package.json           # Dependencies
├── render.yaml            # Render.com config
├── db/migrations/         # Database migrations
├── middleware/            # Auth & validation middleware
├── scripts/               # Deployment & test scripts
└── docs/                  # Documentation
```

## Development Commands
```bash
# Install dependencies
npm install

# Run locally
npm start

# Test authentication
npm run test:auth

# Deploy to Render
git push origin main
```

## Environment Variables
Stored in `~/.zshrc`:
- `SUPABASE_PROJECT_REF`
- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Common Tasks
- OAuth implementation → See `docs/AUTH.md`
- Database migrations → See `docs/MIGRATION.md`
- Production hardening → See `docs/PRODUCTION_HARDENING_COMPLETE.md`

## Git Workflow
```bash
# Check status
git status

# Add changes
git add .

# Commit with descriptive message
git commit -m "feat: description"

# Push to trigger deployment
git push origin main
```
