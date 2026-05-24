import { findProfessorRating as defaultFindProfessorRating } from "./shared/rmpClient.js";

export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createProfessorLookupService({
  storage,
  findProfessorRating = defaultFindProfessorRating,
  now = Date.now,
} = {}) {
  if (!storage) {
    throw new Error("storage is required");
  }

  const memoryCache = new Map();

  return {
    async lookup(name) {
      const key = professorCacheKey(name);
      const currentTime = now();
      const memoryEntry = memoryCache.get(key);
      if (memoryEntry && isFreshCacheEntry(memoryEntry, currentTime)) {
        return memoryEntry.value;
      }

      const cached = await readStoredRating(storage, key, currentTime);
      if (cached.status === "fresh") {
        memoryCache.set(key, createStoredRating(cached.value, cached.cachedAt));
        return cached.value;
      }

      if (cached.status === "legacy") {
        memoryCache.set(key, createStoredRating(cached.value, currentTime));
        return cached.value;
      }

      const result = await findProfessorRating(name);
      const storedResult = createStoredRating(result, currentTime);
      memoryCache.set(key, storedResult);
      await storage.set({ [key]: storedResult });
      return result;
    },
  };
}

export function professorCacheKey(name) {
  return `professor:${String(name).trim().toLowerCase()}`;
}

async function readStoredRating(storage, key, currentTime) {
  const result = await storage.get(key);
  if (!Object.prototype.hasOwnProperty.call(result, key) || result[key] === undefined) {
    return { status: "missing" };
  }

  const stored = result[key];
  if (isTimestampedCacheEntry(stored)) {
    return isFreshCacheEntry(stored, currentTime)
      ? { status: "fresh", value: stored.value, cachedAt: stored.cachedAt }
      : { status: "stale" };
  }

  return { status: "legacy", value: stored };
}

function createStoredRating(value, cachedAt) {
  return { cachedAt, value };
}

function isTimestampedCacheEntry(value) {
  return value && typeof value === "object" && "cachedAt" in value && "value" in value;
}

function isFreshCacheEntry(entry, currentTime) {
  return currentTime - entry.cachedAt <= CACHE_TTL_MS;
}
