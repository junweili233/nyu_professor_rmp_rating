import { afterEach, describe, expect, it, vi } from "vitest";
import { createProfessorMessenger } from "../src/contentMessenger.js";

describe("content script professor messenger", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends professor lookup requests through the extension runtime", async () => {
    const chrome = {
      runtime: {
        sendMessage: vi.fn(async () => ({
          ok: true,
          result: { name: "Ada Lovelace", rating: 4.7 },
        })),
      },
    };
    const messenger = createProfessorMessenger(chrome);

    await expect(messenger.lookupProfessor("Ada Lovelace", { forceRefresh: true })).resolves.toEqual({
      name: "Ada Lovelace",
      rating: 4.7,
    });

    expect(chrome.runtime.sendMessage.mock.calls[0][0]).toEqual({
      type: "NYU_RMP_FIND_PROFESSOR",
      name: "Ada Lovelace",
      forceRefresh: true,
    });
  });

  it("surfaces Chrome runtime messaging failures as RMP lookup errors", async () => {
    const chrome = {
      runtime: {
        lastError: { message: "Could not establish connection. Receiving end does not exist." },
        sendMessage: vi.fn(async () => undefined),
      },
    };
    const messenger = createProfessorMessenger(chrome);

    await expect(messenger.lookupProfessor("Ada Lovelace")).rejects.toThrow(
      "Could not establish connection. Receiving end does not exist.",
    );
  });

  it("supports callback-style Chrome messaging responses", async () => {
    const chrome = {
      runtime: {
        sendMessage: vi.fn((_message, sendResponse) => {
          sendResponse({
            ok: true,
            result: { name: "Grace Hopper", rating: 4.8 },
          });
        }),
      },
    };
    const messenger = createProfessorMessenger(chrome);

    await expect(messenger.lookupProfessor("Grace Hopper")).resolves.toEqual({
      name: "Grace Hopper",
      rating: 4.8,
    });
  });

  it("surfaces callback-style Chrome runtime lastError values", async () => {
    const chrome = {
      runtime: {
        sendMessage: vi.fn((_message, sendResponse) => {
          chrome.runtime.lastError = { message: "The message port closed before a response was received." };
          sendResponse(undefined);
        }),
      },
    };
    const messenger = createProfessorMessenger(chrome);

    await expect(messenger.lookupProfessor("Ada Lovelace")).rejects.toThrow(
      "The message port closed before a response was received.",
    );
  });

  it("rejects missing background responses with a clear retryable error", async () => {
    const chrome = {
      runtime: {
        sendMessage: vi.fn(async () => undefined),
      },
    };
    const messenger = createProfessorMessenger(chrome);

    await expect(messenger.lookupProfessor("Ada Lovelace")).rejects.toThrow("RMP lookup failed");
  });

  it("rejects unavailable extension runtime with a clear retryable error", async () => {
    const messenger = createProfessorMessenger({});

    await expect(messenger.lookupProfessor("Ada Lovelace")).rejects.toThrow("extension runtime is unavailable");
  });

  it("times out runtime messages that never receive a background response", async () => {
    vi.useFakeTimers();
    const chrome = {
      runtime: {
        sendMessage: vi.fn(() => undefined),
      },
    };
    const messenger = createProfessorMessenger(chrome, { timeoutMs: 10 });

    const lookup = messenger.lookupProfessor("Ada Lovelace");
    const assertion = expect(lookup).rejects.toThrow("RMP lookup timed out");
    await vi.advanceTimersByTimeAsync(10);

    await assertion;
  });
});
