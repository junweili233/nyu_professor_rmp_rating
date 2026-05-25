// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { removeAlbertRmpEnhancements, scanAlbertPageOnce, startAlbertRmpEnhancer } from "../src/contentDom.js";

describe("Albert content DOM injection", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not scan unrelated NYU pages at startup", () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn();
    const observe = vi.fn();
    const windowMock = {
      location: new URL("https://www.nyu.edu/academics.html"),
      MutationObserver: class {
        observe = observe;
      },
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(),
    };

    const observer = startAlbertRmpEnhancer({ document, window: windowMock, lookupProfessor });

    expect(observer).toBeNull();
    expect(lookupProfessor).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
    expect(document.querySelector(".nyu-rmp-card")).toBeNull();
  });

  it("does not scan Albert pages when the overlay is disabled", () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn();
    const observe = vi.fn();
    const windowMock = {
      location: new URL("https://albert.nyu.edu/psc/csprod/EMPLOYEE/SA/c/NUI_FRAMEWORK.PT_LANDINGPAGE.GBL"),
      MutationObserver: class {
        observe = observe;
      },
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(),
    };

    const observer = startAlbertRmpEnhancer({
      document,
      window: windowMock,
      lookupProfessor,
      enabled: false,
    });

    expect(observer).toBeNull();
    expect(lookupProfessor).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
    expect(document.querySelector(".nyu-rmp-card")).toBeNull();
  });

  it("scans Albert pages at startup", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => null);
    const observe = vi.fn();
    const windowMock = {
      location: new URL("https://albert.nyu.edu/psc/csprod/EMPLOYEE/SA/c/NUI_FRAMEWORK.PT_LANDINGPAGE.GBL"),
      MutationObserver: class {
        observe = observe;
      },
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(),
    };

    const observer = startAlbertRmpEnhancer({ document, window: windowMock, lookupProfessor });
    await flushPromises();

    expect(observer).not.toBeNull();
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(observe).toHaveBeenCalledWith(document.body, { childList: true, subtree: true });
  });

  it("cancels a pending Albert rescan when the overlay observer disconnects", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => null);
    let mutationCallback;
    const windowMock = {
      location: new URL("https://albert.nyu.edu/psc/csprod/EMPLOYEE/SA/c/NUI_FRAMEWORK.PT_LANDINGPAGE.GBL"),
      MutationObserver: class {
        constructor(callback) {
          mutationCallback = callback;
        }

        observe = vi.fn();
        disconnect = vi.fn();
      },
      clearTimeout,
      setTimeout,
    };

    const observer = startAlbertRmpEnhancer({ document, window: windowMock, lookupProfessor });
    await flushPromises();
    removeAlbertRmpEnhancements(document);

    mutationCallback();
    observer.disconnect();
    await vi.advanceTimersByTimeAsync(300);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".nyu-rmp-card")).toBeNull();
  });

  it("scans blank child frames owned by an Albert parent page", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => null);
    const observe = vi.fn();
    const windowMock = {
      location: new URL("about:blank"),
      parent: {
        location: new URL("https://albert.nyu.edu/psc/csprod/EMPLOYEE/SA/c/NUI_FRAMEWORK.PT_LANDINGPAGE.GBL"),
      },
      MutationObserver: class {
        observe = observe;
      },
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(),
    };

    const observer = startAlbertRmpEnhancer({ document, window: windowMock, lookupProfessor });
    await flushPromises();

    expect(observer).not.toBeNull();
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(observe).toHaveBeenCalledWith(document.body, { childList: true, subtree: true });
  });

  it("injects one RMP card per Albert instructor and updates it with rating data", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;

    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      wouldTakeAgain: 24.2857,
      tags: ["Tough grader"],
      topComments: ["Avoid if you dislike fast lectures."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    const mounted = scanAlbertPageOnce({ document, lookupProfessor });
    await Promise.all(mounted.pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("2.1");
    expect(document.querySelector(".nyu-rmp-score").getAttribute("aria-label")).toBe("RMP rating 2.1 out of 5");
    expect(document.body.textContent).toContain("Low rating");
    expect(document.body.textContent).toContain("Computer Science");
    expect(document.body.textContent).toContain("Difficulty 4.5");
    expect(document.body.textContent).toContain("Avoid if you dislike fast lectures.");
  });

  it("labels injected rating cards with a concise accessible summary", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    const mounted = scanAlbertPageOnce({ document, lookupProfessor });
    const card = document.querySelector(".nyu-rmp-card");

    expect(card.getAttribute("role")).toBe("group");
    expect(card.getAttribute("aria-busy")).toBe("true");
    expect(card.getAttribute("aria-label")).toBe("Checking RMP rating for Ada Lovelace");

    await Promise.all(mounted.pendingLookups);

    expect(card.hasAttribute("aria-busy")).toBe(false);
    expect(card.getAttribute("aria-label")).toBe("RMP rating for Ada Lovelace: 4.7 out of 5, 38 ratings");
  });

  it("renders useful-comment metadata from RMP ratings", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      wouldTakeAgain: 92,
      tags: [],
      topComments: [
        {
          text: "Explains low-level systems clearly and gives practical labs.",
          helpfulRating: 11,
          clarityRating: 5,
          difficultyRating: 2,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.body.textContent).toContain("Explains low-level systems clearly and gives practical labs.");
    expect(document.body.textContent).toContain("11 useful");
    expect(document.body.textContent).toContain("Clarity 5.0");
    expect(document.body.textContent).toContain("Difficulty 2.0");
  });

  it("renders only trimmed nonblank cached RMP tags", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: ["  Clear grading criteria ", "   ", "", null],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const tags = Array.from(document.querySelectorAll(".nyu-rmp-tags span")).map((tag) => tag.textContent);
    expect(tags).toEqual(["Clear grading criteria"]);
  });

  it("does not render unsafe cached RMP profile URLs", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [],
      url: "javascript:alert(1)",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const profileLink = document.querySelector(".nyu-rmp-actions a");
    expect(profileLink.getAttribute("href")).toBe("https://www.ratemyprofessors.com/");
  });

  it("labels matched RMP profile links with the professor name", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const profileLink = document.querySelector(".nyu-rmp-actions a");
    expect(profileLink.textContent).toBe("RMP");
    expect(profileLink.getAttribute("aria-label")).toBe("Open RMP profile for Ada Lovelace");
    expect(profileLink.getAttribute("rel")).toBe("noreferrer noopener");
  });

  it("omits negative useful-comment metadata from cached RMP ratings", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [
        {
          text: "Cached comment with malformed metadata.",
          helpfulRating: -1,
          clarityRating: -1,
          difficultyRating: -1,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.body.textContent).toContain("Cached comment with malformed metadata.");
    expect(document.querySelector(".nyu-rmp-comment-meta")).toBeNull();
    expect(document.body.textContent).not.toContain("-1 useful");
    expect(document.body.textContent).not.toContain("Clarity -1.0");
    expect(document.body.textContent).not.toContain("Difficulty -1.0");
  });

  it("renders a singular rating count label for one RMP rating", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 1,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-score-row").textContent).toContain("1 rating");
    expect(document.querySelector(".nyu-rmp-score-row").textContent).not.toContain("1 ratings");
  });

  it("renders negative cached rating counts as zero ratings", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: -1,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(scoreRowText).toContain("0 ratings");
    expect(scoreRowText).not.toContain("-1 ratings");
  });

  it("renders fractional cached rating counts as whole ratings", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 12.8,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(scoreRowText).toContain("12 ratings");
    expect(scoreRowText).not.toContain("12.8 ratings");
  });

  it("renders comma-formatted cached rating counts", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: "1,234",
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(scoreRowText).toContain("1234 ratings");
  });

  it("renders labeled comma-formatted cached rating counts", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: "1,234 ratings",
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(scoreRowText).toContain("1234 ratings");
  });

  it("renders abbreviated cached rating counts", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: "1.2k ratings",
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(scoreRowText).toContain("1200 ratings");
  });

  it("renders negative cached RMP metrics as unavailable values", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: -1,
      difficulty: -1,
      ratingsCount: 12,
      wouldTakeAgain: -1,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("N/A");
    expect(scoreRowText).toContain("No rating");
    expect(scoreRowText).toContain("Difficulty N/A");
    expect(scoreRowText).not.toContain("-1.0");
    expect(scoreRowText).not.toContain("-1% take again");
  });

  it("does not render cached RMP take-again percentages above 100", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 12,
      wouldTakeAgain: 125,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(scoreRowText).not.toContain("125% take again");
  });

  it("renders formatted cached RMP take-again percentages", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 12,
      wouldTakeAgain: "82%",
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(scoreRowText).toContain("82% take again");
  });

  it("renders cached RMP scale metrics above 5 as unavailable values", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 6.2,
      difficulty: 8.4,
      ratingsCount: 12,
      tags: [],
      topComments: [
        {
          text: "Cached comment with impossible metadata.",
          clarityRating: 7,
          difficultyRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("N/A");
    expect(scoreRowText).toContain("Difficulty N/A");
    expect(document.body.textContent).not.toContain("6.2");
    expect(document.body.textContent).not.toContain("Difficulty 8.4");
    expect(document.querySelector(".nyu-rmp-comment-meta")).toBeNull();
  });

  it("renders formatted cached RMP rating strings", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: "4.7 / 5",
      difficulty: "2.4 / 5",
      ratingsCount: 12,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("4.7");
    expect(scoreRowText).toContain("Difficulty 2.4");
  });

  it("keeps long useful comments compact until expanded", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const longComment = [
      "This professor gives detailed systems lectures with careful examples, but the project workload is heavy",
      "and the exams require students to understand every lab at a deep level before test day.",
    ].join(" ");
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.1,
      difficulty: 3.8,
      ratingsCount: 44,
      tags: [],
      topComments: [{ text: longComment, helpfulRating: 18 }],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const commentText = document.querySelector(".nyu-rmp-comment-text");
    const toggle = document.querySelector(".nyu-rmp-comment-toggle");
    expect(commentText.textContent).not.toBe(longComment);
    expect(commentText.textContent.endsWith("...")).toBe(true);
    expect(toggle.textContent).toBe("Show more");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(commentText.id);
    expect(commentText.id).toMatch(/^nyu-rmp-comment-/);

    toggle.click();

    expect(commentText.textContent).toBe(longComment);
    expect(toggle.textContent).toBe("Show less");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("renders when the RMP data was last updated", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      topComments: [],
      cacheUpdatedAt: new Date("2026-05-24T12:00:00Z").getTime(),
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-updated").textContent).toBe("Updated May 24, 2026");
  });

  it("shows the original Albert instructor name when the RMP match name differs", async () => {
    document.body.innerHTML = `<div>Instructor: Chee Keng Yap</div>`;
    const lookupProfessor = vi.fn(async () => ({
      name: "Chee Yap",
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      matchConfidence: "fuzzy",
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-card strong").textContent).toBe("Chee Yap");
    expect(document.querySelector(".nyu-rmp-match-note").textContent).toBe(
      "Fuzzy RMP match - Albert: Chee Keng Yap",
    );
  });

  it("refreshes a professor card with a cache-bypassing lookup", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn()
      .mockResolvedValueOnce({
        name: "Ada Lovelace",
        department: "Computer Science",
        rating: 4.7,
        difficulty: 2.4,
        ratingsCount: 38,
        wouldTakeAgain: 92,
        tags: [],
        topComments: ["Original comment."],
        url: "https://www.ratemyprofessors.com/professor/123",
      })
      .mockResolvedValueOnce({
        name: "Ada Lovelace",
        department: "Computer Science",
        rating: 3.1,
        difficulty: 3.8,
        ratingsCount: 41,
        wouldTakeAgain: 62,
        tags: [],
        topComments: ["Fresh comment."],
        url: "https://www.ratemyprofessors.com/professor/123",
      });

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    document.querySelector(".nyu-rmp-refresh").click();
    await flushPromises();

    expect(lookupProfessor).toHaveBeenLastCalledWith("Ada Lovelace", { forceRefresh: true });
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("3.1");
    expect(document.body.textContent).toContain("Fresh comment.");
  });

  it("renders partial RMP payloads without turning the card into an error", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => ({
      name: "Ada Lovelace",
      rating: null,
      difficulty: null,
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-card").classList.contains("is-error")).toBe(false);
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("N/A");
    expect(document.querySelector(".nyu-rmp-score").getAttribute("aria-label")).toBe("RMP rating unavailable");
    expect(document.body.textContent).toContain("No rating");
    expect(document.body.textContent).toContain("0 ratings");
    expect(document.body.textContent).toContain("Difficulty N/A");
    expect(document.querySelector(".nyu-rmp-card a").href).toBe("https://www.ratemyprofessors.com/");
  });

  it("lets students refresh a no-match card without rescanning Albert", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        name: "Ada Lovelace",
        department: "Computer Science",
        rating: 4.7,
        difficulty: 2.4,
        ratingsCount: 38,
        wouldTakeAgain: 92,
        tags: [],
        topComments: ["Now found."],
        url: "https://www.ratemyprofessors.com/professor/123",
      });

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    document.querySelector(".nyu-rmp-refresh").click();
    await flushPromises();

    expect(lookupProfessor).toHaveBeenLastCalledWith("Ada Lovelace", { forceRefresh: true });
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("4.7");
    expect(document.body.textContent).toContain("Now found.");
  });

  it("links no-match cards to an RMP professor search for the requested name", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const searchLink = document.querySelector(".nyu-rmp-search");
    expect(searchLink.textContent).toBe("Search RMP");
    expect(searchLink.href).toBe("https://www.ratemyprofessors.com/search/professors/1381?q=Ada%20Lovelace");
    expect(searchLink.getAttribute("aria-label")).toBe("Search RMP for Ada Lovelace");
    expect(searchLink.getAttribute("rel")).toBe("noreferrer noopener");
  });

  it("announces loading, no-match, and error status updates politely", async () => {
    document.body.innerHTML = `
      <div>Instructor: Ada Lovelace</div>
      <div>Instructor: Grace Hopper</div>
      <div>Instructor: Alan Turing</div>
    `;
    const lookupProfessor = vi.fn((name) => {
      if (name === "Ada Lovelace") {
        return new Promise(() => {});
      }
      if (name === "Grace Hopper") {
        return Promise.resolve(null);
      }
      return Promise.reject(new Error("RMP lookup failed"));
    });

    scanAlbertPageOnce({ document, lookupProfessor });
    await flushPromises();

    const statuses = Array.from(document.querySelectorAll(".nyu-rmp-status"));
    expect(statuses.map((status) => status.getAttribute("role"))).toEqual(["status", "status", "status"]);
    expect(statuses.map((status) => status.getAttribute("aria-live"))).toEqual(["polite", "polite", "polite"]);
    expect(statuses.map((status) => status.getAttribute("aria-atomic"))).toEqual(["true", "true", "true"]);
  });

  it("lets students retry an error card after a failed RMP request", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn()
      .mockRejectedValueOnce(new Error("RMP lookup failed"))
      .mockResolvedValueOnce({
        name: "Ada Lovelace",
        department: "Computer Science",
        rating: 4.7,
        difficulty: 2.4,
        ratingsCount: 38,
        wouldTakeAgain: 92,
        tags: [],
        topComments: ["Recovered."],
        url: "https://www.ratemyprofessors.com/professor/123",
      });

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    document.querySelector(".nyu-rmp-refresh").click();
    await flushPromises();

    expect(lookupProfessor).toHaveBeenLastCalledWith("Ada Lovelace", { forceRefresh: true });
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("4.7");
    expect(document.body.textContent).toContain("Recovered.");
  });

  it("links error cards to an RMP professor search for manual fallback", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => {
      throw new Error("RMP lookup failed");
    });

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const searchLink = document.querySelector(".nyu-rmp-search");
    expect(searchLink.textContent).toBe("Search RMP");
    expect(searchLink.href).toBe("https://www.ratemyprofessors.com/search/professors/1381?q=Ada%20Lovelace");
    expect(searchLink.getAttribute("aria-label")).toBe("Search RMP for Ada Lovelace");
    expect(searchLink.getAttribute("rel")).toBe("noreferrer noopener");
  });

  it("labels refresh controls with the requested professor name", async () => {
    document.body.innerHTML = `
      <div>Instructor: Ada Lovelace</div>
      <div>Instructor: Grace Hopper</div>
      <div>Instructor: Alan Turing</div>
    `;
    const lookupProfessor = vi.fn(async (name) => {
      if (name === "Ada Lovelace") {
        return {
          name,
          rating: 4.7,
          difficulty: 2.4,
          ratingsCount: 38,
          tags: [],
          topComments: [],
          url: "https://www.ratemyprofessors.com/professor/123",
        };
      }
      if (name === "Grace Hopper") {
        return null;
      }
      throw new Error("RMP lookup failed");
    });

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const labels = Array.from(document.querySelectorAll(".nyu-rmp-refresh"))
      .map((button) => button.getAttribute("aria-label"));
    expect(labels).toEqual([
      "Refresh RMP rating for Ada Lovelace",
      "Refresh RMP rating for Grace Hopper",
      "Retry RMP rating for Alan Turing",
    ]);
  });

  it("does not duplicate cards when Albert mutates the same processed row", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(lookupProfessor).toHaveBeenCalledTimes(1);
  });

  it("ignores hidden Albert instructor templates during scans", async () => {
    document.body.innerHTML = `
      <div hidden>Instructor: Hidden Template</div>
      <div aria-hidden="true">Instructor: Hidden Aria</div>
      <div style="display: none;">Instructor: Hidden Display</div>
      <div style="opacity: 0;">Instructor: Hidden Transparent</div>
      <div style="opacity: 0.0;">Instructor: Hidden Transparent Variant</div>
      <div style="height: 0; width: 0; overflow: hidden;">Instructor: Hidden Zero Size</div>
      <div>Instructor: Ada Lovelace</div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("ignores mixed Albert placeholder instructor text", async () => {
    document.body.innerHTML = `
      <div>Instructor: Staff TBA</div>
      <div>Instructor: To Be Assigned</div>
      <div>Instructor: Not Available</div>
      <div>Instructor: Ada Lovelace</div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Staff Tba");
    expect(lookupProfessor).not.toHaveBeenCalledWith("To Be Assigned");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Not Available");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("ignores comma-separated placeholder instructors without corrupting real names", async () => {
    document.body.innerHTML = `
      <div>Instructor(s): TBA, Ada Lovelace</div>
      <div>Instructor: Grace Hopper, Staff</div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(2);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(lookupProfessor).toHaveBeenCalledWith("Grace Hopper");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Ada Lovelace Tba");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Staff Grace Hopper");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
  });

  it("ignores instructor sections hidden by Albert stylesheet classes", async () => {
    document.head.innerHTML = `<style>.collapsed-albert-section { display: none; }</style>`;
    document.body.innerHTML = `
      <div class="collapsed-albert-section">Instructor: Hidden Stylesheet</div>
      <div>Instructor: Grace Hopper</div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Grace Hopper");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("removes injected cards and processed markers when the overlay is disabled", async () => {
    document.body.innerHTML = `<div id="instructor">Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.getElementById("instructor").dataset.nyuRmpProcessed).toBe("true");

    removeAlbertRmpEnhancements(document);

    expect(document.querySelector(".nyu-rmp-rating-root")).toBeNull();
    expect(document.getElementById("instructor").dataset.nyuRmpProcessed).toBeUndefined();
  });

  it("reuses one RMP lookup for duplicate instructors during the same scan", async () => {
    document.body.innerHTML = `
      <div>Instructor: Ada Lovelace</div>
      <div>Instructor: Ada Lovelace</div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: ["Clear systems explanations."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
    expect(Array.from(document.querySelectorAll(".nyu-rmp-score")).map((score) => score.textContent)).toEqual([
      "4.7",
      "4.7",
    ]);
  });

  it("reuses one RMP lookup for accented and unaccented duplicate instructors during the same scan", async () => {
    document.body.innerHTML = `
      <div>Instructor: Jos\u00e9 Garc\u00eda</div>
      <div>Instructor: Jose Garcia</div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: ["Accent folded duplicate lookup."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Jos\u00e9 Garc\u00eda");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
  });

  it("deduplicates repeated instructor names inside the same Albert instructor cell", async () => {
    document.body.innerHTML = `<div>Instructor(s): Ada Lovelace; Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: ["Clear systems explanations."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("deduplicates repeated instructor names inside adjacent Albert cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor(s)</th>
            <td>Ada Lovelace; Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: ["Clear systems explanations."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("injects ratings when Albert splits the instructor label and name into adjacent cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      wouldTakeAgain: 24.2857,
      tags: [],
      topComments: ["Assignments are demanding."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Assignments are demanding.");
  });

  it("injects ratings when Albert splits a primary instructor label and name into adjacent cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Primary Instructor</th>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Primary instructor labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Primary instructor labels should render.");
  });

  it("injects ratings when adjacent Albert instructor labels include a trailing colon", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor(s):</th>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Assignments are demanding."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("injects ratings when adjacent Albert instructor labels include a trailing period", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor.</th>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Period-terminated labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Period-terminated labels should render.");
  });

  it("injects ratings when adjacent Albert instructor labels include trailing dash separators", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor -</th>
            <td>YAP, CHEE KENG</td>
          </tr>
          <tr>
            <th>Instructor(s) \u2013</th>
            <td>Grace B. Hopper</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.1,
      difficulty: 3.4,
      ratingsCount: 17,
      tags: [],
      topComments: [`${name} comment`],
      url: "https://www.ratemyprofessors.com/",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(lookupProfessor).toHaveBeenCalledWith("Grace B. Hopper");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
  });

  it("skips empty spacer cells between adjacent Albert instructor labels and names", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td class="spacer"></td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Spacer cells should not block instructor detection."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Spacer cells should not block instructor detection.");
  });

  it("skips separator-only cells between adjacent Albert instructor labels and names", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td>:</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Separator cells should not block instructor detection."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Separator cells should not block instructor detection.");
  });

  it("injects ratings when Albert instructor labels use a hyphen separator", async () => {
    document.body.innerHTML = `<div>Instructor - YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Hyphen-separated labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Hyphen-separated labels should render.");
  });

  it("injects ratings when Albert instructor labels use whitespace instead of punctuation", async () => {
    document.body.innerHTML = `<div>Instructor(s) YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Whitespace-separated labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Whitespace-separated labels should render.");
  });

  it("injects ratings when Albert renders an inline label before name text", async () => {
    document.body.innerHTML = `<div><strong>Instructor</strong>YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Inline label markup should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Inline label markup should render.");
  });

  it("injects ratings when Albert rows use instructor-name labels", async () => {
    document.body.innerHTML = `<div>Instructor Name: YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Instructor-name labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Instructor-name labels should render.");
  });

  it("injects ratings when Albert rows use plural instructor-name labels", async () => {
    document.body.innerHTML = `<div>Instructor(s) Name: YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Plural instructor-name labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Plural instructor-name labels should render.");
  });

  it("injects ratings when Albert rows use instructor-names labels", async () => {
    document.body.innerHTML = `<div>Instructor Names: YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Instructor-names labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Instructor-names labels should render.");
  });

  it("injects ratings when Albert rows use professor labels", async () => {
    document.body.innerHTML = `<div>Professor: YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Professor labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Professor labels should render.");
  });

  it("injects ratings when Albert splits a professor label and name into adjacent cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Professor</th>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Adjacent professor labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Adjacent professor labels should render.");
  });

  it("injects ratings when Albert rows use faculty labels", async () => {
    document.body.innerHTML = `<div>Faculty: YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Faculty labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Faculty labels should render.");
  });

  it("injects ratings when Albert rows use teacher labels", async () => {
    document.body.innerHTML = `<div>Teacher: YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Teacher labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Teacher labels should render.");
  });

  it("injects ratings when Albert rows use taught-by labels", async () => {
    document.body.innerHTML = `<div>Taught by: YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Taught-by labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Taught-by labels should render.");
  });

  it("does not treat whitespace instructor metadata as a professor name", async () => {
    document.body.innerHTML = `<div>Instructor Consent Required</div>`;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).not.toHaveBeenCalled();
    expect(document.querySelector(".nyu-rmp-card")).toBeNull();
  });

  it("does not treat whitespace professor metadata as a professor name", async () => {
    document.body.innerHTML = `<div>Professor Consent Required</div>`;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).not.toHaveBeenCalled();
    expect(document.querySelector(".nyu-rmp-card")).toBeNull();
  });

  it("does not treat whitespace faculty metadata as a professor name", async () => {
    document.body.innerHTML = `
      <div>Faculty Consent Required</div>
      <div>Faculty Permission Required</div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).not.toHaveBeenCalled();
    expect(document.querySelector(".nyu-rmp-card")).toBeNull();
  });

  it("does not treat punctuation instructor metadata as a professor name", async () => {
    document.body.innerHTML = `
      <div>Instructor: Permission Required</div>
      <div>Teacher: Permission Required</div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).not.toHaveBeenCalled();
    expect(document.querySelector(".nyu-rmp-card")).toBeNull();
  });

  it("injects ratings when Albert instructor labels use a period separator", async () => {
    document.body.innerHTML = `<div>Instructor. YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Period-separated labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Period-separated labels should render.");
  });

  it("injects ratings when Albert instructor labels use a dash variant separator", async () => {
    document.body.innerHTML = `<div>Instructor \u2013 YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Dash-variant labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Dash-variant labels should render.");
  });

  it("strips sentence-final punctuation from Albert instructor names", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace.</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: ["Sentence punctuation should not affect lookup."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Ada Lovelace.");
    expect(document.body.textContent).toContain("Sentence punctuation should not affect lookup.");
  });

  it("injects ratings when Albert uses definition-list instructor labels", async () => {
    document.body.innerHTML = `
      <dl>
        <dt>Instructor</dt>
        <dd>YAP, CHEE KENG</dd>
      </dl>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Definition-list details should still render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.querySelector("dd .nyu-rmp-rating-root")).not.toBeNull();
    expect(document.body.textContent).toContain("Definition-list details should still render.");
  });

  it("ignores hidden adjacent instructor-name cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td hidden>HIDDEN, TEMPLATE</td>
          </tr>
          <tr>
            <th>Instructor</th>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("falls back to a visible marked instructor cell when the immediate sibling is hidden", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td hidden>HIDDEN, TEMPLATE</td>
            <td data-instructor-name>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("falls back to a marked instructor cell when earlier visible siblings are metadata", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td>Permission Required</td>
            <td data-instructor-name>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("uses marked Albert instructor attributes when the visible cell text is not the name", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td data-instructor-name="YAP, CHEE KENG">View instructor details</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Attribute-backed instructor names should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Attribute-backed instructor names should render.");
  });

  it("injects ratings for standalone Albert instructor-name attributes", async () => {
    document.body.innerHTML = `
      <section>
        <span data-instructor-name="YAP, CHEE KENG">View instructor details</span>
      </section>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Standalone marked instructor names should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Standalone marked instructor names should render.");
  });

  it("skips adjacent metadata cells before an unmarked instructor name cell", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td>Permission Required</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("skips adjacent Albert helper text before an unmarked instructor name cell", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td>View instructor details</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("uses adjacent Albert title attributes when visible cell text is helper text", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td title="YAP, CHEE KENG">View instructor details</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Title-backed instructor names should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Title-backed instructor names should render.");
  });

  it("keeps injected ratings inside table cells instead of adding invalid row children", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr id="section-row">
            <th>Instructor</th>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const row = document.querySelector("#section-row");
    expect(Array.from(row.children).map((child) => child.tagName)).toEqual(["TH", "TD"]);
    expect(row.querySelector("td .nyu-rmp-rating-root")).not.toBeNull();
  });

  it("injects one rating card for each adjacent-cell co-instructor", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor(s)</th>
            <td>Grace B. Hopper; Alan Turing</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: name === "Grace B. Hopper" ? 4.9 : 4.6,
      difficulty: 3.1,
      ratingsCount: 27,
      wouldTakeAgain: 88.4,
      tags: [],
      topComments: [`${name} comment`],
      url: "https://www.ratemyprofessors.com/",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Grace B. Hopper");
    expect(lookupProfessor).toHaveBeenCalledWith("Alan Turing");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
    expect(document.body.textContent).toContain("Grace B. Hopper comment");
    expect(document.body.textContent).toContain("Alan Turing comment");
  });

  it("parses adjacent-cell co-instructors split across Albert child rows", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor(s)</th>
            <td>
              <div>YAP, CHEE KENG</div>
              <div>Grace B. Hopper</div>
            </td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.1,
      difficulty: 3.4,
      ratingsCount: 17,
      tags: [],
      topComments: [`${name} comment`],
      url: "https://www.ratemyprofessors.com/",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(lookupProfessor).toHaveBeenCalledWith("Grace B. Hopper");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
    expect(document.body.textContent).toContain("Chee Keng Yap comment");
    expect(document.body.textContent).toContain("Grace B. Hopper comment");
  });

  it("injects ratings when Albert puts names on lines after an instructor label", async () => {
    document.body.innerHTML = `
      <div>
        <span>Instructor(s):</span>
        <br>
        <span>YAP, CHEE KENG</span>
        <br>
        <span>Grace B. Hopper</span>
        <br>
        <span>Enrollment Requirement Group</span>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.1,
      difficulty: 3.4,
      ratingsCount: 17,
      tags: [],
      topComments: [`${name} comment`],
      url: "https://www.ratemyprofessors.com/",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(lookupProfessor).toHaveBeenCalledWith("Grace B. Hopper");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Enrollment Requirement Group");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
  });

  it("injects ratings when multiline Albert instructor labels omit the colon", async () => {
    document.body.innerHTML = `
      <div>
        <span>Instructor(s)</span>
        <br>
        <span>YAP, CHEE KENG</span>
        <br>
        <span>Alan Turing</span>
        <br>
        <span>Section Status Open</span>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.1,
      difficulty: 3.4,
      ratingsCount: 17,
      tags: [],
      topComments: [`${name} comment`],
      url: "https://www.ratemyprofessors.com/",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(lookupProfessor).toHaveBeenCalledWith("Alan Turing");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Section Status Open");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
  });

  it("prefers the most specific instructor node inside nested Albert containers", async () => {
    document.body.innerHTML = `
      <div class="course-wrapper">
        <div class="section-row">
          <span>Instructor: Ada Lovelace</span>
        </div>
      </div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(lookupProfessor).toHaveBeenCalledTimes(1);
  });
});

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}
