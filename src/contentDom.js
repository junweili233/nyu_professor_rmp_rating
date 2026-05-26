import { extractInstructorNamesFromText, isLikelyInstructorName, normalizeInstructorName, splitInstructorList } from "./shared/albertParser.js";

const ROOT_CLASS = "nyu-rmp-rating-root";
const STYLE_ID = "nyu-rmp-rating-styles";
const COMMENT_PREVIEW_LENGTH = 150;
const MAX_RENDERED_COMMENTS = 3;
const RMP_COMMENT_SAMPLE_SIZE = 20;
const MIN_CONFIDENT_RATING_COUNT = 5;
const PLACEHOLDER_COMMENT_TEXT = new Set(["n/a", "na", "none", "no comment", "no comments", "no comments yet"]);
const COURSE_CODE_PATTERN = /\b([A-Z]{2,5}-[A-Z]{2}[.\-\s]*\d{3,4})\b/i;
const SPACED_COURSE_CODE_PATTERN = /\b([A-Z]{2,5}\s+[A-Z]{2}\s*0?\d{3,4})\b/i;
const COMPACT_COURSE_CODE_PATTERN = /\b([A-Z]{2,5}[A-Z]{2}0?\d{3,4})\b/i;
const CSCI_SHORTHAND_COURSE_CODE_PATTERN = /\b(CSCI[-\s]*0?\d{3,4})\b/i;
const CS_SHORTHAND_COURSE_CODE_PATTERN = /\b(CS[-\s]*0?\d{3,4})\b/i;
const COURSE_TITLE_CODE_ALIASES = [
  { pattern: /\bcomputer\s+systems?\s+organization\b/i, code: "CSCI-UA 201" },
  { pattern: /\bcomputer\s+systems?\s+org\.?\b/i, code: "CSCI-UA 201" },
  { pattern: /\bCSO\b/i, code: "CSCI-UA 201" },
];
const CONTROLLED_OPTION_SELECTOR = "[role='option'], [aria-selected], [aria-checked], [aria-current], [aria-pressed], [data-selected], [data-active], [data-checked], [data-current], [data-focus], [data-focused], [data-highlighted], [data-pressed], [data-state], [selected], [class]";
const ALBERT_OBSERVER_OPTIONS = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: [
    "aria-colindex",
    "aria-activedescendant",
    "aria-checked",
    "aria-controls",
    "aria-current",
    "aria-describedby",
    "aria-hidden",
    "aria-label",
    "aria-labelledby",
    "aria-owns",
    "aria-pressed",
    "aria-selected",
    "aria-value",
    "aria-valuetext",
    "class",
    "data-automation-id",
    "data-automationid",
    "data-active",
    "data-active-label",
    "data-active-name",
    "data-active-text",
    "data-active-value",
    "data-caption",
    "data-checked",
    "data-col",
    "data-col-id",
    "data-col-label",
    "data-col-name",
    "data-col-title",
    "data-colid",
    "data-colname",
    "data-content",
    "data-column",
    "data-column-id",
    "data-column-label",
    "data-column-name",
    "data-column-title",
    "data-columnname",
    "data-columnid",
    "data-current",
    "data-cy",
    "data-description",
    "data-display",
    "data-display-name",
    "data-displayname",
    "data-e2e",
    "data-faculty-label",
    "data-faculty-name",
    "data-faculty-text",
    "data-field",
    "data-field-id",
    "data-field-label",
    "data-field-key",
    "data-field-name",
    "data-fieldid",
    "data-fieldname",
    "data-focus",
    "data-focused",
    "data-fld",
    "data-fld-id",
    "data-fld-label",
    "data-fld-name",
    "data-fldid",
    "data-fldname",
    "data-full-name",
    "data-fullname",
    "data-full-text",
    "data-ps-field-id",
    "data-ps-field-name",
    "data-header",
    "data-heading",
    "data-highlighted",
    "data-highlighted-label",
    "data-highlighted-name",
    "data-instructor-label",
    "data-instructor-name",
    "data-instructor-text",
    "data-item-label",
    "data-item-text",
    "data-key",
    "data-label",
    "data-name",
    "data-option-label",
    "data-option-text",
    "data-original-title",
    "data-person-label",
    "data-person-name",
    "data-person-text",
    "data-pnlfld",
    "data-pnlfldid",
    "data-pnlfldname",
    "data-professor-label",
    "data-professor-name",
    "data-professor-text",
    "data-ps-column-id",
    "data-ps-column-name",
    "data-ps-columnid",
    "data-ps-columnname",
    "data-ps-fieldid",
    "data-ps-fieldname",
    "data-pressed",
    "data-qa",
    "data-search",
    "data-selected",
    "data-selected-label",
    "data-selected-name",
    "data-selected-text",
    "data-selected-value",
    "data-slot",
    "data-state",
    "data-test-id",
    "data-testid",
    "data-teacher-label",
    "data-teacher-name",
    "data-teacher-text",
    "data-text",
    "data-title",
    "data-tooltip",
    "data-value",
    "headers",
    "hidden",
    "id",
    "inert",
    "name",
    "role",
    "selected",
    "slot",
    "style",
    "title",
    "value",
  ],
};
let nextCardId = 0;

export function startAlbertRmpEnhancer({
  document = globalThis.document,
  window = globalThis.window,
  lookupProfessor,
  enabled = true,
} = {}) {
  if (!enabled || !isAlbertWindow(window)) {
    return null;
  }

  injectStyles(document);
  scanAlbertPageOnce({ document, lookupProfessor });

  let observer;
  let scanTimer = null;
  const scheduleScan = () => {
    if (scanTimer !== null) {
      return;
    }
    const runScan = () => {
      scanTimer = null;
      scanAlbertPageOnce({ document, lookupProfessor });
    };
    if (typeof window.requestAnimationFrame === "function") {
      scanTimer = window.requestAnimationFrame(runScan);
    } else {
      scanTimer = window.setTimeout(runScan, 0);
    }
  };

  observer = new window.MutationObserver(scheduleScan);

  observer.observe(document.body, ALBERT_OBSERVER_OPTIONS);
  document.addEventListener("input", scheduleScan, true);
  document.addEventListener("change", scheduleScan, true);
  const disconnectObserver = observer.disconnect?.bind(observer) ?? (() => {});
  observer.disconnect = () => {
    if (scanTimer !== null) {
      if (typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(scanTimer);
      } else {
        window.clearTimeout(scanTimer);
      }
      scanTimer = null;
    }
    document.removeEventListener("input", scheduleScan, true);
    document.removeEventListener("change", scheduleScan, true);
    disconnectObserver();
  };
  return observer;
}

function isAlbertWindow(window) {
  return candidateFrameLocations(window).some(isAlbertPage);
}

function candidateFrameLocations(window) {
  return [window, safeFrameWindow(window, "parent"), safeFrameWindow(window, "top")]
    .filter(Boolean)
    .map((frameWindow) => safeFrameLocation(frameWindow))
    .filter(Boolean);
}

function safeFrameWindow(window, property) {
  try {
    return window?.[property] ?? null;
  } catch {
    return null;
  }
}

function safeFrameLocation(window) {
  try {
    return window?.location ?? null;
  } catch {
    return null;
  }
}

function isAlbertPage(location) {
  const hostname = String(location?.hostname ?? "").toLowerCase();
  const pathname = String(location?.pathname ?? "").toLowerCase();
  return hostname === "albert.nyu.edu"
    || hostname === "sis.nyu.edu"
    || hostname.startsWith("albert.")
    || pathname.includes("albert");
}

export function scanAlbertPageOnce({ document = globalThis.document, lookupProfessor }) {
  if (!lookupProfessor) {
    throw new Error("lookupProfessor is required");
  }

  injectStyles(document);
  const targets = findInstructorTargets(document);
  const cachedLookupProfessor = createScanLookupCache(lookupProfessor);
  const pendingLookups = targets.flatMap((target) =>
    mountRatings({ ...target, document, lookupProfessor: cachedLookupProfessor }),
  );
  return { targets, pendingLookups };
}

export function removeAlbertRmpEnhancements(document = globalThis.document) {
  for (const root of document.querySelectorAll(`.${ROOT_CLASS}`)) {
    root.remove();
  }

  for (const element of document.querySelectorAll("[data-nyu-rmp-processed]")) {
    delete element.dataset.nyuRmpProcessed;
  }
}

function createScanLookupCache(lookupProfessor) {
  const lookups = new Map();
  return (name, options = {}) => {
    if (options.forceRefresh) {
      return lookupProfessor(name, options);
    }

    const key = compactName(name);
    if (!lookups.has(key)) {
      lookups.set(key, lookupProfessor(name));
    }
    return lookups.get(key);
  };
}

export function findInstructorTargets(document = globalThis.document) {
  const candidates = Array.from(document.querySelectorAll("td, th, dt, dd, div, span, li, p, section, article, h1, h2, h3, h4, h5, h6, a, button, [role='button'], [role='cell'], [role='gridcell'], label, strong, b, input, textarea, select, [data-instructor-name]"))
    .filter(isUnprocessedVisibleCandidate)
    .flatMap((element) => findInstructorTargetsForElement(element));

  return preferMostSpecificTargets(candidates);
}

function findInstructorTargetsForElement(element) {
  const markedNames = instructorNamesFromElementMarker(element);
  if (markedNames.length > 0) {
    return [{ element, names: markedNames }];
  }

  const formControlNames = instructorNamesFromFormControl(element);
  if (formControlNames.length > 0) {
    return [{ element, names: formControlNames }];
  }

  const ariaValueControlNames = instructorNamesFromAriaValueControl(element);
  if (ariaValueControlNames.length > 0) {
    return [{ element, names: ariaValueControlNames }];
  }

  const headeredCellNames = instructorNamesFromHeaderedCell(element);
  if (headeredCellNames.length > 0) {
    return [{ element, names: headeredCellNames }];
  }

  const text = visibleTextSegments(element).join("\n");
  if (hasInstructorText(text) && text.length < 700) {
    const names = extractInstructorNamesFromText(text);
    if (names.length > 0) {
      return [{ element, names }];
    }
  }

  if (isInstructorLabel(text)) {
    const adjacentTarget = findAdjacentInstructorTarget(element);
    return adjacentTarget ? [adjacentTarget] : [];
  }

  return [];
}

function hasInstructorText(text) {
  return /\b(?:(?:primary\s+)?(?:instructor(?:\(s\)|s)?(?:\s+name(?:\(s\)|s)?)?|instr\.?(?:\(s\)|s)?(?:\s+name(?:\(s\)|s)?)?)|professor(?:\s+name(?:\(s\)|s)?)?|prof\.?(?:\s+name(?:\(s\)|s)?)?|faculty(?:\s+name(?:\(s\)|s)?)?|teacher(?:s)?(?:\s+name(?:\(s\)|s)?)?|taught\s+by)(?:\s*(?::|\.|-|\u2013|\u2014)|\s+\S)/i.test(text)
    || /(?:^|\n)\s*(?:(?:primary\s+)?(?:instructor(?:\(s\)|s)?(?:\s+name(?:\(s\)|s)?)?|instr\.?(?:\(s\)|s)?(?:\s+name(?:\(s\)|s)?)?)|professor(?:\s+name(?:\(s\)|s)?)?|prof\.?(?:\s+name(?:\(s\)|s)?)?|faculty(?:\s+name(?:\(s\)|s)?)?|teacher(?:s)?(?:\s+name(?:\(s\)|s)?)?|taught\s+by)\s*(?:\n|$)/i.test(text);
}

function isUnprocessedVisibleCandidate(element) {
  return element.dataset.nyuRmpProcessed !== "true" && !element.closest(`.${ROOT_CLASS}`) && isElementVisible(element);
}

function isElementVisible(element) {
  return !hasHiddenAttribute(element) && !hasHiddenInlineStyle(element);
}

function hasHiddenAttribute(element) {
  for (let node = element; node; node = node.parentElement) {
    if (node.hasAttribute("hidden")
      || node.hasAttribute("inert")
      || node.getAttribute("aria-hidden")?.trim().toLowerCase() === "true") {
      return true;
    }
  }
  return false;
}

function hasHiddenInlineStyle(element) {
  for (let node = element; node; node = node.parentElement) {
    const inlineStyle = node.style;
    if (isHiddenStyle(inlineStyle) || isHiddenStyle(computedStyleFor(node))) {
      return true;
    }
  }
  return false;
}

function computedStyleFor(element) {
  return element.ownerDocument?.defaultView?.getComputedStyle?.(element) ?? null;
}

function isHiddenStyle(style) {
  return style?.display === "none"
    || style?.visibility === "hidden"
    || style?.visibility === "collapse"
    || style?.contentVisibility === "hidden"
    || style?.opacity === "0"
    || isZeroSizeOverflowHidden(style);
}

function isZeroSizeOverflowHidden(style) {
  const width = parseCssPixelValue(style?.width);
  const height = parseCssPixelValue(style?.height);
  return width === 0 && height === 0 && /hidden|clip/i.test(`${style?.overflow ?? ""} ${style?.overflowX ?? ""} ${style?.overflowY ?? ""}`);
}

function parseCssPixelValue(value) {
  const match = String(value ?? "").trim().match(/^(-?\d+(?:\.\d+)?)px$/i);
  return match ? Number(match[1]) : null;
}

function isInstructorLabel(text) {
  const normalizedText = normalizeLabelText(text);
  return /^(?:(?:primary\s+)?(?:instructor|instr\.?)(?:\(s\)|s)?(?:\s+name(?:\(s\)|s)?)?|professor(?:\s+name(?:\(s\)|s)?)?|prof\.?(?:\s+name(?:\(s\)|s)?)?|faculty(?:\s+name(?:\(s\)|s)?)?|teacher(?:s)?(?:\s+name(?:\(s\)|s)?)?|taught\s+by)\s*(?::|\.|-|\u2013|\u2014)?$/i.test(normalizedText);
}

function normalizeLabelText(text) {
  return String(text ?? "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findAdjacentInstructorTarget(element) {
  const candidateElements = [
    findNextVisibleInstructorSibling(element),
    element.parentElement?.querySelector("[data-instructor-name]"),
  ].filter((candidate) => candidate && isElementVisible(candidate));

  for (const nameElement of candidateElements) {
    const names = instructorNameSegments(nameElement)
      .flatMap(splitInstructorList)
      .filter(isLikelyInstructorName)
      .map(normalizeInstructorName)
      .filter(Boolean);
    if (names.length > 0) {
      return { element: nameElement, processedElements: [element, nameElement], names };
    }
  }

  return null;
}

function findNextVisibleInstructorSibling(element) {
  for (let sibling = element.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
    if (!isElementVisible(sibling)) {
      continue;
    }
    if (isBroadGridContainer(sibling)) {
      continue;
    }
    const segments = visibleTextSegments(sibling);
    if (segments.length > 0
      && !segments.every(isInstructorSeparatorOnlyText)
      && instructorNameSegments(sibling).flatMap(splitInstructorList).some(isLikelyInstructorName)) {
      return sibling;
    }
  }
  return null;
}

function isBroadGridContainer(element) {
  return element.tagName === "TABLE" || ["grid", "table", "treegrid"].includes(element.getAttribute("role")?.trim().toLowerCase());
}

function isInstructorSeparatorOnlyText(value) {
  return /^(?::|\.|-|\u2013|\u2014)+$/.test(value.trim());
}

function visibleTextSegments(element) {
  return textForParsing(element)
    .split(/\n+/)
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function instructorNameSegments(element) {
  const markedName = element.getAttribute("data-instructor-name")?.trim();
  const attributeName = markedName || firstNameLikeAttribute(element);
  return attributeName ? [attributeName] : visibleTextSegments(element);
}

function instructorNamesFromElementMarker(element) {
  const markedName = element.getAttribute("data-instructor-name")?.trim();
  if (!markedName) {
    return [];
  }

  return [markedName]
    .flatMap(splitInstructorList)
    .filter(isLikelyInstructorName)
    .map(normalizeInstructorName)
    .filter(Boolean);
}

function instructorNamesFromFormControl(element) {
  if (!isNamedFormControl(element) || !isInstructorLabeledFormControl(element)) {
    return [];
  }

  const value = formControlValue(element);
  if (!value) {
    return [];
  }

  return [value]
    .flatMap(splitInstructorList)
    .filter(isLikelyInstructorName)
    .map(normalizeInstructorName)
    .filter(Boolean);
}

function isNamedFormControl(element) {
  return ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName);
}

function instructorNamesFromAriaValueControl(element) {
  if (!isInstructorLabeledAriaValueControl(element)) {
    return [];
  }

  return ariaValueControlSegments(element)
    .flatMap(splitInstructorList)
    .filter(isLikelyInstructorName)
    .map(normalizeInstructorName)
    .filter(Boolean);
}

function isInstructorLabeledAriaValueControl(element) {
  const role = element.getAttribute("role")?.trim().toLowerCase();
  if (!["combobox", "listbox", "textbox"].includes(role)) {
    return false;
  }

  return [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    ariaLabelledByText(element),
    ariaDescribedByText(element),
  ].some((value) => value && isInstructorLabel(String(value)));
}

function ariaValueControlSegments(element) {
  return [
    element.getAttribute("aria-valuetext")?.trim(),
    element.getAttribute("aria-value")?.trim(),
    activeDescendantText(element),
    selectedControlledOptionText(element),
    ...visibleTextSegments(element),
  ].filter(Boolean);
}

function activeDescendantText(element) {
  const activeDescendantId = element.getAttribute("aria-activedescendant")?.trim();
  if (!activeDescendantId) {
    return "";
  }

  const activeDescendant = element.ownerDocument?.getElementById(activeDescendantId);
  return activeDescendant && isElementVisible(activeDescendant)
    ? instructorNameSegments(activeDescendant).join(" ")
    : "";
}

function selectedControlledOptionText(element) {
  const controlledElementIds = [
    element.getAttribute("aria-controls"),
    element.getAttribute("aria-owns"),
  ].join(" ").trim().split(/\s+/).filter(Boolean);

  const fallbackTexts = [];
  for (const controlledElementId of controlledElementIds) {
    const controlledElement = element.ownerDocument?.getElementById(controlledElementId);
    const selectedOption = selectedControlledOption(controlledElement);
    const selectedText = selectedOption && isElementVisible(selectedOption)
      ? instructorNameSegments(selectedOption).join(" ")
      : "";
    if (!selectedText || !splitInstructorList(selectedText).some(isLikelyInstructorName)) {
      continue;
    }
    if (isInstructorLabeledControlledElement(controlledElement, controlledElementId)) {
      return selectedText;
    }
    fallbackTexts.push(selectedText);
  }

  return fallbackTexts[0] ?? "";
}

function selectedControlledOption(element) {
  return Array.from(element?.querySelectorAll?.(CONTROLLED_OPTION_SELECTOR) ?? [])
    .find((option) => option.getAttribute("aria-selected")?.trim().toLowerCase() === "true"
      || option.getAttribute("aria-checked")?.trim().toLowerCase() === "true"
      || option.getAttribute("aria-pressed")?.trim().toLowerCase() === "true"
      || isCurrentOption(option.getAttribute("aria-current"))
      || option.hasAttribute("selected")
      || option.getAttribute("data-selected")?.trim().toLowerCase() === "true"
      || option.getAttribute("data-active")?.trim().toLowerCase() === "true"
      || isEnabledPresenceAttribute(option.getAttribute("data-checked"))
      || option.getAttribute("data-current")?.trim().toLowerCase() === "true"
      || isEnabledPresenceAttribute(option.getAttribute("data-focus"))
      || isEnabledPresenceAttribute(option.getAttribute("data-focused"))
      || isEnabledPresenceAttribute(option.getAttribute("data-highlighted"))
      || isEnabledPresenceAttribute(option.getAttribute("data-pressed"))
      || ["checked", "selected", "active", "current", "highlight", "highlighted", "focused", "on"].includes(option.getAttribute("data-state")?.trim().toLowerCase())
      || hasSelectedOptionClass(option));
}

function isEnabledPresenceAttribute(value) {
  const normalizedValue = value?.trim().toLowerCase();
  return normalizedValue === "" || normalizedValue === "true";
}

function isCurrentOption(value) {
  const normalizedValue = value?.trim().toLowerCase();
  return normalizedValue === "true"
    || normalizedValue === "page"
    || normalizedValue === "step"
    || normalizedValue === "location"
    || normalizedValue === "date"
    || normalizedValue === "time";
}

function hasSelectedOptionClass(element) {
  return Array.from(element.classList ?? [])
    .some((className) => {
      const normalizedClassName = className.toLowerCase();
      return /^(?:is-|ps-|ui-|nyu-|oj-)?(?:selected|active|current|checked|on|pressed|highlighted|focused|focus)$/.test(normalizedClassName)
        || /^(?:p|ps|ui|nyu|oj)[-_](?:selected|active|current|checked|on|pressed|highlight|highlighted|focused|focus)$/.test(normalizedClassName)
        || /^(?:is|ps|ui|nyu|oj)[-_]state[-_](?:selected|active|current|checked|on|pressed|highlight|highlighted|focused|focus)$/.test(normalizedClassName)
        || /^(?:is|ps|ui|nyu|oj)[-_](?:selected|active|current|checked|on|pressed|highlighted|focused|focus)[-_]option$/.test(normalizedClassName)
        || /^(?:selected|active|current|checked|on|pressed|highlighted|focused|focus)[-_]option$/.test(normalizedClassName)
        || /^option[-_](?:selected|active|current|checked|on|pressed|highlighted|focused|focus)$/.test(normalizedClassName);
    });
}

function isInstructorLabeledControlledElement(element, id) {
  return [
    id,
    element?.getAttribute?.("aria-label"),
    element?.getAttribute?.("title"),
    element ? ariaLabelledByText(element) : "",
  ].some((value) => value && /\b(?:instructor|instr)\b/i.test(normalizeLabelText(value)));
}

function instructorNamesFromHeaderedCell(element) {
  if (!isTableCell(element) || !isInstructorHeaderedCell(element)) {
    return [];
  }

  return instructorNameSegments(element)
    .flatMap(splitInstructorList)
    .filter(isLikelyInstructorName)
    .map(normalizeInstructorName)
    .filter(Boolean);
}

function isInstructorHeaderedCell(element) {
  return cellHeaderText(element)
    .split("\n")
    .some(isInstructorLabel);
}

function cellHeaderText(element) {
  return [
    cellLabelAttributeText(element),
    ariaLabelledByText(element),
    ariaDescribedByText(element),
    referencedHeaderText(element),
    columnHeaderText(element),
  ].filter(Boolean).join("\n");
}

function cellLabelAttributeText(element) {
  for (const attributeName of [
    "data-label",
    "data-title",
    "data-tooltip",
    "data-original-title",
    "data-caption",
    "data-header",
    "data-heading",
    "data-col",
    "data-col-id",
    "data-col-label",
    "data-col-title",
    "data-col-name",
    "data-colname",
    "data-colid",
    "data-column",
    "data-column-id",
    "data-column-label",
    "data-column-title",
    "data-column-name",
    "data-columnname",
    "data-columnid",
    "data-ps-column-id",
    "data-ps-column-name",
    "data-ps-columnid",
    "data-ps-columnname",
    "data-field",
    "data-field-id",
    "data-field-label",
    "data-fieldid",
    "data-field-name",
    "data-fieldname",
    "data-fld",
    "data-fld-id",
    "data-fld-label",
    "data-fld-name",
    "data-fldid",
    "data-fldname",
    "data-ps-field-id",
    "data-ps-field-name",
    "data-ps-fieldid",
    "data-ps-fieldname",
    "data-pnlfldid",
    "data-pnlfldname",
    "data-pnlfld",
    "aria-label",
    "title",
    "id",
    "name",
    "class",
    "data-testid",
    "data-test-id",
    "data-qa",
    "data-cy",
    "data-e2e",
    "data-automation-id",
    "data-automationid",
    "data-slot",
    "slot",
    "data-name",
    "data-key",
    "data-field-key",
  ]) {
    const value = element.getAttribute(attributeName)?.trim();
    if (value) {
      return normalizeCellLabelAttributeValue(attributeName, value);
    }
  }
  return "";
}

function normalizeCellLabelAttributeValue(attributeName, value) {
  const normalized = normalizeLabelText(value);
  if (isFieldNameAttribute(attributeName) && /\b(?:instructor|instr)\b/i.test(normalized)) {
    return "Instructor";
  }
  return value;
}

function isFieldNameAttribute(attributeName) {
  return ["data-field", "data-field-id", "data-fieldid", "data-field-name", "data-fieldname", "data-fld", "data-fld-id", "data-fldid", "data-fld-name", "data-fldname", "data-ps-field-id", "data-ps-field-name", "data-ps-fieldid", "data-ps-fieldname", "data-pnlfldid", "data-pnlfldname", "data-pnlfld", "data-col", "data-col-id", "data-colid", "data-col-name", "data-colname", "data-column", "data-column-id", "data-columnid", "data-column-name", "data-columnname", "data-ps-column-id", "data-ps-column-name", "data-ps-columnid", "data-ps-columnname", "id", "name", "class", "data-testid", "data-test-id", "data-qa", "data-cy", "data-e2e", "data-automation-id", "data-automationid", "data-slot", "slot", "data-name", "data-key", "data-field-key"].includes(attributeName);
}

function referencedHeaderText(element) {
  const ids = element.getAttribute("headers")?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (ids.length === 0) {
    return "";
  }

  return ids
    .map((id) => element.ownerDocument?.getElementById(id))
    .filter((headerElement) => headerElement && isElementVisible(headerElement))
    .map((headerElement) => visibleTextSegments(headerElement).join(" "))
    .filter(Boolean)
    .join("\n");
}

function columnHeaderText(element) {
  const row = rowForCell(element);
  const rowGroup = rowGroupForCell(element);
  if (!row || !rowGroup) {
    return "";
  }

  const columnKey = columnKeyForCell(element, visibleRowCells(row));
  if (!columnKey) {
    return "";
  }

  const headerRow = Array.from(rowGroup.querySelectorAll("tr, [role='row']"))
    .filter((candidateRow) => candidateRow !== row && (candidateRow.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING))
    .find((candidateRow) => visibleRowCells(candidateRow).some(isColumnHeaderCell));
  const headerCell = headerRow ? visibleRowCells(headerRow).find((cell) => columnKeyForCell(cell, visibleRowCells(headerRow)) === columnKey) : null;
  return headerCell && isColumnHeaderCell(headerCell) ? visibleTextSegments(headerCell).join(" ") : "";
}

function columnKeyForCell(element, rowCells) {
  const ariaColumnIndex = positiveIntegerAttribute(element, "aria-colindex");
  if (ariaColumnIndex !== null) {
    return `aria:${ariaColumnIndex}`;
  }

  const cellIndex = rowCells.indexOf(element);
  return cellIndex >= 0 ? `index:${cellIndex}` : "";
}

function positiveIntegerAttribute(element, attributeName) {
  const value = Number.parseInt(element.getAttribute(attributeName) ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function rowForCell(element) {
  return element.closest("tr") ?? element.closest("[role='row']");
}

function rowGroupForCell(element) {
  return element.closest("table") ?? element.closest("[role='grid'], [role='table'], [role='treegrid']");
}

function visibleRowCells(row) {
  return Array.from(row.children)
    .filter((child) => isRowCell(child) && isElementVisible(child));
}

function isRowCell(element) {
  return ["TD", "TH"].includes(element.tagName) || isAriaCell(element) || isColumnHeaderCell(element);
}

function isColumnHeaderCell(element) {
  return element.tagName === "TH" || element.getAttribute("role")?.trim().toLowerCase() === "columnheader";
}

function formControlValue(element) {
  if (element.tagName === "SELECT") {
    const selectedOptionValues = Array.from(element.selectedOptions ?? [])
      .map((option) => instructorNameSegments(option).join(" "))
      .filter(Boolean);
    return selectedOptionValues.find((value) => splitInstructorList(value).some(isLikelyInstructorName))
      ?? selectedOptionValues[0]
      ?? element.value?.trim()
      ?? "";
  }

  return element.value?.trim() || firstNameLikeAttribute(element) || "";
}

function isInstructorLabeledFormControl(element) {
  return [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("name"),
    element.id,
    ariaLabelledByText(element),
    associatedLabelText(element),
  ].some((value) => value && isInstructorLabel(String(value)));
}

function ariaLabelledByText(element) {
  return ariaReferencedText(element, "aria-labelledby");
}

function ariaDescribedByText(element) {
  return ariaReferencedText(element, "aria-describedby");
}

function ariaReferencedText(element, attributeName) {
  const ids = element.getAttribute(attributeName)?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (ids.length === 0) {
    return "";
  }

  return ids
    .map((id) => element.ownerDocument?.getElementById(id))
    .filter((labelElement) => labelElement && isElementVisible(labelElement))
    .map((labelElement) => visibleTextSegments(labelElement).join(" "))
    .filter(Boolean)
    .join(" ");
}

function associatedLabelText(element) {
  return Array.from(element.labels ?? [])
    .filter((labelElement) => labelElement && isElementVisible(labelElement))
    .map((labelElement) => visibleTextSegments(labelElement).join(" "))
    .filter(Boolean)
    .join(" ");
}

function firstNameLikeAttribute(element) {
  for (const attributeName of ["title", "aria-label", "data-value", "data-label", "data-active-label", "data-active-name", "data-active-text", "data-active-value", "data-highlighted-label", "data-highlighted-name", "data-instructor-label", "data-instructor-text", "data-option-label", "data-option-text", "data-selected-label", "data-selected-name", "data-selected-text", "data-selected-value", "data-item-label", "data-item-text", "data-person-label", "data-person-name", "data-person-text", "data-faculty-label", "data-faculty-name", "data-faculty-text", "data-professor-label", "data-professor-name", "data-professor-text", "data-teacher-label", "data-teacher-name", "data-teacher-text", "data-title", "data-caption", "data-description", "data-text", "data-search", "data-full-name", "data-fullname", "data-full-text", "data-tooltip", "data-content", "data-original-title", "data-display", "data-display-name", "data-displayname", "data-name"]) {
    const value = element.getAttribute(attributeName)?.trim();
    if (value && splitInstructorList(value).some(isLikelyInstructorName)) {
      return value;
    }
  }
  return "";
}

function textForParsing(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }
  if (!isElementVisible(node)) {
    return "";
  }
  if (node.tagName === "BR") {
    return "\n";
  }

  const text = Array.from(node.childNodes).map(textForParsing).join(" ");
  return isLineBreakElement(node) ? `\n${text}\n` : text;
}

function isLineBreakElement(element) {
  return ["DIV", "P", "LI", "TR"].includes(element.tagName);
}

function preferMostSpecificTargets(targets) {
  return targets.filter((target) => {
    return !targets.some((other) => {
      if (other === target) {
        return false;
      }
      if (other.element === target.element) {
        return targets.indexOf(other) < targets.indexOf(target);
      }
      if (target.element.contains(other.element)) {
        return other.names.length >= target.names.length;
      }
      if (other.element.contains(target.element)) {
        return other.names.length > target.names.length;
      }
      return false;
    });
  });
}

function mountRatings({ element, names, processedElements = [], document, lookupProfessor }) {
  for (const processedElement of new Set([element, ...processedElements])) {
    processedElement.dataset.nyuRmpProcessed = "true";
  }
  const container = document.createElement("div");
  container.className = ROOT_CLASS;
  const courseCode = courseCodeForElement(element);

  const pendingLookups = [];
  for (const name of uniqueNames(names.flatMap(splitInstructorList).map(normalizeInstructorName).filter(Boolean))) {
    const card = createRatingShell(document, name, courseCode);
    container.append(card);
    const pendingLookup = loadRatingCard({ card, name, lookupProfessor, courseCode });
    pendingLookups.push(pendingLookup);
  }

  if (isTableCell(element)) {
    element.append(container);
  } else {
    element.insertAdjacentElement("afterend", container);
  }
  return pendingLookups;
}

function courseCodeForElement(element) {
  return normalizeCourseCode([
    rowForCell(element) ? visibleTextSegments(rowForCell(element)).join(" ") : "",
    element.closest?.("[role='row']") ? visibleTextSegments(element.closest("[role='row']")).join(" ") : "",
    element.parentElement ? visibleTextSegments(element.parentElement).join(" ") : "",
  ].find(courseCodeFromText));
}

function courseCodeFromText(value) {
  const text = String(value ?? "");
  return text.match(COURSE_CODE_PATTERN)?.[1] ?? text.match(SPACED_COURSE_CODE_PATTERN)?.[1] ?? text.match(COMPACT_COURSE_CODE_PATTERN)?.[1] ?? text.match(CSCI_SHORTHAND_COURSE_CODE_PATTERN)?.[1] ?? text.match(CS_SHORTHAND_COURSE_CODE_PATTERN)?.[1] ?? courseCodeFromKnownTitle(text);
}

function courseCodeFromKnownTitle(text) {
  return COURSE_TITLE_CODE_ALIASES.find(({ pattern }) => pattern.test(text))?.code ?? "";
}

function normalizeCourseCode(value) {
  const code = courseCodeFromText(value) || String(value ?? "");
  return code
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase()
    .replace(/\bCSCI[-\s]*0*(\d{1,4})\b/, (_match, courseNumber) => `CSCI-UA ${Number(courseNumber)}`)
    .replace(/\bCS[-\s]*0*(\d{1,4})\b/, (_match, courseNumber) => `CSCI-UA ${Number(courseNumber)}`)
    .replace(/\b([A-Z]{2,5})\s+([A-Z]{2})\s*0*(\d{1,4})\b/, (_match, subject, school, courseNumber) => `${subject}-${school} ${Number(courseNumber)}`)
    .replace(/\b([A-Z]{2,5})([A-Z]{2})0*(\d{1,4})\b/, (_match, subject, school, courseNumber) => `${subject}-${school} ${Number(courseNumber)}`)
    .replace(/\b([A-Z]{2,5}-[A-Z]{2})[.\-\s]*0*(\d{1,4})\b/, (_match, prefix, courseNumber) => `${prefix} ${Number(courseNumber)}`);
}

function uniqueNames(names) {
  const seen = new Set();
  return names.filter((name) => {
    const key = compactName(name);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function loadRatingCard({ card, name, lookupProfessor, forceRefresh = false, courseCode = card.dataset.nyuRmpCourseCode ?? "" }) {
  setCardLoading(card, name, forceRefresh ? "Refreshing RMP" : "Checking RMP");
  const lookupArgs = forceRefresh ? [name, { forceRefresh: true }] : [name];
  return lookupProfessor(...lookupArgs)
    .then((result) => updateRatingCard(card, result, { requestedName: name, lookupProfessor, courseCode }))
    .catch((error) => {
      updateErrorCard(card, { requestedName: name, lookupProfessor, message: error.message, courseCode });
    });
}

function isTableCell(element) {
  return ["TD", "TH", "DD"].includes(element.tagName) || isAriaCell(element);
}

function isAriaCell(element) {
  return ["cell", "gridcell"].includes(element.getAttribute("role")?.trim().toLowerCase());
}

function createRatingShell(document, name, courseCode = "") {
  const card = document.createElement("article");
  card.className = "nyu-rmp-card is-loading";
  card.dataset.nyuRmpCardId = String(++nextCardId);
  if (courseCode) {
    card.dataset.nyuRmpCourseCode = courseCode;
  }
  card.setAttribute("role", "group");
  setCardLoading(card, name, "Checking RMP");
  return card;
}

function setCardLoading(card, name, status) {
  const courseCode = card.dataset.nyuRmpCourseCode ?? "";
  card.className = "nyu-rmp-card is-loading";
  card.setAttribute("aria-busy", "true");
  card.setAttribute("aria-label", [`${status} rating for ${name}`, formatAlbertCourseSummary(courseCode)].filter(Boolean).join(", "));
  card.innerHTML = `
    <div class="nyu-rmp-card-head">
      <strong></strong>
      ${statusMarkup(status)}
    </div>
    ${renderCourseContext(courseCode)}
    <div class="nyu-rmp-skeleton"></div>
  `;
  card.querySelector("strong").textContent = name;
}

function updateRatingCard(card, result, { requestedName = "Professor", lookupProfessor, courseCode = "" } = {}) {
  card.classList.remove("is-loading");
  card.removeAttribute("aria-busy");
  if (!result) {
    const courseContext = renderCourseContext(courseCode);
    card.classList.add("is-empty");
    card.setAttribute("aria-label", [`No RMP match for ${requestedName}`, formatAlbertCourseSummary(courseCode)].filter(Boolean).join(", "));
    card.innerHTML = `
      <div class="nyu-rmp-card-head">
        <strong>${escapeHtml(requestedName)}</strong>
        <div class="nyu-rmp-actions" aria-label="${escapeHtml(`RMP actions for ${requestedName}`)}">
          <button class="nyu-rmp-refresh" type="button" aria-label="${escapeHtml(refreshLabel(requestedName))}">Refresh</button>
          <a class="nyu-rmp-search" href="${escapeHtml(rmpSearchUrl(requestedName))}" target="_blank" rel="noreferrer noopener" aria-label="${escapeHtml(searchLabel(requestedName))}">Search RMP</a>
          ${statusMarkup("No RMP match")}
        </div>
      </div>
      ${courseContext}
      <div class="nyu-rmp-empty-note" role="note">No automatic RMP match. Use Search RMP to verify manually.</div>
    `;
    wireRefreshAction(card, requestedName, lookupProfessor);
    return;
  }

  const rating = rmpScaleNumberOrNull(result.rating);
  const difficulty = rmpScaleNumberOrNull(result.difficulty);
  const ease = difficulty == null ? null : 5 - difficulty;
  const wouldTakeAgain = percentNumberOrNull(result.wouldTakeAgain);
  const ratingVerdict = getRatingVerdict(rating);
  const ratingClass = ratingVerdict.className;
  const professorName = result.name || requestedName;
  const ratingsCountLabel = formatOptionalRatingsCount(result.ratingsCount);
  const rmpUrl = safeRmpProfileUrl(result.url);
  const department = String(result.department ?? "").trim();
  const updatedAt = formatUpdatedAt(result.cacheUpdatedAt);
  const matchNote = formatMatchNote(professorName, requestedName, result.matchConfidence);
  const cacheNotice = formatCacheNotice(result.cacheStatus);
  const profileAction = rmpUrl
    ? `<a href="${escapeHtml(rmpUrl)}" target="_blank" rel="noreferrer noopener" aria-label="${escapeHtml(profileLabel(professorName))}">RMP</a>`
    : "";
  const searchAction = (matchNote || !rmpUrl)
    ? `<a class="nyu-rmp-search" href="${escapeHtml(rmpSearchUrl(requestedName))}" target="_blank" rel="noreferrer noopener" aria-label="${escapeHtml(searchLabel(requestedName))}">Search RMP</a>`
    : "";
  const sortedTopComments = prioritizeCourseMatchedComments(result.topComments, courseCode);
  const usefulTopComments = sortedTopComments
    .filter((comment) => isUsefulCommentText(normalizeComment(comment).text));
  const tagNames = asArray(result.tags)
    .map(normalizeTagName)
    .filter(Boolean);
  const commentSignal = commentFitSignal(usefulTopComments, tagNames, courseCode);
  const displayedTopComments = usefulTopComments.slice(0, MAX_RENDERED_COMMENTS);
  const courseMatchedCommentCount = countCourseMatchedComments(usefulTopComments, courseCode);
  const courseContext = renderCourseContext(courseCode);
  const comments = usefulTopComments
    .map((comment, index) => formatComment(comment, commentTextId(card, index), courseCode, { hidden: index >= MAX_RENDERED_COMMENTS }))
    .join("");
  const commentCount = Math.min(usefulTopComments.length, MAX_RENDERED_COMMENTS);
  const commentsPanel = renderCommentsPanel(comments, { courseMatchedCommentCount, courseCode, commentSignal, totalUsefulCommentCount: usefulTopComments.length, visibleCommentCount: commentCount, listId: `nyu-rmp-comments-${card.dataset.nyuRmpCardId || "0"}` });
  const radarFit = radarFitDetails({
    rating,
    ease,
    normalizedRatingsCount: optionalNonNegativeCount(result.ratingsCount),
    wouldTakeAgain,
    commentSignal,
  });
  const recommendation = getPickRecommendation(radarFit);
  const tags = tagNames
    .map((tag) => `<span role="listitem">${escapeHtml(tag)}</span>`)
    .join(" ");
  const tagListLabel = `RMP professor tags, ${tagNames.length} shown`;
  const radar = renderRadarChart({
    chartId: card.dataset.nyuRmpCardId,
    professorName,
    rating,
    difficulty,
    ratingsCount: result.ratingsCount,
    wouldTakeAgain,
    commentSignal,
    recommendationClassName: recommendation.className,
  });
  const recommendationEvidence = renderRecommendationEvidence({ rating, difficulty, ratingsCount: result.ratingsCount, wouldTakeAgain, commentSignal, courseCode, courseMatchedCommentCount });
  const collapsedCardLabel = formatCardSummaryLabel({ professorName, department, rating, ratingVerdict: ratingVerdict.label, recommendation, radarFit, ratingsCountLabel, difficulty, ease, wouldTakeAgain, commentSignal, commentCount, courseMatchedCommentCount, courseCode, tagNames, updatedAt, matchNote, cacheNotice });
  const expandedCardLabel = formatCardSummaryLabel({ professorName, department, rating, ratingVerdict: ratingVerdict.label, recommendation, radarFit, ratingsCountLabel, difficulty, ease, wouldTakeAgain, commentSignal, commentCount: usefulTopComments.length, courseMatchedCommentCount, courseCode, tagNames, updatedAt, matchNote, cacheNotice });
  card.dataset.nyuRmpCollapsedLabel = collapsedCardLabel;
  card.dataset.nyuRmpExpandedLabel = expandedCardLabel;

  card.classList.add(`rating-${ratingClass}`);
  card.setAttribute(
    "aria-label",
    collapsedCardLabel,
  );
  card.innerHTML = `
    <div class="nyu-rmp-card-head">
      <strong>${escapeHtml(professorName)}</strong>
      <div class="nyu-rmp-actions" aria-label="${escapeHtml(`RMP actions for ${professorName}`)}">
        <button class="nyu-rmp-refresh" type="button" aria-label="${escapeHtml(refreshLabel(requestedName))}">Refresh</button>
        ${profileAction}
        ${searchAction}
      </div>
    </div>
    ${department ? `<div class="nyu-rmp-department">${escapeHtml(department)}</div>` : ""}
    ${courseContext}
    ${matchNote ? `<div class="nyu-rmp-match-note">${escapeHtml(matchNote)}</div>` : ""}
    ${updatedAt ? `<div class="nyu-rmp-updated">${escapeHtml(updatedAt)}</div>` : ""}
    ${cacheNotice ? `<div class="nyu-rmp-cache-note" role="note">${escapeHtml(cacheNotice)}.</div>` : ""}
    <div class="nyu-rmp-recommendation is-${escapeHtml(recommendation.className)}" role="note" aria-label="${escapeHtml(`RMP pick recommendation: ${recommendation.label}`)}">
      <strong>${escapeHtml(recommendation.label)}</strong>
      <span>${escapeHtml(recommendation.detail)}</span>
    </div>
    ${recommendationEvidence}
    <dl class="nyu-rmp-score-row nyu-rmp-metrics" aria-label="${escapeHtml(`RMP metrics for ${professorName}`)}">
      <div class="nyu-rmp-metric nyu-rmp-rating-metric">
        <dt class="nyu-rmp-metric-label">Rating</dt>
        <dd class="nyu-rmp-score nyu-rmp-metric-value" aria-label="${escapeHtml(formatRatingLabel(rating))}">${formatScore(rating)}</dd>
        <dd class="nyu-rmp-verdict">${escapeHtml(ratingVerdict.label)}</dd>
        <dd class="nyu-rmp-rating-count">${escapeHtml(ratingsCountLabel)}</dd>
      </div>
      <div class="nyu-rmp-metric">
        <dt class="nyu-rmp-metric-label">Difficulty</dt>
        <dd class="nyu-rmp-metric-value">Difficulty ${formatScore(difficulty)}</dd>
        <dd class="nyu-rmp-metric-secondary">Ease ${formatScore(ease)}/5</dd>
      </div>
      <div class="nyu-rmp-metric">
        <dt class="nyu-rmp-metric-label">Take again</dt>
        <dd class="nyu-rmp-metric-value">${wouldTakeAgain == null ? "Take again N/A" : `${Math.round(wouldTakeAgain)}% take again`}</dd>
      </div>
    </dl>
    ${radar}
    ${tags ? `<div class="nyu-rmp-tags" role="list" aria-label="${escapeHtml(tagListLabel)}">${tags}</div>` : ""}
    ${commentsPanel}
  `;
  wireRefreshAction(card, requestedName, lookupProfessor);
  wireCommentToggleActions(card);
  wireCommentsExpandActions(card);
}

function renderCourseContext(courseCode) {
  return courseCode
    ? `<div class="nyu-rmp-course-context" role="note" aria-label="${escapeHtml(`Albert course context: ${courseCode}`)}"><span>Albert</span> <strong>${escapeHtml(courseCode)}</strong></div>`
    : "";
}

function formatAlbertCourseSummary(courseCode) {
  return courseCode ? `Albert course ${courseCode}` : "";
}

function updateErrorCard(card, { requestedName, lookupProfessor, message, courseCode = card.dataset.nyuRmpCourseCode ?? "" }) {
  card.className = "nyu-rmp-card is-error";
  card.removeAttribute("aria-busy");
  card.setAttribute("aria-label", [`RMP lookup failed for ${requestedName}`, formatAlbertCourseSummary(courseCode)].filter(Boolean).join(", ") + `: ${message || "RMP lookup failed"}`);
  card.innerHTML = `
    <div class="nyu-rmp-card-head">
      <strong>${escapeHtml(requestedName)}</strong>
      <div class="nyu-rmp-actions" aria-label="${escapeHtml(`RMP actions for ${requestedName}`)}">
        <button class="nyu-rmp-refresh" type="button" aria-label="${escapeHtml(retryLabel(requestedName))}">Retry</button>
        <a class="nyu-rmp-search" href="${escapeHtml(rmpSearchUrl(requestedName))}" target="_blank" rel="noreferrer noopener" aria-label="${escapeHtml(searchLabel(requestedName))}">Search RMP</a>
        ${statusMarkup(message || "RMP lookup failed")}
      </div>
    </div>
    ${renderCourseContext(courseCode)}
  `;
  wireRefreshAction(card, requestedName, lookupProfessor);
}

function renderRadarChart({ chartId, professorName = "Professor", rating, difficulty, ratingsCount, wouldTakeAgain, commentSignal = null, recommendationClassName = "" }) {
  const ease = difficulty == null ? null : 5 - difficulty;
  const normalizedRatingsCount = optionalNonNegativeCount(ratingsCount);
  const ratingsCountLabel = normalizedRatingsCount == null ? "N/A ratings" : formatRatingsCount(normalizedRatingsCount);
  const ratingsVolumeLabel = normalizedRatingsCount == null ? "N/A" : normalizedRatingsCount;
  const commentSignalLabel = commentSignal == null ? "" : `, comment signal ${Math.round(commentSignal * 100)} out of 100`;
  const commentLegendLabel = commentSignal == null ? "" : radarLegendItem(`Comments ${Math.round(commentSignal * 100)}/100`, clamp01(commentSignal), true);
  const safeChartId = String(chartId ?? "0").replace(/\D+/g, "") || "0";
  const titleId = `nyu-rmp-radar-title-${safeChartId}`;
  const descId = `nyu-rmp-radar-desc-${safeChartId}`;
  const radarFit = radarFitDetails({ rating, ease, normalizedRatingsCount, wouldTakeAgain, commentSignal });
  const axes = radarFit.axes;
  const metricCountLabel = `${radarFit.availableMetricCount} of ${radarFit.totalMetricCount} radar metrics`;
  const compactMetricCountLabel = `${radarFit.availableMetricCount}/${radarFit.totalMetricCount} metrics`;
  const isLimitedData = radarFit.availableMetricCount < radarFit.totalMetricCount;
  const limitedDataLabel = isLimitedData ? ", limited data" : "";
  const limitedDataText = isLimitedData ? " <em>Limited data</em>" : "";
  const legendLabel = isLimitedData
    ? `Radar chart values, limited data: ${radarFit.availableMetricCount} of ${radarFit.totalMetricCount} metrics available`
    : "Radar chart values";
  const fitSummary = `professor fit ${radarFit.score} out of 100`;
  const points = axes
    .map(({ value }, index) => radarPoint(value, index, axes.length))
    .map(({ x, y }) => `${x},${y}`)
    .join(" ");
  const radarSummary = `${fitSummary}${isLimitedData ? ", limited data" : ""}, rating ${formatScore(rating)} out of 5, ease ${formatScore(ease)} out of 5, take again ${wouldTakeAgain == null ? "N/A" : `${Math.round(wouldTakeAgain)}%`}, ${ratingsCountLabel}${commentSignalLabel}`;
  const limitedDataDescription = isLimitedData ? ` Limited data: ${metricCountLabel} available.` : "";
  const radarDescription = `${capitalizeSentence(fitSummary)}.${limitedDataDescription} Rating ${formatScore(rating)} out of 5, ease ${formatScore(ease)} out of 5, take again ${wouldTakeAgain == null ? "N/A" : `${Math.round(wouldTakeAgain)}%`}, ${ratingsCountLabel}${commentSignalLabel}.`;
  const ariaLabel = `Professor radar: ${radarSummary}`;
  const outerGridPoints = radarGridPoints(48, axes.length);
  const innerGridPoints = radarGridPoints(24, axes.length);
  const spokes = axes
    .map((_, index) => {
      const { x, y } = radarPoint(48 / 42, index, axes.length);
      return `<line class="nyu-rmp-radar-spoke" x1="60" y1="60" x2="${x}" y2="${y}"></line>`;
    })
    .join("");
  const radarFitClassName = [
    "nyu-rmp-radar-fit",
    recommendationClassName ? `is-${recommendationClassName}` : "",
    isLimitedData && recommendationClassName !== "limited" ? "is-limited" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <div class="nyu-rmp-radar-wrap${recommendationClassName ? ` is-${escapeHtml(recommendationClassName)}` : ""}" role="group" aria-label="${escapeHtml(`Professor fit radar for ${professorName}`)}">
      <svg class="nyu-rmp-radar" viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(ariaLabel)}" aria-labelledby="${titleId}" aria-describedby="${descId}" focusable="false">
        <title id="${titleId}">Professor rating radar</title>
        <desc id="${descId}">${escapeHtml(radarDescription)}</desc>
        <polygon class="nyu-rmp-radar-grid" points="${outerGridPoints}"></polygon>
        <polygon class="nyu-rmp-radar-grid inner" points="${innerGridPoints}"></polygon>
        ${spokes}
        <polygon class="nyu-rmp-radar-shape" points="${escapeHtml(points)}"></polygon>
        ${axes.map((axis, index) => radarMetricNode(axis, index, axes.length, { rating, ease, normalizedRatingsCount, wouldTakeAgain, commentSignal })).join("")}
        ${axes.map(({ label }, index) => radarAxisLabel(label, index, axes.length)).join("")}
      </svg>
      <div class="nyu-rmp-radar-summary">
        <div class="${escapeHtml(radarFitClassName)}" aria-label="Professor fit score ${radarFit.score} out of 100, based on ${metricCountLabel}${limitedDataLabel}"><span>Fit</span> <strong>${radarFit.score}</strong> <em>${compactMetricCountLabel}</em>${limitedDataText}</div>
        <div class="nyu-rmp-radar-weight-note" role="note">Rating-led fit: rating counts most.</div>
        <ul class="nyu-rmp-radar-legend" aria-label="${escapeHtml(legendLabel)}">
          ${radarLegendItem(`Rating ${formatScore(rating)}/5`, scaleFivePoint(rating), rating != null)}
          ${radarLegendItem(`Ease ${formatScore(ease)}/5`, scaleFivePoint(ease), ease != null)}
          ${radarLegendItem(`Volume ${ratingsVolumeLabel}`, scaleRatingVolume(normalizedRatingsCount), normalizedRatingsCount != null)}
          ${radarLegendItem(`Take again ${wouldTakeAgain == null ? "N/A" : `${Math.round(wouldTakeAgain)}%`}`, scalePercent(wouldTakeAgain), wouldTakeAgain != null)}
          ${commentLegendLabel}
        </ul>
      </div>
    </div>
  `;
}

function radarLegendItem(label, value, available) {
  const state = radarLegendState(value, available);
  return `<li class="nyu-rmp-radar-legend-item is-${state}" aria-label="${escapeHtml(evidenceChipStatePrefix(state))}: ${escapeHtml(label)}">${escapeHtml(label)}</li>`;
}

function radarLegendState(value, available) {
  if (!available) {
    return "limited";
  }
  const normalized = clamp01(value);
  if (normalized >= 0.7) {
    return "strong";
  }
  if (normalized >= 0.5) {
    return "mixed";
  }
  return "weak";
}

function radarMetricNode(axis, index, total, metrics) {
  const { x, y } = radarPoint(axis.value, index, total);
  const label = radarMetricLabel(axis.label, metrics);
  const className = axis.available ? "nyu-rmp-radar-node" : "nyu-rmp-radar-node is-unavailable";
  return `<circle class="${className}" cx="${x}" cy="${y}" r="3.5" role="img" aria-label="${escapeHtml(`Radar metric ${label}`)}"><title>${escapeHtml(label)}</title></circle>`;
}

function radarMetricLabel(label, { rating, ease, normalizedRatingsCount, wouldTakeAgain, commentSignal }) {
  if (label === "Rating") {
    return `Rating: ${formatScore(rating)} out of 5`;
  }
  if (label === "Ease") {
    return `Ease: ${formatScore(ease)} out of 5`;
  }
  if (label === "Volume") {
    return `Volume: ${normalizedRatingsCount == null ? "N/A ratings" : formatRatingsCount(normalizedRatingsCount)}`;
  }
  if (label === "Again") {
    return `Take again: ${wouldTakeAgain == null ? "N/A" : `${Math.round(wouldTakeAgain)}%`}`;
  }
  if (label === "Comments") {
    return `Comments: ${commentSignal == null ? "N/A" : `${Math.round(commentSignal * 100)} out of 100`}`;
  }
  return `${label}: N/A`;
}

function radarFitDetails({ rating, ease, normalizedRatingsCount, wouldTakeAgain, commentSignal = null }) {
  const axes = [
    { label: "Rating", value: scaleFivePoint(rating), available: rating != null },
    { label: "Ease", value: scaleFivePoint(ease), available: ease != null },
    { label: "Volume", value: scaleRatingVolume(normalizedRatingsCount), available: normalizedRatingsCount != null },
    { label: "Again", value: scalePercent(wouldTakeAgain), available: wouldTakeAgain != null },
  ];
  if (commentSignal != null) {
    axes.push({ label: "Comments", value: clamp01(commentSignal), available: true });
  }
  return {
    axes,
    score: radarFitScore(axes),
    availableMetricCount: axes.filter((axis) => axis.available).length,
    ratingsCount: normalizedRatingsCount,
    totalMetricCount: axes.length,
  };
}

function radarFitScore(axes) {
  const hasCommentSignal = axes.some((axis) => axis.label === "Comments");
  const weights = hasCommentSignal
    ? {
        Rating: 0.5,
        Ease: 0.17,
        Volume: 0.07,
        Again: 0.16,
        Comments: 0.1,
      }
    : {
        Rating: 0.5,
        Ease: 0.2,
        Volume: 0.1,
        Again: 0.2,
      };
  const weighted = axes.reduce((total, axis) => total + axis.value * (weights[axis.label] ?? 0), 0);
  const availableWeight = axes.reduce((total, axis) => total + (axis.available ? weights[axis.label] ?? 0 : 0), 0);
  return Math.round((weighted / (availableWeight || 1)) * 100);
}

function getPickRecommendation(radarFit) {
  if (!radarFit || radarFit.availableMetricCount <= 2) {
    return {
      className: "limited",
      label: "Limited RMP data",
      detail: "Check RMP before picking",
    };
  }
  if (radarFit.ratingsCount == null) {
    return {
      className: "limited",
      label: "Limited RMP data",
      detail: "RMP rating count unavailable",
    };
  }
  if (Number.isFinite(radarFit.ratingsCount) && radarFit.ratingsCount > 0 && radarFit.ratingsCount < MIN_CONFIDENT_RATING_COUNT) {
    return {
      className: "limited",
      label: "Limited RMP data",
      detail: `Only ${radarFit.ratingsCount} RMP ${radarFit.ratingsCount === 1 ? "rating" : "ratings"}`,
    };
  }
  if (radarFit.score >= 80) {
    return {
      className: "strong",
      label: "Pick with confidence",
      detail: "Strong fit from RMP signals",
    };
  }
  if (radarFit.score >= 60) {
    return {
      className: "mixed",
      label: "Check tradeoffs",
      detail: "Readable fit with some risk",
    };
  }
  return {
    className: "weak",
    label: "Avoid if possible",
    detail: "Weak fit from RMP signals",
  };
}

function renderRecommendationEvidence({ rating, difficulty, ratingsCount, wouldTakeAgain, commentSignal = null, courseCode = "", courseMatchedCommentCount = 0 }) {
  const chips = [
    evidenceChip(ratingEvidenceLabel(rating), ratingEvidenceState(rating)),
    evidenceChip(difficultyEvidenceLabel(difficulty), difficultyEvidenceState(difficulty)),
    evidenceChip(takeAgainEvidenceLabel(wouldTakeAgain), takeAgainEvidenceState(wouldTakeAgain)),
    evidenceChip(ratingsCountEvidenceLabel(ratingsCount), ratingsCountEvidenceState(ratingsCount)),
    evidenceChip(commentSignalEvidenceLabel(commentSignal, { courseCode, courseMatchedCommentCount }), commentSignalEvidenceState(commentSignal)),
  ].filter((chip) => chip.label);

  return `
    <div class="nyu-rmp-evidence" role="list" aria-label="RMP recommendation evidence">
      ${chips.map((chip) => `<span class="nyu-rmp-evidence-chip is-${escapeHtml(chip.state)}" role="listitem" aria-label="${escapeHtml(evidenceChipAriaLabel(chip))}">${escapeHtml(chip.label)}</span>`).join("")}
    </div>
  `;
}

function evidenceChip(label, state) {
  return {
    label,
    state: state || "limited",
  };
}

function evidenceChipAriaLabel({ label, state }) {
  return `${evidenceChipStatePrefix(state)}: ${label}`;
}

function evidenceChipStatePrefix(state) {
  if (state === "strong") {
    return "Support signal";
  }
  if (state === "weak") {
    return "Risk signal";
  }
  if (state === "mixed") {
    return "Mixed signal";
  }
  return "Limited data signal";
}

function commentSignalEvidenceLabel(commentSignal, { courseCode = "", courseMatchedCommentCount = 0 } = {}) {
  if (commentSignal == null) {
    return null;
  }
  const score = Math.round(commentSignal * 100);
  const hasCourseCommentContext = courseCode && courseMatchedCommentCount > 0;
  const hasCourseRiskContext = score <= 40 && hasCourseCommentContext;
  if (hasCourseRiskContext) {
    return `${courseCode} comment risk ${score}/100`;
  }
  if (score >= 70 && hasCourseCommentContext) {
    return `${courseCode} comment support ${score}/100`;
  }
  if (score >= 70) {
    return `Positive comment signal ${score}/100`;
  }
  if (score <= 40) {
    return `Risky comment signal ${score}/100`;
  }
  return `Mixed comment signal ${score}/100`;
}

function ratingEvidenceLabel(rating) {
  if (rating == null) {
    return "Rating N/A";
  }
  if (rating >= 4) {
    return `Strong rating ${formatScore(rating)}/5`;
  }
  if (rating < 3) {
    return `Low rating ${formatScore(rating)}/5`;
  }
  return `Mixed rating ${formatScore(rating)}/5`;
}

function ratingEvidenceState(rating) {
  if (rating == null) {
    return "limited";
  }
  if (rating >= 4) {
    return "strong";
  }
  if (rating < 3) {
    return "weak";
  }
  return "mixed";
}

function difficultyEvidenceLabel(difficulty) {
  if (difficulty == null) {
    return "Difficulty N/A";
  }
  if (difficulty >= 4) {
    return `High difficulty ${formatScore(difficulty)}/5`;
  }
  if (difficulty <= 2.5) {
    return `Manageable difficulty ${formatScore(difficulty)}/5`;
  }
  return `Moderate difficulty ${formatScore(difficulty)}/5`;
}

function difficultyEvidenceState(difficulty) {
  if (difficulty == null) {
    return "limited";
  }
  if (difficulty >= 4) {
    return "weak";
  }
  if (difficulty <= 2.5) {
    return "strong";
  }
  return "mixed";
}

function takeAgainEvidenceLabel(wouldTakeAgain) {
  if (wouldTakeAgain == null) {
    return "Take-again N/A";
  }
  const rounded = Math.round(wouldTakeAgain);
  if (rounded >= 80) {
    return `High take-again ${rounded}%`;
  }
  if (rounded < 50) {
    return `Low take-again ${rounded}%`;
  }
  return `Mixed take-again ${rounded}%`;
}

function takeAgainEvidenceState(wouldTakeAgain) {
  if (wouldTakeAgain == null) {
    return "limited";
  }
  const rounded = Math.round(wouldTakeAgain);
  if (rounded >= 80) {
    return "strong";
  }
  if (rounded < 50) {
    return "weak";
  }
  return "mixed";
}

function ratingsCountEvidenceLabel(ratingsCount) {
  const normalizedRatingsCount = optionalNonNegativeCount(ratingsCount);
  return normalizedRatingsCount == null ? "N/A ratings" : formatRatingsCount(normalizedRatingsCount);
}

function ratingsCountEvidenceState(ratingsCount) {
  const normalizedRatingsCount = optionalNonNegativeCount(ratingsCount);
  if (normalizedRatingsCount == null || normalizedRatingsCount < MIN_CONFIDENT_RATING_COUNT) {
    return "limited";
  }
  return "strong";
}

function commentSignalEvidenceState(commentSignal) {
  if (commentSignal == null) {
    return "limited";
  }
  const score = Math.round(commentSignal * 100);
  if (score >= 70) {
    return "strong";
  }
  if (score <= 40) {
    return "weak";
  }
  return "mixed";
}

function commentFitSignal(comments = [], tags = [], albertCourseCode = "") {
  const sources = [
    ...asArray(comments).map((comment) => {
      const normalized = normalizeComment(comment);
      return {
        text: normalized.text,
        weight: commentMatchesCourse(normalized, albertCourseCode) ? 3 : 1,
      };
    }),
    ...asArray(tags).map((tag) => ({ text: tag, weight: 1 })),
  ]
    .map(({ text, weight }) => ({ text: String(text ?? "").toLowerCase(), weight }))
    .filter(({ text }) => Boolean(text));
  if (sources.length === 0) {
    return null;
  }

  const positiveSignals = [
    /(?<!not\s)(?<!not very\s)\bclear(?:ly)?\b/,
    /\bexplain(?:s|ed|ing)?\b/,
    /(?<!not\s)(?<!not very\s)\bhelpful\b/,
    /(?<!not\s)(?<!not very\s)\bfair\b/,
    /(?<!not\s)(?<!not very\s)\borganized\b/,
    /(?<!not\s)(?<!not very\s)\bpractical\b/,
    /(?<!not\s)(?<!not very\s)\bexcellent\b/,
    /(?<!not\s)(?<!not very\s)\bgreat\b/,
    /(?<!not\s)(?<!not very\s)\bmanageable\b/,
    /(?<!not\s)(?<!not very\s)(?<!not too\s)\beasy\b/,
    /\beasy\s+to\s+follow\b/,
    /(?<!no\s)\boffice\s+hours\b(?!\s+(?:are|is|were|was)\s+not\b)(?!\s+not\b)/,
    /(?<!not\s)(?<!not very\s)\bresponsive\b/,
    /(?<!not\s)(?<!not very\s)\baccessible\b/,
    /\bquick\s+(?:feedback|grading|responses?|replies)\b/,
    /\bfast\s+(?:feedback|grading|responses?|replies)\b/,
    /\bemails?\s+(?:get|gets|got)\s+replies\b/,
    /\b(?:reply|respond)s?\s+quickly\b/,
    /\bpractice\s+(?:exams?|tests?|problems?)\b/,
    /\breview\s+sessions?\b/,
    /\bstudy\s+guides?\b/,
    /\bexam\s+prep\b/,
    /\bopen[-\s]+notes?\b/,
    /\bopen[-\s]+book\b/,
    /\bgenerous\s+curve\b/,
    /\bcurve\s+on\s+exams?\b/,
    /\bcurved\s+exams?\b/,
    /\bextra\s+credit\b/,
    /\bbonus\s+(?:points?|credit)\b/,
    /\bdrops?\s+(?:the\s+)?lowest\s+(?:quiz|quizzes|homework|assignments?|grades?)\b/,
    /\blowest\s+(?:quiz|quizzes|homework|assignments?|grades?)\s+(?:is|are|was|were)?\s*dropped\b/,
    /\bflexible\s+deadlines?\b/,
    /\ballows?\s+extensions?\b/,
    /\bextensions?\s+(?:are|is|were|was)?\s*allowed\b/,
    /(?<!no\s)(?<!without\s)\bpartial\s+credit\b/,
    /\b(?:slides?|recordings?|notes?)\s+(?:are|is|were|was)?\s*posted\b/,
    /\bposts?\s+(?:slides?|recordings?|notes?)\b/,
    /\bnot\s+hard\b/,
    /\bnot\s+very\s+hard\b/,
    /\bnot\s+tough\b/,
    /\bnot\s+very\s+tough\b/,
    /\bnot\s+confusing\b/,
    /\bnot\s+very\s+confusing\b/,
    /\bnot\s+demanding\b/,
    /\bnot\s+very\s+demanding\b/,
    /\bnot\s+overwhelming\b/,
    /\bnot\s+very\s+overwhelming\b/,
    /\bnot\s+heavy\b/,
    /\bnot\s+very\s+heavy\b/,
    /\bnot\s+too\s+heavy\b/,
    /\bnot\s+fast\b/,
    /\bnot\s+very\s+fast\b/,
    /\bnot\s+too\s+fast\b/,
    /\bnot\s+heavy\s+workload\b/,
    /\bnot\s+too\s+heavy\s+workload\b/,
  ];
  const riskSignals = [
    /(?<!not\s)(?<!not very\s)\bhard\b/,
    /(?<!not\s)(?<!not very\s)\btough\b/,
    /\bavoid\b/,
    /(?<!not\s)(?<!not very\s)\bconfusing\b/,
    /(?<!not\s)(?<!not very\s)\bdemanding\b/,
    /\bdisorganized\b/,
    /\bnot\s+clear\b/,
    /\bnot\s+very\s+clear\b/,
    /\bnot\s+fair\b/,
    /\bnot\s+very\s+fair\b/,
    /\bnot\s+helpful\b/,
    /\bnot\s+very\s+helpful\b/,
    /\bnot\s+organized\b/,
    /\bnot\s+very\s+organized\b/,
    /\bnot\s+practical\b/,
    /\bnot\s+very\s+practical\b/,
    /\bnot\s+manageable\b/,
    /\bnot\s+very\s+manageable\b/,
    /\bnot\s+responsive\b/,
    /\bnot\s+very\s+responsive\b/,
    /\bnot\s+accessible\b/,
    /\bnot\s+very\s+accessible\b/,
    /\bdoes\s+not\s+(?:reply|respond)\b/,
    /\bdoesn't\s+(?:reply|respond)\b/,
    /\bno\s+(?:reply|response)\b/,
    /\bslow\s+(?:feedback|grading|responses?|replies)\b/,
    /\boffice\s+hours\s+(?:are|is|were|was)\s+not\s+responsive\b/,
    /\boffice\s+hours\s+(?:are|is|were|was)\s+not\s+accessible\b/,
    /\bno\s+office\s+hours\b/,
    /\bunresponsive\b/,
    /\bunanswered\b/,
    /\binaccessible\b/,
    /\bharsh\b/,
    /\bharshly\b/,
    /\bstrict\s+grading\b/,
    /\bgrade(?:s|d|ing)?\s+harsh(?:ly)?\b/,
    /\bno\s+curve\b/,
    /\bwithout\s+a\s+curve\b/,
    /\bmandatory\s+attendance\b/,
    /\battendance\s+(?:is|was)\s+mandatory\b/,
    /\brequired\s+attendance\b/,
    /\battendance\s+(?:is|was)\s+required\b/,
    /\bparticipation\s+(?:is|was)\s+graded\b/,
    /\bgraded\s+participation\b/,
    /\bstrict\s+deadlines?\b/,
    /\bno\s+late\s+(?:submissions?|work|assignments?)\b/,
    /\bno\s+extensions?\b/,
    /\bwithout\s+extensions?\b/,
    /\bno\s+partial\s+credit\b/,
    /\bwithout\s+partial\s+credit\b/,
    /\bdeducts?\s+points?\b/,
    /\bpoints?\s+(?:are|is|were|was)?\s*deducted\b/,
    /(?<!not\s)(?<!not very\s)\bbrutal\b/,
    /(?<!not\s)(?<!not very\s)\bimpossible\b/,
    /(?<!not\s)(?<!not very\s)\brude\b/,
    /(?<!not\s)(?<!not very\s)\bcondescending\b/,
    /\bunclear\b/,
    /\bunfair\b/,
    /(?<!not\s)(?<!not very\s)(?<!not too\s)\bfast\b/,
    /(?<!not\s)(?<!not very\s)(?<!not too\s)\bheavy\b/,
    /(?<!not\s)(?<!not very\s)\boverwhelming\b/,
    /(?<!not heavy\s)(?<!not too heavy\s)(?<!manageable\s)(?<!light\s)\bworkload\b/,
  ];
  const positives = countSignalMatches(sources, positiveSignals);
  const risks = countSignalMatches(sources, riskSignals);
  const totalSignals = positives + risks;
  if (totalSignals === 0) {
    return 0.5;
  }
  return clamp01(0.5 + ((positives - risks) / totalSignals) * 0.5);
}

function countSignalMatches(sources, patterns) {
  return sources.reduce((count, { text, weight }) => (
    count + patterns.reduce((matches, pattern) => matches + (pattern.test(text) ? weight : 0), 0)
  ), 0);
}

function optionalNonNegativeCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return null;
  }
  return Math.floor(number);
}

function capitalizeSentence(value) {
  const text = String(value ?? "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function radarAxisLabel(label, index, total) {
  const { x, y } = radarPoint(1.14, index, total);
  return `<text class="nyu-rmp-radar-axis" x="${x}" y="${y}">${escapeHtml(label)}</text>`;
}

function radarPoint(value, index, total) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  const radius = 42 * clamp01(value);
  return {
    x: roundRadarCoordinate(60 + Math.cos(angle) * radius),
    y: roundRadarCoordinate(60 + Math.sin(angle) * radius),
  };
}

function radarGridPoints(radius, total) {
  return Array.from({ length: total }, (_, index) => radarPoint(radius / 42, index, total))
    .map(({ x, y }) => `${x},${y}`)
    .join(" ");
}

function roundRadarCoordinate(value) {
  return Math.round(value * 10) / 10;
}

function scaleFivePoint(value) {
  return value == null ? 0 : clamp01(value / 5);
}

function scalePercent(value) {
  return value == null ? 0 : clamp01(value / 100);
}

function scaleRatingVolume(value) {
  if (value == null) {
    return 0;
  }
  return clamp01(Math.log10(value + 1) / 2);
}

function clamp01(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function statusMarkup(message) {
  return `<span class="nyu-rmp-status" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(message)}</span>`;
}

function wireRefreshAction(card, requestedName, lookupProfessor) {
  card.querySelector(".nyu-rmp-refresh")?.addEventListener("click", () => {
    loadRatingCard({ card, name: requestedName, lookupProfessor, forceRefresh: true, courseCode: card.dataset.nyuRmpCourseCode ?? "" });
  });
}

export function injectStyles(document = globalThis.document) {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
	    .${ROOT_CLASS} {
	      display: grid;
	      gap: 6px;
	      margin: 6px 0 8px;
	      font-family: Aptos, "Segoe UI", sans-serif;
	    }
	    td > .nyu-rmp-rating-root,
	    th > .nyu-rmp-rating-root,
	    [role="cell"] > .nyu-rmp-rating-root,
	    [role="gridcell"] > .nyu-rmp-rating-root,
	    .ps_box-scrollarea .nyu-rmp-rating-root,
	    [class*="ps_box-scrollarea"] .nyu-rmp-rating-root {
	      gap: 4px;
	      margin: 2px 0 4px;
	    }
	    .nyu-rmp-card {
	      border: 1px solid #d9dee8;
	      border-left: 4px solid #667085;
	      border-radius: 8px;
	      background: #ffffff;
	      color: #182033;
	      container-type: inline-size;
	      padding: 12px 13px;
	      box-shadow: 0 1px 2px rgba(16,24,40,0.06), 0 8px 20px rgba(16,24,40,0.07);
	      transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
	    }
	    td .nyu-rmp-card,
	    th .nyu-rmp-card,
	    [role="cell"] .nyu-rmp-card,
	    [role="gridcell"] .nyu-rmp-card,
	    .ps_box-scrollarea .nyu-rmp-card,
	    [class*="ps_box-scrollarea"] .nyu-rmp-card {
	      padding: 8px 10px;
	      border-radius: 7px;
	    }
	    .nyu-rmp-card:hover {
	      border-color: #b9c2d0;
	      box-shadow: 0 2px 4px rgba(16,24,40,0.08), 0 10px 26px rgba(16,24,40,0.1);
	      transform: translateY(-1px);
	    }
	    .nyu-rmp-card-head,
	    .nyu-rmp-tags {
	      align-items: center;
	      display: flex;
	      flex-wrap: wrap;
	      gap: 7px;
	    }
	    .nyu-rmp-card-head {
	      justify-content: space-between;
	      margin-bottom: 5px;
	    }
	    .nyu-rmp-card strong {
	      font-size: 12.5px;
	      font-weight: 700;
	      letter-spacing: 0;
	      line-height: 1.3;
	    }
	    .nyu-rmp-department {
	      color: #5f6b7a;
	      font-size: 10.5px;
	      font-weight: 500;
	      letter-spacing: 0;
	      margin: -2px 0 5px;
	      text-transform: uppercase;
	    }
	    .nyu-rmp-match-note {
	      color: #64748b;
	      font-size: 10.5px;
	      margin: -1px 0 5px;
	    }
	    .nyu-rmp-course-context {
	      align-items: center;
	      background: #f6f7fa;
	      border: 1px solid #dde3ec;
	      border-radius: 6px;
	      color: #344054;
	      display: inline-flex;
	      gap: 5px;
	      line-height: 1;
	      margin: -1px 0 6px;
	      max-width: 100%;
	      padding: 4px 6px;
	      width: fit-content;
	    }
	    .nyu-rmp-course-context span {
	      color: #667085;
	      font-size: 9.5px;
	      font-weight: 750;
	      letter-spacing: 0;
	      text-transform: uppercase;
	    }
	    .nyu-rmp-course-context strong {
	      color: #253044;
	      font-size: 10.5px;
	      font-weight: 800;
	      letter-spacing: 0;
	      line-height: 1;
	    }
	    .nyu-rmp-updated {
	      color: #7a8699;
	      font-size: 10px;
	      margin: -3px 0 6px;
	    }
	    .nyu-rmp-cache-note {
	      background: #fff8e5;
	      border: 1px solid #ecd48b;
	      border-radius: 6px;
	      color: #7c5600;
	      font-size: 10px;
	      font-weight: 650;
	      line-height: 1.35;
	      margin: -2px 0 7px;
	      padding: 5px 6px;
	    }
	    .nyu-rmp-empty-note {
	      background: #f7f8fb;
	      border: 1px solid #dfe5ee;
	      border-radius: 6px;
	      color: #526173;
	      font-size: 10.5px;
	      font-weight: 650;
	      line-height: 1.35;
	      margin-top: 6px;
	      padding: 6px 7px;
	    }
	    .nyu-rmp-card a,
	    .nyu-rmp-refresh,
	    .nyu-rmp-status {
	      color: #344054;
	      font-size: 10.5px;
	      font-weight: 600;
	      letter-spacing: 0;
	      text-transform: uppercase;
	    }
	    .nyu-rmp-card a:hover {
	      color: #57068c;
	    }
	    .nyu-rmp-actions {
	      align-items: center;
	      display: flex;
	      gap: 8px;
	    }
	    .nyu-rmp-actions a,
	    .nyu-rmp-refresh {
	      text-decoration: none;
	    }
	    .nyu-rmp-actions a:hover {
	      text-decoration: underline;
	    }
	    .nyu-rmp-refresh {
	      background: transparent;
	      border: 0;
	      cursor: pointer;
	      font-family: inherit;
	      padding: 0;
	      transition: color 120ms ease;
	    }
	    .nyu-rmp-refresh:hover {
	      color: #57068c;
	    }
	    .nyu-rmp-refresh:active {
	      transform: translateY(1px);
	    }
	    .nyu-rmp-score {
	      font-size: 22px;
	      font-weight: 800;
	      letter-spacing: 0;
	      line-height: 1;
	    }
	    .rating-good .nyu-rmp-score { color: #1a7a4c; }
	    .rating-mixed .nyu-rmp-score { color: #a0620a; }
	    .rating-weak .nyu-rmp-score { color: #b42318; }
	    .is-error .nyu-rmp-score,
	    .is-loading .nyu-rmp-score,
	    .is-empty .nyu-rmp-score { color: #1f1a2e; }
	    .nyu-rmp-score-row,
	    .nyu-rmp-comments {
	      color: #344054;
	      font-size: 11.5px;
	    }
	    .nyu-rmp-metrics {
	      display: grid;
	      gap: 6px;
	      grid-template-columns: minmax(92px, 1.25fr) repeat(2, minmax(72px, 1fr));
	      margin: 8px 0 7px;
	    }
	    .nyu-rmp-metrics dt,
	    .nyu-rmp-metrics dd {
	      margin: 0;
	    }
	    .nyu-rmp-metric {
	      align-content: start;
	      background: #f8fafc;
	      border: 1px solid #e3e8ef;
	      border-radius: 7px;
	      display: grid;
	      gap: 3px;
	      min-width: 0;
	      padding: 7px 8px;
	    }
	    .nyu-rmp-rating-metric {
	      grid-template-columns: auto 1fr;
	    }
	    .nyu-rmp-rating-metric .nyu-rmp-metric-label,
	    .nyu-rmp-rating-metric .nyu-rmp-rating-count {
	      grid-column: 1 / -1;
	    }
	    .nyu-rmp-metric-label {
	      color: #667085;
	      font-size: 9.5px;
	      font-weight: 700;
	      letter-spacing: 0;
	      line-height: 1.1;
	      text-transform: uppercase;
	    }
	    .nyu-rmp-metric-value,
	    .nyu-rmp-rating-count {
	      color: #253044;
	      font-size: 11px;
	      font-weight: 650;
	      line-height: 1.25;
	    }
	    .nyu-rmp-metric-secondary {
	      color: #64748b;
	      font-size: 10.5px;
	      font-weight: 600;
	      line-height: 1.2;
	      margin: 0;
	    }
	    .nyu-rmp-recommendation {
	      align-items: center;
	      background: #f7f8fb;
	      border: 1px solid #dde4ee;
	      border-left: 3px solid #667085;
	      border-radius: 7px;
	      color: #253044;
	      display: grid;
	      gap: 2px 8px;
	      grid-template-columns: minmax(0, 1fr);
	      margin: 8px 0 7px;
	      padding: 7px 9px;
	    }
	    .nyu-rmp-recommendation strong {
	      color: #1f2937;
	      font-size: 11.5px;
	      font-weight: 800;
	      letter-spacing: 0;
	      line-height: 1.15;
	    }
	    .nyu-rmp-recommendation span {
	      color: #667085;
	      font-size: 10.5px;
	      font-weight: 600;
	      line-height: 1.25;
	    }
	    .nyu-rmp-recommendation.is-strong {
	      background: #f0f8f4;
	      border-color: #c2decf;
	      border-left-color: #1a7a4c;
	    }
	    .nyu-rmp-recommendation.is-mixed {
	      background: #fff8ed;
	      border-color: #ebd5a8;
	      border-left-color: #b7791f;
	    }
	    .nyu-rmp-recommendation.is-weak {
	      background: #fff5f5;
	      border-color: #eac0c0;
	      border-left-color: #b42318;
	    }
	    .nyu-rmp-recommendation.is-limited {
	      background: #f6f4f8;
	      border-color: #ddd6e8;
	      border-left-color: #7a6a90;
	    }
	    .nyu-rmp-evidence {
	      display: flex;
	      flex-wrap: wrap;
	      gap: 5px;
	      margin: -1px 0 7px;
	    }
	    .nyu-rmp-evidence-chip {
	      background: #ffffff;
	      border: 1px solid #dbe3ee;
	      border-radius: 999px;
	      color: #344054;
	      font-size: 10px;
	      font-weight: 700;
	      letter-spacing: 0;
	      line-height: 1.15;
	      padding: 4px 7px;
	    }
	    .nyu-rmp-evidence-chip.is-strong {
	      background: #edf7f1;
	      border-color: #b8dcc8;
	      color: #1a6a3e;
	    }
	    .nyu-rmp-evidence-chip.is-mixed {
	      background: #fef7ed;
	      border-color: #e8cf9a;
	      color: #8a5a14;
	    }
	    .nyu-rmp-evidence-chip.is-weak {
	      background: #fef4f4;
	      border-color: #e8b8b8;
	      color: #a82020;
	    }
	    .nyu-rmp-evidence-chip.is-limited {
	      background: #f6f4f8;
	      border-color: #ddd6e8;
	      color: #6b5e7a;
	    }
	    .nyu-rmp-radar-wrap {
	      align-items: center;
	      display: grid;
	      gap: 7px;
	      grid-template-columns: minmax(104px, 128px) minmax(0, 1fr);
	      margin: 5px 0 8px;
	    }
	    .nyu-rmp-radar {
	      display: block;
	      height: 112px;
	      overflow: visible;
	      width: min(112px, 100%);
	    }
	    .nyu-rmp-radar-grid {
	      fill: #f8fafc;
	      stroke: #dbe3ee;
	      stroke-width: 1;
	    }
	    .nyu-rmp-radar-grid.inner {
	      fill: none;
	      opacity: 0.8;
	    }
	    .nyu-rmp-radar-spoke {
	      stroke: #e4eaf2;
	      stroke-width: 1;
	    }
	    .nyu-rmp-radar-shape {
	      fill: rgba(87, 6, 140, 0.16);
	      stroke: #57068c;
	      stroke-linejoin: round;
	      stroke-width: 2;
	    }
	    .nyu-rmp-radar-wrap.is-strong .nyu-rmp-radar-shape {
	      fill: rgba(26, 122, 76, 0.16);
	      stroke: #1a7a4c;
	    }
	    .nyu-rmp-radar-wrap.is-mixed .nyu-rmp-radar-shape {
	      fill: rgba(176, 105, 20, 0.16);
	      stroke: #b7791f;
	    }
	    .nyu-rmp-radar-wrap.is-weak .nyu-rmp-radar-shape {
	      fill: rgba(180, 35, 24, 0.14);
	      stroke: #b42318;
	    }
	    .nyu-rmp-radar-wrap.is-limited .nyu-rmp-radar-shape {
	      fill: rgba(122, 106, 144, 0.14);
	      stroke: #7a6a90;
	    }
	    .nyu-rmp-radar-node {
	      fill: #ffffff;
	      stroke: #57068c;
	      stroke-width: 2;
	    }
	    .nyu-rmp-radar-wrap.is-strong .nyu-rmp-radar-node {
	      stroke: #1a7a4c;
	    }
	    .nyu-rmp-radar-wrap.is-mixed .nyu-rmp-radar-node {
	      stroke: #b7791f;
	    }
	    .nyu-rmp-radar-wrap.is-weak .nyu-rmp-radar-node {
	      stroke: #b42318;
	    }
	    .nyu-rmp-radar-wrap.is-limited .nyu-rmp-radar-node {
	      stroke: #7a6a90;
	    }
	    .nyu-rmp-radar-node.is-unavailable {
	      fill: #f8fafc;
	      opacity: 0.62;
	      stroke: #98a2b3;
	      stroke-dasharray: 2 2;
	    }
	    .nyu-rmp-radar-axis {
	      fill: #667085;
	      font-size: 8.5px;
	      font-weight: 700;
	      letter-spacing: 0;
	      text-anchor: middle;
	      text-transform: uppercase;
	    }
	    .nyu-rmp-radar-legend {
	      display: grid;
	      gap: 4px;
	      grid-template-columns: repeat(2, minmax(64px, 1fr));
	      list-style: none;
	      margin: 0;
	      padding: 0;
	    }
	    .nyu-rmp-radar-summary {
	      display: grid;
	      gap: 5px;
	      min-width: 0;
	    }
	    .nyu-rmp-radar-fit {
	      align-items: center;
	      background: #1f1a2e;
	      border: 1px solid #1f1a2e;
	      border-radius: 7px;
	      color: #ffffff;
	      display: grid;
	      gap: 6px;
	      grid-template-columns: auto 1fr;
	      line-height: 1;
	      padding: 6px 7px;
	    }
	    .nyu-rmp-radar-fit.is-limited {
	      background: #2f2a1f;
	      border-color: #5f4a1f;
	    }
	    .nyu-rmp-radar-fit.is-strong {
	      background: #183f2c;
	      border-color: #1f6f48;
	    }
	    .nyu-rmp-radar-fit.is-mixed {
	      background: #4a3318;
	      border-color: #8a5a14;
	    }
	    .nyu-rmp-radar-fit.is-weak {
	      background: #4a1f1d;
	      border-color: #9f2f27;
	    }
	    .nyu-rmp-radar-fit.is-limited {
	      background: #30283b;
	      border-color: #685778;
	    }
	    .nyu-rmp-radar-fit span {
	      color: #d8d1e6;
	      font-size: 9.5px;
	      font-weight: 750;
	      letter-spacing: 0;
	      text-transform: uppercase;
	    }
	    .nyu-rmp-radar-fit strong {
	      color: #ffffff;
	      font-size: 18px;
	      font-weight: 800;
	      justify-self: end;
	      letter-spacing: 0;
	    }
	    .nyu-rmp-radar-fit em {
	      color: #bfb6cf;
	      font-size: 9.5px;
	      font-style: normal;
	      font-weight: 650;
	      grid-column: 1 / -1;
	      letter-spacing: 0;
	    }
	    .nyu-rmp-radar-fit.is-limited em:last-child {
	      color: #f2d28a;
	      font-weight: 750;
	      text-transform: uppercase;
	    }
	    .nyu-rmp-radar-weight-note {
	      color: #526173;
	      font-size: 10px;
	      font-weight: 700;
	      line-height: 1.2;
	    }
	    .nyu-rmp-radar-legend li {
	      background: #f8fafc;
	      border: 1px solid #e3e8ef;
	      border-radius: 6px;
	      color: #344054;
	      font-size: 10.5px;
	      font-weight: 650;
	      line-height: 1.2;
	      padding: 5px 6px;
	    }
	    .nyu-rmp-radar-legend-item.is-strong {
	      background: #edf7f1;
	      border-color: #b8dcc8;
	      color: #1a6a3e;
	    }
	    .nyu-rmp-radar-legend-item.is-mixed {
	      background: #fef7ed;
	      border-color: #e8cf9a;
	      color: #8a5a14;
	    }
	    .nyu-rmp-radar-legend-item.is-weak {
	      background: #fef4f4;
	      border-color: #e8b8b8;
	      color: #a82020;
	    }
	    .nyu-rmp-radar-legend-item.is-limited {
	      background: #f6f4f8;
	      border-color: #ddd6e8;
	      color: #6b5e7a;
	    }
	    .nyu-rmp-score-row .nyu-rmp-verdict {
	      align-self: center;
	      border: 1px solid #d0d5dd;
	      border-radius: 999px;
	      color: #344054;
	      font-size: 10.5px;
	      font-weight: 600;
	      justify-self: start;
	      letter-spacing: 0;
	      line-height: 1.15;
	      padding: 2px 7px;
	    }
	    .rating-good .nyu-rmp-verdict {
	      background: #edf7f1;
	      border-color: #b8dcc8;
	      color: #1a6a3e;
	    }
	    .rating-mixed .nyu-rmp-verdict {
	      background: #fef7ed;
	      border-color: #e8cf9a;
	      color: #8a5a14;
	    }
	    .rating-weak .nyu-rmp-verdict,
	    .is-error .nyu-rmp-verdict {
	      background: #fef4f4;
	      border-color: #e8b8b8;
	      color: #a82020;
	    }
	    .nyu-rmp-tags {
	      gap: 5px;
	    }
	    .nyu-rmp-tags span {
	      background: #f6f8fb;
	      border: 1px solid #e1e7ef;
	      border-radius: 999px;
	      color: #344054;
	      font-size: 10px;
	      font-weight: 500;
	      padding: 2px 8px;
	    }
	    .nyu-rmp-comments-panel {
	      background: #fbfcfe;
	      border-left: 2px solid #c7d7ef;
	      margin-top: 8px;
	      padding: 7px 0 2px 9px;
	    }
	    .nyu-rmp-comments-heading {
	      align-items: center;
	      color: #475467;
	      display: flex;
	      flex-wrap: wrap;
	      font-size: 9.5px;
	      font-weight: 750;
	      gap: 5px;
	      letter-spacing: 0;
	      line-height: 1.1;
	      margin: 0 0 5px;
	      text-transform: uppercase;
	    }
	    .nyu-rmp-comments-sample {
	      background: #eef2f7;
	      border: 1px solid #dbe3ee;
	      border-radius: 999px;
	      color: #526173;
	      font-size: 9px;
	      font-weight: 750;
	      letter-spacing: 0;
	      line-height: 1;
	      padding: 2px 6px;
	      text-transform: uppercase;
	    }
	    .nyu-rmp-comments-course-match {
	      background: #eaf7f0;
	      border: 1px solid #b9dfca;
	      border-radius: 999px;
	      color: #155b3a;
	      font-size: 9px;
	      font-weight: 800;
	      line-height: 1;
	      padding: 2px 6px;
	      text-transform: uppercase;
	    }
	    .nyu-rmp-comments-course-match.is-strong {
	      background: #eaf7f0;
	      border-color: #b9dfca;
	      color: #155b3a;
	    }
	    .nyu-rmp-comments-course-match.is-mixed {
	      background: #fef7ed;
	      border-color: #e8cf9a;
	      color: #8a5a14;
	    }
	    .nyu-rmp-comments-course-match.is-weak {
	      background: #fef4f4;
	      border-color: #e8b8b8;
	      color: #a82020;
	    }
	    .nyu-rmp-comments-course-match.is-limited {
	      background: #f6f4f8;
	      border-color: #ddd6e8;
	      color: #6b5e7a;
	    }
	    .nyu-rmp-comments-course-match.is-empty {
	      background: #f6f4f8;
	      border-color: #ddd6e8;
	      color: #6b5e7a;
	    }
	    .nyu-rmp-comments {
	      margin: 0;
	      padding-left: 13px;
	    }
	    .nyu-rmp-comments-empty {
	      color: #667085;
	      font-size: 10.5px;
	      font-weight: 550;
	      line-height: 1.35;
	      margin: 0 0 4px;
	    }
	    .nyu-rmp-comments-truncated {
	      color: #667085;
	      font-size: 10px;
	      font-weight: 650;
	      line-height: 1.3;
	      margin: 0 0 4px;
	    }
	    .nyu-rmp-comments li {
	      margin-bottom: 6px;
	    }
	    .nyu-rmp-comment.is-course-match {
	      background: #f3fbf6;
	      border-left: 2px solid #4f9b6e;
	      border-radius: 5px;
	      margin-left: -8px;
	      padding: 5px 7px 5px 8px;
	    }
	    .nyu-rmp-comment.is-course-match.is-strong {
	      background: #f3fbf6;
	      border-left-color: #4f9b6e;
	    }
	    .nyu-rmp-comment.is-course-match.is-mixed {
	      background: #fff8ed;
	      border-left-color: #b7791f;
	    }
	    .nyu-rmp-comment.is-course-match.is-weak {
	      background: #fff5f5;
	      border-left-color: #b42318;
	    }
	    .nyu-rmp-comment.is-course-match.is-limited {
	      background: #f6f4f8;
	      border-left-color: #7a6a90;
	    }
	    .nyu-rmp-comments p {
	      margin: 0;
	      line-height: 1.45;
	    }
	    .nyu-rmp-comment-toggle {
	      background: transparent;
	      border: 0;
	      color: #57068c;
	      cursor: pointer;
	      font-family: inherit;
	      font-size: 10.5px;
	      font-weight: 600;
	      letter-spacing: 0;
	      margin-top: 2px;
	      padding: 0;
	      text-transform: uppercase;
	    }
	    .nyu-rmp-comment-toggle:hover {
	      text-decoration: underline;
	    }
	    .nyu-rmp-comment-toggle:active {
	      transform: translateY(1px);
	    }
	    .nyu-rmp-comments-expand {
	      background: #f4f7f5;
	      border: 1px solid #d8e1dc;
	      border-radius: 5px;
	      color: #245943;
	      cursor: pointer;
	      font-size: 10px;
	      font-weight: 750;
	      line-height: 1.2;
	      margin: 0 0 3px;
	      padding: 5px 7px;
	      transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
	      will-change: transform;
	    }
	    .nyu-rmp-comments-expand:hover {
	      background: #eaf2ee;
	      border-color: #b7c9c0;
	      color: #173d2d;
	    }
	    .nyu-rmp-comments-expand:active {
	      transform: translateY(1px);
	    }
	    .nyu-rmp-comment-meta {
	      color: #7a8699;
	      display: block;
	      font-size: 10px;
	      margin-top: 2px;
	    }
	    .nyu-rmp-comment-meta.is-course-match {
	      color: #155b3a;
	      font-weight: 700;
	    }
	    .nyu-rmp-skeleton {
	      animation: nyu-rmp-shimmer 1.3s infinite linear;
	      background: linear-gradient(105deg, #f0ecf6 8%, #faf8fd 18%, #f0ecf6 33%);
	      background-size: 280% 100%;
	      border-radius: 5px;
	      height: 18px;
	    }
	    .nyu-rmp-card.is-loading {
	      border-left-color: #b8a8d0;
	    }
	    .nyu-rmp-card.is-empty {
	      border-left-color: #d0c8de;
	    }
	    .nyu-rmp-card.rating-good { border-left-color: #1a7a4c; }
	    .nyu-rmp-card.rating-mixed { border-left-color: #c4850e; }
	    .nyu-rmp-card.rating-weak,
	    .nyu-rmp-card.is-error { border-left-color: #c42020; }
	    @keyframes nyu-rmp-shimmer {
	      to { background-position: -280% 0; }
	    }
	    @container (max-width: 360px) {
	      .nyu-rmp-card-head,
	      .nyu-rmp-actions {
	        align-items: flex-start;
	        flex-direction: column;
	      }
	      .nyu-rmp-actions {
	        gap: 5px;
	      }
	      .nyu-rmp-metrics,
	      .nyu-rmp-radar-wrap,
	      .nyu-rmp-radar-legend {
	        grid-template-columns: 1fr;
	      }
	      .nyu-rmp-radar-wrap {
	        justify-items: start;
	      }
	      .nyu-rmp-radar-summary {
	        width: 100%;
	      }
	      .nyu-rmp-rating-metric {
	        grid-template-columns: 1fr;
	      }
	      .nyu-rmp-score-row .nyu-rmp-verdict {
	        justify-self: start;
	      }
	    }
	    @container (max-width: 180px) {
	      .nyu-rmp-radar {
	        overflow: hidden;
	      }
	      .nyu-rmp-radar-axis {
	        display: none;
	      }
	    }
	    @media (prefers-reduced-motion: reduce) {
	      .nyu-rmp-card,
	      .nyu-rmp-refresh,
	      .nyu-rmp-comment-toggle {
	        transition: none;
	      }
	      .nyu-rmp-card:hover,
	      .nyu-rmp-refresh:active,
	      .nyu-rmp-comment-toggle:active {
	        transform: none;
	      }
	      .nyu-rmp-skeleton {
	        animation: none;
	        background-position: 0 0;
	      }
	    }
	  `;
  document.documentElement.append(style);
}

function formatScore(value) {
  return value == null ? "N/A" : Number(value).toFixed(1);
}

function formatRatingLabel(value) {
  return value == null ? "RMP rating unavailable" : `RMP rating ${formatScore(value)} out of 5`;
}

function formatRatingSummary(value) {
  return value == null ? "rating unavailable" : `${formatScore(value)} out of 5`;
}

function formatCardSummaryLabel({ professorName, department, rating, ratingVerdict, recommendation, radarFit, ratingsCountLabel, difficulty, ease, wouldTakeAgain, commentSignal = null, commentCount, courseMatchedCommentCount = 0, courseCode = "", tagNames = [], updatedAt, matchNote, cacheNotice }) {
  const takeAgainLabel = wouldTakeAgain == null ? "N/A" : `${Math.round(wouldTakeAgain)}%`;
  return [
    `RMP rating for ${professorName}: ${formatRatingSummary(rating)}`,
    department ? `department ${department}` : "",
    courseCode ? `Albert course ${courseCode}` : "",
    ratingVerdict,
    recommendation ? `recommendation ${recommendation.label}` : "",
    formatRadarFitSummary(radarFit),
    ratingsCountLabel,
    `difficulty ${formatScore(difficulty)} out of 5`,
    `ease ${formatScore(ease)} out of 5`,
    `take again ${takeAgainLabel}`,
    formatCommentSignalSummary(commentSignal, { courseCode, courseMatchedCommentCount }),
    formatUsefulCommentSummary(commentCount, courseMatchedCommentCount, courseCode),
    formatTagSummary(tagNames),
    updatedAt,
    matchNote,
    cacheNotice,
  ].filter(Boolean).join(", ");
}

function formatCommentSignalSummary(commentSignal, { courseCode = "", courseMatchedCommentCount = 0 } = {}) {
  if (commentSignal == null) {
    return "";
  }
  const score = Math.round(commentSignal * 100);
  if (courseCode && courseMatchedCommentCount > 0 && score <= 40) {
    return `${courseCode} comment risk ${score} out of 100`;
  }
  if (courseCode && courseMatchedCommentCount > 0 && score >= 70) {
    return `${courseCode} comment support ${score} out of 100`;
  }
  return `comment signal ${score} out of 100`;
}

function formatCacheNotice(cacheStatus) {
  return cacheStatus === "stale-refresh-failed"
    ? "Showing cached RMP data; refresh failed"
    : "";
}

function formatRadarFitSummary(radarFit) {
  if (!radarFit) {
    return "";
  }
  const limitedData = radarFit.availableMetricCount < radarFit.totalMetricCount ? ", limited data" : "";
  return `professor fit ${radarFit.score} out of 100 based on ${radarFit.availableMetricCount} of ${radarFit.totalMetricCount} radar metrics${limitedData}`;
}

function formatTagSummary(tagNames) {
  return tagNames.length > 0 ? `tags ${tagNames.join(", ")}` : "";
}

function formatUsefulCommentSummary(commentCount, courseMatchedCommentCount = 0, courseCode = "") {
  if (commentCount == null) {
    return "";
  }
  const commentSummary = commentCount === 1 ? "1 useful comment shown" : `${commentCount} useful comments shown`;
  if (!courseCode) {
    return commentSummary;
  }
  if (courseMatchedCommentCount <= 0 && commentCount > 0) {
    return `${commentSummary}, ${formatNoCourseMatchSummary(courseCode)}`;
  }
  if (courseMatchedCommentCount <= 0) {
    return commentSummary;
  }
  return `${commentSummary}, ${formatCourseMatchSummary(courseMatchedCommentCount, courseCode)}`;
}

function formatCourseMatchSummary(courseMatchedCommentCount, courseCode) {
  return courseMatchedCommentCount === 1
    ? `1 useful comment matches Albert course ${courseCode}`
    : `${courseMatchedCommentCount} useful comments match Albert course ${courseCode}`;
}

function formatRatingsCount(value) {
  return `${value} ${value === 1 ? "rating" : "ratings"}`;
}

function formatOptionalRatingsCount(value) {
  const count = isMissingValue(value) ? null : nonNegativeCount(value);
  return count == null ? "N/A ratings" : formatRatingsCount(count);
}

function isMissingValue(value) {
  return value == null || String(value).trim() === "";
}

function nonNegativeCount(value) {
  const number = nonNegativeNumberOrNull(value);
  return number == null ? 0 : Math.floor(number);
}

function nonNegativeNumberOrNull(value) {
  const number = numberOrNull(value);
  return number == null || number < 0 ? null : number;
}

function percentNumberOrNull(value) {
  const number = nonNegativeNumberOrNull(stripPercentSuffix(value));
  return number == null || number > 100 ? null : number;
}

function stripPercentSuffix(value) {
  return typeof value === "string" ? value.trim().replace(/%$/, "") : value;
}

function rmpScaleNumberOrNull(value) {
  const number = nonNegativeNumberOrNull(value);
  return number == null || number > 5 ? null : number;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatComment(comment, textId, albertCourseCode = "", { hidden = false } = {}) {
  const normalized = normalizeComment(comment);
  if (!isUsefulCommentText(normalized.text)) {
    return "";
  }

  const preview = truncateComment(normalized.text);
  const isTruncated = preview !== normalized.text;
  const isCourseMatch = commentMatchesCourse(normalized, albertCourseCode);
  const signalState = isCourseMatch ? commentSignalEvidenceState(commentFitSignal([normalized], [], albertCourseCode)) : "";
  const signalLabel = isCourseMatch
    ? ` aria-label="${escapeHtml(evidenceChipStatePrefix(signalState))}: useful comment matches Albert course ${escapeHtml(normalizeCourseCode(albertCourseCode) || albertCourseCode)}"`
    : "";
  const metadata = [
    normalized.course ? `Course ${normalized.course}${isCourseMatch ? " (Albert match)" : ""}` : "",
    !normalized.course && isCourseMatch ? "Albert course match" : "",
    normalized.helpfulRating == null ? "" : `${normalized.helpfulRating} useful`,
    normalized.clarityRating == null ? "" : `Clarity ${formatScore(normalized.clarityRating)}`,
    normalized.difficultyRating == null ? "" : `Difficulty ${formatScore(normalized.difficultyRating)}`,
  ].filter(Boolean);

  return `
    <li class="nyu-rmp-comment${isCourseMatch ? ` is-course-match is-${escapeHtml(signalState)}` : ""}${hidden ? " is-hidden" : ""}"${hidden ? " hidden" : ""}${signalLabel}>
      <p class="nyu-rmp-comment-text" id="${escapeHtml(textId)}">${escapeHtml(preview)}</p>
      ${isTruncated ? `
        <button
          class="nyu-rmp-comment-toggle"
          type="button"
          aria-expanded="false"
          aria-controls="${escapeHtml(textId)}"
          data-preview-text="${escapeHtml(preview)}"
          data-full-text="${escapeHtml(normalized.text)}"
        >Show more</button>
      ` : ""}
      ${metadata.length > 0 ? `<span class="nyu-rmp-comment-meta${isCourseMatch ? " is-course-match" : ""}">${metadata.map(escapeHtml).join(" | ")}</span>` : ""}
    </li>
  `;
}

function prioritizeCourseMatchedComments(comments, albertCourseCode = "") {
  return asArray(comments)
    .map((comment, index) => ({ comment, index, isCourseMatch: commentMatchesCourse(comment, albertCourseCode) }))
    .sort((left, right) => Number(right.isCourseMatch) - Number(left.isCourseMatch) || left.index - right.index)
    .map(({ comment }) => comment);
}

function countCourseMatchedComments(comments, albertCourseCode = "") {
  return asArray(comments).filter((comment) => commentMatchesCourse(comment, albertCourseCode)).length;
}

function commentMatchesCourse(comment, albertCourseCode = "") {
  const normalized = normalizeComment(comment);
  const normalizedAlbertCourseCode = normalizeCourseCode(albertCourseCode);
  if (!normalizedAlbertCourseCode) {
    return false;
  }
  return [normalized.course, normalized.text]
    .filter(Boolean)
    .some((value) => normalizeCourseCode(value) === normalizedAlbertCourseCode);
}

function renderCommentsPanel(comments, { courseMatchedCommentCount = 0, courseCode = "", commentSignal = null, totalUsefulCommentCount, visibleCommentCount, listId = "nyu-rmp-comments" } = {}) {
  const renderedCommentCount = countRenderedComments(comments);
  const shownCommentCount = Number.isFinite(visibleCommentCount) ? visibleCommentCount : renderedCommentCount;
  const heading = shownCommentCount > 0 ? `Most useful comments (${shownCommentCount})` : "Most useful comments";
  const sampleLabel = `Useful comments selected from a ${RMP_COMMENT_SAMPLE_SIZE}-rating RMP sample`;
  const sampleText = `${RMP_COMMENT_SAMPLE_SIZE}-rating sample`;
  const usefulCommentCount = Number.isFinite(totalUsefulCommentCount) ? totalUsefulCommentCount : renderedCommentCount;
  const hiddenCommentCount = Math.max(0, usefulCommentCount - shownCommentCount);
  const hasCourseContext = Boolean(courseCode);
  const hasUsefulComments = usefulCommentCount > 0;
  const matchBadge = courseMatchedCommentCount > 0 && hasCourseContext
    ? renderCourseMatchBadge(courseMatchedCommentCount, courseCode, commentSignal)
    : hasCourseContext && hasUsefulComments
      ? `<span class="nyu-rmp-comments-course-match is-empty">${escapeHtml(formatNoCourseMatchBadge(courseCode))}</span>`
      : "";
  const courseMatchLabel = courseMatchedCommentCount > 0 && courseCode
    ? formatCourseMatchSummary(courseMatchedCommentCount, courseCode)
    : courseCode && hasUsefulComments
      ? formatNoCourseMatchSummary(courseCode)
    : "";
  const shownLabel = hiddenCommentCount > 0
    ? `${shownCommentCount} of ${usefulCommentCount} useful comments shown`
    : `${shownCommentCount} shown`;
  const expandedShownLabel = `${usefulCommentCount} of ${usefulCommentCount} useful comments shown`;
  const listLabel = courseMatchLabel
    ? `Most useful RMP comments from a ${RMP_COMMENT_SAMPLE_SIZE}-rating sample, ${shownLabel}, ${courseMatchLabel}`
    : `Most useful RMP comments from a ${RMP_COMMENT_SAMPLE_SIZE}-rating sample, ${shownLabel}`;
  const expandedListLabel = courseMatchLabel
    ? `Most useful RMP comments from a ${RMP_COMMENT_SAMPLE_SIZE}-rating sample, ${expandedShownLabel}, ${courseMatchLabel}`
    : `Most useful RMP comments from a ${RMP_COMMENT_SAMPLE_SIZE}-rating sample, ${expandedShownLabel}`;
  const truncationNote = hiddenCommentCount > 0
    ? `<p class="nyu-rmp-comments-truncated">Showing ${shownCommentCount} of ${usefulCommentCount} useful comments</p>`
    : "";
  const expandControl = hiddenCommentCount > 0
    ? `<button class="nyu-rmp-comments-expand" type="button" aria-expanded="false" aria-controls="${escapeHtml(listId)}" data-collapsed-text="${escapeHtml(`Show ${hiddenCommentCount} more comments`)}" data-expanded-text="Show fewer comments" data-collapsed-note="${escapeHtml(`Showing ${shownCommentCount} of ${usefulCommentCount} useful comments`)}" data-expanded-note="${escapeHtml(`Showing ${usefulCommentCount} of ${usefulCommentCount} useful comments`)}" data-collapsed-heading="${escapeHtml(heading)}" data-expanded-heading="${escapeHtml(`Most useful comments (${usefulCommentCount})`)}" data-collapsed-label="${escapeHtml(listLabel)}" data-expanded-label="${escapeHtml(expandedListLabel)}">Show ${hiddenCommentCount} more comments</button>`
    : "";
  const body = comments
    ? `<ul class="nyu-rmp-comments" id="${escapeHtml(listId)}" aria-label="${escapeHtml(listLabel)}">${comments}</ul>`
    : `<p class="nyu-rmp-comments-empty">No useful comments found in the ${RMP_COMMENT_SAMPLE_SIZE}-rating RMP sample.</p>`;
  return `
    <div class="nyu-rmp-comments-panel" role="region" aria-label="${escapeHtml(listLabel)}">
      <div class="nyu-rmp-comments-heading">${heading}<span class="nyu-rmp-comments-sample" aria-label="${escapeHtml(sampleLabel)}">${escapeHtml(sampleText)}</span>${matchBadge}</div>
      ${body}
      ${truncationNote}
      ${expandControl}
    </div>
  `;
}

function renderCourseMatchBadge(courseMatchedCommentCount, courseCode, commentSignal = null) {
  const state = commentSignalEvidenceState(commentSignal);
  return `<span class="nyu-rmp-comments-course-match is-${escapeHtml(state)}" aria-label="${escapeHtml(evidenceChipStatePrefix(state))}: ${escapeHtml(formatCourseMatchSummary(courseMatchedCommentCount, courseCode))}">${escapeHtml(formatCourseMatchBadge(courseMatchedCommentCount, courseCode))}</span>`;
}

function formatCourseMatchBadge(courseMatchedCommentCount, courseCode) {
  const matchLabel = courseMatchedCommentCount === 1 ? "match" : "matches";
  return `${courseMatchedCommentCount} ${courseCode} ${matchLabel}`;
}

function formatNoCourseMatchBadge(courseCode) {
  return `No ${courseCode} matches`;
}

function formatNoCourseMatchSummary(courseCode) {
  return `no ${courseCode} comment matches`;
}

function countRenderedComments(comments) {
  return (String(comments ?? "").match(/<li\b/g) ?? []).length;
}

function commentTextId(card, index) {
  return `nyu-rmp-comment-${card.dataset.nyuRmpCardId || "0"}-${index + 1}`;
}

function wireCommentToggleActions(card) {
  for (const button of card.querySelectorAll(".nyu-rmp-comment-toggle")) {
    button.addEventListener("click", () => {
      const commentText = button.parentElement?.querySelector(".nyu-rmp-comment-text");
      if (!commentText) {
        return;
      }

      const isExpanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!isExpanded));
      button.textContent = isExpanded ? "Show more" : "Show less";
      commentText.textContent = isExpanded ? button.dataset.previewText : button.dataset.fullText;
    });
  }
}

function wireCommentsExpandActions(card) {
  const button = card.querySelector(".nyu-rmp-comments-expand");
  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    const isExpanded = button.getAttribute("aria-expanded") === "true";
    const nextExpanded = !isExpanded;
    const panel = button.closest(".nyu-rmp-comments-panel");
    const list = panel?.querySelector(".nyu-rmp-comments");
    const note = panel?.querySelector(".nyu-rmp-comments-truncated");
    const heading = panel?.querySelector(".nyu-rmp-comments-heading");

    for (const comment of panel?.querySelectorAll(".nyu-rmp-comment.is-hidden") ?? []) {
      comment.hidden = !nextExpanded;
    }

    button.setAttribute("aria-expanded", String(nextExpanded));
    button.textContent = nextExpanded ? button.dataset.expandedText : button.dataset.collapsedText;
    const nextLabel = nextExpanded ? button.dataset.expandedLabel : button.dataset.collapsedLabel;
    if (nextLabel) {
      panel?.setAttribute("aria-label", nextLabel);
      list?.setAttribute("aria-label", nextLabel);
    }
    if (note) {
      note.textContent = nextExpanded ? button.dataset.expandedNote : button.dataset.collapsedNote;
    }
    if (heading?.firstChild) {
      heading.firstChild.textContent = nextExpanded ? button.dataset.expandedHeading : button.dataset.collapsedHeading;
    }
    const nextCardLabel = nextExpanded ? card.dataset.nyuRmpExpandedLabel : card.dataset.nyuRmpCollapsedLabel;
    if (nextCardLabel) {
      card.setAttribute("aria-label", nextCardLabel);
    }
  });
}

function truncateComment(text) {
  if (text.length <= COMMENT_PREVIEW_LENGTH) {
    return text;
  }
  return `${text.slice(0, COMMENT_PREVIEW_LENGTH).trimEnd()}...`;
}

function normalizeComment(comment) {
  if (typeof comment === "string") {
    return { text: normalizeCommentText(comment) };
  }

  return {
    text: normalizeCommentText(comment?.text),
    course: normalizeCommentMetadataText(comment?.course),
    helpfulRating: nonNegativeNumberOrNull(comment?.helpfulRating),
    clarityRating: rmpScaleNumberOrNull(comment?.clarityRating),
    difficultyRating: rmpScaleNumberOrNull(comment?.difficultyRating),
  };
}

function isUsefulCommentText(value) {
  const text = normalizeCommentText(value);
  const normalized = text.toLowerCase().replace(/[.!?]+$/g, "").trim();
  return /\p{L}|\p{N}/u.test(text) && !PLACEHOLDER_COMMENT_TEXT.has(normalized);
}

function normalizeCommentText(value) {
  return decodeHtmlEntities(value).trim().replace(/\s+/g, " ");
}

function normalizeCommentMetadataText(value) {
  return typeof value === "string" ? normalizeCommentText(value) : "";
}

function decodeHtmlEntities(value) {
  const namedEntities = {
    amp: "&",
    apos: "'",
    emdash: "-",
    endash: "-",
    hellip: "...",
    gt: ">",
    lt: "<",
    mdash: "-",
    nbsp: " ",
    ndash: "-",
    quot: "\"",
    rdquo: "\"",
    reg: "(R)",
    rsquo: "'",
    ldquo: "\"",
    lsquo: "'",
    trade: "(TM)",
  };

  return String(value ?? "").replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (entity, token) => {
    const normalized = token.toLowerCase();
    if (normalized.startsWith("#x")) {
      return codePointEntity(normalized.slice(2), 16) ?? entity;
    }
    if (normalized.startsWith("#")) {
      return codePointEntity(normalized.slice(1), 10) ?? entity;
    }
    return Object.prototype.hasOwnProperty.call(namedEntities, normalized)
      ? namedEntities[normalized]
      : entity;
  });
}

function codePointEntity(value, radix) {
  const codePoint = Number.parseInt(value, radix);
  if (!Number.isFinite(codePoint)) {
    return null;
  }
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return null;
  }
}

function numberOrNull(value) {
  if (value == null || value === "") {
    return null;
  }
  const number = Number(normalizeNumericString(stripScaleSuffix(value)));
  return Number.isFinite(number) ? number : null;
}

function stripScaleSuffix(value) {
  return typeof value === "string" ? value.trim().replace(/\s*\/\s*5\s*$/i, "") : value;
}

function normalizeNumericString(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim().replace(/\s+ratings?$/i, "");
  const abbreviatedThousands = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*k$/i);
  if (abbreviatedThousands) {
    return String(Number(abbreviatedThousands[1]) * 1000);
  }

  return /^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(trimmed) ? trimmed.replace(/,/g, "") : trimmed;
}

function formatUpdatedAt(value) {
  const timestamp = numberOrNull(value);
  if (timestamp == null) {
    return "";
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][date.getUTCMonth()];
  return `Updated ${month} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

function formatMatchNote(professorName, requestedName, matchConfidence) {
  const requested = String(requestedName ?? "").trim();
  if (!requested || compactName(professorName) === compactName(requested)) {
    return "";
  }
  const prefix = matchConfidence === "fuzzy" ? "Fuzzy RMP match - " : "";
  return `${prefix}Albert: ${requested}`;
}

function compactName(value) {
  return foldDiacritics(value).toLowerCase().replace(/[^a-z]/g, "");
}

function foldDiacritics(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeTagName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function refreshLabel(name) {
  return `Refresh RMP rating for ${name}`;
}

function retryLabel(name) {
  return `Retry RMP rating for ${name}`;
}

function searchLabel(name) {
  return `Search RMP for ${name}`;
}

function profileLabel(name) {
  return `Open RMP profile for ${name}`;
}

function rmpSearchUrl(name) {
  return `https://www.ratemyprofessors.com/search/professors/1381?q=${encodeURIComponent(name)}`;
}

function safeRmpProfileUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    const host = url.hostname.toLowerCase();
    if (url.protocol === "https:" && (host === "www.ratemyprofessors.com" || host === "ratemyprofessors.com") && /^\/professor\/\d+\/?$/.test(url.pathname)) {
      return url.href;
    }
  } catch {
    return "";
  }

  return "";
}

function getRatingVerdict(value) {
  const rating = numberOrNull(value);
  if (rating == null) {
    return { className: "weak", label: "No rating" };
  }
  if (rating >= 4) {
    return { className: "good", label: "Strong rating" };
  }
  if (rating >= 3) {
    return { className: "mixed", label: "Mixed rating" };
  }
  return { className: "weak", label: "Low rating" };
}
