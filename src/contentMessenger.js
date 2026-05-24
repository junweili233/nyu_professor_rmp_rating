export function createProfessorMessenger(chrome) {
  return {
    async lookupProfessor(name, { forceRefresh = false } = {}) {
      const response = await sendRuntimeMessage(chrome, {
        type: "NYU_RMP_FIND_PROFESSOR",
        name,
        forceRefresh,
      });
      if (!response?.ok) {
        throw new Error(response?.error ?? "RMP lookup failed");
      }
      return response.result;
    },
  };
}

function sendRuntimeMessage(chrome, message) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (response) => {
      if (settled) {
        return;
      }
      settled = true;
      const runtimeError = chrome.runtime.lastError?.message;
      if (runtimeError) {
        reject(new Error(runtimeError));
        return;
      }
      resolve(response);
    };

    try {
      const maybePromise = chrome.runtime.sendMessage(message, finish);
      if (maybePromise?.then) {
        maybePromise.then(finish, reject);
      }
    } catch (error) {
      reject(error);
    }
  });
}
