import { describe, expect, it, vi } from "vitest";
import { CACHE_TTL_MS, createProfessorLookupService, professorCacheKey } from "../src/backgroundService.js";

describe("background professor lookup service", () => {
  it("rejects blank professor lookup names before touching RMP or cache", async () => {
    const storage = createStorageMock();
    const findProfessorRating = vi.fn();
    const service = createProfessorLookupService({ storage, findProfessorRating });

    await expect(service.lookup("   ")).rejects.toThrow("professor name is required");

    expect(findProfessorRating).not.toHaveBeenCalled();
    expect(storage.data).toEqual({});
  });

  it("reuses persisted Chrome storage cache before calling Rate My Professors", async () => {
    const cachedRating = {
      name: "Chee Yap",
      rating: 2.1,
      topComments: ["Avoid if you dislike fast lectures."],
    };
    const storage = createStorageMock({
      [professorCacheKey("YAP, CHEE KENG")]: cachedRating,
    });
    const findProfessorRating = vi.fn();
    const service = createProfessorLookupService({ storage, findProfessorRating });

    await expect(service.lookup("YAP, CHEE KENG")).resolves.toMatchObject(cachedRating);
    expect(findProfessorRating).not.toHaveBeenCalled();
  });

  it("reuses fresh timestamped persisted cache entries", async () => {
    const now = new Date("2026-05-24T12:00:00Z").getTime();
    const cachedRating = {
      name: "Grace Hopper",
      rating: 4.8,
      topComments: ["Useful systems lectures."],
    };
    const storage = createStorageMock({
      [professorCacheKey("Grace Hopper")]: {
        cachedAt: now - 1000,
        value: cachedRating,
      },
    });
    const findProfessorRating = vi.fn();
    const service = createProfessorLookupService({
      storage,
      findProfessorRating,
      now: () => now,
    });

    await expect(service.lookup("Grace Hopper")).resolves.toEqual({
      ...cachedRating,
      cacheUpdatedAt: now - 1000,
    });
    expect(findProfessorRating).not.toHaveBeenCalled();
  });

  it("returns cache update metadata with professor lookup results", async () => {
    const now = new Date("2026-05-24T12:00:00Z").getTime();
    const cachedRating = {
      name: "Grace Hopper",
      rating: 4.8,
      topComments: ["Useful systems lectures."],
    };
    const storage = createStorageMock({
      [professorCacheKey("Grace Hopper")]: {
        cachedAt: now - 1000,
        value: cachedRating,
      },
    });
    const findProfessorRating = vi.fn();
    const service = createProfessorLookupService({
      storage,
      findProfessorRating,
      now: () => now,
    });

    await expect(service.lookup("Grace Hopper")).resolves.toEqual({
      ...cachedRating,
      cacheUpdatedAt: now - 1000,
    });
  });

  it("refreshes stale persisted cache entries before returning Albert data", async () => {
    const now = new Date("2026-05-24T12:00:00Z").getTime();
    const staleRating = {
      name: "Alan Turing",
      rating: 3.1,
      topComments: ["Old comment."],
    };
    const freshRating = {
      name: "Alan Turing",
      rating: 4.6,
      topComments: ["Fresh useful comment."],
    };
    const storage = createStorageMock({
      [professorCacheKey("Alan Turing")]: {
        cachedAt: now - CACHE_TTL_MS - 1,
        value: staleRating,
      },
    });
    const findProfessorRating = vi.fn(async () => freshRating);
    const service = createProfessorLookupService({
      storage,
      findProfessorRating,
      now: () => now,
    });

    await expect(service.lookup("Alan Turing")).resolves.toEqual({
      ...freshRating,
      cacheUpdatedAt: now,
    });

    expect(findProfessorRating).toHaveBeenCalledWith("Alan Turing");
    expect(storage.data[professorCacheKey("Alan Turing")]).toEqual({
      cachedAt: now,
      value: freshRating,
    });
  });

  it("refreshes stale in-memory cache entries while the service worker stays alive", async () => {
    let currentTime = new Date("2026-05-24T12:00:00Z").getTime();
    const firstRating = {
      name: "Donald Knuth",
      rating: 3.8,
      topComments: ["First lookup."],
    };
    const refreshedRating = {
      name: "Donald Knuth",
      rating: 4.9,
      topComments: ["Refreshed lookup."],
    };
    const storage = createStorageMock();
    const findProfessorRating = vi.fn()
      .mockResolvedValueOnce(firstRating)
      .mockResolvedValueOnce(refreshedRating);
    const service = createProfessorLookupService({
      storage,
      findProfessorRating,
      now: () => currentTime,
    });

    await expect(service.lookup("Donald Knuth")).resolves.toEqual({
      ...firstRating,
      cacheUpdatedAt: currentTime,
    });
    currentTime += CACHE_TTL_MS + 1;
    await expect(service.lookup("Donald Knuth")).resolves.toEqual({
      ...refreshedRating,
      cacheUpdatedAt: currentTime,
    });

    expect(findProfessorRating).toHaveBeenCalledTimes(2);
    expect(storage.data[professorCacheKey("Donald Knuth")]).toEqual({
      cachedAt: currentTime,
      value: refreshedRating,
    });
  });

  it("deduplicates concurrent lookups for the same professor", async () => {
    const now = new Date("2026-05-24T12:00:00Z").getTime();
    const rating = {
      name: "Barbara Liskov",
      rating: 4.8,
      topComments: ["Precise and rigorous."],
    };
    let resolveLookup;
    const pendingLookup = new Promise((resolve) => {
      resolveLookup = resolve;
    });
    const storage = createStorageMock();
    const findProfessorRating = vi.fn(() => pendingLookup);
    const service = createProfessorLookupService({
      storage,
      findProfessorRating,
      now: () => now,
    });

    const first = service.lookup("Barbara Liskov");
    const second = service.lookup("Barbara Liskov");
    resolveLookup(rating);

    await expect(Promise.all([first, second])).resolves.toEqual([
      { ...rating, cacheUpdatedAt: now },
      { ...rating, cacheUpdatedAt: now },
    ]);

    expect(findProfessorRating).toHaveBeenCalledTimes(1);
    expect(storage.data[professorCacheKey("Barbara Liskov")]).toEqual({
      cachedAt: now,
      value: rating,
    });
  });

  it("persists fresh RMP lookup results for later Albert page scans", async () => {
    const freshRating = {
      name: "Ada Lovelace",
      rating: 4.7,
      topComments: ["Clear explanations."],
    };
    const storage = createStorageMock();
    const findProfessorRating = vi.fn(async () => freshRating);
    const now = new Date("2026-05-24T12:00:00Z").getTime();
    const service = createProfessorLookupService({ storage, findProfessorRating, now: () => now });

    await expect(service.lookup("Ada Lovelace")).resolves.toEqual({
      ...freshRating,
      cacheUpdatedAt: now,
    });

    expect(findProfessorRating).toHaveBeenCalledWith("Ada Lovelace");
    expect(storage.data[professorCacheKey("Ada Lovelace")]).toEqual({
      cachedAt: now,
      value: freshRating,
    });
  });

  it("clears persisted and in-memory professor cache entries", async () => {
    const firstRating = {
      name: "Ada Lovelace",
      rating: 4.7,
      topComments: ["Clear explanations."],
    };
    const refreshedRating = {
      name: "Ada Lovelace",
      rating: 3.2,
      topComments: ["Newer RMP data."],
    };
    const storage = createStorageMock({
      "professor:grace hopper": { cachedAt: 1, value: { name: "Grace Hopper" } },
      "settings:theme": "system",
    });
    const findProfessorRating = vi.fn()
      .mockResolvedValueOnce(firstRating)
      .mockResolvedValueOnce(refreshedRating);
    const service = createProfessorLookupService({ storage, findProfessorRating });

    await expect(service.lookup("Ada Lovelace")).resolves.toMatchObject(firstRating);
    await expect(service.clearCache()).resolves.toEqual(2);
    await expect(service.lookup("Ada Lovelace")).resolves.toMatchObject(refreshedRating);

    expect(storage.data).toEqual({
      [professorCacheKey("Ada Lovelace")]: expect.objectContaining({ value: refreshedRating }),
      "settings:theme": "system",
    });
    expect(findProfessorRating).toHaveBeenCalledTimes(2);
  });

  it("bypasses fresh cache entries when a force refresh is requested", async () => {
    const now = new Date("2026-05-24T12:00:00Z").getTime();
    const cachedRating = {
      name: "Chee Yap",
      rating: 2.1,
      topComments: ["Cached comment."],
    };
    const refreshedRating = {
      name: "Chee Yap",
      rating: 3.0,
      topComments: ["Fresh RMP comment."],
    };
    const storage = createStorageMock({
      [professorCacheKey("Chee Yap")]: {
        cachedAt: now - 1000,
        value: cachedRating,
      },
    });
    const findProfessorRating = vi.fn(async () => refreshedRating);
    const service = createProfessorLookupService({
      storage,
      findProfessorRating,
      now: () => now,
    });

    await expect(service.lookup("Chee Yap", { forceRefresh: true })).resolves.toEqual({
      ...refreshedRating,
      cacheUpdatedAt: now,
    });

    expect(findProfessorRating).toHaveBeenCalledWith("Chee Yap");
    expect(storage.data[professorCacheKey("Chee Yap")]).toEqual({
      cachedAt: now,
      value: refreshedRating,
    });
  });
});

function createStorageMock(initialData = {}) {
  return {
    data: { ...initialData },
    async get(key) {
      if (key === null) {
        return { ...this.data };
      }
      return { [key]: this.data[key] };
    },
    async set(items) {
      Object.assign(this.data, items);
    },
    async remove(keys) {
      for (const key of keys) {
        delete this.data[key];
      }
    },
  };
}
