# GitHub Repository Setup

## Option 1: Create Repository via GitHub Web UI (Recommended)

1. **Go to GitHub:**
   - Visit: https://github.com/new

2. **Repository Settings:**
   - **Repository name:** `render-mcp-bridge`
   - **Description:** `MCP (Model Context Protocol) server for ChatGPT integration hosted on Render`
   - **Visibility:** Public (or Private if preferred)
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)

3. **Create Repository:**
   - Click "Create repository"

4. **Push Local Code:**
   ```bash
   cd /Users/tbwa/render-mcp-bridge
   git remote add origin https://github.com/jgtolentino/render-mcp-bridge.git
   git push -u origin main
   ```

## Option 2: Use GitHub CLI with Proper Token

If you want to use `gh` CLI, you need to update your GitHub token:

1. **Create New Token:**
   - Go to: https://github.com/settings/tokens/new
   - Select scopes: `repo`, `workflow`, `read:org`
   - Generate token

2. **Authenticate gh CLI:**
   ```bash
   gh auth login
   # Choose "Paste an authentication token"
   # Paste your new token
   ```

3. **Create Repository:**
   ```bash
   cd /Users/tbwa/render-mcp-bridge
   gh repo create render-mcp-bridge --public --description "MCP server for ChatGPT on Render" --source=. --remote=origin --push
   ```

## Verify Setup

After pushing, verify:
```bash
git remote -v
# Should show:
# origin  https://github.com/jgtolentino/render-mcp-bridge.git (fetch)
# origin  https://github.com/jgtolentino/render-mcp-bridge.git (push)

git log --oneline
# Should show your initial commit
```

Repository URL: https://github.com/jgtolentino/render-mcp-bridge
