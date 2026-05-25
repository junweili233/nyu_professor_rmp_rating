import { afterEach, describe, expect, it, vi } from "vitest";
import { findProfessorRating, pickBestTeacher } from "../src/shared/rmpClient.js";

describe("Rate My Professors client", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
      matchConfidence: "exact",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      wouldTakeAgain: 92,
      topComments: [
        {
          text: "Explains low-level systems clearly and gives practical labs.",
          helpfulRating: 11,
          clarityRating: 5,
          difficultyRating: 2,
        },
        {
          text: "Lectures move fast, but office hours are excellent.",
          helpfulRating: 7,
          clarityRating: 4,
          difficultyRating: 3,
        },
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

    expect(result.topComments.map((comment) => comment.text)).toEqual([
      "The systems explanations are precise and the labs are fair.",
      "Office hours make the projects much easier to reason about.",
    ]);
    expect(result.topComments.map((comment) => comment.helpfulRating)).toEqual([19, 7]);
  });

  it("normalizes negative useful-comment metadata as missing values", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "VGVhY2hlci05",
                    legacyId: 135,
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
                            comment: "Helpful comment with unavailable metadata.",
                            helpfulRating: -1,
                            clarityRating: -1,
                            difficultyRating: -1,
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
      {
        text: "Helpful comment with unavailable metadata.",
        helpfulRating: null,
        clarityRating: null,
        difficultyRating: null,
      },
    ]);
  });

  it("normalizes out-of-range RMP scale metrics as missing values", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "VGVhY2hlci0xMg==",
                    legacyId: 137,
                    firstName: "Grace",
                    lastName: "Hopper",
                    department: "Computer Science",
                    avgRating: 6.2,
                    avgDifficulty: 8.4,
                    numRatings: 44,
                    wouldTakeAgainPercent: 96,
                    teacherRatingTags: [],
                    ratings: {
                      edges: [
                        {
                          node: {
                            comment: "Helpful comment with impossible metadata.",
                            helpfulRating: 4,
                            clarityRating: 7,
                            difficultyRating: 8,
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

    expect(result.rating).toBeNull();
    expect(result.difficulty).toBeNull();
    expect(result.topComments[0].clarityRating).toBeNull();
    expect(result.topComments[0].difficultyRating).toBeNull();
  });

  it("orders useful comments with malformed helpfulness after valid helpful comments", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "VGVhY2hlci0xMA==",
                    legacyId: 136,
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
                            comment: "Malformed helpfulness should not win sorting.",
                            helpfulRating: "not available",
                          },
                        },
                        {
                          node: {
                            comment: "Most useful systems comment.",
                            helpfulRating: 12,
                          },
                        },
                        {
                          node: {
                            comment: "Second most useful systems comment.",
                            helpfulRating: 8,
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

    expect(result.topComments.map((comment) => comment.text)).toEqual([
      "Most useful systems comment.",
      "Second most useful systems comment.",
    ]);
  });

  it("deduplicates repeated useful comments before returning them to Albert", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "VGVhY2hlci0xNA==",
                    legacyId: 248,
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
                            comment: "Projects are hard, but lectures are clear.",
                            helpfulRating: 21,
                          },
                        },
                        {
                          node: {
                            comment: "  projects are hard, but lectures are clear.  ",
                            helpfulRating: 18,
                          },
                        },
                        {
                          node: {
                            comment: "Office hours make the systems projects manageable.",
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

    expect(result.topComments.map((comment) => comment.text)).toEqual([
      "Projects are hard, but lectures are clear.",
      "Office hours make the systems projects manageable.",
    ]);
  });

  it("keeps missing RMP numeric fields as null instead of fake zeroes", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "VGVhY2hlci0z",
                    legacyId: 789,
                    firstName: "Edsger",
                    lastName: "Dijkstra",
                    department: "Computer Science",
                    avgRating: null,
                    avgDifficulty: null,
                    numRatings: 3,
                    wouldTakeAgainPercent: null,
                    teacherRatingTags: [],
                    ratings: { edges: [] },
                  },
                },
              ],
            },
          },
        },
      }),
    }));

    const result = await findProfessorRating("Edsger Dijkstra", { fetchImpl });

    expect(result.rating).toBeNull();
    expect(result.difficulty).toBeNull();
    expect(result.wouldTakeAgain).toBeNull();
  });

  it("treats negative unavailable RMP metrics as missing values", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "VGVhY2hlci03",
                    legacyId: 890,
                    firstName: "Alan",
                    lastName: "Turing",
                    department: "Computer Science",
                    avgRating: -1,
                    avgDifficulty: -1,
                    numRatings: 0,
                    wouldTakeAgainPercent: -1,
                    teacherRatingTags: [],
                    ratings: { edges: [] },
                  },
                },
              ],
            },
          },
        },
      }),
    }));

    const result = await findProfessorRating("Alan Turing", { fetchImpl });

    expect(result.rating).toBeNull();
    expect(result.difficulty).toBeNull();
    expect(result.wouldTakeAgain).toBeNull();
  });

  it("treats impossible RMP take-again percentages as missing values", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "VGVhY2hlci0xMQ==",
                    legacyId: 891,
                    firstName: "Alan",
                    lastName: "Turing",
                    department: "Computer Science",
                    avgRating: 4.6,
                    avgDifficulty: 2.7,
                    numRatings: 20,
                    wouldTakeAgainPercent: 125,
                    teacherRatingTags: [],
                    ratings: { edges: [] },
                  },
                },
              ],
            },
          },
        },
      }),
    }));

    const result = await findProfessorRating("Alan Turing", { fetchImpl });

    expect(result.wouldTakeAgain).toBeNull();
  });

  it("keeps invalid RMP rating counts as zero instead of NaN", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "VGVhY2hlci02",
                    legacyId: 987,
                    firstName: "Ada",
                    lastName: "Lovelace",
                    department: "Computer Science",
                    avgRating: 4.7,
                    avgDifficulty: 2.4,
                    numRatings: "not available",
                    wouldTakeAgainPercent: 92,
                    teacherRatingTags: [],
                    ratings: { edges: [] },
                  },
                },
              ],
            },
          },
        },
      }),
    }));

    const result = await findProfessorRating("Ada Lovelace", { fetchImpl });

    expect(result.ratingsCount).toBe(0);
  });

  it("keeps negative RMP rating counts as zero instead of showing impossible counts", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "VGVhY2hlci04",
                    legacyId: 246,
                    firstName: "Ada",
                    lastName: "Lovelace",
                    department: "Computer Science",
                    avgRating: 4.7,
                    avgDifficulty: 2.4,
                    numRatings: -1,
                    wouldTakeAgainPercent: 92,
                    teacherRatingTags: [],
                    ratings: { edges: [] },
                  },
                },
              ],
            },
          },
        },
      }),
    }));

    const result = await findProfessorRating("Ada Lovelace", { fetchImpl });

    expect(result.ratingsCount).toBe(0);
  });

  it("normalizes fractional RMP rating counts to whole counts", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "VGVhY2hlci0xMw==",
                    legacyId: 247,
                    firstName: "Ada",
                    lastName: "Lovelace",
                    department: "Computer Science",
                    avgRating: 4.7,
                    avgDifficulty: 2.4,
                    numRatings: 12.8,
                    wouldTakeAgainPercent: 92,
                    teacherRatingTags: [],
                    ratings: { edges: [] },
                  },
                },
              ],
            },
          },
        },
      }),
    }));

    const result = await findProfessorRating("Ada Lovelace", { fetchImpl });

    expect(result.ratingsCount).toBe(12);
  });

  it("ignores null RMP teacher edges in partial GraphQL results", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                null,
                { node: null },
                {
                  node: {
                    id: "VGVhY2hlci00",
                    legacyId: 321,
                    firstName: "Ada",
                    lastName: "Lovelace",
                    department: "Computer Science",
                    avgRating: 4.7,
                    avgDifficulty: 2.4,
                    numRatings: 38,
                    wouldTakeAgainPercent: 92,
                    teacherRatingTags: [],
                    ratings: { edges: [] },
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
    });
  });

  it("ignores null RMP teacher rating tags in partial GraphQL results", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "VGVhY2hlci01",
                    legacyId: 654,
                    firstName: "Grace",
                    lastName: "Hopper",
                    department: "Computer Science",
                    avgRating: 4.8,
                    avgDifficulty: 3.1,
                    numRatings: 44,
                    wouldTakeAgainPercent: 96,
                    teacherRatingTags: [
                      null,
                      { tagName: "" },
                      { tagName: "   " },
                      { tagName: " Clear grading criteria " },
                    ],
                    ratings: { edges: [] },
                  },
                },
              ],
            },
          },
        },
      }),
    }));

    await expect(findProfessorRating("Grace Hopper", { fetchImpl })).resolves.toMatchObject({
      name: "Grace Hopper",
      tags: ["Clear grading criteria"],
    });
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

  it("treats RMP GraphQL errors as lookup failures instead of empty results", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        errors: [{ message: "RMP search is temporarily unavailable" }],
        data: null,
      }),
    }));

    await expect(findProfessorRating("Ada Lovelace", { fetchImpl })).rejects.toThrow(
      "Rate My Professors request failed: RMP search is temporarily unavailable",
    );
  });

  it("wraps malformed RMP JSON responses as request failures", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    }));

    await expect(findProfessorRating("Ada Lovelace", { fetchImpl })).rejects.toThrow(
      "Rate My Professors response was not valid JSON",
    );
  });

  it("aborts RMP requests that exceed the lookup timeout", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url, options) => {
      if (!options?.signal) {
        return Promise.reject(new Error("missing abort signal"));
      }
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const lookup = findProfessorRating("Ada Lovelace", { fetchImpl, timeoutMs: 10 });
    const assertion = expect(lookup).rejects.toThrow("Rate My Professors request timed out");
    await vi.advanceTimersByTimeAsync(10);

    await assertion;
    expect(fetchImpl.mock.calls[0][1].signal.aborted).toBe(true);
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

  it("matches unaccented Albert names to accented RMP professor names", () => {
    const bestMatch = pickBestTeacher("Jose Garcia", [
      {
        firstName: "Joseph",
        lastName: "Garcia",
        department: "Computer Science",
        numRatings: 20,
      },
      {
        firstName: "José",
        lastName: "García",
        department: "Computer Science",
        numRatings: 4,
      },
    ]);

    expect(`${bestMatch.firstName} ${bestMatch.lastName}`).toBe("José García");
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
    expect(result.matchConfidence).toBe("fuzzy");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).variables.query.text).toBe("Chee Yap");
  });

  it("does not accept an RMP professor whose longer surname only starts with the Albert surname", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "wrong",
                    legacyId: 123,
                    firstName: "Ada",
                    lastName: "Lovelace-Smith",
                    department: "Computer Science",
                    avgRating: 4.9,
                    avgDifficulty: 2.1,
                    numRatings: 80,
                    wouldTakeAgainPercent: 98,
                    teacherRatingTags: [],
                    ratings: { edges: [] },
                  },
                },
              ],
            },
          },
        },
      }),
    }));

    await expect(findProfessorRating("Ada Lovelace", { fetchImpl })).resolves.toBeNull();
  });

  it("does not accept nameless RMP teacher results", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "nameless",
                    legacyId: 321,
                    firstName: null,
                    lastName: null,
                    department: "Computer Science",
                    avgRating: 5,
                    avgDifficulty: 1,
                    numRatings: 200,
                    wouldTakeAgainPercent: 100,
                    teacherRatingTags: [],
                    ratings: { edges: [] },
                  },
                },
              ],
            },
          },
        },
      }),
    }));

    await expect(findProfessorRating("Ada Lovelace", { fetchImpl })).resolves.toBeNull();
  });

  it("does not accept abbreviated RMP names as substring-only matches", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          newSearch: {
            teachers: {
              edges: [
                {
                  node: {
                    id: "abbreviated",
                    legacyId: 654,
                    firstName: "Ada",
                    lastName: "L",
                    department: "Computer Science",
                    avgRating: 5,
                    avgDifficulty: 1,
                    numRatings: 120,
                    wouldTakeAgainPercent: 100,
                    teacherRatingTags: [],
                    ratings: { edges: [] },
                  },
                },
              ],
            },
          },
        },
      }),
    }));

    await expect(findProfessorRating("Ada Lovelace", { fetchImpl })).resolves.toBeNull();
  });

  it("drops title suffixes before building first-last fallback searches", async () => {
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

    await findProfessorRating("Robert Martin Jr.", { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).variables.query.text).toBe("Robert Martin");
  });

  it("drops roman suffixes before building fallback searches", async () => {
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

    await findProfessorRating("Robert Martin III", { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).variables.query.text).toBe("Robert Martin");
  });

  it("drops punctuated roman suffixes before building fallback searches", async () => {
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

    await findProfessorRating("Robert Martin III.", { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).variables.query.text).toBe("Robert Martin");
  });

  it("retries accented professor searches with folded ASCII names", async () => {
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

    await findProfessorRating("Jos\u00e9 Garc\u00eda", { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).variables.query.text).toBe("Jos\u00e9 Garc\u00eda");
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).variables.query.text).toBe("Jose Garcia");
  });
});
