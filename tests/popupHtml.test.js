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
    expect(popup).toContain("Radar fit score and pick recommendation");
    expect(popup).toContain("Most useful RMP comments from a 20-rating sample");
    expect(popup).toContain("Course-aware matching for Albert surname rows");
  });

  it("tells students that matched comments are marked by risk or support", async () => {
    const popup = await readFile(new URL("../src/popup.html", import.meta.url), "utf8");

    expect(popup).toContain("Course comment risk/support highlighting");
  });

  it("tells students to refresh Albert after updating the extension", async () => {
    const popup = await readFile(new URL("../src/popup.html", import.meta.url), "utf8");

    expect(popup).toContain("Refresh Albert after loading or updating the extension.");
    expect(popup).toContain('class="notice"');
  });

  it("marks the overlay toggle as an accessible switch with visible keyboard focus", async () => {
    const popup = await readFile(new URL("../src/popup.html", import.meta.url), "utf8");

    expect(popup).toContain('id="enable-overlay" type="checkbox" role="switch"');
    expect(popup).toContain('aria-describedby="overlay-helper"');
    expect(popup).toContain('id="overlay-helper"');
    expect(popup).toContain(".toggle-switch input:focus-visible + .toggle-track");
    expect(popup).toContain("outline: 2px solid var(--gold)");
  });
});
