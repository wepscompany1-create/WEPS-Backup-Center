type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function consumeRateLimit(options: {
  key: string;
  max: number;
  windowMs: number;
  now?: number;
}) {
  const now = options.now ?? Date.now();
  const current = buckets.get(options.key);
  if (!current || current.resetAt <= now) {
    buckets.set(options.key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.max - 1, retryAfterMs: 0 };
  }
  if (current.count >= options.max) {
    return { allowed: false, remaining: 0, retryAfterMs: current.resetAt - now };
  }
  current.count += 1;
  buckets.set(options.key, current);
  return { allowed: true, remaining: options.max - current.count, retryAfterMs: 0 };
}

export function resetRateLimit(key?: string) {
  if (key) {
    buckets.delete(key);
    return;
  }
  buckets.clear();
}

export function loginRateLimitKey(ip: string, email: string) {
  return `login:${ip}:${email.trim().toLowerCase()}`;
}

export function testEmailRateLimitKey(userId: string) {
  return `test-email:${userId}`;
}
