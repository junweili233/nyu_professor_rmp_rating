import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { verifyChromeUserDataExtension } from "./verify-chrome-profile-extension.js";
import { verifyExtensionPackage } from "./verify-extension-package.js";

const EXTENSION_NAME = "NYU Albert RMP Ratings";

export async function verifyLiveReadiness({
  distDir = "dist",
  userDataDir,
  extensionPath = distDir,
} = {}) {
  await verifyExtensionPackage(distDir);

  try {
    const chromeProfile = await verifyChromeUserDataExtension({ userDataDir, extensionPath });
    return {
      packageReady: true,
      chromeProfileReady: true,
      extensionName: EXTENSION_NAME,
      chromeProfile,
    };
  } catch (error) {
    const expectedPath = resolve(extensionPath);
    throw new Error([
      error.message,
      "Load the generated dist folder as an unpacked Chrome extension in the Chrome profile used for Albert.",
      `Expected extension folder: ${expectedPath}`,
      ...(userDataDir ? [`Scanned Chrome user-data folder: ${resolve(userDataDir)}`] : []),
      "Then refresh Albert and run this command again before live UI verification.",
    ].join("\n"));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = process.argv[2] ?? "dist";
  const result = await verifyLiveReadiness({ distDir });
  console.log(
    `${result.extensionName} is ready for live Albert verification in ${result.chromeProfile.profileName}`,
  );
}
