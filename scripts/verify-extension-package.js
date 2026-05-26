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
  const albertContentScript = manifest.content_scripts?.find((contentScript) =>
    contentScript.matches?.includes("https://albert.nyu.edu/*")
  );
  if (!albertContentScript) {
    throw new Error("Albert content script match is required");
  }
  if (albertContentScript.matches?.some((match) => /(^|\*)\.?nyu\.edu\/\*/i.test(match.replace(/^https:\/\//, "")))) {
    throw new Error("content script matches must be limited to Albert surfaces");
  }
  if (!albertContentScript.matches?.includes("https://sis.nyu.edu/*")) {
    throw new Error("SIS Albert content script match is required");
  }
  if (!albertContentScript.matches?.includes("https://sis.portal.nyu.edu/*")) {
    throw new Error("SIS portal Albert content script match is required");
  }
  if (!Array.isArray(albertContentScript.js) || albertContentScript.js.length === 0) {
    throw new Error("Albert content script JavaScript entry is required");
  }
  if (albertContentScript.all_frames !== true) {
    throw new Error("Albert content script must run in all frames");
  }
  if (albertContentScript.match_about_blank !== true) {
    throw new Error("Albert content script must match blank child frames");
  }

  await assertFileExists(join(distDir, manifest.background?.service_worker ?? ""), "background service worker is missing");
  const popupPath = manifest.action?.default_popup;
  if (!popupPath) {
    throw new Error("popup html entry is required");
  }
  await assertFileExists(join(distDir, popupPath), "popup html is missing");

  for (const script of manifest.content_scripts?.flatMap((contentScript) => contentScript.js ?? []) ?? []) {
    const scriptPath = join(distDir, script);
    await assertFileExists(scriptPath, `content script is missing: ${script}`);
    await assertClassicContentScript(scriptPath);
  }

  const popupHtml = await readFile(join(distDir, popupPath), "utf8");
  const popupScripts = Array.from(popupHtml.matchAll(/<script[^>]+src="([^"]+)"/g)).map((match) => match[1]);
  if (popupScripts.length === 0) {
    throw new Error("popup script entry is required");
  }
  for (const script of popupScripts) {
    const normalizedScript = script.replace(/^\//, "");
    await assertFileExists(join(distDir, normalizedScript), `popup script is missing: ${normalizedScript}`);
  }
}

async function assertClassicContentScript(path) {
  const source = await readFile(path, "utf8");
  if (/(^|[;}]\s*)await\s+/.test(source)) {
    throw new Error("content script must not use top-level await");
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
