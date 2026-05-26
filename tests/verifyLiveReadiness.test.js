import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { liveReadinessArgs, verifyLiveReadiness } from "../scripts/verify-live-readiness.js";

describe("live Albert readiness verifier", () => {
  it("parses optional CLI user-data and extension paths", () => {
    expect(liveReadinessArgs([])).toEqual({
      distDir: "dist",
      userDataDir: undefined,
      extensionPath: "dist",
    });
    expect(liveReadinessArgs(["build-output", "C:\\Chrome\\User Data", "D:\\NYU-Professor-RMP-Rating\\dist"])).toEqual({
      distDir: "build-output",
      userDataDir: "C:\\Chrome\\User Data",
      extensionPath: "D:\\NYU-Professor-RMP-Rating\\dist",
    });
  });

  it("passes when the package is valid and Chrome has the unpacked extension from dist", async () => {
    const workspace = await createWorkspace({ installedFromDist: true });

    await expect(verifyLiveReadiness({
      distDir: workspace.dist,
      userDataDir: workspace.userData,
      extensionPath: workspace.dist,
    })).resolves.toMatchObject({
      packageReady: true,
      chromeProfileReady: true,
      extensionName: "NYU Albert RMP Ratings",
    });

    await rm(workspace.root, { recursive: true, force: true });
  });

  it("adds the manual load-unpacked next step when Chrome has not installed dist", async () => {
    const workspace = await createWorkspace({ installedFromDist: false });

    await expect(verifyLiveReadiness({
      distDir: workspace.dist,
      userDataDir: workspace.userData,
      extensionPath: workspace.dist,
    })).rejects.toThrow("Load the generated dist folder as an unpacked Chrome extension");
    await expect(verifyLiveReadiness({
      distDir: workspace.dist,
      userDataDir: workspace.userData,
      extensionPath: workspace.dist,
    })).rejects.toThrow(`Expected extension folder: ${resolve(workspace.dist)}`);
    await expect(verifyLiveReadiness({
      distDir: workspace.dist,
      userDataDir: workspace.userData,
      extensionPath: workspace.dist,
    })).rejects.toThrow(`Scanned Chrome user-data folder: ${resolve(workspace.userData)}`);

    await rm(workspace.root, { recursive: true, force: true });
  });
});

async function createWorkspace({ installedFromDist }) {
  const root = await mkdtemp(join(tmpdir(), "nyu-rmp-live-ready-"));
  const dist = join(root, "dist");
  const userData = join(root, "User Data");
  const profile = join(userData, "Default");
  await mkdir(dist, { recursive: true });
  await mkdir(profile, { recursive: true });
  await writeFile(join(dist, "manifest.json"), JSON.stringify({
    manifest_version: 3,
    name: "NYU Albert RMP Ratings",
    version: "0.1.1",
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
  }), "utf8");
  await writeFile(join(dist, "background.js"), "", "utf8");
  await writeFile(
    join(dist, "content.js"),
    '(() => { const version = "0.1.1"; document.documentElement.dataset.nyuRmpVersion = version; })();',
    "utf8",
  );
  await writeFile(join(dist, "popup.html"), '<script src="popup.js"></script>', "utf8");
  await writeFile(join(dist, "popup.js"), "", "utf8");
  await writeFile(join(profile, "Preferences"), JSON.stringify({
    extensions: {
      settings: installedFromDist
        ? {
            abcdefghijklmnopabcdefghijklmnop: {
              manifest: { name: "NYU Albert RMP Ratings", version: "0.1.1" },
              path: resolve(dist),
              state: 1,
              from_webstore: false,
            },
          }
        : {},
    },
  }), "utf8");
  return { root, dist, userData };
}
