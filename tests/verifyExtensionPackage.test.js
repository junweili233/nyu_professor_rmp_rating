import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifyExtensionPackage } from "../scripts/verify-extension-package.js";

describe("extension package verifier", () => {
  it("fails when the built manifest is missing", async () => {
    const emptyDist = await mkdtemp(join(tmpdir(), "nyu-rmp-empty-dist-"));

    await expect(verifyExtensionPackage(emptyDist)).rejects.toThrow("dist manifest is missing");

    await rm(emptyDist, { recursive: true, force: true });
  });

  it("accepts a complete NYU Albert RMP extension package", async () => {
    const dist = await createPackageDist();

    await expect(verifyExtensionPackage(dist)).resolves.toBeUndefined();

    await rm(dist, { recursive: true, force: true });
  });

  it("fails when the manifest omits Rate My Professors host permission", async () => {
    const dist = await createPackageDist({
      manifestOverrides: { host_permissions: [] },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("Rate My Professors host permission is required");

    await rm(dist, { recursive: true, force: true });
  });

  it("fails when a content script contains top-level await", async () => {
    const dist = await createPackageDist({
      files: {
        "content.js": "await boot();",
      },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("content script must not use top-level await");

    await rm(dist, { recursive: true, force: true });
  });
});

async function createPackageDist({ manifestOverrides = {}, files = {} } = {}) {
  const dist = await mkdtemp(join(tmpdir(), "nyu-rmp-dist-"));
  const manifest = {
    manifest_version: 3,
    name: "NYU Albert RMP Ratings",
    version: "0.1.0",
    action: { default_popup: "popup.html" },
    background: { service_worker: "background.js", type: "module" },
    content_scripts: [
      {
        matches: ["https://albert.nyu.edu/*"],
        js: ["content.js"],
        run_at: "document_idle",
      },
    ],
    host_permissions: ["https://www.ratemyprofessors.com/*"],
    permissions: ["storage"],
    ...manifestOverrides,
  };

  await mkdir(dist, { recursive: true });
  await writeFile(join(dist, "manifest.json"), JSON.stringify(manifest), "utf8");
  await writeFile(join(dist, "background.js"), "", "utf8");
  await writeFile(join(dist, "content.js"), files["content.js"] ?? "", "utf8");
  await writeFile(join(dist, "popup.html"), '<script type="module" src="/popup.js"></script>', "utf8");
  await writeFile(join(dist, "popup.js"), "", "utf8");
  return dist;
}
