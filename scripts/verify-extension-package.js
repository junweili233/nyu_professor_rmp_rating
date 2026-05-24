import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export async function verifyExtensionPackage(distDir = "dist") {
  const manifestPath = join(distDir, "manifest.json");
  await assertFileExists(manifestPath, "dist manifest is missing");

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.manifest_version !== 3) {
    throw new Error("manifest_version must be 3");
  }
  if (manifest.background?.type !== "module") {
    throw new Error("background service worker must be a module");
  }
  if (!manifest.host_permissions?.includes("https://www.ratemyprofessors.com/*")) {
    throw new Error("Rate My Professors host permission is required");
  }
  if (!manifest.permissions?.includes("storage")) {
    throw new Error("storage permission is required");
  }
  if (!manifest.content_scripts?.some((contentScript) => contentScript.matches?.includes("https://albert.nyu.edu/*"))) {
    throw new Error("Albert content script match is required");
  }

  await assertFileExists(join(distDir, manifest.background?.service_worker ?? ""), "background service worker is missing");
  await assertFileExists(join(distDir, manifest.action?.default_popup ?? ""), "popup html is missing");

  for (const script of manifest.content_scripts?.flatMap((contentScript) => contentScript.js ?? []) ?? []) {
    await assertFileExists(join(distDir, script), `content script is missing: ${script}`);
  }

  const popupHtml = await readFile(join(distDir, manifest.action.default_popup), "utf8");
  const popupScripts = Array.from(popupHtml.matchAll(/<script[^>]+src="([^"]+)"/g)).map((match) => match[1]);
  for (const script of popupScripts) {
    const normalizedScript = script.replace(/^\//, "");
    await assertFileExists(join(distDir, normalizedScript), `popup script is missing: ${normalizedScript}`);
  }
}

async function assertFileExists(path, message) {
  try {
    await access(path);
  } catch {
    throw new Error(message);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const distDir = process.argv[2] ?? "dist";
  await verifyExtensionPackage(distDir);
  console.log(`Verified Chrome extension package at ${distDir}`);
}
