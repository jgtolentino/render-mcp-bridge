#!/usr/bin/env bash
# migrate-to-global-framework.sh
# Migrate project to use only global SuperClaude framework
# Usage: ./scripts/migrate-to-global-framework.sh

set -euo pipefail

PROJECT_PATH="$(pwd)"
PROJECT_NAME="$(basename "$PROJECT_PATH")"
ENV_VAR_NAME="$(echo "$PROJECT_NAME" | tr '[:lower:]-' '[:upper:]_')"

echo "🔄 Migrating $PROJECT_NAME to global framework structure..."
echo ""

# Step 1: Detect project stack and commands
echo "📦 Detecting project configuration..."

STACK="[]"
if [ -f "package.json" ]; then
    STACK='["Node.js"]'
    if grep -q '"react"' package.json 2>/dev/null; then
        STACK='["Node.js", "React"]'
    fi
    if grep -q '"express"' package.json 2>/dev/null; then
        STACK='["Node.js", "Express"]'
    fi
fi

# Detect common commands
DEV_CMD="npm run dev"
BUILD_CMD="npm run build"
TEST_CMD="npm test"

if [ -f "package.json" ]; then
    if ! grep -q '"dev"' package.json; then
        DEV_CMD="npm start"
    fi
    if ! grep -q '"build"' package.json; then
        BUILD_CMD="echo 'No build command'"
    fi
fi

# Step 2: Create/update .claude-project
echo "📝 Creating enhanced .claude-project..."

cat > .claude-project << EOF
{
  "name": "$PROJECT_NAME",
  "root": "$PROJECT_PATH",
  "description": "$(git remote get-url origin 2>/dev/null || echo 'Development project')",
  "stack": $STACK,
  "commands": {
    "dev": "$DEV_CMD",
    "build": "$BUILD_CMD",
    "test": "$TEST_CMD",
    "deploy": "git push origin main"
  }
}
EOF

echo "✅ Created .claude-project"

# Step 3: Archive old CLAUDE.md if it exists
if [ -f "CLAUDE.md" ]; then
    echo "📦 Archiving old CLAUDE.md..."
    mkdir -p .claude-archive
    mv CLAUDE.md ".claude-archive/CLAUDE.md.$(date +%Y%m%d_%H%M%S)"
    echo "✅ Archived to .claude-archive/"
fi

# Step 4: Add environment variable if not exists
echo "🔧 Checking environment variable..."

if ! grep -q "export $ENV_VAR_NAME=" ~/.zshrc 2>/dev/null; then
    echo "" >> ~/.zshrc
    echo "# $PROJECT_NAME project path" >> ~/.zshrc
    echo "export $ENV_VAR_NAME=\"$PROJECT_PATH\"" >> ~/.zshrc
    echo "✅ Added $ENV_VAR_NAME to ~/.zshrc"
else
    echo "ℹ️  $ENV_VAR_NAME already exists in ~/.zshrc"
fi

# Step 5: Update .gitignore if needed
if [ -f ".gitignore" ]; then
    if ! grep -q ".claude-archive" .gitignore; then
        echo ".claude-archive/" >> .gitignore
        echo "✅ Added .claude-archive/ to .gitignore"
    fi
fi

# Step 6: Git operations
echo "📊 Git status..."
git add .claude-project .gitignore 2>/dev/null || true

echo ""
echo "✅ Migration complete!"
echo ""
echo "Next steps:"
echo "  1. Review changes: git diff --staged"
echo "  2. Commit: git commit -m 'chore: migrate to global SuperClaude framework'"
echo "  3. Reload shell: source ~/.zshrc"
echo "  4. Test navigation: cd \$$ENV_VAR_NAME"
echo ""
echo "All project instructions are now in: ~/.claude/CLAUDE.md"
echo "Project-specific config is in: .claude-project (lightweight JSON only)"
