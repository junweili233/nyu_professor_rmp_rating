const EXTENSION_VERSION = "0.1.1";

export async function initContentScript({
  chrome = globalThis.chrome,
  document = globalThis.document,
  startAlbertRmpEnhancer,
  removeAlbertRmpEnhancements,
  lookupProfessor,
} = {}) {
  markContentScriptLoaded(document);
  const settings = await readOverlaySettings(chrome);
  let observer = null;
  if (settings["settings:overlayEnabled"] !== false) {
    markOverlayState(document, "enabled");
    observer = startOverlay();
  } else {
    markOverlayState(document, "disabled");
  }

  chrome.storage.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes["settings:overlayEnabled"]) {
      return;
    }

    const enabled = changes["settings:overlayEnabled"].newValue !== false;
    if (enabled && !observer) {
      markOverlayState(document, "enabled");
      observer = startOverlay();
      return;
    }

    if (!enabled) {
      markOverlayState(document, "disabled");
      observer?.disconnect?.();
      observer = null;
      removeAlbertRmpEnhancements();
    }
  });
  chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
    if (message?.type !== "NYU_RMP_CONTENT_STATUS") {
      return false;
    }
    sendResponse({
      ok: true,
      contentScript: document?.documentElement?.dataset.nyuRmpContentScript ?? "loaded",
      version: document?.documentElement?.dataset.nyuRmpVersion ?? EXTENSION_VERSION,
      overlayState: document?.documentElement?.dataset.nyuRmpOverlayState ?? "unknown",
      cardCount: document?.querySelectorAll?.(".nyu-rmp-card").length ?? 0,
      radarCount: document?.querySelectorAll?.(".nyu-rmp-radar").length ?? 0,
    });
    return false;
  });

  function startOverlay() {
    return startAlbertRmpEnhancer({
      lookupProfessor,
      enabled: true,
    });
  }
}

function markContentScriptLoaded(document) {
  if (document?.documentElement) {
    document.documentElement.dataset.nyuRmpContentScript = "loaded";
    document.documentElement.dataset.nyuRmpVersion = EXTENSION_VERSION;
  }
}

function markOverlayState(document, state) {
  if (document?.documentElement) {
    document.documentElement.dataset.nyuRmpOverlayState = state;
  }
}

async function readOverlaySettings(chrome) {
  try {
    return await chrome.storage.local.get("settings:overlayEnabled");
  } catch {
    return {};
  }
}
