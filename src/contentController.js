import { EXTENSION_VERSION } from "./shared/version.js";

const PROCESSED_CELL_LAYOUT_GUARD_PROPERTIES = [
  ["align-items", "flex-start"],
  ["flex-wrap", "wrap"],
  ["grid-template-columns", "minmax(0, 1fr)"],
  ["min-inline-size", "0"],
  ["min-width", "0"],
  ["overflow-wrap", "normal"],
  ["white-space", "normal"],
  ["word-break", "normal"],
];
const PROCESSED_CELL_CHILD_GUARD_PROPERTIES = [
  ["flex", "0 0 100%"],
  ["grid-column", "1 / -1"],
  ["min-inline-size", "0"],
  ["min-width", "0"],
  ["overflow-wrap", "normal"],
  ["white-space", "normal"],
  ["width", "100%"],
  ["word-break", "normal"],
];

export async function initContentScript({
  chrome = globalThis.chrome,
  document = globalThis.document,
  startAlbertRmpEnhancer,
  removeAlbertRmpEnhancements,
  repairAlbertRmpLayoutSafeguards = () => ({ repairedCount: 0 }),
  lookupProfessor,
} = {}) {
  markContentScriptLoaded(document);
  const settings = await readOverlaySettings(chrome);
  const staleLayoutMigration = migrateStaleCardLayout(document, removeAlbertRmpEnhancements);
  let observer = null;
  if (settings["settings:overlayEnabled"] !== false) {
    markOverlayState(document, "enabled");
    observer = startOverlay();
  } else {
    markOverlayState(document, "disabled");
  }

  chrome.storage.onChanged?.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes["settings:overlayEnabled"]) {
      return;
    }

    const enabled = changes["settings:overlayEnabled"].newValue !== false;
    if (enabled && !observer) {
      markOverlayState(document, "enabled");
      observer = startOverlay();
      return;
    }

    if (!enabled) {
      markOverlayState(document, "disabled");
      observer?.disconnect?.();
      observer = null;
      removeAlbertRmpEnhancements(document);
    }
  });
  chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
    if (message?.type === "NYU_RMP_CONTENT_STATUS") {
      sendResponse(contentStatusResponse(document));
      return false;
    }

    if (message?.type === "NYU_RMP_REPAIR_LAYOUT") {
      const beforeWarningCount = countProcessedCellLayoutWarnings(document);
      const repairResult = repairAlbertRmpLayoutSafeguards(document) ?? {};
      const afterWarningCount = countProcessedCellLayoutWarnings(document);
      markLayoutRepairResult(document, {
        repairedCount: nonNegativeInteger(repairResult.repairedCount),
        beforeWarningCount,
        afterWarningCount,
      });
      sendResponse({
        ok: true,
        repairedCount: nonNegativeInteger(repairResult.repairedCount),
        beforeWarningCount,
        afterWarningCount,
      });
      return false;
    }

    return false;
  });

  function startOverlay() {
    return startAlbertRmpEnhancer({
      lookupProfessor,
      enabled: true,
    });
  }
}

function contentStatusResponse(document) {
  const trailingRatingColumnStatus = ratingColumnStatusResponse(document);
  const staleCardCount = staleCardLayoutCount(document);
  return {
    ok: true,
    contentScript: document?.documentElement?.dataset.nyuRmpContentScript ?? "loaded",
    version: document?.documentElement?.dataset.nyuRmpVersion ?? EXTENSION_VERSION,
    overlayState: document?.documentElement?.dataset.nyuRmpOverlayState ?? "unknown",
    ratingRootCount: document?.querySelectorAll?.(".nyu-rmp-rating-root").length ?? 0,
    cardCount: document?.querySelectorAll?.(".nyu-rmp-card").length ?? 0,
    quickGridCount: document?.querySelectorAll?.(".nyu-rmp-quick-grid").length ?? 0,
    staleCardLayoutCount: staleCardCount,
    radarCount: document?.querySelectorAll?.(".nyu-rmp-radar").length ?? 0,
    processedCellCount: document?.querySelectorAll?.("[data-nyu-rmp-processed='true']").length ?? 0,
    ...trailingRatingColumnStatus,
    processedCellLayoutWarningCount: countProcessedCellLayoutWarnings(document),
    staleCardLayoutMigrationCount: nonNegativeInteger(document?.documentElement?.dataset.nyuRmpStaleCardLayoutMigrationCount),
    processedCellLastRepairCount: nonNegativeInteger(document?.documentElement?.dataset.nyuRmpLastLayoutRepairCount),
    processedCellLastRepairWarningCount: nonNegativeInteger(document?.documentElement?.dataset.nyuRmpLastLayoutRepairWarningCount),
    processedCellLastRepairRemainingWarningCount: nonNegativeInteger(document?.documentElement?.dataset.nyuRmpLastLayoutRepairRemainingWarningCount),
  };
}

function ratingColumnStatusResponse(document) {
  const ratingCellSelector = "[data-nyu-rmp-rating-cell='true']";
  const selectButtonRatingRootSelector = "[data-nyu-rmp-select-button-rating='true'] > .nyu-rmp-rating-root";
  return {
    ratingCellCount: document?.querySelectorAll?.(ratingCellSelector).length ?? 0,
    trailingRatingRootCount: document?.querySelectorAll?.(`${ratingCellSelector} > .nyu-rmp-rating-root`).length ?? 0,
    inlineProcessedRatingRootCount: document?.querySelectorAll?.("[data-nyu-rmp-processed='true'] > .nyu-rmp-rating-root").length ?? 0,
    selectButtonRatingRootCount: document?.querySelectorAll?.(selectButtonRatingRootSelector).length ?? 0,
  };
}

function migrateStaleCardLayout(document, removeAlbertRmpEnhancements) {
  const staleCardCount = staleCardLayoutCount(document);
  if (staleCardCount === 0) {
    if (document?.documentElement) {
      document.documentElement.dataset.nyuRmpStaleCardLayoutMigrationCount = "0";
    }
    return 0;
  }
  removeAlbertRmpEnhancements(document);
  if (document?.documentElement) {
    document.documentElement.dataset.nyuRmpStaleCardLayoutMigrationCount = String(staleCardCount);
  }
  return staleCardCount;
}

function staleCardLayoutCount(document) {
  return Array.from(document?.querySelectorAll?.(".nyu-rmp-card") ?? [])
    .filter(isStaleCardLayout).length;
}

function isStaleCardLayout(card) {
  if (card.dataset.nyuRmpVersion !== EXTENSION_VERSION) {
    return true;
  }
  if (card.classList.contains("is-loading")
    || card.classList.contains("is-empty")
    || card.classList.contains("is-error")) {
    return false;
  }
  return !card.querySelector(":scope > .nyu-rmp-quick-grid");
}

function markContentScriptLoaded(document) {
  if (document?.documentElement) {
    document.documentElement.dataset.nyuRmpContentScript = "loaded";
    document.documentElement.dataset.nyuRmpVersion = EXTENSION_VERSION;
  }
}

function markOverlayState(document, state) {
  if (document?.documentElement) {
    document.documentElement.dataset.nyuRmpOverlayState = state;
  }
}

function markLayoutRepairResult(document, { repairedCount, beforeWarningCount, afterWarningCount }) {
  if (!document?.documentElement) {
    return;
  }
  document.documentElement.dataset.nyuRmpLastLayoutRepairCount = String(repairedCount);
  document.documentElement.dataset.nyuRmpLastLayoutRepairWarningCount = String(beforeWarningCount);
  document.documentElement.dataset.nyuRmpLastLayoutRepairRemainingWarningCount = String(afterWarningCount);
}

async function readOverlaySettings(chrome) {
  try {
    return await chrome.storage.local.get("settings:overlayEnabled");
  } catch {
    return {};
  }
}

function countProcessedCellLayoutWarnings(document) {
  return Array.from(document?.querySelectorAll?.("[data-nyu-rmp-processed='true']") ?? [])
    .filter(isProcessedAlbertCell)
    .filter(hasProcessedCellLayoutWarning).length;
}

function isProcessedAlbertCell(element) {
  const tagName = element.tagName;
  const role = element.getAttribute?.("role")?.toLowerCase();
  return tagName === "TD" || tagName === "TH" || role === "cell" || role === "gridcell";
}

function hasProcessedCellLayoutWarning(element) {
  if (!hasRequiredInlineStyles(element, PROCESSED_CELL_LAYOUT_GUARD_PROPERTIES)) {
    return true;
  }

  const originalContent = element.querySelector?.(":scope > .nyu-rmp-albert-original");
  const ratingRoot = element.querySelector?.(":scope > .nyu-rmp-rating-root.is-cell-mounted");
  return [originalContent, ratingRoot]
    .filter(Boolean)
    .some((child) => !hasRequiredInlineStyles(child, PROCESSED_CELL_CHILD_GUARD_PROPERTIES));
}

function hasRequiredInlineStyles(element, properties) {
  return properties.every(([property, expectedValue]) => {
    const value = normalizeInlineStyleValue(property, element.style.getPropertyValue(property));
    const expected = normalizeInlineStyleValue(property, expectedValue);
    return value === expected && element.style.getPropertyPriority(property) === "important";
  });
}

function normalizeInlineStyleValue(property, value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if ((property === "min-inline-size" || property === "min-width") && normalized === "0px") {
    return "0";
  }
  return normalized;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}
