import { startAlbertRmpEnhancer } from "./contentDom.js";

const settings = await chrome.storage.local.get("settings:overlayEnabled");
startAlbertRmpEnhancer({
  lookupProfessor,
  enabled: settings["settings:overlayEnabled"] !== false,
});

function lookupProfessor(name, { forceRefresh = false } = {}) {
  return chrome.runtime.sendMessage({
    type: "NYU_RMP_FIND_PROFESSOR",
    name,
    forceRefresh,
  }).then((response) => {
    if (!response?.ok) {
      throw new Error(response?.error ?? "RMP lookup failed");
    }
    return response.result;
  });
}
