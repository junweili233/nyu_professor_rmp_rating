const DEFAULT_MESSAGE_TIMEOUT_MS = 10000;

export function createProfessorMessenger(chrome, { timeoutMs = DEFAULT_MESSAGE_TIMEOUT_MS } = {}) {
  return {
    async lookupProfessor(name, { forceRefresh = false } = {}) {
      const response = await sendRuntimeMessage(chrome, {
        type: "NYU_RMP_FIND_PROFESSOR",
        name,
        forceRefresh,
      }, { timeoutMs });
      if (!response?.ok) {
        throw new Error(response?.error ?? "RMP lookup failed");
      }
      return response.result;
    },
  };
}

function sendRuntimeMessage(chrome, message, { timeoutMs }) {
  return new Promise((resolve, reject) => {
    if (!chrome?.runtime?.sendMessage) {
      reject(new Error("extension runtime is unavailable"));
      return;
    }

    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error("RMP lookup timed out"));
    }, timeoutMs);
    const finish = (response) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
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
        maybePromise.then(finish, (error) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeoutId);
          reject(error);
        });
      }
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}
