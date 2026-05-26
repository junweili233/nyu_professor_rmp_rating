import { pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { verifyChromeUserDataExtension } from "./verify-chrome-profile-extension.js";
import { verifyExtensionPackage } from "./verify-extension-package.js";

const EXTENSION_NAME = "NYU Albert RMP Ratings";

export async function verifyLiveReadiness({
  distDir = "dist",
  userDataDir,
  extensionPath = distDir,
  expectedAccountName,
} = {}) {
  await verifyExtensionPackage(distDir);

  try {
    const chromeProfile = await verifyChromeUserDataExtension({ userDataDir, extensionPath, expectedAccountName });
    return {
      packageReady: true,
      chromeProfileReady: true,
      extensionName: EXTENSION_NAME,
      chromeProfile,
    };
  } catch (error) {
    const expectedPath = redactPath(resolve(extensionPath));
    throw new Error([
      error.message,
      "Load the generated dist folder as an unpacked Chrome extension in the Chrome profile used for Albert.",
      "Use the same Chrome profile where Albert is already logged in, then reload the Albert tab.",
      `Expected extension folder: ${expectedPath}`,
      ...(expectedAccountName ? [`Expected Chrome account: ${redactAccountName(expectedAccountName)}`] : []),
      ...(userDataDir ? [`Scanned Chrome user-data folder: ${redactPath(resolve(userDataDir))}`] : []),
      "Then refresh Albert, open the extension popup on Albert, and confirm it reports segmented quick views.",
      "If Albert still shows the old squeezed card layout, save an Albert page snapshot and run: npm run verify:albert-shape -- .\\albert-snapshot.html",
      "Do not click enrollment, cart, or class-selection controls during live verification.",
    ].join("\n"));
  }
}

export function liveReadinessArgs(argv = process.argv.slice(2)) {
  const [distDir = "dist", userDataDir, extensionPath = distDir, expectedAccountName] = argv;
  return { distDir, userDataDir, extensionPath, expectedAccountName };
}

function redactAccountName(value) {
  return String(value ?? "").trim().replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<account>");
}

function redactPath(path) {
  const value = String(path ?? "");
  const home = homedir();
  return home && value.toLowerCase().startsWith(home.toLowerCase())
    ? `%USERPROFILE%${value.slice(home.length)}`
    : value;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await verifyLiveReadiness(liveReadinessArgs());
  console.log(
    `${result.extensionName} is ready for live Albert verification in ${result.chromeProfile.profileName}`,
  );
}
