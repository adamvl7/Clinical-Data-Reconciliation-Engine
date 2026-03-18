import crypto from "crypto";

interface CacheEntry<T> {
  value: T;
  createdAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function cacheKey(prefix: string, payload: unknown): string {
  const hash = crypto
    .createHash("sha256")
    .update(prefix + JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);
  return `${prefix}:${hash}`;
}

export async function getCachedOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing && Date.now() - existing.createdAt < ttlMs) {
    return existing.value;
  }

  const value = await fetchFn();
  store.set(key, { value, createdAt: Date.now() });
  return value;
}

export function clearCache(): void {
  store.clear();
}
