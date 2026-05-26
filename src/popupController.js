import { EXTENSION_VERSION } from "./shared/version.js";

export async function initPopup({
  document = globalThis.document,
  storage = globalThis.chrome?.storage?.local,
  runtime = globalThis.chrome?.runtime,
  tabs = globalThis.chrome?.tabs,
  scripting = globalThis.chrome?.scripting,
} = {}) {
  const status = document.getElementById("status");
  const pageStatus = document.getElementById("page-status");
  const buildVersion = document.getElementById("build-version");
  const clearButton = document.getElementById("clear-cache");
  const enableOverlay = document.getElementById("enable-overlay");
  if (!status || !storage) {
    return;
  }
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  if (pageStatus) {
    pageStatus.setAttribute("role", "status");
    pageStatus.setAttribute("aria-live", "polite");
    pageStatus.setAttribute("aria-atomic", "true");
  }
  if (buildVersion) {
    buildVersion.textContent = `Build v${EXTENSION_VERSION}`;
  }

  let settings;
  try {
    settings = await storage.get("settings:overlayEnabled");
  } catch (error) {
    status.textContent = `Popup unavailable: ${error.message}`;
    if (enableOverlay) {
      enableOverlay.disabled = true;
    }
    if (clearButton) {
      clearButton.disabled = true;
    }
    return;
  }

  const overlayEnabled = settings["settings:overlayEnabled"] !== false;
  if (enableOverlay) {
    enableOverlay.checked = overlayEnabled;
    syncSwitchState(enableOverlay);
    enableOverlay.addEventListener("change", async () => {
      const nextValue = enableOverlay.checked;
      syncSwitchState(enableOverlay);
      enableOverlay.disabled = true;
      enableOverlay.setAttribute("aria-busy", "true");
      status.textContent = "Saving overlay setting";
      try {
        await storage.set({ "settings:overlayEnabled": nextValue });
        status.textContent = nextValue ? "Ratings overlay enabled" : "Ratings overlay disabled";
      } catch (error) {
        enableOverlay.checked = !nextValue;
        syncSwitchState(enableOverlay);
        status.textContent = `Overlay setting failed: ${error.message}`;
      } finally {
        enableOverlay.disabled = false;
        enableOverlay.setAttribute("aria-busy", "false");
      }
    });
  }

  async function refreshStatus() {
    try {
      const cached = await getProfessorCacheKeys(storage);
      status.textContent = formatCacheCountStatus(cached.length);
      if (clearButton) {
        clearButton.disabled = cached.length === 0;
      }
      return cached;
    } catch (error) {
      status.textContent = `Cache status unavailable: ${error.message}`;
      if (clearButton) {
        clearButton.disabled = true;
      }
      return [];
    }
  }

  if (clearButton) {
    clearButton.addEventListener("click", async () => {
      clearButton.disabled = true;
      clearButton.setAttribute("aria-busy", "true");
      status.textContent = "Clearing cache";
      try {
        let clearedCount = 0;
        if (runtime?.sendMessage) {
          const response = await runtime.sendMessage({ type: "NYU_RMP_CLEAR_CACHE" });
          if (!response?.ok) {
            throw new Error(response?.error ?? "Cache clear failed");
          }
          clearedCount = nonNegativeInteger(response.cleared);
        } else {
          const cached = await getProfessorCacheKeys(storage);
          clearedCount = cached.length;
          if (cached.length > 0) {
            await storage.remove(cached);
          }
        }
        status.textContent = formatCacheClearedStatus(clearedCount);
        clearButton.disabled = true;
      } catch (error) {
        status.textContent = `Cache clear failed: ${error.message}`;
        clearButton.disabled = false;
      } finally {
        clearButton.setAttribute("aria-busy", "false");
      }
    });
  }

  await refreshStatus();
  await refreshAlbertPageStatus({ pageStatus, tabs, scripting });
}

async function getProfessorCacheKeys(storage) {
  const items = await storage.get(null);
  return Object.keys(items ?? {}).filter((key) => key.startsWith("professor:"));
}

function syncSwitchState(input) {
  if (input?.getAttribute("role") === "switch") {
    input.setAttribute("aria-checked", String(input.checked));
  }
}

function formatCacheClearedStatus(count) {
  return count === 1
    ? "1 cached rating lookup cleared"
    : `${count} cached rating lookups cleared`;
}

function formatCacheCountStatus(count) {
  return count === 1
    ? "1 rating lookup cached"
    : `${count} rating lookups cached`;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

async function refreshAlbertPageStatus({ pageStatus, tabs, scripting }) {
  if (!pageStatus) {
    return;
  }
  if (!tabs?.query || !tabs?.sendMessage) {
    setPageStatus(pageStatus, "Open Albert to check page connection.", "idle");
    return;
  }

  try {
    const [activeTab] = await tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id || !isAlbertUrl(activeTab.url)) {
      setPageStatus(pageStatus, "Open an Albert tab to check page connection.", "idle");
      return;
    }

    const response = await pingAlbertContentScript(tabs, activeTab.id);
    if (isLoadedContentResponse(response)) {
      setPageStatus(pageStatus, formatAlbertConnectedStatus(response), albertPageStatusState(response));
      return;
    }

    const wakeResponse = await wakeAlbertContentScript({ tabs, scripting, tabId: activeTab.id });
    if (!isLoadedContentResponse(wakeResponse)) {
      setPageStatus(pageStatus, "Albert not connected. Reload the extension, then refresh Albert.", "warning");
      return;
    }

    setPageStatus(pageStatus, formatAlbertConnectedStatus(wakeResponse), albertPageStatusState(wakeResponse));
  } catch {
    setPageStatus(pageStatus, "Albert not connected. Reload the extension, then refresh Albert.", "warning");
  }
}

async function pingAlbertContentScript(tabs, tabId) {
  try {
    return await tabs.sendMessage(tabId, { type: "NYU_RMP_CONTENT_STATUS" });
  } catch {
    return null;
  }
}

async function wakeAlbertContentScript({ tabs, scripting, tabId }) {
  if (!scripting?.executeScript) {
    return null;
  }
  await scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["content.js"],
  });
  return pingAlbertContentScript(tabs, tabId);
}

function isLoadedContentResponse(response) {
  return response?.ok && response.contentScript === "loaded";
}

function setPageStatus(pageStatus, message, state) {
  pageStatus.textContent = message;
  pageStatus.dataset.state = state;
}

function isAlbertUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:"
      && ["albert.nyu.edu", "sis.nyu.edu", "sis.portal.nyu.edu"].includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function formatAlbertConnectedStatus(response) {
  const cardCount = nonNegativeInteger(response.cardCount);
  const radarCount = nonNegativeInteger(response.radarCount);
  const cardLabel = cardCount === 1 ? "1 card" : `${cardCount} cards`;
  const radarLabel = radarCount === 1 ? "1 radar map" : `${radarCount} radar maps`;
  const versionLabel = formatVersionLabel(response.version);
  if (isStaleContentVersion(response.version)) {
    return `Albert connected${versionLabel}; popup v${EXTENSION_VERSION}. Reload the extension, then refresh Albert. ${cardLabel}, ${radarLabel}`;
  }
  if (response.overlayState === "disabled") {
    return `Albert connected${versionLabel}; overlay disabled. ${cardLabel}, ${radarLabel}`;
  }
  return `Albert connected${versionLabel}: ${cardLabel}, ${radarLabel}`;
}

function albertPageStatusState(response) {
  return isStaleContentVersion(response.version) ? "warning" : "connected";
}

function isStaleContentVersion(version) {
  const normalized = String(version ?? "").trim();
  return Boolean(normalized) && normalized !== EXTENSION_VERSION;
}

function formatVersionLabel(version) {
  const normalized = String(version ?? "").trim();
  return normalized ? ` v${normalized}` : "";
}
