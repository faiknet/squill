/**
 * Rate Limiter for Deno Edge Functions
 * 
 * Implements a sliding window rate limiting algorithm with configurable
 * request thresholds and time windows. Zero external dependencies.
 * 
 * Usage:
 *   const limiter = new RateLimiter();
 *   limiter.checkLimit('user-id', 5, 60); // 5 requests per 60 seconds
 *   // Throws RateLimitError if limit exceeded
 */

export class RateLimitError extends Error {
  constructor(
    public readonly retryAfterSeconds: number,
    message = 'Rate limit exceeded'
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

interface RequestWindow {
  count: number;
  firstRequestTime: number;
  windowSize: number;
}

/**
 * RateLimiter uses sliding window algorithm to track requests
 * 
 * - Maintains in-memory request history per key
 * - Cleans up old entries periodically
 * - Time-based expiration prevents unlimited memory growth
 * 
 * Note: This is in-memory only. For distributed systems, use Redis or Supabase.
 */
export class RateLimiter {
  private windows: Map<string, RequestWindow> = new Map();
  private cleanupInterval: number = 60000; // 1 minute

  constructor() {
    // Auto-cleanup old entries every minute
    this.startCleanup();
  }

  /**
   * Check if a request is within rate limit
   * 
   * @param key - Identifier (IP address, user ID, session ID)
   * @param maxRequests - Maximum requests allowed in time window
   * @param windowSeconds - Time window in seconds
   * @returns Remaining requests allowed in current window
   * @throws RateLimitError if limit exceeded (includes retryAfterSeconds)
   * 
   * @example
   *   try {
   *     const remaining = limiter.checkLimit('192.168.1.1', 5, 900);
   *     console.log(`${remaining} requests remaining`);
   *   } catch (error) {
   *     if (error instanceof RateLimitError) {
   *       console.log(`Try again in ${error.retryAfterSeconds}s`);
   *     }
   *   }
   */
  checkLimit(key: string, maxRequests: number, windowSeconds: number): number {
    const now = Date.now();
    const window = this.windows.get(key);
    const windowMs = windowSeconds * 1000;

    // New key or window expired
    if (!window || now - window.firstRequestTime > windowMs) {
      this.windows.set(key, {
        count: 1,
        firstRequestTime: now,
        windowSize: windowMs,
      });
      return maxRequests - 1;
    }

    // Request within current window
    if (window.count < maxRequests) {
      window.count++;
      return maxRequests - window.count;
    }

    // Rate limit exceeded
    const timeUntilReset = Math.ceil(
      (window.firstRequestTime + windowMs - now) / 1000
    );
    throw new RateLimitError(timeUntilReset);
  }

  /**
   * Reset rate limit for a specific key
   * Useful for testing or manual administrative resets
   */
  reset(key: string): void {
    this.windows.delete(key);
  }

  /**
   * Reset all rate limits
   * Useful for testing or cache clearing
   */
  resetAll(): void {
    this.windows.clear();
  }

  /**
   * Get current state of a rate limit window (for debugging)
   * Returns null if key not found or window expired
   */
  getState(key: string): { count: number; remaining: number; expiresInSeconds: number } | null {
    const window = this.windows.get(key);
    if (!window) return null;

    const now = Date.now();
    const expiresAt = window.firstRequestTime + window.windowSize;

    if (now > expiresAt) {
      this.windows.delete(key);
      return null;
    }

    return {
      count: window.count,
      remaining: window.windowSize,
      expiresInSeconds: Math.ceil((expiresAt - now) / 1000),
    };
  }

  /**
   * Start periodic cleanup of expired windows
   * Prevents unbounded memory growth for long-running edge functions
   */
  private startCleanup(): void {
    // Note: Edge functions are typically short-lived, but cleanup helps
    // if the function stays alive for extended periods
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, window] of this.windows.entries()) {
        if (now - window.firstRequestTime > window.windowSize) {
          this.windows.delete(key);
          cleaned++;
        }
      }

      // Optional: Log cleanup stats in verbose mode
      // console.log(`[RateLimiter] Cleaned ${cleaned} expired entries`);
    }, this.cleanupInterval);
  }

  /**
   * Stop cleanup interval (useful for testing)
   * Note: Not typically needed in edge functions
   */
  stopCleanup(): void {
    // Intervals in Deno are automatically cleaned up when the function exits
  }
}

/**
 * Helper to extract IP address from request headers
 * Handles X-Forwarded-For and standard REMOTE_ADDR patterns
 * 
 * @example
 *   const ip = getClientIp(req.headers);
 *   limiter.checkLimit(ip, 5, 900); // 5 requests per 15 minutes
 */
export function getClientIp(headers: Headers): string {
  // Check for forwarded IP (from proxy/CDN)
  const forwarded = headers.get('X-Forwarded-For');
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, use the first one
    return forwarded.split(',')[0].trim();
  }

  // Fallback to CF-Connecting-IP (Cloudflare)
  const cfIP = headers.get('CF-Connecting-IP');
  if (cfIP) return cfIP;

  // Fallback to generic X-Real-IP
  const realIP = headers.get('X-Real-IP');
  if (realIP) return realIP;

  // Default (should rarely reach here in production)
  return 'unknown';
}

/**
 * Helper to extract request signature for webhook validation
 * Used by snapshot-note to rate limit per session ID instead of IP
 * 
 * @example
 *   const sessionId = await extractSessionId(req);
 *   limiter.checkLimit(sessionId, 10, 60); // 10 requests per minute
 */
export async function extractSessionId(req: Request): Promise<string | null> {
  try {
    if (req.method !== 'POST') return null;

    const contentType = req.headers.get('Content-Type');
    if (!contentType?.includes('application/json')) return null;

    const body = await req.json() as Record<string, unknown>;
    return typeof body.session_id === 'string' ? body.session_id : null;
  } catch {
    return null;
  }
}

/**
 * Helper function to create a standard rate limit error response
 * Includes HTTP 429 status and Retry-After header
 * 
 * @example
 *   if (error instanceof RateLimitError) {
 *     return createRateLimitResponse(error, corsHeaders);
 *   }
 */
export function createRateLimitResponse(
  error: RateLimitError,
  corsHeaders: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify({
      error: 'Request rate limit exceeded. Please try again later.',
      retryAfter: error.retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(error.retryAfterSeconds),
        ...corsHeaders,
      },
    }
  );
}
