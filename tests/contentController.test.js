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
      <div class="nyu-rmp-card" data-nyu-rmp-version="0.1.5">
        <div class="nyu-rmp-quick-grid"></div>
      </div>
      <div class="nyu-rmp-card" data-nyu-rmp-version="0.1.5">
        <div class="nyu-rmp-quick-grid"></div>
      </div>
      <div class="nyu-rmp-rating-root"></div>
      <div class="nyu-rmp-rating-root"></div>
      <div class="nyu-rmp-rating-root"></div>
      <svg class="nyu-rmp-radar"></svg>
      <div data-nyu-rmp-processed="true"></div>
      <div data-nyu-rmp-processed="true"></div>
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
      version: "0.1.5",
      overlayState: "enabled",
      ratingRootCount: 3,
      cardCount: 2,
      quickGridCount: 2,
      staleCardLayoutCount: 0,
      radarCount: 1,
      processedCellCount: 2,
      ratingCellCount: 0,
      trailingRatingRootCount: 0,
      inlineProcessedRatingRootCount: 0,
      selectButtonRatingRootCount: 0,
      processedCellLayoutWarningCount: 0,
      staleCardLayoutMigrationCount: 0,
      processedCellLastRepairCount: 0,
      processedCellLastRepairWarningCount: 0,
      processedCellLastRepairRemainingWarningCount: 0,
    });
  });

  it("migrates stale squeezed card markup before starting the current overlay", async () => {
    const document = globalThis.document;
    document.body.innerHTML = `
      <div data-nyu-rmp-processed="true">
        <div class="nyu-rmp-albert-original">Instructor: Ada Lovelace</div>
        <div class="nyu-rmp-rating-root">
          <div class="nyu-rmp-card">
            <div class="nyu-rmp-card-head">Ada Lovelace</div>
            <div class="nyu-rmp-comments-panel">Old squeezed comments</div>
          </div>
        </div>
      </div>
    `;
    const chrome = createChromeMock({ "settings:overlayEnabled": true });
    const removeAlbertRmpEnhancements = vi.fn((targetDocument) => {
      targetDocument.querySelector(".nyu-rmp-rating-root")?.remove();
    });
    const startAlbertRmpEnhancer = vi.fn(() => ({ disconnect: vi.fn() }));

    await initContentScript({
      chrome,
      document,
      startAlbertRmpEnhancer,
      removeAlbertRmpEnhancements,
      lookupProfessor: vi.fn(),
    });

    expect(removeAlbertRmpEnhancements).toHaveBeenCalledWith(document);
    expect(startAlbertRmpEnhancer).toHaveBeenCalled();
    expect(document.documentElement.dataset.nyuRmpStaleCardLayoutMigrationCount).toBe("1");
    const sendResponse = vi.fn();
    chrome.runtime.onMessage.listener({ type: "NYU_RMP_CONTENT_STATUS" }, {}, sendResponse);
    expect(sendResponse.mock.calls[0][0]).toMatchObject({
      cardCount: 0,
      quickGridCount: 0,
      staleCardLayoutCount: 0,
      staleCardLayoutMigrationCount: 1,
    });
  });

  it("keeps current segmented card markup when the content script restarts", async () => {
    const document = globalThis.document;
    document.body.innerHTML = `
      <div class="nyu-rmp-rating-root" data-nyu-rmp-version="0.1.5">
        <div class="nyu-rmp-card" data-nyu-rmp-version="0.1.5">
          <div class="nyu-rmp-quick-grid"></div>
        </div>
      </div>
    `;
    const chrome = createChromeMock({ "settings:overlayEnabled": true });
    const removeAlbertRmpEnhancements = vi.fn();

    await initContentScript({
      chrome,
      document,
      startAlbertRmpEnhancer: vi.fn(() => ({ disconnect: vi.fn() })),
      removeAlbertRmpEnhancements,
      lookupProfessor: vi.fn(),
    });

    expect(removeAlbertRmpEnhancements).not.toHaveBeenCalled();
    expect(document.querySelector(".nyu-rmp-quick-grid")).not.toBeNull();
  });

  it("keeps current loading, empty, and error cards when the content script restarts", async () => {
    const document = globalThis.document;
    document.body.innerHTML = `
      <div class="nyu-rmp-rating-root" data-nyu-rmp-version="0.1.5">
        <div class="nyu-rmp-card is-loading" data-nyu-rmp-version="0.1.5"></div>
        <div class="nyu-rmp-card is-empty" data-nyu-rmp-version="0.1.5"></div>
        <div class="nyu-rmp-card is-error" data-nyu-rmp-version="0.1.5"></div>
      </div>
    `;
    const chrome = createChromeMock({ "settings:overlayEnabled": true });
    const removeAlbertRmpEnhancements = vi.fn();

    await initContentScript({
      chrome,
      document,
      startAlbertRmpEnhancer: vi.fn(() => ({ disconnect: vi.fn() })),
      removeAlbertRmpEnhancements,
      lookupProfessor: vi.fn(),
    });

    expect(removeAlbertRmpEnhancements).not.toHaveBeenCalled();
    const sendResponse = vi.fn();
    chrome.runtime.onMessage.listener({ type: "NYU_RMP_CONTENT_STATUS" }, {}, sendResponse);
    expect(sendResponse.mock.calls[0][0]).toMatchObject({
      cardCount: 3,
      quickGridCount: 0,
      staleCardLayoutCount: 0,
      staleCardLayoutMigrationCount: 0,
    });
  });

  it("reports processed Albert layout warnings when cell safeguards are missing", async () => {
    const document = globalThis.document;
    document.body.innerHTML = `
      <div role="gridcell" data-nyu-rmp-processed="true">
        <div class="nyu-rmp-albert-original">Ada Lovelace</div>
        <div class="nyu-rmp-rating-root is-cell-mounted"></div>
      </div>
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

    expect(sendResponse.mock.calls[0][0].processedCellLayoutWarningCount).toBe(1);
  });

  it("reports when ratings are mounted in generated trailing Albert columns", async () => {
    const document = globalThis.document;
    document.body.innerHTML = `
      <div role="row">
        <div role="gridcell" data-nyu-rmp-processed="true">Ada Lovelace</div>
        <div role="gridcell" data-nyu-rmp-rating-cell="true">
          <div class="nyu-rmp-rating-root">
            <div class="nyu-rmp-card" data-nyu-rmp-version="0.1.5">
              <div class="nyu-rmp-quick-grid"></div>
            </div>
          </div>
        </div>
      </div>
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

    expect(sendResponse.mock.calls[0][0]).toMatchObject({
      ratingRootCount: 1,
      cardCount: 1,
      quickGridCount: 1,
      processedCellCount: 1,
      ratingCellCount: 1,
      trailingRatingRootCount: 1,
      inlineProcessedRatingRootCount: 0,
      selectButtonRatingRootCount: 0,
    });
  });

  it("reports when SELECT_BUTTON ratings are mounted under select buttons", async () => {
    const document = globalThis.document;
    document.body.innerHTML = `
      <div role="row">
        <div role="gridcell" data-nyu-rmp-processed="true" data-nyu-rmp-select-button-rating="true">
          <div class="nyu-rmp-albert-original"><button>Select</button></div>
          <div class="nyu-rmp-rating-root">
            <div class="nyu-rmp-card" data-nyu-rmp-version="0.1.5">
              <div class="nyu-rmp-quick-grid"></div>
            </div>
          </div>
        </div>
        <div role="gridcell" data-nyu-rmp-processed="true">Ada Lovelace</div>
      </div>
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

    expect(sendResponse.mock.calls[0][0]).toMatchObject({
      ratingRootCount: 1,
      cardCount: 1,
      quickGridCount: 1,
      processedCellCount: 2,
      ratingCellCount: 0,
      trailingRatingRootCount: 0,
      inlineProcessedRatingRootCount: 1,
      selectButtonRatingRootCount: 1,
    });
  });

  it("repairs processed Albert layout safeguards when the popup requests it", async () => {
    const document = globalThis.document;
    document.body.innerHTML = `
      <div role="gridcell" data-nyu-rmp-processed="true">
        <div class="nyu-rmp-albert-original">Ada Lovelace</div>
        <div class="nyu-rmp-rating-root is-cell-mounted"></div>
      </div>
    `;
    const chrome = createChromeMock({ "settings:overlayEnabled": true });
    const repairAlbertRmpLayoutSafeguards = vi.fn(() => ({ repairedCount: 1 }));

    await initContentScript({
      chrome,
      document,
      startAlbertRmpEnhancer: vi.fn(() => ({ disconnect: vi.fn() })),
      removeAlbertRmpEnhancements: vi.fn(),
      repairAlbertRmpLayoutSafeguards,
      lookupProfessor: vi.fn(),
    });

    const sendResponse = vi.fn();
    chrome.runtime.onMessage.listener({ type: "NYU_RMP_REPAIR_LAYOUT" }, {}, sendResponse);

    expect(repairAlbertRmpLayoutSafeguards).toHaveBeenCalledWith(document);
    expect(sendResponse).toHaveBeenCalledWith({
      ok: true,
      repairedCount: 1,
      beforeWarningCount: 1,
      afterWarningCount: 1,
    });
    expect(document.documentElement.dataset.nyuRmpLastLayoutRepairCount).toBe("1");
    expect(document.documentElement.dataset.nyuRmpLastLayoutRepairWarningCount).toBe("1");
    expect(document.documentElement.dataset.nyuRmpLastLayoutRepairRemainingWarningCount).toBe("1");
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
