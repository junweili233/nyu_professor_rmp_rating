import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  verifyChromeProfileExtension,
  verifyChromeUserDataExtension,
} from "../scripts/verify-chrome-profile-extension.js";

describe("Chrome profile extension verifier", () => {
  it("reports an enabled unpacked NYU RMP extension loaded from the expected dist path", async () => {
    const profile = await createProfile({
      extensions: {
        abcdefghijklmnopabcdefghijklmnop: {
          manifest: { name: "NYU Albert RMP Ratings", version: "0.1.0" },
          path: resolve("dist"),
          state: 1,
          from_webstore: false,
        },
      },
    });

    await expect(verifyChromeProfileExtension({ profileDir: profile, extensionPath: "dist" })).resolves.toMatchObject({
      id: "abcdefghijklmnopabcdefghijklmnop",
      enabled: true,
      installedFromExpectedPath: true,
    });

    await rm(profile, { recursive: true, force: true });
  });

  it("fails when the NYU RMP extension is not installed in the Chrome profile", async () => {
    const profile = await createProfile({
      extensions: {
        zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz: {
          manifest: { name: "Other Extension", version: "1.0.0" },
          path: resolve("other"),
          state: 1,
          from_webstore: false,
        },
      },
    });

    await expect(verifyChromeProfileExtension({ profileDir: profile, extensionPath: "dist" })).rejects.toThrow(
      "NYU Albert RMP Ratings is not installed in this Chrome profile",
    );

    await rm(profile, { recursive: true, force: true });
  });

  it("fails when the NYU RMP extension is installed from a different path", async () => {
    const profile = await createProfile({
      extensions: {
        abcdefghijklmnopabcdefghijklmnop: {
          manifest: { name: "NYU Albert RMP Ratings", version: "0.1.0" },
          path: resolve("old-dist"),
          state: 1,
          from_webstore: false,
        },
      },
    });

    await expect(verifyChromeProfileExtension({ profileDir: profile, extensionPath: "dist" })).rejects.toThrow(
      "NYU Albert RMP Ratings is installed from a different path",
    );

    await rm(profile, { recursive: true, force: true });
  });

  it("finds the enabled unpacked extension across Chrome user-data profiles", async () => {
    const userData = await mkdtemp(join(tmpdir(), "nyu-rmp-user-data-"));
    await createProfile({
      profile: join(userData, "Default"),
      extensions: {},
    });
    await createProfile({
      profile: join(userData, "Profile 1"),
      extensions: {
        abcdefghijklmnopabcdefghijklmnop: {
          manifest: { name: "NYU Albert RMP Ratings", version: "0.1.0" },
          path: resolve("dist"),
          state: 1,
          from_webstore: false,
        },
      },
    });

    await expect(verifyChromeUserDataExtension({ userDataDir: userData, extensionPath: "dist" })).resolves.toMatchObject({
      profileName: "Profile 1",
      id: "abcdefghijklmnopabcdefghijklmnop",
      installedFromExpectedPath: true,
    });

    await rm(userData, { recursive: true, force: true });
  });

  it("reports all scanned Chrome profiles when the unpacked extension is missing", async () => {
    const userData = await mkdtemp(join(tmpdir(), "nyu-rmp-user-data-"));
    await createProfile({
      profile: join(userData, "Default"),
      extensions: {},
    });
    await createProfile({
      profile: join(userData, "Profile 2"),
      extensions: {},
    });

    await expect(verifyChromeUserDataExtension({ userDataDir: userData, extensionPath: "dist" })).rejects.toThrow(
      `NYU Albert RMP Ratings is not installed from ${resolve("dist")} in any scanned Chrome profile: Default, Profile 2`,
    );
    await expect(verifyChromeUserDataExtension({ userDataDir: userData, extensionPath: "dist" })).rejects.toThrow(
      `Scanned Chrome user-data folder: ${userData}`,
    );

    await rm(userData, { recursive: true, force: true });
  });

  it("reports where mismatched NYU RMP extension installs were found", async () => {
    const userData = await mkdtemp(join(tmpdir(), "nyu-rmp-user-data-"));
    const oldDist = resolve("old-dist");
    await createProfile({
      profile: join(userData, "Default"),
      extensions: {
        abcdefghijklmnopabcdefghijklmnop: {
          manifest: { name: "NYU Albert RMP Ratings", version: "0.1.0" },
          path: oldDist,
          state: 1,
          from_webstore: false,
        },
      },
    });
    await createProfile({
      profile: join(userData, "Profile 2"),
      extensions: {
        abcdefghijklmnopabcdefghijklmnop: {
          manifest: { name: "NYU Albert RMP Ratings", version: "0.1.1" },
          path: resolve("dist"),
          state: 0,
          from_webstore: false,
        },
      },
    });

    await expect(verifyChromeUserDataExtension({ userDataDir: userData, extensionPath: "dist" })).rejects.toThrow(
      `Profile details: Default: NYU Albert RMP Ratings is installed from a different path: ${oldDist}; expected ${resolve("dist")}; Profile 2: NYU Albert RMP Ratings is installed but disabled`,
    );

    await rm(userData, { recursive: true, force: true });
  });
});

async function createProfile({ profile = null, extensions }) {
  profile ??= await mkdtemp(join(tmpdir(), "nyu-rmp-chrome-profile-"));
  await mkdir(profile, { recursive: true });
  await writeFile(
    join(profile, "Preferences"),
    JSON.stringify({
      extensions: {
        settings: extensions,
      },
    }),
    "utf8",
  );
  return profile;
}
