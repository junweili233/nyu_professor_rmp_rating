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
  const inFlightLookups = new Map();

  return {
    async lookup(name, { forceRefresh = false } = {}) {
      if (!String(name ?? "").trim()) {
        throw new Error("professor name is required");
      }
      const key = professorCacheKey(name);
      const currentTime = now();
      const memoryEntry = memoryCache.get(key);
      if (!forceRefresh && memoryEntry && isFreshCacheEntry(memoryEntry, currentTime)) {
        return withCacheMetadata(memoryEntry.value, memoryEntry.cachedAt);
      }

      if (!forceRefresh) {
        const cached = await readStoredRating(storage, key, currentTime);
        if (cached.status === "fresh") {
          memoryCache.set(key, createStoredRating(cached.value, cached.cachedAt));
          return withCacheMetadata(cached.value, cached.cachedAt);
        }

        if (cached.status === "legacy") {
          memoryCache.set(key, createStoredRating(cached.value, currentTime));
          return withCacheMetadata(cached.value, currentTime);
        }
      }

      if (!inFlightLookups.has(key)) {
        inFlightLookups.set(key, fetchAndCacheRating({ key, name, currentTime, findProfessorRating, memoryCache, storage }));
      }

      return inFlightLookups.get(key).finally(() => {
        inFlightLookups.delete(key);
      });
    },
    async clearCache() {
      memoryCache.clear();
      const items = await storage.get(null);
      const keys = Object.keys(items).filter((key) => key.startsWith("professor:"));
      if (keys.length > 0) {
        await storage.remove(keys);
      }
      return keys.length;
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

async function fetchAndCacheRating({ key, name, currentTime, findProfessorRating, memoryCache, storage }) {
  const result = await findProfessorRating(name);
  const storedResult = createStoredRating(result, currentTime);
  memoryCache.set(key, storedResult);
  await storage.set({ [key]: storedResult });
  return withCacheMetadata(result, currentTime);
}

function withCacheMetadata(value, cachedAt) {
  if (!value || typeof value !== "object") {
    return value;
  }
  return { ...value, cacheUpdatedAt: cachedAt };
}
