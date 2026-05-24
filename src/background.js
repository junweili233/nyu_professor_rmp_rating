import { createProfessorLookupService } from "./backgroundService.js";

const professorLookupService = createProfessorLookupService({
  storage: chrome.storage.local,
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "NYU_RMP_FIND_PROFESSOR") {
    professorLookupService.lookup(message.name, { forceRefresh: Boolean(message.forceRefresh) })
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  if (message?.type === "NYU_RMP_CLEAR_CACHE") {
    professorLookupService.clearCache()
      .then((cleared) => sendResponse({ ok: true, cleared }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  }

  return false;
});
