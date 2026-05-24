import { createProfessorLookupService } from "./backgroundService.js";

const professorLookupService = createProfessorLookupService({
  storage: chrome.storage.local,
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "NYU_RMP_FIND_PROFESSOR") {
    return false;
  }

  professorLookupService.lookup(message.name)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});
