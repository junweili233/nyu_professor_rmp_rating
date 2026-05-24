import { findProfessorRating as defaultFindProfessorRating } from "./shared/rmpClient.js";

export function createProfessorLookupService({
  storage,
  findProfessorRating = defaultFindProfessorRating,
} = {}) {
  if (!storage) {
    throw new Error("storage is required");
  }

  const memoryCache = new Map();

  return {
    async lookup(name) {
      const key = professorCacheKey(name);
      if (memoryCache.has(key)) {
        return memoryCache.get(key);
      }

      const cached = await readStoredRating(storage, key);
      if (cached !== undefined) {
        memoryCache.set(key, cached);
        return cached;
      }

      const result = await findProfessorRating(name);
      memoryCache.set(key, result);
      await storage.set({ [key]: result });
      return result;
    },
  };
}

export function professorCacheKey(name) {
  return `professor:${String(name).trim().toLowerCase()}`;
}

async function readStoredRating(storage, key) {
  const result = await storage.get(key);
  return Object.prototype.hasOwnProperty.call(result, key) ? result[key] : undefined;
}
