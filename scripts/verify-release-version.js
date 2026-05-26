import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { EXTENSION_VERSION } from "../src/shared/version.js";

export async function verifyReleaseVersion({ distDir = "dist", releaseTag = "" } = {}) {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  const sourceManifest = JSON.parse(await readFile(join("src", "manifest.json"), "utf8"));
  const distManifest = JSON.parse(await readFile(join(distDir, "manifest.json"), "utf8"));
  const expectedVersion = String(packageJson.version ?? "").trim();
  const expectedTag = releaseTag || `v${expectedVersion}`;
  const checks = {
    packageVersion: expectedVersion,
    runtimeVersion: EXTENSION_VERSION,
    sourceManifestVersion: String(sourceManifest.version ?? "").trim(),
    distManifestVersion: String(distManifest.version ?? "").trim(),
    expectedTag,
    expectedAssetName: `nyu-albert-rmp-ratings-${expectedTag}.zip`,
  };

  const failures = [];
  if (!expectedVersion) {
    failures.push("package.json version is missing");
  }
  if (checks.runtimeVersion !== expectedVersion) {
    failures.push(`runtime version ${checks.runtimeVersion || "missing"} does not match package.json ${expectedVersion || "missing"}`);
  }
  if (checks.sourceManifestVersion !== expectedVersion) {
    failures.push(`source manifest version ${checks.sourceManifestVersion || "missing"} does not match package.json ${expectedVersion || "missing"}`);
  }
  if (checks.distManifestVersion !== expectedVersion) {
    failures.push(`dist manifest version ${checks.distManifestVersion || "missing"} does not match package.json ${expectedVersion || "missing"}`);
  }
  if (expectedTag !== `v${expectedVersion}`) {
    failures.push(`release tag ${expectedTag} does not match package.json version v${expectedVersion}`);
  }

  if (failures.length > 0) {
    const error = new Error([
      "Release version check failed.",
      ...failures.map((failure) => `- ${failure}`),
      "Run npm run build after changing the extension version, then verify again.",
    ].join("\n"));
    error.result = { ok: false, ...checks, failures };
    throw error;
  }

  return { ok: true, ...checks };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [distDir = "dist", releaseTag = ""] = process.argv.slice(2);
  const result = await verifyReleaseVersion({ distDir, releaseTag });
  console.log(JSON.stringify(result, null, 2));
}
