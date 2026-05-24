import { describe, expect, it, vi } from "vitest";
import { findProfessorRating } from "../src/shared/rmpClient.js";

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
});
