import { access, readFile, readdir } from "node:fs/promises";
import { homedir } from "node:os";
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
  const expectedVersion = await extensionManifestVersion(extensionPath);
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
    throw new Error(`${EXTENSION_NAME} is installed from a different path: ${redactPath(installed.path)}; expected ${redactPath(resolve(extensionPath))}`);
  }

  if (!installed.enabled) {
    throw new Error(`${EXTENSION_NAME} is installed but disabled`);
  }

  if (expectedVersion && installed.version !== expectedVersion) {
    throw new Error(`${EXTENSION_NAME} is installed from the expected path but Chrome reports version ${installed.version}; expected ${expectedVersion}. Reload the unpacked extension in chrome://extensions`);
  }

  return {
    ...installed,
    installedFromExpectedPath: true,
    expectedVersion,
  };
}

export async function verifyChromeUserDataExtension({
  userDataDir = defaultUserDataDir(),
  extensionPath = "dist",
  expectedAccountName = "",
} = {}) {
  const resolvedUserDataDir = resolve(userDataDir);
  const resolvedExtensionPath = resolve(extensionPath);
  const normalizedExpectedAccount = normalizeAccountName(expectedAccountName);
  const profileLabels = await chromeProfileLabels(userDataDir);
  const allProfiles = await chromeProfileDirs(userDataDir);
  const profiles = normalizedExpectedAccount
    ? allProfiles.filter((profileDir) => chromeProfileMatchesAccount(basename(profileDir), profileLabels, normalizedExpectedAccount))
    : allProfiles;
  const scanned = [];
  const misses = [];
  if (normalizedExpectedAccount && profiles.length === 0) {
    const allScanned = allProfiles
      .map((profileDir) => redactedChromeProfileLabel(basename(profileDir), profileLabels))
      .join(", ") || "none";
    throw new Error(
      `Expected Chrome profile account ${redactAccountName(expectedAccountName)} was not found in scanned Chrome profiles: ${allScanned}\nScanned Chrome user-data folder: ${redactPath(resolvedUserDataDir)}`,
    );
  }
  for (const profileDir of profiles) {
    const profileName = basename(profileDir);
    const profileLabel = redactedChromeProfileLabel(profileName, profileLabels);
    scanned.push(profileLabel);
    try {
      const result = await verifyChromeProfileExtension({ profileDir, extensionPath });
      return {
        ...result,
        profileDir,
        profileName,
        profileDisplayName: profileLabels.get(profileName)?.displayName ?? "",
        profileAccountName: profileLabels.get(profileName)?.accountName ?? "",
      };
    } catch (error) {
      if (!isExpectedProfileMiss(error)) {
        throw error;
      }
      misses.push(`${profileLabel}: ${error.message}`);
    }
  }

  const details = misses.length > 0 ? `\nProfile details: ${misses.join("; ")}` : "";
  const expectedAccountPrefix = normalizedExpectedAccount
    ? ` for Chrome account ${redactAccountName(expectedAccountName)}`
    : "";
  throw new Error(
    `${EXTENSION_NAME} is not installed from ${redactPath(resolvedExtensionPath)}${expectedAccountPrefix} in scanned Chrome profile${scanned.length === 1 ? "" : "s"}: ${scanned.join(", ") || "none"}\nScanned Chrome user-data folder: ${redactPath(resolvedUserDataDir)}${details}`,
  );
}

async function chromeProfileLabels(userDataDir) {
  try {
    const localState = JSON.parse(await readFile(resolve(userDataDir, "Local State"), "utf8"));
    return new Map(Object.entries(localState.profile?.info_cache ?? {})
      .map(([profileName, profileInfo]) => [profileName, {
        accountName: chromeProfileAccountName(profileInfo),
        displayName: String(profileInfo?.name ?? "").trim(),
      }])
      .filter(([, label]) => label.displayName || label.accountName));
  } catch {
    return new Map();
  }
}

function chromeProfileAccountName(profileInfo) {
  return [
    profileInfo?.user_name,
    profileInfo?.email,
    profileInfo?.gaia_name,
    profileInfo?.account_name,
  ].map((value) => String(value ?? "").trim()).find(Boolean) ?? "";
}

function chromeProfileLabel(profileName, profileLabels) {
  const label = profileLabels.get(profileName);
  const details = uniqueLabelDetails([label?.displayName, label?.accountName]);
  return details.length > 0 ? `${profileName} (${details.join(", ")})` : profileName;
}

function redactedChromeProfileLabel(profileName, profileLabels) {
  const label = profileLabels.get(profileName);
  const details = uniqueLabelDetails([label?.displayName, redactAccountName(label?.accountName)]);
  return details.length > 0 ? `${profileName} (${details.join(", ")})` : profileName;
}

function chromeProfileMatchesAccount(profileName, profileLabels, normalizedExpectedAccount) {
  const label = profileLabels.get(profileName);
  return uniqueLabelDetails([label?.displayName, label?.accountName])
    .some((value) => normalizeAccountName(value) === normalizedExpectedAccount);
}

function normalizeAccountName(value) {
  return String(value ?? "").trim().toLowerCase();
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

function uniqueLabelDetails(values) {
  const seen = new Set();
  return values
    .map((value) => String(value ?? "").trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
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
  return /not installed in this Chrome profile|installed from a different path|installed but disabled|Chrome reports version/i.test(error?.message ?? "");
}

function normalizePath(path) {
  return resolve(path).toLowerCase();
}

async function extensionManifestVersion(extensionPath) {
  try {
    const manifest = JSON.parse(await readFile(resolve(extensionPath, "manifest.json"), "utf8"));
    return String(manifest.version ?? "").trim();
  } catch {
    return "";
  }
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
    `${EXTENSION_NAME} ${result.version} is enabled in ${redactPath(result.profileDir ?? profileDir)} from ${redactPath(result.path)} (${result.id})`,
  );
}
