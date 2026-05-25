export async function initContentScript({
  chrome = globalThis.chrome,
  startAlbertRmpEnhancer,
  removeAlbertRmpEnhancements,
  lookupProfessor,
} = {}) {
  const settings = await readOverlaySettings(chrome);
  let observer = null;
  if (settings["settings:overlayEnabled"] !== false) {
    observer = startOverlay();
  }

  chrome.storage.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes["settings:overlayEnabled"]) {
      return;
    }

    const enabled = changes["settings:overlayEnabled"].newValue !== false;
    if (enabled && !observer) {
      observer = startOverlay();
      return;
    }

    if (!enabled) {
      observer?.disconnect?.();
      observer = null;
      removeAlbertRmpEnhancements();
    }
  });

  function startOverlay() {
    return startAlbertRmpEnhancer({
      lookupProfessor,
      enabled: true,
    });
  }
}

async function readOverlaySettings(chrome) {
  try {
    return await chrome.storage.local.get("settings:overlayEnabled");
  } catch {
    return {};
  }
}
