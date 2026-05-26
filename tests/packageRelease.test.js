import { describe, expect, it, vi } from "vitest";
import { packageRelease, packageReleaseArgs } from "../scripts/package-release.js";

describe("release packager", () => {
  it("parses dist, tag, output directory, and dry-run arguments", () => {
    expect(packageReleaseArgs([])).toEqual({
      distDir: "dist",
      releaseTag: "",
      outDir: ".",
      dryRun: false,
    });
    expect(packageReleaseArgs(["dist", "v0.1.2", "release", "--dry-run"])).toEqual({
      distDir: "dist",
      releaseTag: "v0.1.2",
      outDir: "release",
      dryRun: true,
    });
  });

  it("dry-runs the expected release asset without invoking compression", async () => {
    const execFileImpl = vi.fn();

    await expect(packageRelease({ distDir: "dist", releaseTag: "v0.1.2", dryRun: true, execFileImpl })).resolves.toMatchObject({
      ok: true,
      expectedTag: "v0.1.2",
      expectedAssetName: "nyu-albert-rmp-ratings-v0.1.2.zip",
      dryRun: true,
    });
    expect(execFileImpl).not.toHaveBeenCalled();
  });

  it("builds the PowerShell compression command from verified release metadata", async () => {
    const execFileImpl = vi.fn(async () => ({ stdout: "", stderr: "" }));

    const result = await packageRelease({ distDir: "dist", releaseTag: "v0.1.2", outDir: "release", execFileImpl });

    expect(result.expectedAssetName).toBe("nyu-albert-rmp-ratings-v0.1.2.zip");
    expect(result.command).toContain("Compress-Archive");
    expect(result.command).toContain("nyu-albert-rmp-ratings-v0.1.2.zip");
    expect(execFileImpl).toHaveBeenCalledWith("powershell", ["-NoProfile", "-Command", result.command]);
  });
});
