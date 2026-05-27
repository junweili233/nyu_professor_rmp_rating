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

  it("fails when the manifest version drifts from package.json", async () => {
    const dist = await createPackageDist({
      manifestOverrides: { version: "0.1.0" },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("manifest version must match package.json version");

    await rm(dist, { recursive: true, force: true });
  });

  it("fails when the manifest action omits the popup html entry", async () => {
    const dist = await createPackageDist({
      manifestOverrides: {
        action: { default_title: "NYU RMP" },
      },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("popup html entry is required");

    await rm(dist, { recursive: true, force: true });
  });

  it("fails when the manifest omits Rate My Professors host permission", async () => {
    const dist = await createPackageDist({
      manifestOverrides: { host_permissions: [] },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("Rate My Professors host permission is required");

    await rm(dist, { recursive: true, force: true });
  });

  it("fails when the manifest omits active tab permission for popup Albert checks", async () => {
    const dist = await createPackageDist({
      manifestOverrides: { permissions: ["storage"] },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("activeTab permission is required");

    await rm(dist, { recursive: true, force: true });
  });

  it("fails when the manifest omits scripting permission for popup Albert wake-up", async () => {
    const dist = await createPackageDist({
      manifestOverrides: { permissions: ["storage", "activeTab"] },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("scripting permission is required");

    await rm(dist, { recursive: true, force: true });
  });

  it("fails when the content script uses a broad NYU match instead of explicit Albert surfaces", async () => {
    const dist = await createPackageDist({
      manifestOverrides: {
        content_scripts: [
          {
            matches: ["https://albert.nyu.edu/*", "https://*.nyu.edu/*"],
            js: ["content.js"],
            run_at: "document_idle",
            all_frames: true,
            match_about_blank: true,
          },
        ],
      },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("content script matches must be limited to Albert surfaces");

    await rm(dist, { recursive: true, force: true });
  });

  it("fails when the content script omits the SIS Albert surface", async () => {
    const dist = await createPackageDist({
      manifestOverrides: {
        content_scripts: [
          {
            matches: ["https://albert.nyu.edu/*"],
            js: ["content.js"],
            run_at: "document_idle",
            all_frames: true,
            match_about_blank: true,
          },
        ],
      },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("SIS Albert content script match is required");

    await rm(dist, { recursive: true, force: true });
  });

  it("fails when the content script omits the live SIS portal Albert host", async () => {
    const dist = await createPackageDist({
      manifestOverrides: {
        content_scripts: [
          {
            matches: ["https://albert.nyu.edu/*", "https://sis.nyu.edu/*"],
            js: ["content.js"],
            run_at: "document_idle",
            all_frames: true,
            match_about_blank: true,
          },
        ],
      },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("SIS portal Albert content script match is required");

    await rm(dist, { recursive: true, force: true });
  });

  it("fails when the Albert content script is not enabled for nested frames", async () => {
    const dist = await createPackageDist({
      manifestOverrides: {
        content_scripts: [
          {
            matches: ["https://albert.nyu.edu/*", "https://sis.nyu.edu/*", "https://sis.portal.nyu.edu/*"],
            js: ["content.js"],
            run_at: "document_idle",
          },
        ],
      },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("Albert content script must run in all frames");

    await rm(dist, { recursive: true, force: true });
  });

  it("fails when the Albert content script has no JavaScript entry", async () => {
    const dist = await createPackageDist({
      manifestOverrides: {
        content_scripts: [
          {
            matches: ["https://albert.nyu.edu/*", "https://sis.nyu.edu/*", "https://sis.portal.nyu.edu/*"],
            run_at: "document_idle",
            all_frames: true,
            match_about_blank: true,
          },
        ],
      },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("Albert content script JavaScript entry is required");

    await rm(dist, { recursive: true, force: true });
  });

  it("fails when the Albert content script does not match blank child frames", async () => {
    const dist = await createPackageDist({
      manifestOverrides: {
        content_scripts: [
          {
            matches: ["https://albert.nyu.edu/*", "https://sis.nyu.edu/*", "https://sis.portal.nyu.edu/*"],
            js: ["content.js"],
            run_at: "document_idle",
            all_frames: true,
          },
        ],
      },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("Albert content script must match blank child frames");

    await rm(dist, { recursive: true, force: true });
  });

  it("fails when the popup html has no script entry", async () => {
    const dist = await createPackageDist({
      files: {
        "popup.html": "<main>NYU RMP</main>",
      },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("popup script entry is required");

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

  it("fails when a content script imports a generated chunk", async () => {
    const dist = await createPackageDist({
      files: {
        "content.js": 'import { boot } from "./chunks/shared.js"; boot();',
      },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("content script must be a classic script without imports");

    await rm(dist, { recursive: true, force: true });
  });

  it("fails when a content script omits the runtime version marker", async () => {
    const dist = await createPackageDist({
      files: {
        "content.js": '(() => { document.body.dataset.nyuRmpContentScript = "loaded"; })();',
      },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("content script must include the runtime version marker");

    await rm(dist, { recursive: true, force: true });
  });

  it("fails when a content script runtime marker drifts from package.json", async () => {
    const dist = await createPackageDist({
      files: {
        "content.js": '(() => { const version = "0.1.0"; document.body.dataset.nyuRmpVersion = version; })();',
      },
    });

    await expect(verifyExtensionPackage(dist)).rejects.toThrow("content script runtime marker must match package.json version");

    await rm(dist, { recursive: true, force: true });
  });
});

async function createPackageDist({ manifestOverrides = {}, files = {} } = {}) {
  const dist = await mkdtemp(join(tmpdir(), "nyu-rmp-dist-"));
  const manifest = {
    manifest_version: 3,
    name: "NYU Albert RMP Ratings",
    version: "0.1.6",
    action: { default_popup: "popup.html" },
    background: { service_worker: "background.js", type: "module" },
    content_scripts: [
      {
        matches: ["https://albert.nyu.edu/*", "https://sis.nyu.edu/*", "https://sis.portal.nyu.edu/*"],
        js: ["content.js"],
        run_at: "document_idle",
        all_frames: true,
        match_about_blank: true,
      },
    ],
    host_permissions: ["https://www.ratemyprofessors.com/*"],
    permissions: ["storage", "activeTab", "scripting"],
    ...manifestOverrides,
  };

  await mkdir(dist, { recursive: true });
  await writeFile(join(dist, "manifest.json"), JSON.stringify(manifest), "utf8");
  await writeFile(join(dist, "background.js"), "", "utf8");
  await writeFile(join(dist, "content.js"), files["content.js"] ?? '(() => { const version = "0.1.6"; document.body.dataset.nyuRmpVersion = version; })();', "utf8");
  await writeFile(join(dist, "popup.html"), files["popup.html"] ?? '<script type="module" src="/popup.js"></script>', "utf8");
  await writeFile(join(dist, "popup.js"), "", "utf8");
  return dist;
}
