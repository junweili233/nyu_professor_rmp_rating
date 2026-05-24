import { describe, expect, it, vi } from "vitest";
import { createProfessorLookupService, professorCacheKey } from "../src/backgroundService.js";

describe("background professor lookup service", () => {
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

    await expect(service.lookup("YAP, CHEE KENG")).resolves.toEqual(cachedRating);
    expect(findProfessorRating).not.toHaveBeenCalled();
  });

  it("persists fresh RMP lookup results for later Albert page scans", async () => {
    const freshRating = {
      name: "Ada Lovelace",
      rating: 4.7,
      topComments: ["Clear explanations."],
    };
    const storage = createStorageMock();
    const findProfessorRating = vi.fn(async () => freshRating);
    const service = createProfessorLookupService({ storage, findProfessorRating });

    await expect(service.lookup("Ada Lovelace")).resolves.toEqual(freshRating);

    expect(findProfessorRating).toHaveBeenCalledWith("Ada Lovelace");
    expect(storage.data[professorCacheKey("Ada Lovelace")]).toEqual(freshRating);
  });
});

function createStorageMock(initialData = {}) {
  return {
    data: { ...initialData },
    async get(key) {
      return { [key]: this.data[key] };
    },
    async set(items) {
      Object.assign(this.data, items);
    },
  };
}
