import { ApiError } from "@/lib/api/errors";

/**
 * Simple per-employee sliding-window rate limiter.
 *
 * This is intentionally in-memory. It is suitable for a single-process
 * deployment/demo. For a multi-instance production deployment, replace
 * this with a shared store such as Redis.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 15;

const hits = new Map<string, number[]>();

export function checkAIRateLimit(key: string): void {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const recent = (hits.get(key) ?? []).filter(
    (timestamp) => timestamp > windowStart,
  );

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    if (hits.size > 500) {
      pruneStaleKeys(windowStart);
    }

    throw ApiError.tooManyRequests(
      "You're asking Dayflow AI questions too quickly. Please wait a moment and try again.",
    );
  }

  recent.push(now);
  hits.set(key, recent);
}

function pruneStaleKeys(windowStart: number) {
  for (const [key, timestamps] of hits) {
    const recent = timestamps.filter(
      (timestamp) => timestamp > windowStart,
    );

    if (recent.length === 0) {
      hits.delete(key);
    } else {
      hits.set(key, recent);
    }
  }
}