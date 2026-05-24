import { describe, expect, it, vi } from "vitest";
import { findProfessorRating, pickBestTeacher } from "../src/shared/rmpClient.js";

describe("Rate My Professors client", () => {
  it("returns the best NYU professor match with useful comments", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "VGVhY2hlci0x",
                    legacyId: 123,
                    firstName: "Ada",
                    lastName: "Lovelace",
                    department: "Computer Science",
                    avgRating: 4.7,
                    avgDifficulty: 2.4,
                    numRatings: 38,
                    wouldTakeAgainPercent: 92,
                    teacherRatingTags: [{ tagName: "Clear grading criteria" }],
                    ratings: {
                      edges: [
                        {
                          node: {
                            comment: "Explains low-level systems clearly and gives practical labs.",
                            helpfulRating: 11,
                            clarityRating: 5,
                            difficultyRating: 2,
                          },
                        },
                        {
                          node: {
                            comment: "Lectures move fast, but office hours are excellent.",
                            helpfulRating: 7,
                            clarityRating: 4,
                            difficultyRating: 3,
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      }),
    }));

    await expect(findProfessorRating("Ada Lovelace", { fetchImpl })).resolves.toMatchObject({
      name: "Ada Lovelace",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      wouldTakeAgain: 92,
      topComments: [
        "Explains low-level systems clearly and gives practical labs.",
        "Lectures move fast, but office hours are excellent.",
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    });
  });

  it("orders top comments by helpfulness before returning them to Albert", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "VGVhY2hlci0y",
                    legacyId: 456,
                    firstName: "Grace",
                    lastName: "Hopper",
                    department: "Computer Science",
                    avgRating: 4.8,
                    avgDifficulty: 3.1,
                    numRatings: 44,
                    wouldTakeAgainPercent: 96,
                    teacherRatingTags: [],
                    ratings: {
                      edges: [
                        {
                          node: {
                            comment: "Fine lecture, but the review is not very detailed.",
                            helpfulRating: 1,
                          },
                        },
                        {
                          node: {
                            comment: "The systems explanations are precise and the labs are fair.",
                            helpfulRating: 19,
                          },
                        },
                        {
                          node: {
                            comment: "Office hours make the projects much easier to reason about.",
                            helpfulRating: 7,
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      }),
    }));

    const result = await findProfessorRating("Grace Hopper", { fetchImpl });

    expect(result.topComments).toEqual([
      "The systems explanations are precise and the labs are fair.",
      "Office hours make the projects much easier to reason about.",
    ]);
  });

  it("requests enough RMP ratings to choose useful comments from more than the first page edge", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [],
            },
          },
        },
      }),
    }));

    await findProfessorRating("Ada Lovelace", { fetchImpl });

    const requestBody = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(requestBody.query).toContain("ratings(first: 8)");
  });

  it("matches Albert names with middle names to RMP first-last names", () => {
    const bestMatch = pickBestTeacher("Chee Keng Yap", [
      {
        firstName: "Keng",
        lastName: "Chee",
        department: "Mathematics",
        numRatings: 200,
      },
      {
        firstName: "Chee",
        lastName: "Yap",
        department: "Computer Science",
        numRatings: 92,
      },
    ]);

    expect(`${bestMatch.firstName} ${bestMatch.lastName}`).toBe("Chee Yap");
  });

  it("falls back to first-last RMP search when a full Albert middle-name search is weak", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            newSearch: {
              teachers: {
                edges: [
                  {
                    node: {
                      id: "wrong",
                      legacyId: 1,
                      firstName: "Keng",
                      lastName: "Deng",
                      department: "Mathematics",
                      avgRating: 3.5,
                      avgDifficulty: 3.2,
                      numRatings: 28,
                      wouldTakeAgainPercent: 60,
                      teacherRatingTags: [],
                      ratings: { edges: [] },
                    },
                  },
                ],
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            newSearch: {
              teachers: {
                edges: [
                  {
                    node: {
                      id: "right",
                      legacyId: 419998,
                      firstName: "Chee",
                      lastName: "Yap",
                      department: "Computer Science",
                      avgRating: 2.1,
                      avgDifficulty: 4.5,
                      numRatings: 92,
                      wouldTakeAgainPercent: 24.2857,
                      teacherRatingTags: [],
                      ratings: { edges: [] },
                    },
                  },
                ],
              },
            },
          },
        }),
      });

    const result = await findProfessorRating("Chee Keng Yap", { fetchImpl });

    expect(result.name).toBe("Chee Yap");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).variables.query.text).toBe("Chee Yap");
  });
});
