import { removeAlbertRmpEnhancements, startAlbertRmpEnhancer } from "./contentDom.js";
import { initContentScript } from "./contentController.js";
import { createProfessorMessenger } from "./contentMessenger.js";

const professorMessenger = createProfessorMessenger(chrome);

initContentScript({
  chrome,
  startAlbertRmpEnhancer,
  removeAlbertRmpEnhancements,
  lookupProfessor: professorMessenger.lookupProfessor,
}).catch((error) => {
  console.error("NYU RMP extension failed to start", error);
});
