export async function initPopup({
  document = globalThis.document,
  storage = globalThis.chrome?.storage?.local,
  runtime = globalThis.chrome?.runtime,
} = {}) {
  const status = document.getElementById("status");
  const clearButton = document.getElementById("clear-cache");
  const enableOverlay = document.getElementById("enable-overlay");
  if (!status || !storage) {
    return;
  }
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");

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
    enableOverlay.addEventListener("change", async () => {
      const nextValue = enableOverlay.checked;
      enableOverlay.disabled = true;
      enableOverlay.setAttribute("aria-busy", "true");
      status.textContent = "Saving overlay setting";
      try {
        await storage.set({ "settings:overlayEnabled": nextValue });
        status.textContent = nextValue ? "Ratings overlay enabled" : "Ratings overlay disabled";
      } catch (error) {
        enableOverlay.checked = !nextValue;
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
      status.textContent = cached.length === 1 ? "1 professor cached" : `${cached.length} professors cached`;
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
        if (runtime?.sendMessage) {
          const response = await runtime.sendMessage({ type: "NYU_RMP_CLEAR_CACHE" });
          if (!response?.ok) {
            throw new Error(response?.error ?? "Cache clear failed");
          }
        } else {
          const cached = await getProfessorCacheKeys(storage);
          if (cached.length > 0) {
            await storage.remove(cached);
          }
        }
        status.textContent = "Cache cleared";
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
}

async function getProfessorCacheKeys(storage) {
  const items = await storage.get(null);
  return Object.keys(items).filter((key) => key.startsWith("professor:"));
}
