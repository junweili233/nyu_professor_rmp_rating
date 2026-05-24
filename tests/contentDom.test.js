// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { scanAlbertPageOnce } from "../src/contentDom.js";

describe("Albert content DOM injection", () => {
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
    expect(document.body.textContent).toContain("Difficulty 4.5");
    expect(document.body.textContent).toContain("Avoid if you dislike fast lectures.");
  });

  it("does not duplicate cards when Albert mutates the same processed row", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(lookupProfessor).toHaveBeenCalledTimes(1);
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
