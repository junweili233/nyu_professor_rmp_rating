import { startAlbertRmpEnhancer } from "./contentDom.js";

startAlbertRmpEnhancer({ lookupProfessor });

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
