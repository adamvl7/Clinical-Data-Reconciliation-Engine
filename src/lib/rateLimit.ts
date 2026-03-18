import { NextRequest, NextResponse } from "next/server";

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 15;  // per window
const CLEANUP_INTERVAL_MS = 300_000; // 5 minutes

function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return ip;
}

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

setInterval(cleanup, CLEANUP_INTERVAL_MS).unref?.();

/**
 * Returns a 429 response if the client has exceeded the rate limit,
 * or null if the request is allowed.
 */
export function checkRateLimit(request: NextRequest): NextResponse | null {
  const key = getClientKey(request);
  const now = Date.now();

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);

  if (entry.timestamps.length >= MAX_REQUESTS) {
    const oldestInWindow = entry.timestamps[0];
    const retryAfterSec = Math.ceil((oldestInWindow + WINDOW_MS - now) / 1000);

    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(MAX_REQUESTS),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil((oldestInWindow + WINDOW_MS) / 1000)),
        },
      }
    );
  }

  entry.timestamps.push(now);

  return null;
}
