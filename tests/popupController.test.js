// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { initPopup } from "../src/popupController.js";

describe("extension popup controller", () => {
  it("shows the rating lookup cache count on load", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const storage = createStorageMock({
      "professor:ada lovelace": { value: { name: "Ada Lovelace" } },
      "professor:grace hopper": { value: { name: "Grace Hopper" } },
      "settings:theme": "system",
    });

    await initPopup({ document, storage });

    expect(document.getElementById("status").textContent).toBe("2 rating lookups cached");
    expect(document.getElementById("enable-overlay").checked).toBe(true);
  });

  it("uses singular wording for one cached rating lookup", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const storage = createStorageMock({
      "professor:ada lovelace:course:csci-ua 202": { value: { name: "Ada Lovelace" } },
    });

    await initPopup({ document, storage });

    expect(document.getElementById("status").textContent).toBe("1 rating lookup cached");
  });

  it("treats an empty popup storage result as no cached rating lookups", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const storage = createStorageMock({
      "settings:overlayEnabled": true,
    });
    storage.get = vi.fn(async (key) => {
      if (key === "settings:overlayEnabled") {
        return { "settings:overlayEnabled": true };
      }
      return null;
    });

    await initPopup({ document, storage });

    expect(document.getElementById("status").textContent).toBe("0 rating lookups cached");
    expect(document.getElementById("clear-cache").disabled).toBe(true);
  });

  it("marks popup status text as a polite live region", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const storage = createStorageMock();

    await initPopup({ document, storage });

    const status = document.getElementById("status");
    expect(status.getAttribute("role")).toBe("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("aria-atomic")).toBe("true");
  });

  it("shows the installed extension build version in the popup", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <p id="build-version"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const storage = createStorageMock();

    await initPopup({ document, storage });

    expect(document.getElementById("build-version").textContent).toBe("Build v0.1.1");
  });

  it("reports when the active Albert page is connected to the content script", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <p id="page-status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const tabs = createTabsMock({
      activeTab: { id: 12, url: "https://sis.portal.nyu.edu/psp/ihprod/EMPLOYEE/EMPL/h/" },
      contentStatus: {
        ok: true,
        contentScript: "loaded",
        version: "0.1.1",
        overlayState: "enabled",
        ratingRootCount: 4,
        cardCount: 4,
        radarCount: 3,
        processedCellCount: 4,
      },
    });

    await initPopup({ document, storage: createStorageMock(), tabs });

    expect(tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(tabs.sendMessage).toHaveBeenCalledWith(12, { type: "NYU_RMP_CONTENT_STATUS" });
    expect(document.getElementById("page-status").textContent).toBe("Albert connected v0.1.1: 4 rating roots, 4 cards, 3 radar maps, 4 Albert cells checked, layout OK");
    expect(document.getElementById("page-status").dataset.state).toBe("connected");
  });

  it("warns when the active Albert page is running an older content script version", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <p id="page-status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const tabs = createTabsMock({
      activeTab: { id: 12, url: "https://sis.portal.nyu.edu/psp/ihprod/EMPLOYEE/EMPL/h/" },
      contentStatus: {
        ok: true,
        contentScript: "loaded",
        version: "0.1.0",
        overlayState: "enabled",
        ratingRootCount: 2,
        cardCount: 2,
        radarCount: 1,
        processedCellCount: 2,
      },
    });

    await initPopup({ document, storage: createStorageMock(), tabs });

    expect(document.getElementById("page-status").textContent).toBe(
      "Albert connected v0.1.0; popup v0.1.1. Reload the extension, then refresh Albert. 2 rating roots, 2 cards, 1 radar map, 2 Albert cells checked, layout OK",
    );
    expect(document.getElementById("page-status").dataset.state).toBe("warning");
  });

  it("reports processed Albert layout warnings in the connected page status", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <p id="page-status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const tabs = createTabsMock({
      activeTab: { id: 12, url: "https://sis.portal.nyu.edu/psp/ihprod/EMPLOYEE/EMPL/h/" },
      contentStatus: {
        ok: true,
        contentScript: "loaded",
        version: "0.1.1",
        overlayState: "enabled",
        ratingRootCount: 4,
        cardCount: 4,
        radarCount: 3,
        processedCellCount: 4,
        processedCellLayoutWarningCount: 1,
      },
    });

    await initPopup({ document, storage: createStorageMock(), tabs });

    expect(document.getElementById("page-status").textContent).toBe("Albert connected v0.1.1: 4 rating roots, 4 cards, 3 radar maps, 4 Albert cells checked, 1 layout warning");
    expect(document.getElementById("page-status").dataset.state).toBe("warning");
  });

  it("wakes an active Albert page by injecting the content script when the first ping fails", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <p id="page-status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const tabs = createTabsMock({
      activeTab: { id: 12, url: "https://sis.portal.nyu.edu/psp/ihprod/EMPLOYEE/EMPL/h/" },
      sendResults: [
        new Error("Receiving end does not exist"),
        {
          ok: true,
          contentScript: "loaded",
          overlayState: "enabled",
          ratingRootCount: 4,
          cardCount: 4,
          radarCount: 3,
          processedCellCount: 4,
        },
      ],
    });
    const scripting = {
      executeScript: vi.fn(async () => []),
    };

    await initPopup({ document, storage: createStorageMock(), tabs, scripting });

    expect(scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 12, allFrames: true },
      files: ["content.js"],
    });
    expect(tabs.sendMessage).toHaveBeenCalledTimes(2);
    expect(document.getElementById("page-status").textContent).toBe("Albert connected: 4 rating roots, 4 cards, 3 radar maps, 4 Albert cells checked, layout OK");
    expect(document.getElementById("page-status").dataset.state).toBe("connected");
  });

  it("reports a warning when the active Albert wake-up injection fails", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <p id="page-status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const tabs = createTabsMock({
      activeTab: { id: 12, url: "https://sis.portal.nyu.edu/psp/ihprod/EMPLOYEE/EMPL/h/" },
      sendError: new Error("Receiving end does not exist"),
    });
    const scripting = {
      executeScript: vi.fn(async () => {
        throw new Error("Cannot access tab");
      }),
    };

    await initPopup({ document, storage: createStorageMock(), tabs, scripting });

    expect(scripting.executeScript).toHaveBeenCalledTimes(1);
    expect(document.getElementById("page-status").textContent).toBe("Albert not connected. Reload the extension, then refresh Albert.");
    expect(document.getElementById("page-status").dataset.state).toBe("warning");
  });

  it("prompts a refresh when the active Albert page is not connected", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <p id="page-status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const tabs = createTabsMock({
      activeTab: { id: 12, url: "https://sis.portal.nyu.edu/psp/ihprod/EMPLOYEE/EMPL/h/" },
      sendError: new Error("Receiving end does not exist"),
    });

    await initPopup({ document, storage: createStorageMock(), tabs });

    expect(document.getElementById("page-status").textContent).toBe("Albert not connected. Reload the extension, then refresh Albert.");
    expect(document.getElementById("page-status").dataset.state).toBe("warning");
  });

  it("asks students to open Albert when the active tab is not an Albert page", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <p id="page-status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const tabs = createTabsMock({
      activeTab: { id: 12, url: "https://www.nyu.edu/" },
    });

    await initPopup({ document, storage: createStorageMock(), tabs });

    expect(tabs.sendMessage).not.toHaveBeenCalled();
    expect(document.getElementById("page-status").textContent).toBe("Open an Albert tab to check page connection.");
    expect(document.getElementById("page-status").dataset.state).toBe("idle");
  });

  it("shows an inline error when popup storage cannot be read on startup", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const storage = createStorageMock();
    storage.get = vi.fn(async () => {
      throw new Error("Storage unavailable");
    });

    await expect(initPopup({ document, storage })).resolves.toBeUndefined();

    expect(document.getElementById("status").textContent).toBe("Popup unavailable: Storage unavailable");
    expect(document.getElementById("enable-overlay").disabled).toBe(true);
    expect(document.getElementById("clear-cache").disabled).toBe(true);
  });

  it("shows an inline error when cached rating lookup count cannot be read", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const storage = createStorageMock({
      "settings:overlayEnabled": true,
    });
    storage.get = vi.fn(async (key) => {
      if (key === "settings:overlayEnabled") {
        return { "settings:overlayEnabled": true };
      }
      throw new Error("Cache unavailable");
    });

    await expect(initPopup({ document, storage })).resolves.toBeUndefined();

    expect(document.getElementById("status").textContent).toBe("Cache status unavailable: Cache unavailable");
    expect(document.getElementById("enable-overlay").disabled).toBe(false);
    expect(document.getElementById("clear-cache").disabled).toBe(true);
  });

  it("persists whether the Albert overlay is enabled", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const storage = createStorageMock({
      "settings:overlayEnabled": false,
    });

    await initPopup({ document, storage });
    const checkbox = document.getElementById("enable-overlay");

    expect(checkbox.checked).toBe(false);

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    await flushPromises();

    expect(storage.set).toHaveBeenCalledWith({ "settings:overlayEnabled": true });
  });

  it("keeps the overlay switch ARIA checked state synchronized", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <input id="enable-overlay" type="checkbox" role="switch" />
      <button id="clear-cache"></button>
    `;
    const storage = createStorageMock({
      "settings:overlayEnabled": false,
    });

    await initPopup({ document, storage });
    const checkbox = document.getElementById("enable-overlay");

    expect(checkbox.checked).toBe(false);
    expect(checkbox.getAttribute("aria-checked")).toBe("false");

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    await flushPromises();

    expect(checkbox.getAttribute("aria-checked")).toBe("true");
  });

  it("disables and marks the overlay toggle busy while saving the setting", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const storage = createStorageMock({
      "settings:overlayEnabled": false,
    });
    let resolveSave;
    storage.set.mockImplementationOnce(() => new Promise((resolve) => {
      resolveSave = resolve;
    }));

    await initPopup({ document, storage });
    const checkbox = document.getElementById("enable-overlay");

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));

    expect(checkbox.disabled).toBe(true);
    expect(checkbox.getAttribute("aria-busy")).toBe("true");
    expect(document.getElementById("status").textContent).toBe("Saving overlay setting");

    resolveSave();
    await flushPromises();

    expect(checkbox.disabled).toBe(false);
    expect(checkbox.getAttribute("aria-busy")).toBe("false");
    expect(document.getElementById("status").textContent).toBe("Ratings overlay enabled");
  });

  it("rolls back the overlay toggle when the setting cannot be saved", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const storage = createStorageMock({
      "settings:overlayEnabled": false,
    });
    storage.set.mockRejectedValueOnce(new Error("Storage unavailable"));

    await initPopup({ document, storage });
    const checkbox = document.getElementById("enable-overlay");

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change"));
    await flushPromises();

    expect(checkbox.checked).toBe(false);
    expect(document.getElementById("status").textContent).toBe("Overlay setting failed: Storage unavailable");
  });

  it("clears only cached rating lookups when the popup clear button is clicked", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const storage = createStorageMock({
      "professor:ada lovelace": { value: { name: "Ada Lovelace" } },
      "professor:grace hopper": { value: { name: "Grace Hopper" } },
      "settings:theme": "system",
    });
    const runtime = createRuntimeMock();

    await initPopup({ document, storage, runtime });
    document.getElementById("clear-cache").click();
    await flushPromises();

    expect(runtime.sendMessage).toHaveBeenCalledWith({ type: "NYU_RMP_CLEAR_CACHE" });
    expect(storage.remove).not.toHaveBeenCalled();
    expect(document.getElementById("status").textContent).toBe("2 cached rating lookups cleared");
  });

  it("disables and marks the clear button busy while cache clearing is in progress", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const storage = createStorageMock({
      "professor:ada lovelace": { value: { name: "Ada Lovelace" } },
    });
    let resolveClear;
    const runtime = {
      sendMessage: vi.fn(() => new Promise((resolve) => {
        resolveClear = resolve;
      })),
    };

    await initPopup({ document, storage, runtime });
    const clearButton = document.getElementById("clear-cache");
    clearButton.click();

    expect(clearButton.disabled).toBe(true);
    expect(clearButton.getAttribute("aria-busy")).toBe("true");
    expect(document.getElementById("status").textContent).toBe("Clearing cache");

    resolveClear({ ok: true, cleared: 1 });
    await flushPromises();

    expect(clearButton.disabled).toBe(true);
    expect(clearButton.getAttribute("aria-busy")).toBe("false");
    expect(document.getElementById("status").textContent).toBe("1 cached rating lookup cleared");
  });

  it("shows an inline error when the background cache clear fails", async () => {
    document.body.innerHTML = `
      <p id="status"></p>
      <input id="enable-overlay" type="checkbox" />
      <button id="clear-cache"></button>
    `;
    const storage = createStorageMock({
      "professor:ada lovelace": { value: { name: "Ada Lovelace" } },
    });
    const runtime = {
      sendMessage: vi.fn(async () => ({ ok: false, error: "Background unavailable" })),
    };

    await initPopup({ document, storage, runtime });
    const clearButton = document.getElementById("clear-cache");
    clearButton.click();
    await flushPromises();

    expect(document.getElementById("status").textContent).toBe("Cache clear failed: Background unavailable");
    expect(clearButton.disabled).toBe(false);
  });
});

function createStorageMock(initialData = {}) {
  return {
    data: { ...initialData },
    async get() {
      return { ...this.data };
    },
    remove: vi.fn(async function remove(keys) {
      for (const key of keys) {
        delete this.data[key];
      }
    }),
    set: vi.fn(async function set(items) {
      Object.assign(this.data, items);
    }),
  };
}

function createRuntimeMock() {
  return {
    sendMessage: vi.fn(async () => ({ ok: true, cleared: 2 })),
  };
}

function createTabsMock({ activeTab = null, contentStatus = null, sendError = null, sendResults = null } = {}) {
  const queuedResults = [...(sendResults ?? [])];
  return {
    query: vi.fn(async () => (activeTab ? [activeTab] : [])),
    sendMessage: vi.fn(async () => {
      if (queuedResults.length > 0) {
        const next = queuedResults.shift();
        if (next instanceof Error) {
          throw next;
        }
        return next;
      }
      if (sendError) {
        throw sendError;
      }
      return contentStatus;
    }),
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}
