const counters = new Map<string, { start: number; count: number }>();

export function rateLimit(key: string, maximum: number, windowMs: number) {
  const now = Date.now();
  if (counters.size > 10_000) {
    for (const [entryKey, entry] of counters) if (now - entry.start >= windowMs) counters.delete(entryKey);
  }
  const counter = counters.get(key);
  if (!counter || now - counter.start >= windowMs) {
    counters.set(key, { start: now, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  counter.count += 1;
  return { allowed: counter.count <= maximum, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - counter.start)) / 1000)) };
}

export function clientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
