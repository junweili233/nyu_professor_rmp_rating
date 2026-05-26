import { access, readFile, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const EXTENSION_NAME = "NYU Albert RMP Ratings";

export async function verifyChromeProfileExtension({
  profileDir = defaultProfileDir(),
  extensionPath = "dist",
} = {}) {
  const preferencesPath = resolve(profileDir, "Preferences");
  await assertFileExists(preferencesPath, `Chrome Preferences file is missing: ${preferencesPath}`);

  const expectedPath = normalizePath(extensionPath);
  const preferences = JSON.parse(await readFile(preferencesPath, "utf8"));
  const settings = preferences.extensions?.settings ?? {};
  const installed = Object.entries(settings)
    .map(([id, setting]) => ({
      id,
      name: setting?.manifest?.name ?? "",
      version: setting?.manifest?.version ?? "",
      path: setting?.path ?? "",
      enabled: setting?.state === 1,
      fromWebStore: Boolean(setting?.from_webstore),
    }))
    .find((extension) => extension.name === EXTENSION_NAME);

  if (!installed) {
    throw new Error(`${EXTENSION_NAME} is not installed in this Chrome profile`);
  }

  const installedPath = normalizePath(installed.path);
  if (installedPath !== expectedPath) {
    throw new Error(`${EXTENSION_NAME} is installed from a different path: ${installed.path}; expected ${resolve(extensionPath)}`);
  }

  if (!installed.enabled) {
    throw new Error(`${EXTENSION_NAME} is installed but disabled`);
  }

  return {
    ...installed,
    installedFromExpectedPath: true,
  };
}

export async function verifyChromeUserDataExtension({
  userDataDir = defaultUserDataDir(),
  extensionPath = "dist",
} = {}) {
  const resolvedUserDataDir = resolve(userDataDir);
  const resolvedExtensionPath = resolve(extensionPath);
  const profiles = await chromeProfileDirs(userDataDir);
  const scanned = [];
  const misses = [];
  for (const profileDir of profiles) {
    const profileName = basename(profileDir);
    scanned.push(profileName);
    try {
      const result = await verifyChromeProfileExtension({ profileDir, extensionPath });
      return {
        ...result,
        profileDir,
        profileName,
      };
    } catch (error) {
      if (!isExpectedProfileMiss(error)) {
        throw error;
      }
      misses.push(`${profileName}: ${error.message}`);
    }
  }

  const details = misses.length > 0 ? `\nProfile details: ${misses.join("; ")}` : "";
  throw new Error(
    `${EXTENSION_NAME} is not installed from ${resolvedExtensionPath} in any scanned Chrome profile: ${scanned.join(", ") || "none"}\nScanned Chrome user-data folder: ${resolvedUserDataDir}${details}`,
  );
}

async function chromeProfileDirs(userDataDir) {
  const entries = await readdir(userDataDir, { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(userDataDir, entry.name));
  const profiles = [];
  for (const dir of dirs) {
    try {
      await access(resolve(dir, "Preferences"));
      profiles.push(dir);
    } catch {
      // Not a Chrome profile directory.
    }
  }
  return profiles.sort((left, right) => profileSortKey(left).localeCompare(profileSortKey(right)));
}

function profileSortKey(profileDir) {
  const name = basename(profileDir);
  return name === "Default" ? "000 Default" : name;
}

function isExpectedProfileMiss(error) {
  return /not installed in this Chrome profile|installed from a different path|installed but disabled/i.test(error?.message ?? "");
}

function normalizePath(path) {
  return resolve(path).toLowerCase();
}

function defaultProfileDir() {
  return resolve(defaultUserDataDir(), "Default");
}

function defaultUserDataDir() {
  return resolve(process.env.LOCALAPPDATA ?? "", "Google", "Chrome", "User Data");
}

async function assertFileExists(path, message) {
  try {
    await access(path);
  } catch {
    throw new Error(message);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const profileDir = process.argv[2];
  const extensionPath = process.argv[3] ?? "dist";
  const result = profileDir
    ? await verifyChromeProfileExtension({ profileDir, extensionPath })
    : await verifyChromeUserDataExtension({ extensionPath });
  console.log(
    `${EXTENSION_NAME} ${result.version} is enabled in ${result.profileDir ?? profileDir} from ${result.path} (${result.id})`,
  );
}
