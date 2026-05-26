import { findProfessorRating as defaultFindProfessorRating } from "./shared/rmpClient.js";
import { normalizeInstructorName, splitInstructorList } from "./shared/albertParser.js";

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
      const normalizedName = normalizeProfessorName(name);
      const key = professorCacheKey(normalizedName);
      const currentTime = now();
      const memoryEntry = memoryCache.get(key);
      let staleFallback = null;
      if (!forceRefresh && memoryEntry && isFreshCacheEntry(memoryEntry, currentTime)) {
        return withCacheMetadata(memoryEntry.value, memoryEntry.cachedAt);
      }
      if (!forceRefresh && memoryEntry && !isFreshCacheEntry(memoryEntry, currentTime)) {
        staleFallback = memoryEntry;
      }

      if (!forceRefresh) {
        const cached = await readStoredRating(storage, key, currentTime);
        if (cached.status === "fresh") {
          memoryCache.set(key, createStoredRating(cached.value, cached.cachedAt));
          return withCacheMetadata(cached.value, cached.cachedAt);
        }

        if (cached.status === "legacy") {
          const migratedEntry = createStoredRating(cached.value, currentTime);
          memoryCache.set(key, migratedEntry);
          try {
            await storage.set({ [key]: migratedEntry });
          } catch {
            // Old cache data can still render even if Chrome storage refuses the timestamp migration.
          }
          return withCacheMetadata(cached.value, currentTime);
        }
        if (cached.status === "stale") {
          staleFallback = createStoredRating(cached.value, cached.cachedAt);
        }
      }

      const inFlightKey = forceRefresh ? `${key}:force` : key;
      if (!inFlightLookups.has(inFlightKey)) {
        inFlightLookups.set(inFlightKey, fetchAndCacheRating({ key, name: normalizedName, currentTime, findProfessorRating, memoryCache, storage, staleFallback }));
      }

      return inFlightLookups.get(inFlightKey).finally(() => {
        inFlightLookups.delete(inFlightKey);
      });
    },
    async clearCache() {
      memoryCache.clear();
      const items = await storage.get(null);
      const keys = Object.keys(items ?? {}).filter((key) => key.startsWith("professor:"));
      if (keys.length > 0) {
        await storage.remove(keys);
      }
      return keys.length;
    },
  };
}

export function professorCacheKey(name) {
  return `professor:${foldDiacritics(normalizeProfessorName(name))
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()}`;
}

function normalizeProfessorName(name) {
  const pieces = splitInstructorList(name);
  if (pieces.length === 1) {
    return normalizeInstructorName(pieces[0]) || pieces[0];
  }

  return normalizeInstructorName(String(name ?? "")) || name;
}

function foldDiacritics(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function readStoredRating(storage, key, currentTime) {
  let result;
  try {
    result = await storage.get(key);
  } catch {
    return { status: "missing" };
  }
  if (!Object.prototype.hasOwnProperty.call(result, key) || result[key] === undefined) {
    return { status: "missing" };
  }

  const stored = result[key];
  if (isTimestampedCacheEntry(stored)) {
    return isFreshCacheEntry(stored, currentTime)
      ? { status: "fresh", value: stored.value, cachedAt: stored.cachedAt }
      : { status: "stale", value: stored.value, cachedAt: stored.cachedAt };
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
  return entry.cachedAt <= currentTime && currentTime - entry.cachedAt <= CACHE_TTL_MS;
}

async function fetchAndCacheRating({ key, name, currentTime, findProfessorRating, memoryCache, storage, staleFallback = null }) {
  let result;
  try {
    result = await findProfessorRating(name);
  } catch (error) {
    if (staleFallback) {
      memoryCache.set(key, staleFallback);
      return withCacheMetadata(staleFallback.value, staleFallback.cachedAt);
    }
    throw error;
  }
  const storedResult = createStoredRating(result, currentTime);
  const existingMemoryEntry = memoryCache.get(key);
  if (existingMemoryEntry && existingMemoryEntry.cachedAt > currentTime) {
    return withCacheMetadata(result, currentTime);
  }

  memoryCache.set(key, storedResult);
  try {
    await storage.set({ [key]: storedResult });
  } catch {
    // Chrome storage can fail transiently; fetched RMP data is still useful for the current Albert card.
  }
  return withCacheMetadata(result, currentTime);
}

function withCacheMetadata(value, cachedAt) {
  if (!value || typeof value !== "object") {
    return value;
  }
  return { ...value, cacheUpdatedAt: cachedAt };
}
