import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { verifyExtensionPackage } from "./verify-extension-package.js";
import { verifyReleaseVersion } from "./verify-release-version.js";

const execFileAsync = promisify(execFile);

export async function packageRelease({
  distDir = "dist",
  releaseTag = "",
  outDir = ".",
  dryRun = false,
  execFileImpl = execFileAsync,
} = {}) {
  await verifyExtensionPackage(distDir);
  const release = await verifyReleaseVersion({ distDir, releaseTag });
  const assetPath = resolve(outDir, release.expectedAssetName);
  const distGlob = `${resolve(distDir)}\\*`;
  const command = [
    "Compress-Archive",
    "-Path",
    powerShellString(distGlob),
    "-DestinationPath",
    powerShellString(assetPath),
    "-Force",
  ].join(" ");

  if (!dryRun) {
    await rm(assetPath, { force: true });
    await execFileImpl("powershell", ["-NoProfile", "-Command", command]);
  }

  return {
    ...release,
    assetPath,
    command,
    dryRun,
  };
}

export function packageReleaseArgs(argv = process.argv.slice(2)) {
  const [distDir = "dist", releaseTag = "", outDir = "."] = argv.filter((value) => value !== "--dry-run");
  return {
    distDir,
    releaseTag,
    outDir,
    dryRun: argv.includes("--dry-run"),
  };
}

function powerShellString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await packageRelease(packageReleaseArgs());
  console.log(JSON.stringify({
    ok: result.ok,
    expectedTag: result.expectedTag,
    expectedAssetName: result.expectedAssetName,
    assetPath: result.assetPath,
    dryRun: result.dryRun,
  }, null, 2));
}
