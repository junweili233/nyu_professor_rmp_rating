import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("README", () => {
  it("documents the core extension workflow and controls", async () => {
    const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

    expect(readme).toContain("Load `dist` as an unpacked Chrome extension");
    expect(readme).toContain("Show ratings on Albert");
    expect(readme).toContain("Clear cached ratings");
    expect(readme).toContain("Refresh");
    expect(readme).toContain("Search RMP");
    expect(readme).toContain("Fuzzy RMP match");
    expect(readme).toContain("radar fit score");
    expect(readme).toContain("pick recommendation");
    expect(readme).toContain("course-match badge");
    expect(readme).toContain("CSCI-UA 0201");
    expect(readme).toContain("Show more comments");
    expect(readme).toContain("counts every CS201-matched useful comment");
  });
});
