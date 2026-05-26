import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("README", () => {
  it("documents the core extension workflow and controls", async () => {
    const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

    expect(readme).toContain("Load `dist` as an unpacked Chrome extension");
    expect(readme).toContain("npm run verify:chrome-profile");
    expect(readme).toContain("npm run verify:albert-shape");
    expect(readme).toContain("npm run verify:live");
    expect(readme).toContain("refresh Albert");
    expect(readme).toContain("Show ratings on Albert");
    expect(readme).toContain("Clear cached ratings");
    expect(readme).toContain("old squeezed card layout");
    expect(readme).toContain("segmented score/tools quick view");
    expect(readme).toContain("stale card layouts were cleaned up");
    expect(readme).toContain("Refresh");
    expect(readme).toContain("Search RMP");
    expect(readme).toContain("Fuzzy RMP match");
    expect(readme).toContain("radar fit score");
    expect(readme).toContain("comment signal");
    expect(readme).toContain("pick recommendation");
    expect(readme).toContain("course-match badge");
    expect(readme).toContain("CSCI-UA 0201");
    expect(readme).toContain("Operating Systems, NLP, Calculus III, and Linear Algebra");
    expect(readme).toContain("Show more comments");
    expect(readme).toContain("counts every CS201-matched useful comment");
    expect(readme).toContain("samples 20 recent RMP ratings");
    expect(readme).toContain("Live Albert Verification Troubleshooting");
    expect(readme).toContain('node scripts/verify-live-readiness.js dist "%LOCALAPPDATA%\\Google\\Chrome\\User Data" "%CD%\\dist" "student-account@nyu.example"');
    expect(readme).toContain("not installed from `dist`");
    expect(readme).toContain("your local repository `dist` folder");
    expect(readme).toContain("A current build should report segmented quick views");
    expect(readme).toContain("confirm it reports segmented quick views");
    expect(readme).toContain("save an Albert page snapshot");
    expect(readme).toContain("Albert page snapshot");
    expect(readme).toContain("Do not click enrollment, cart, or class-selection controls");
  });
});
