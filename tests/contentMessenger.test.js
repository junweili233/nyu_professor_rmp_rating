import { describe, expect, it, vi } from "vitest";
import { createProfessorMessenger } from "../src/contentMessenger.js";

describe("content script professor messenger", () => {
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

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
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

  it("rejects missing background responses with a clear retryable error", async () => {
    const chrome = {
      runtime: {
        sendMessage: vi.fn(async () => undefined),
      },
    };
    const messenger = createProfessorMessenger(chrome);

    await expect(messenger.lookupProfessor("Ada Lovelace")).rejects.toThrow("RMP lookup failed");
  });
});
