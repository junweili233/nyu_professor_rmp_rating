import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyReleaseVersion } from "../scripts/verify-release-version.js";

describe("release version verifier", () => {
  it("passes when package, runtime, source manifest, dist manifest, and tag align", async () => {
    await expect(verifyReleaseVersion({ distDir: "dist", releaseTag: "v0.1.5" })).resolves.toMatchObject({
      ok: true,
      packageVersion: "0.1.5",
      runtimeVersion: "0.1.5",
      sourceManifestVersion: "0.1.5",
      distManifestVersion: "0.1.5",
      expectedTag: "v0.1.5",
      expectedAssetName: "nyu-albert-rmp-ratings-v0.1.5.zip",
    });
  });

  it("fails when the built dist manifest is stale", async () => {
    const staleDist = await createDistManifest("0.1.1");

    await expect(verifyReleaseVersion({ distDir: staleDist, releaseTag: "v0.1.5" })).rejects.toThrow(
      "dist manifest version 0.1.1 does not match package.json 0.1.5",
    );

    await rm(staleDist, { recursive: true, force: true });
  });

  it("fails when the release tag does not match package.json", async () => {
    await expect(verifyReleaseVersion({ distDir: "dist", releaseTag: "v0.1.1" })).rejects.toThrow(
      "release tag v0.1.1 does not match package.json version v0.1.5",
    );
  });
});

async function createDistManifest(version) {
  const dist = await mkdtemp(join(tmpdir(), "nyu-rmp-release-dist-"));
  const currentManifest = JSON.parse(await readFile(new URL("../dist/manifest.json", import.meta.url), "utf8"));
  await mkdir(dist, { recursive: true });
  await writeFile(join(dist, "manifest.json"), JSON.stringify({ ...currentManifest, version }), "utf8");
  return dist;
}
