// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { initContentScript } from "../src/contentController.js";

describe("content script controller", () => {
  it("marks the page when the Albert content script has loaded", async () => {
    const document = globalThis.document;
    const chrome = createChromeMock({ "settings:overlayEnabled": true });

    await initContentScript({
      chrome,
      document,
      startAlbertRmpEnhancer: vi.fn(() => ({ disconnect: vi.fn() })),
      removeAlbertRmpEnhancements: vi.fn(),
      lookupProfessor: vi.fn(),
    });

    expect(document.documentElement.dataset.nyuRmpContentScript).toBe("loaded");
    expect(document.documentElement.dataset.nyuRmpOverlayState).toBe("enabled");
  });

  it("responds to popup status pings with overlay state and rendered card counts", async () => {
    const document = globalThis.document;
    document.body.innerHTML = `
      <div class="nyu-rmp-card"></div>
      <div class="nyu-rmp-card"></div>
      <svg class="nyu-rmp-radar"></svg>
    `;
    const chrome = createChromeMock({ "settings:overlayEnabled": true });

    await initContentScript({
      chrome,
      document,
      startAlbertRmpEnhancer: vi.fn(() => ({ disconnect: vi.fn() })),
      removeAlbertRmpEnhancements: vi.fn(),
      lookupProfessor: vi.fn(),
    });

    const sendResponse = vi.fn();
    chrome.runtime.onMessage.listener({ type: "NYU_RMP_CONTENT_STATUS" }, {}, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      contentScript: "loaded",
      version: "0.1.1",
      overlayState: "enabled",
      cardCount: 2,
      radarCount: 1,
    });
  });

  it("ignores unrelated content script messages", async () => {
    const chrome = createChromeMock({ "settings:overlayEnabled": true });

    await initContentScript({
      chrome,
      document: globalThis.document,
      startAlbertRmpEnhancer: vi.fn(() => ({ disconnect: vi.fn() })),
      removeAlbertRmpEnhancements: vi.fn(),
      lookupProfessor: vi.fn(),
    });

    const sendResponse = vi.fn();
    const result = chrome.runtime.onMessage.listener({ type: "OTHER_MESSAGE" }, {}, sendResponse);

    expect(result).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it("starts the overlay when the stored setting is enabled", async () => {
    const chrome = createChromeMock({ "settings:overlayEnabled": true });
    const startAlbertRmpEnhancer = vi.fn(() => ({ disconnect: vi.fn() }));

    await initContentScript({
      chrome,
      startAlbertRmpEnhancer,
      removeAlbertRmpEnhancements: vi.fn(),
      lookupProfessor: vi.fn(),
    });

    expect(startAlbertRmpEnhancer).toHaveBeenCalledWith({
      lookupProfessor: expect.any(Function),
      enabled: true,
    });
  });

  it("defaults to starting the overlay when the stored setting cannot be read", async () => {
    const chrome = createChromeMock();
    chrome.storage.local.get.mockRejectedValueOnce(new Error("Storage unavailable"));
    const startAlbertRmpEnhancer = vi.fn(() => ({ disconnect: vi.fn() }));

    await expect(initContentScript({
      chrome,
      startAlbertRmpEnhancer,
      removeAlbertRmpEnhancements: vi.fn(),
      lookupProfessor: vi.fn(),
    })).resolves.toBeUndefined();

    expect(startAlbertRmpEnhancer).toHaveBeenCalledWith({
      lookupProfessor: expect.any(Function),
      enabled: true,
    });
    expect(chrome.storage.onChanged.addListener).toHaveBeenCalledTimes(1);
  });

  it("cleans up injected cards when the stored setting is disabled", async () => {
    const chrome = createChromeMock({ "settings:overlayEnabled": true });
    const observer = { disconnect: vi.fn() };
    const startAlbertRmpEnhancer = vi.fn(() => observer);
    const removeAlbertRmpEnhancements = vi.fn();

    await initContentScript({
      chrome,
      startAlbertRmpEnhancer,
      removeAlbertRmpEnhancements,
      lookupProfessor: vi.fn(),
    });
    chrome.storage.onChanged.listener({
      "settings:overlayEnabled": { oldValue: true, newValue: false },
    }, "local");

    expect(observer.disconnect).toHaveBeenCalled();
    expect(removeAlbertRmpEnhancements).toHaveBeenCalled();
  });

  it("does not start while disabled, then starts when re-enabled", async () => {
    const document = globalThis.document;
    const chrome = createChromeMock({ "settings:overlayEnabled": false });
    const observer = { disconnect: vi.fn() };
    const startAlbertRmpEnhancer = vi.fn(() => observer);

    await initContentScript({
      chrome,
      document,
      startAlbertRmpEnhancer,
      removeAlbertRmpEnhancements: vi.fn(),
      lookupProfessor: vi.fn(),
    });

    expect(startAlbertRmpEnhancer).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.nyuRmpContentScript).toBe("loaded");
    expect(document.documentElement.dataset.nyuRmpOverlayState).toBe("disabled");

    chrome.storage.onChanged.listener({
      "settings:overlayEnabled": { oldValue: false, newValue: true },
    }, "local");

    expect(startAlbertRmpEnhancer).toHaveBeenCalledTimes(1);
    expect(startAlbertRmpEnhancer).toHaveBeenCalledWith({
      lookupProfessor: expect.any(Function),
      enabled: true,
    });
    expect(document.documentElement.dataset.nyuRmpOverlayState).toBe("enabled");
  });
});

function createChromeMock(settings = {}) {
  return {
    storage: {
      local: {
        get: vi.fn(async () => settings),
      },
      onChanged: {
        addListener: vi.fn(function addListener(listener) {
          this.listener = listener;
        }),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(function addListener(listener) {
          this.listener = listener;
        }),
      },
    },
  };
}
