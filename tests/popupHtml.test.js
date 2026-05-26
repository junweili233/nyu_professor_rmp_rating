import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("extension popup markup", () => {
  it("hides the decorative status dot from assistive technology", async () => {
    const popup = await readFile(new URL("../src/popup.html", import.meta.url), "utf8");

    expect(popup).toContain('<span class="dot" aria-hidden="true"></span>');
  });

  it("respects reduced-motion preferences for popup animations", async () => {
    const popup = await readFile(new URL("../src/popup.html", import.meta.url), "utf8");

    expect(popup).toContain("@media (prefers-reduced-motion: reduce)");
    expect(popup).toContain("animation: none");
    expect(popup).toContain("transition: none");
  });

  it("summarizes the Albert rating overlay features in the popup", async () => {
    const popup = await readFile(new URL("../src/popup.html", import.meta.url), "utf8");

    expect(popup).toContain('<ul class="feature-list" aria-label="Albert rating overlay features">');
    expect(popup).toContain("Rating, difficulty, and take-again metrics");
    expect(popup).toContain("Most useful RMP comments");
    expect(popup).toContain("CS201 course-match comment highlights");
  });
});
