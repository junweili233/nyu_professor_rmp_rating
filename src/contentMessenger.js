export function createProfessorMessenger(chrome) {
  return {
    async lookupProfessor(name, { forceRefresh = false } = {}) {
      const response = await chrome.runtime.sendMessage({
        type: "NYU_RMP_FIND_PROFESSOR",
        name,
        forceRefresh,
      });
      const runtimeError = chrome.runtime.lastError?.message;
      if (runtimeError) {
        throw new Error(runtimeError);
      }
      if (!response?.ok) {
        throw new Error(response?.error ?? "RMP lookup failed");
      }
      return response.result;
    },
  };
}
