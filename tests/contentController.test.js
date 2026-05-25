import { describe, expect, it, vi } from "vitest";
import { initContentScript } from "../src/contentController.js";

describe("content script controller", () => {
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
    const chrome = createChromeMock({ "settings:overlayEnabled": false });
    const observer = { disconnect: vi.fn() };
    const startAlbertRmpEnhancer = vi.fn(() => observer);

    await initContentScript({
      chrome,
      startAlbertRmpEnhancer,
      removeAlbertRmpEnhancements: vi.fn(),
      lookupProfessor: vi.fn(),
    });

    expect(startAlbertRmpEnhancer).not.toHaveBeenCalled();

    chrome.storage.onChanged.listener({
      "settings:overlayEnabled": { oldValue: false, newValue: true },
    }, "local");

    expect(startAlbertRmpEnhancer).toHaveBeenCalledTimes(1);
    expect(startAlbertRmpEnhancer).toHaveBeenCalledWith({
      lookupProfessor: expect.any(Function),
      enabled: true,
    });
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
    },
  };
}
