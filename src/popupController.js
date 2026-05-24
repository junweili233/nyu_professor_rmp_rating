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

  const settings = await storage.get("settings:overlayEnabled");
  const overlayEnabled = settings["settings:overlayEnabled"] !== false;
  if (enableOverlay) {
    enableOverlay.checked = overlayEnabled;
    enableOverlay.addEventListener("change", async () => {
      const nextValue = enableOverlay.checked;
      try {
        await storage.set({ "settings:overlayEnabled": nextValue });
      } catch (error) {
        enableOverlay.checked = !nextValue;
        status.textContent = `Overlay setting failed: ${error.message}`;
      }
    });
  }

  async function refreshStatus() {
    const cached = await getProfessorCacheKeys(storage);
    status.textContent = cached.length === 1 ? "1 professor cached" : `${cached.length} professors cached`;
    if (clearButton) {
      clearButton.disabled = cached.length === 0;
    }
    return cached;
  }

  if (clearButton) {
    clearButton.addEventListener("click", async () => {
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
      }
    });
  }

  await refreshStatus();
}

async function getProfessorCacheKeys(storage) {
  const items = await storage.get(null);
  return Object.keys(items).filter((key) => key.startsWith("professor:"));
}
