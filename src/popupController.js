import { EXTENSION_VERSION } from "./shared/version.js";

export async function initPopup({
  document = globalThis.document,
  storage = globalThis.chrome?.storage?.local,
  runtime = globalThis.chrome?.runtime,
  tabs = globalThis.chrome?.tabs,
  scripting = globalThis.chrome?.scripting,
} = {}) {
  const status = document.getElementById("status");
  const pageStatus = document.getElementById("page-status");
  const buildVersion = document.getElementById("build-version");
  const diagnosticSummary = document.getElementById("diagnostic-summary");
  const clearButton = document.getElementById("clear-cache");
  const copyDiagnosticsButton = document.getElementById("copy-diagnostics");
  const enableOverlay = document.getElementById("enable-overlay");
  if (!status || !storage) {
    return;
  }
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  if (pageStatus) {
    pageStatus.setAttribute("role", "status");
    pageStatus.setAttribute("aria-live", "polite");
    pageStatus.setAttribute("aria-atomic", "true");
  }
  if (buildVersion) {
    buildVersion.textContent = `Build v${EXTENSION_VERSION}`;
  }
  setDiagnosticSummary(diagnosticSummary, formatDiagnosticSummary());

  let settings;
  try {
    settings = await storage.get("settings:overlayEnabled");
  } catch (error) {
    status.textContent = `Popup unavailable: ${error.message}`;
    if (enableOverlay) {
      enableOverlay.disabled = true;
    }
    if (clearButton) {
      clearButton.disabled = true;
    }
    return;
  }

  const overlayEnabled = settings["settings:overlayEnabled"] !== false;
  if (enableOverlay) {
    enableOverlay.checked = overlayEnabled;
    syncSwitchState(enableOverlay);
    enableOverlay.addEventListener("change", async () => {
      const nextValue = enableOverlay.checked;
      syncSwitchState(enableOverlay);
      enableOverlay.disabled = true;
      enableOverlay.setAttribute("aria-busy", "true");
      status.textContent = "Saving overlay setting";
      try {
        await storage.set({ "settings:overlayEnabled": nextValue });
        status.textContent = nextValue ? "Ratings overlay enabled" : "Ratings overlay disabled";
      } catch (error) {
        enableOverlay.checked = !nextValue;
        syncSwitchState(enableOverlay);
        status.textContent = `Overlay setting failed: ${error.message}`;
      } finally {
        enableOverlay.disabled = false;
        enableOverlay.setAttribute("aria-busy", "false");
      }
    });
  }

  async function refreshStatus() {
    try {
      const cached = await getProfessorCacheKeys(storage);
      status.textContent = formatCacheCountStatus(cached.length);
      if (clearButton) {
        clearButton.disabled = cached.length === 0;
      }
      return cached;
    } catch (error) {
      status.textContent = `Cache status unavailable: ${error.message}`;
      if (clearButton) {
        clearButton.disabled = true;
      }
      return [];
    }
  }

  if (clearButton) {
    clearButton.addEventListener("click", async () => {
      clearButton.disabled = true;
      clearButton.setAttribute("aria-busy", "true");
      status.textContent = "Clearing cache";
      try {
        let clearedCount = 0;
        if (runtime?.sendMessage) {
          const response = await runtime.sendMessage({ type: "NYU_RMP_CLEAR_CACHE" });
          if (!response?.ok) {
            throw new Error(response?.error ?? "Cache clear failed");
          }
          clearedCount = nonNegativeInteger(response.cleared);
        } else {
          const cached = await getProfessorCacheKeys(storage);
          clearedCount = cached.length;
          if (cached.length > 0) {
            await storage.remove(cached);
          }
        }
        status.textContent = formatCacheClearedStatus(clearedCount);
        clearButton.disabled = true;
      } catch (error) {
        status.textContent = `Cache clear failed: ${error.message}`;
        clearButton.disabled = false;
      } finally {
        clearButton.setAttribute("aria-busy", "false");
      }
    });
  }

  if (copyDiagnosticsButton) {
    copyDiagnosticsButton.addEventListener("click", async () => {
      copyDiagnosticsButton.disabled = true;
      copyDiagnosticsButton.setAttribute("aria-busy", "true");
      try {
        const diagnosticText = formatDiagnosticsClipboardText({
          diagnosticSummary,
          pageStatus,
        });
        await writeClipboardText(diagnosticText, { navigator: globalThis.navigator });
        status.textContent = "Diagnostics copied";
      } catch (error) {
        status.textContent = `Diagnostics copy failed: ${error.message}`;
      } finally {
        copyDiagnosticsButton.disabled = false;
        copyDiagnosticsButton.setAttribute("aria-busy", "false");
      }
    });
  }

  await refreshStatus();
  await refreshAlbertPageStatus({ pageStatus, diagnosticSummary, tabs, scripting });
}

async function getProfessorCacheKeys(storage) {
  const items = await storage.get(null);
  return Object.keys(items ?? {}).filter((key) => key.startsWith("professor:"));
}

function syncSwitchState(input) {
  if (input?.getAttribute("role") === "switch") {
    input.setAttribute("aria-checked", String(input.checked));
  }
}

function formatCacheClearedStatus(count) {
  return count === 1
    ? "1 cached rating lookup cleared"
    : `${count} cached rating lookups cleared`;
}

function formatCacheCountStatus(count) {
  return count === 1
    ? "1 rating lookup cached"
    : `${count} rating lookups cached`;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

async function refreshAlbertPageStatus({ pageStatus, diagnosticSummary, tabs, scripting }) {
  if (!pageStatus) {
    return;
  }
  if (!tabs?.query || !tabs?.sendMessage) {
    setPageStatus(pageStatus, "Open Albert to check page connection.", "idle");
    setDiagnosticSummary(diagnosticSummary, formatDiagnosticSummary());
    return;
  }

  try {
    const [activeTab] = await tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id || !isAlbertUrl(activeTab.url)) {
      setPageStatus(pageStatus, "Open an Albert tab to check page connection.", "idle");
      setDiagnosticSummary(diagnosticSummary, formatDiagnosticSummary());
      return;
    }

    const response = await pingAlbertContentScript(tabs, activeTab.id);
    if (isLoadedContentResponse(response)) {
      const refreshedResponse = await refreshAlbertContentScriptIfStale({
        tabs,
        scripting,
        tabId: activeTab.id,
        response,
      });
      const repairedResponse = await repairAlbertLayoutWarningsIfNeeded(tabs, activeTab.id, refreshedResponse);
      setPageStatus(pageStatus, formatAlbertConnectedStatus(repairedResponse), albertPageStatusState(repairedResponse));
      setDiagnosticSummary(diagnosticSummary, formatDiagnosticSummary(repairedResponse));
      return;
    }

    const wakeResponse = await wakeAlbertContentScript({ tabs, scripting, tabId: activeTab.id });
    if (!isLoadedContentResponse(wakeResponse)) {
      setPageStatus(pageStatus, "Albert not connected. Reload the extension, then refresh Albert.", "warning");
      setDiagnosticSummary(diagnosticSummary, formatDiagnosticSummary());
      return;
    }

    const repairedWakeResponse = await repairAlbertLayoutWarningsIfNeeded(tabs, activeTab.id, wakeResponse);
    setPageStatus(pageStatus, formatAlbertConnectedStatus(repairedWakeResponse), albertPageStatusState(repairedWakeResponse));
    setDiagnosticSummary(diagnosticSummary, formatDiagnosticSummary(repairedWakeResponse));
  } catch {
    setPageStatus(pageStatus, "Albert not connected. Reload the extension, then refresh Albert.", "warning");
    setDiagnosticSummary(diagnosticSummary, formatDiagnosticSummary());
  }
}

async function refreshAlbertContentScriptIfStale({ tabs, scripting, tabId, response }) {
  if (!shouldRefreshAlbertContentScript(response)) {
    return response;
  }
  if (!scripting?.executeScript) {
    return response;
  }
  const wakeResponse = await wakeAlbertContentScript({ tabs, scripting, tabId });
  if (!isLoadedContentResponse(wakeResponse)) {
    return {
      ...response,
      contentScriptRefreshAttempted: true,
    };
  }
  return {
    ...wakeResponse,
    contentScriptRefreshAttempted: true,
    staleBeforeRefresh: {
      version: response.version,
      cardCount: response.cardCount,
      quickGridCount: response.quickGridCount,
    },
  };
}

async function pingAlbertContentScript(tabs, tabId) {
  try {
    return await tabs.sendMessage(tabId, { type: "NYU_RMP_CONTENT_STATUS" });
  } catch {
    return null;
  }
}

async function repairAlbertLayoutWarningsIfNeeded(tabs, tabId, response) {
  if (!hasProcessedCellLayoutWarnings(response)) {
    return response;
  }
  try {
    await tabs.sendMessage(tabId, { type: "NYU_RMP_REPAIR_LAYOUT" });
    const repairedResponse = await pingAlbertContentScript(tabs, tabId);
    if (!isLoadedContentResponse(repairedResponse)) {
      return response;
    }
    return {
      ...repairedResponse,
      processedCellLayoutRepairAttempted: true,
      processedCellLayoutWarningCountBeforeRepair: nonNegativeInteger(response.processedCellLayoutWarningCount),
    };
  } catch {
    return response;
  }
}

async function wakeAlbertContentScript({ tabs, scripting, tabId }) {
  if (!scripting?.executeScript) {
    return null;
  }
  await scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ["content.js"],
  });
  return pingAlbertContentScript(tabs, tabId);
}

function isLoadedContentResponse(response) {
  return response?.ok && response.contentScript === "loaded";
}

function setPageStatus(pageStatus, message, state) {
  pageStatus.textContent = message;
  pageStatus.dataset.state = state;
}

function setDiagnosticSummary(diagnosticSummary, message) {
  if (diagnosticSummary) {
    diagnosticSummary.textContent = message;
  }
}

function isAlbertUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:"
      && ["albert.nyu.edu", "sis.nyu.edu", "sis.portal.nyu.edu"].includes(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function formatAlbertConnectedStatus(response) {
  const ratingRootCount = nonNegativeInteger(response.ratingRootCount);
  const cardCount = nonNegativeInteger(response.cardCount);
  const quickGridCount = nonNegativeInteger(response.quickGridCount);
  const radarCount = nonNegativeInteger(response.radarCount);
  const processedCellCount = nonNegativeInteger(response.processedCellCount);
  const processedCellLayoutWarningCount = nonNegativeInteger(response.processedCellLayoutWarningCount);
  const staleCardLayoutMigrationCount = nonNegativeInteger(response.staleCardLayoutMigrationCount);
  const ratingColumnLabel = formatRatingColumnLabel(response);
  const ratingRootLabel = ratingRootCount === 1 ? "1 rating root" : `${ratingRootCount} rating roots`;
  const cardLabel = cardCount === 1 ? "1 card" : `${cardCount} cards`;
  const radarLabel = radarCount === 1 ? "1 radar map" : `${radarCount} radar maps`;
  const processedCellLabel = processedCellCount === 1
    ? "1 Albert cell checked"
    : `${processedCellCount} Albert cells checked`;
  const layoutWarningLabel = formatLayoutWarningLabel(response, processedCellLayoutWarningCount);
  const quickGridLabel = formatQuickGridLabel(cardCount, quickGridCount);
  const migrationLabel = formatStaleCardLayoutMigrationLabel(staleCardLayoutMigrationCount);
  const renderedSummary = [ratingRootLabel, cardLabel, quickGridLabel, radarLabel, processedCellLabel, ratingColumnLabel, layoutWarningLabel, migrationLabel].filter(Boolean).join(", ");
  const versionLabel = formatVersionLabel(response.version);
  const refreshLabel = response.contentScriptRefreshAttempted ? " Current content script rechecked." : "";
  if (isStaleContentVersion(response.version)) {
    return `Albert connected${versionLabel}; popup v${EXTENSION_VERSION}.${refreshLabel} Reload the extension, then refresh Albert. ${renderedSummary}`;
  }
  if (hasStaleQuickGridShape(response)) {
    return `Albert connected${versionLabel}; old squeezed card layout detected.${refreshLabel} Reload the extension, then refresh Albert. ${renderedSummary}`;
  }
  if (response.overlayState === "disabled") {
    return `Albert connected${versionLabel}; overlay disabled.${refreshLabel} ${renderedSummary}`;
  }
  return `Albert connected${versionLabel}:${refreshLabel} ${renderedSummary}`;
}

function albertPageStatusState(response) {
  return isStaleContentVersion(response.version)
    || hasStaleQuickGridShape(response)
    || hasRatingColumnWarnings(response)
    || hasProcessedCellLayoutWarnings(response)
    ? "warning"
    : "connected";
}

function formatRatingColumnLabel(response) {
  if (!hasRatingColumnDiagnostics(response)) {
    return "";
  }
  const ratingCellCount = nonNegativeInteger(response.ratingCellCount);
  const trailingRatingRootCount = nonNegativeInteger(response.trailingRatingRootCount);
  const inlineProcessedRatingRootCount = nonNegativeInteger(response.inlineProcessedRatingRootCount);
  const selectButtonRatingRootCount = nonNegativeInteger(response.selectButtonRatingRootCount);
  const unexpectedInlineRatingRootCount = Math.max(0, inlineProcessedRatingRootCount - selectButtonRatingRootCount);
  const ratingCellLabel = ratingCellCount === 1
    ? "1 trailing rating column"
    : `${ratingCellCount} trailing rating columns`;
  const selectButtonLabel = selectButtonRatingRootCount > 0
    ? `${selectButtonRatingRootCount} under-button ${selectButtonRatingRootCount === 1 ? "rating" : "ratings"}`
    : "";
  if (unexpectedInlineRatingRootCount > 0) {
    return [ratingCellLabel, selectButtonLabel, `${unexpectedInlineRatingRootCount} inline ${unexpectedInlineRatingRootCount === 1 ? "rating root" : "rating roots"}`].filter(Boolean).join(", ");
  }
  if (ratingCellCount > 0 && trailingRatingRootCount < ratingCellCount) {
    return [ratingCellLabel, selectButtonLabel, `${ratingCellCount - trailingRatingRootCount} empty ${ratingCellCount - trailingRatingRootCount === 1 ? "rating column" : "rating columns"}`].filter(Boolean).join(", ");
  }
  return [ratingCellLabel, selectButtonLabel].filter(Boolean).join(", ");
}

function formatQuickGridLabel(cardCount, quickGridCount) {
  if (cardCount === 0) {
    return "";
  }
  return quickGridCount === 1
    ? "1 segmented quick view"
    : `${quickGridCount} segmented quick views`;
}

function formatStaleCardLayoutMigrationLabel(count) {
  if (count === 0) {
    return "";
  }
  return count === 1
    ? "1 stale card layout migrated"
    : `${count} stale card layouts migrated`;
}

function formatLayoutWarningLabel(response, processedCellLayoutWarningCount) {
  if (processedCellLayoutWarningCount === 0 && response?.processedCellLayoutRepairAttempted) {
    const repairedCount = nonNegativeInteger(response.processedCellLayoutWarningCountBeforeRepair);
    if (repairedCount > 0) {
      return `${repairedCount} layout ${repairedCount === 1 ? "warning" : "warnings"} repaired`;
    }
  }
  if (processedCellLayoutWarningCount === 0) {
    const lastRepairWarningCount = nonNegativeInteger(response?.processedCellLastRepairWarningCount);
    const lastRepairCount = nonNegativeInteger(response?.processedCellLastRepairCount);
    if (lastRepairWarningCount > 0 && lastRepairCount > 0) {
      return `layout OK; last repair ${lastRepairCount} ${lastRepairCount === 1 ? "cell" : "cells"}`;
    }
  }
  return processedCellLayoutWarningCount === 0
    ? "layout OK"
    : formatActiveLayoutWarningLabel(response, processedCellLayoutWarningCount);
}

function formatActiveLayoutWarningLabel(response, processedCellLayoutWarningCount) {
  const remainingRepairWarningCount = nonNegativeInteger(response?.processedCellLastRepairRemainingWarningCount);
  const lastRepairWarningCount = nonNegativeInteger(response?.processedCellLastRepairWarningCount);
  if (remainingRepairWarningCount > 0 && lastRepairWarningCount > 0) {
    return `${processedCellLayoutWarningCount} layout ${processedCellLayoutWarningCount === 1 ? "warning remains" : "warnings remain"} after repair`;
  }
  return `${processedCellLayoutWarningCount} layout ${processedCellLayoutWarningCount === 1 ? "warning" : "warnings"}`;
}

function isStaleContentVersion(version) {
  const normalized = String(version ?? "").trim();
  return normalized !== EXTENSION_VERSION;
}

function hasProcessedCellLayoutWarnings(response) {
  return nonNegativeInteger(response?.processedCellLayoutWarningCount) > 0;
}

function hasRatingColumnWarnings(response) {
  if (!hasRatingColumnDiagnostics(response)) {
    return false;
  }
  const cardCount = nonNegativeInteger(response?.cardCount);
  const processedCellCount = nonNegativeInteger(response?.processedCellCount);
  const ratingCellCount = nonNegativeInteger(response?.ratingCellCount);
  const trailingRatingRootCount = nonNegativeInteger(response?.trailingRatingRootCount);
  const inlineProcessedRatingRootCount = nonNegativeInteger(response?.inlineProcessedRatingRootCount);
  const selectButtonRatingRootCount = nonNegativeInteger(response?.selectButtonRatingRootCount);
  const unexpectedInlineRatingRootCount = Math.max(0, inlineProcessedRatingRootCount - selectButtonRatingRootCount);
  if (cardCount === 0 || processedCellCount === 0 || response?.overlayState === "disabled") {
    return unexpectedInlineRatingRootCount > 0;
  }
  return unexpectedInlineRatingRootCount > 0
    || (ratingCellCount === 0 && selectButtonRatingRootCount === 0)
    || trailingRatingRootCount < ratingCellCount;
}

function hasStaleQuickGridShape(response) {
  const cardCount = nonNegativeInteger(response?.cardCount);
  if (cardCount === 0 || response?.overlayState === "disabled") {
    return false;
  }
  return nonNegativeInteger(response?.quickGridCount) < cardCount;
}

function shouldRefreshAlbertContentScript(response) {
  return isStaleContentVersion(response?.version) || hasStaleQuickGridShape(response) || hasRatingColumnWarnings(response);
}

function formatVersionLabel(version) {
  const normalized = String(version ?? "").trim();
  return normalized ? ` v${normalized}` : "";
}

function formatDiagnosticSummary(response = null) {
  if (!response) {
    return `Build v${EXTENSION_VERSION} | Albert not verified`;
  }
  const version = String(response.version ?? "").trim() || "missing";
  const cardCount = nonNegativeInteger(response.cardCount);
  const quickGridCount = nonNegativeInteger(response.quickGridCount);
  const processedCellCount = nonNegativeInteger(response.processedCellCount);
  const ratingCellCount = nonNegativeInteger(response.ratingCellCount);
  const selectButtonRatingRootCount = nonNegativeInteger(response.selectButtonRatingRootCount);
  const ratingColumnSummary = hasRatingColumnDiagnostics(response)
    ? ` | ${ratingCellCount} rating columns${selectButtonRatingRootCount > 0 ? ` | ${selectButtonRatingRootCount} under-button ratings` : ""}`
    : "";
  return `Build v${EXTENSION_VERSION} | Albert ${version} | ${cardCount} cards | ${quickGridCount} quick views | ${processedCellCount} cells${ratingColumnSummary}`;
}

function hasRatingColumnDiagnostics(response) {
  return Object.hasOwn(response ?? {}, "ratingCellCount")
    || Object.hasOwn(response ?? {}, "trailingRatingRootCount")
    || Object.hasOwn(response ?? {}, "inlineProcessedRatingRootCount")
    || Object.hasOwn(response ?? {}, "selectButtonRatingRootCount");
}

function formatDiagnosticsClipboardText({ diagnosticSummary, pageStatus }) {
  return [
    "NYU Albert RMP Ratings diagnostics",
    String(diagnosticSummary?.textContent ?? formatDiagnosticSummary()).trim(),
    `Page status: ${String(pageStatus?.textContent ?? "unavailable").trim()}`,
  ].join("\n");
}

async function writeClipboardText(text, { navigator = globalThis.navigator } = {}) {
  if (!navigator?.clipboard?.writeText) {
    throw new Error("clipboard unavailable");
  }
  await navigator.clipboard.writeText(text);
}
