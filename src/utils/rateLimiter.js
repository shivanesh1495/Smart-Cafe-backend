/**
 * Simple in-memory rate limiter for API endpoints
 * Can be extended to use Redis for distributed systems
 */

const requestLog = new Map(); // userId -> array of timestamps

const RATE_LIMIT_CONFIG = {
  chat: {
    maxRequests: 3, // Very strict: 3 messages per minute to prevent quota issues
    windowMs: 60 * 1000, // 1 minute
  },
  nutrition: {
    maxRequests: 5, // 5 nutrition checks per minute
    windowMs: 60 * 1000,
  },
  recommendations: {
    maxRequests: 2, // 2 refreshes per minute
    windowMs: 60 * 1000,
  },
  dietCheck: {
    maxRequests: 3, // 3 diet checks per minute
    windowMs: 60 * 1000,
  },
};

/**
 * Check if user has exceeded rate limit
 * @param {string} userId - User ID
 * @param {string} endpoint - Endpoint name (e.g., 'chat', 'nutrition')
 * @returns {object} { allowed: boolean, remaining: number, resetTime: number }
 */
const checkRateLimit = (userId, endpoint = "chat") => {
  const config = RATE_LIMIT_CONFIG[endpoint];
  if (!config) {
    return { allowed: true, remaining: config.maxRequests };
  }

  const now = Date.now();
  const key = `${userId}:${endpoint}`;

  // Initialize or get request log
  if (!requestLog.has(key)) {
    requestLog.set(key, []);
  }

  let timestamps = requestLog.get(key);

  // Remove old requests outside the window
  timestamps = timestamps.filter(
    (timestamp) => now - timestamp < config.windowMs,
  );

  // Check if limit exceeded
  const allowed = timestamps.length < config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - timestamps.length - 1);

  if (allowed) {
    // Add current request
    timestamps.push(now);
    requestLog.set(key, timestamps);
  }

  // Calculate reset time (when oldest request will expire)
  const resetTime =
    timestamps.length > 0
      ? timestamps[0] + config.windowMs
      : now + config.windowMs;

  return {
    allowed,
    remaining,
    resetTime,
    retryAfterSeconds: Math.ceil((resetTime - now) / 1000),
  };
};

/**
 * Cleanup old entries (call periodically to prevent memory leaks)
 */
const cleanup = () => {
  const now = Date.now();
  for (const [key, timestamps] of requestLog.entries()) {
    const filtered = timestamps.filter(
      (timestamp) => now - timestamp < 24 * 60 * 60 * 1000, // 24 hours
    );
    if (filtered.length === 0) {
      requestLog.delete(key);
    } else {
      requestLog.set(key, filtered);
    }
  }
};

// Cleanup every 30 minutes
setInterval(cleanup, 30 * 60 * 1000);

module.exports = {
  checkRateLimit,
  RATE_LIMIT_CONFIG,
};
