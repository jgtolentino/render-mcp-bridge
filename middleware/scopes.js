/**
 * Scope Validation Helpers
 * Utilities for checking JWT scopes and permissions
 */

/**
 * Parse scope string into array
 * @param {string|string[]} scopes - Space-separated scope string or array
 * @returns {string[]} - Array of scopes
 */
function parseScopes(scopes) {
  if (!scopes) return [];
  if (Array.isArray(scopes)) return scopes;
  if (typeof scopes === 'string') return scopes.split(' ').filter(Boolean);
  return [];
}

/**
 * Check if user has all required scopes
 * @param {string|string[]} userScopes - User's scopes
 * @param {string|string[]} requiredScopes - Required scopes
 * @returns {boolean} - True if has all required scopes
 */
function hasAllScopes(userScopes, requiredScopes) {
  const userScopeArray = parseScopes(userScopes);
  const requiredScopeArray = parseScopes(requiredScopes);

  if (requiredScopeArray.length === 0) return true;

  return requiredScopeArray.every(scope => userScopeArray.includes(scope));
}

/**
 * Check if user has any of the required scopes
 * @param {string|string[]} userScopes - User's scopes
 * @param {string|string[]} requiredScopes - Required scopes
 * @returns {boolean} - True if has at least one required scope
 */
function hasAnyScope(userScopes, requiredScopes) {
  const userScopeArray = parseScopes(userScopes);
  const requiredScopeArray = parseScopes(requiredScopes);

  if (requiredScopeArray.length === 0) return true;

  return requiredScopeArray.some(scope => userScopeArray.includes(scope));
}

/**
 * Get missing scopes
 * @param {string|string[]} userScopes - User's scopes
 * @param {string|string[]} requiredScopes - Required scopes
 * @returns {string[]} - Array of missing scopes
 */
function getMissingScopes(userScopes, requiredScopes) {
  const userScopeArray = parseScopes(userScopes);
  const requiredScopeArray = parseScopes(requiredScopes);

  return requiredScopeArray.filter(scope => !userScopeArray.includes(scope));
}

/**
 * Middleware to require specific scopes
 * @param {string|string[]} requiredScopes - Required scopes (AND logic)
 * @param {object} options - Options
 * @returns {Function} - Express middleware
 */
function requireScopes(requiredScopes, options = {}) {
  const { mode = 'all' } = options; // 'all' or 'any'

  return (req, res, next) => {
    // Skip if no auth or user not present
    if (!req.user && !req.auth) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required'
      });
    }

    const userScopes = req.user?.scope || req.auth?.scopes || req.user?.scopes || '';

    // Check scopes based on mode
    const hasRequired = mode === 'any'
      ? hasAnyScope(userScopes, requiredScopes)
      : hasAllScopes(userScopes, requiredScopes);

    if (!hasRequired) {
      const missing = getMissingScopes(userScopes, requiredScopes);

      return res.status(403).json({
        error: 'forbidden',
        message: `Missing required ${mode === 'all' ? 'scopes' : 'any scope'}`,
        required_scopes: parseScopes(requiredScopes),
        user_scopes: parseScopes(userScopes),
        missing_scopes: missing
      });
    }

    next();
  };
}

/**
 * Minimal MCP API scopes (production-ready)
 * Using minimal scope model for better security posture
 */
const MCP_SCOPES = {
  // Tool operations (minimal set)
  TOOLS_READ: 'mcp:tools.read',      // Read-only tool access (list, describe)
  TOOLS_EXEC: 'mcp:tools.exec',      // Execute tools (call, process)

  // Admin operations
  ADMIN: 'mcp:admin',                // Full admin access (metrics, config)

  // Legacy scopes (deprecated, mapped to minimal set)
  SEARCH: 'mcp:search',              // → maps to tools.read
  FETCH: 'mcp:fetch',                // → maps to tools.read
  READ: 'mcp:read',                  // → maps to tools.read
  PROCESS: 'mcp:process',            // → maps to tools.exec
  WRITE: 'mcp:write',                // → maps to tools.exec
  TOOLS: 'mcp:tools',                // → maps to tools.exec
  TOOLS_CALL: 'mcp:tools:call'       // → maps to tools.exec
};

/**
 * Check if user has admin access
 * @param {object} user - User object from JWT
 * @returns {boolean} - True if admin
 */
function isAdmin(user) {
  if (!user) return false;

  const userScopes = user.scope || user.scopes || '';
  return hasAnyScope(userScopes, [MCP_SCOPES.ADMIN]);
}

/**
 * Check if user can read (including legacy scopes)
 * @param {object} user - User object from JWT
 * @returns {boolean} - True if can read
 */
function canRead(user) {
  if (!user) return false;

  const userScopes = user.scope || user.scopes || '';
  return hasAnyScope(userScopes, [
    MCP_SCOPES.TOOLS_READ,
    MCP_SCOPES.ADMIN,
    // Legacy scopes
    MCP_SCOPES.READ,
    MCP_SCOPES.SEARCH,
    MCP_SCOPES.FETCH
  ]);
}

/**
 * Check if user can execute tools (including legacy scopes)
 * @param {object} user - User object from JWT
 * @returns {boolean} - True if can execute tools
 */
function canExecuteTools(user) {
  if (!user) return false;

  const userScopes = user.scope || user.scopes || '';
  return hasAnyScope(userScopes, [
    MCP_SCOPES.TOOLS_EXEC,
    MCP_SCOPES.ADMIN,
    // Legacy scopes
    MCP_SCOPES.TOOLS,
    MCP_SCOPES.TOOLS_CALL,
    MCP_SCOPES.WRITE,
    MCP_SCOPES.PROCESS
  ]);
}

/**
 * Middleware to require read access (minimal scope model)
 */
function requireRead() {
  return requireScopes([
    MCP_SCOPES.TOOLS_READ,
    MCP_SCOPES.ADMIN,
    // Legacy scopes for backward compatibility
    MCP_SCOPES.READ,
    MCP_SCOPES.SEARCH,
    MCP_SCOPES.FETCH
  ], { mode: 'any' });
}

/**
 * Middleware to require tool execution access (minimal scope model)
 */
function requireToolsExec() {
  return requireScopes([
    MCP_SCOPES.TOOLS_EXEC,
    MCP_SCOPES.ADMIN,
    // Legacy scopes for backward compatibility
    MCP_SCOPES.TOOLS,
    MCP_SCOPES.TOOLS_CALL,
    MCP_SCOPES.WRITE,
    MCP_SCOPES.PROCESS
  ], { mode: 'any' });
}

/**
 * Middleware to require admin access
 */
function requireAdmin() {
  return requireScopes([MCP_SCOPES.ADMIN]);
}

// Aliases for backward compatibility
const requireToolsAccess = requireToolsExec;
const requireWrite = requireToolsExec;

module.exports = {
  // Scope parsing
  parseScopes,
  hasAllScopes,
  hasAnyScope,
  getMissingScopes,

  // Middleware (minimal scope model)
  requireScopes,
  requireRead,
  requireToolsExec,
  requireAdmin,

  // Backward compatibility aliases
  requireWrite,
  requireToolsAccess,

  // Permission checks
  isAdmin,
  canRead,
  canExecuteTools,

  // Constants
  MCP_SCOPES
};
