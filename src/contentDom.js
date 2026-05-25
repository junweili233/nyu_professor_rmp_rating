import { extractInstructorNamesFromText, isLikelyInstructorName, normalizeInstructorName, splitInstructorList } from "./shared/albertParser.js";

const ROOT_CLASS = "nyu-rmp-rating-root";
const STYLE_ID = "nyu-rmp-rating-styles";
const COMMENT_PREVIEW_LENGTH = 150;
const DEFAULT_RMP_URL = "https://www.ratemyprofessors.com/";
const PLACEHOLDER_COMMENT_TEXT = new Set(["n/a", "na", "none", "no comment", "no comments"]);
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

  const observer = new window.MutationObserver(() => {
    window.clearTimeout(observer.scanTimer);
    observer.scanTimer = window.setTimeout(() => {
      scanAlbertPageOnce({ document, lookupProfessor });
    }, 300);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  const disconnectObserver = observer.disconnect?.bind(observer) ?? (() => {});
  observer.disconnect = () => {
    window.clearTimeout(observer.scanTimer);
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
  return hostname === "albert.nyu.edu" || hostname.startsWith("albert.") || pathname.includes("albert");
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
  const candidates = Array.from(document.querySelectorAll("td, th, dt, dd, div, span, li, p, [data-instructor-name]"))
    .filter(isUnprocessedVisibleCandidate)
    .flatMap((element) => findInstructorTargetsForElement(element));

  return preferMostSpecificTargets(candidates);
}

function findInstructorTargetsForElement(element) {
  const markedNames = instructorNamesFromElementMarker(element);
  if (markedNames.length > 0) {
    return [{ element, names: markedNames }];
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
  return /\b(?:(?:primary\s+)?instructor(?:\(s\)|s)?(?:\s+name(?:\(s\)|s)?)?|professor|prof\.?|faculty|teacher(?:s)?|taught\s+by)(?:\s*(?::|\.|-|\u2013|\u2014)|\s+\S)/i.test(text)
    || /(?:^|\n)\s*(?:(?:primary\s+)?instructor(?:\(s\)|s)?(?:\s+name(?:\(s\)|s)?)?|professor|prof\.?|faculty|teacher(?:s)?|taught\s+by)\s*(?:\n|$)/i.test(text);
}

function isUnprocessedVisibleCandidate(element) {
  return element.dataset.nyuRmpProcessed !== "true" && !element.closest(`.${ROOT_CLASS}`) && isElementVisible(element);
}

function isElementVisible(element) {
  return !element.closest("[hidden], [aria-hidden='true']") && !hasHiddenInlineStyle(element);
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
  return /^(?:(?:primary\s+)?instructor(?:\(s\)|s)?(?:\s+name(?:\(s\)|s)?)?|professor|prof\.?|faculty|teacher(?:s)?|taught\s+by)\s*(?::|\.|-|\u2013|\u2014)?$/i.test(text.trim());
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
    const segments = visibleTextSegments(sibling);
    if (segments.length > 0
      && !segments.every(isInstructorSeparatorOnlyText)
      && instructorNameSegments(sibling).flatMap(splitInstructorList).some(isLikelyInstructorName)) {
      return sibling;
    }
  }
  return null;
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

function firstNameLikeAttribute(element) {
  for (const attributeName of ["title", "aria-label"]) {
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

  const pendingLookups = [];
  for (const name of uniqueNames(names.flatMap(splitInstructorList).map(normalizeInstructorName).filter(Boolean))) {
    const card = createRatingShell(document, name);
    container.append(card);
    const pendingLookup = loadRatingCard({ card, name, lookupProfessor });
    pendingLookups.push(pendingLookup);
  }

  if (isTableCell(element)) {
    element.append(container);
  } else {
    element.insertAdjacentElement("afterend", container);
  }
  return pendingLookups;
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

function loadRatingCard({ card, name, lookupProfessor, forceRefresh = false }) {
  setCardLoading(card, name, forceRefresh ? "Refreshing RMP" : "Checking RMP");
  const lookupArgs = forceRefresh ? [name, { forceRefresh: true }] : [name];
  return lookupProfessor(...lookupArgs)
    .then((result) => updateRatingCard(card, result, { requestedName: name, lookupProfessor }))
    .catch((error) => {
      updateErrorCard(card, { requestedName: name, lookupProfessor, message: error.message });
    });
}

function isTableCell(element) {
  return ["TD", "TH", "DD"].includes(element.tagName);
}

function createRatingShell(document, name) {
  const card = document.createElement("article");
  card.className = "nyu-rmp-card is-loading";
  card.dataset.nyuRmpCardId = String(++nextCardId);
  card.setAttribute("role", "group");
  setCardLoading(card, name, "Checking RMP");
  return card;
}

function setCardLoading(card, name, status) {
  card.className = "nyu-rmp-card is-loading";
  card.setAttribute("aria-busy", "true");
  card.setAttribute("aria-label", `${status} rating for ${name}`);
  card.innerHTML = `
    <div class="nyu-rmp-card-head">
      <strong></strong>
      ${statusMarkup(status)}
    </div>
    <div class="nyu-rmp-skeleton"></div>
  `;
  card.querySelector("strong").textContent = name;
}

function updateRatingCard(card, result, { requestedName = "Professor", lookupProfessor } = {}) {
  card.classList.remove("is-loading");
  card.removeAttribute("aria-busy");
  if (!result) {
    card.classList.add("is-empty");
    card.setAttribute("aria-label", `No RMP match for ${requestedName}`);
    card.innerHTML = `
      <div class="nyu-rmp-card-head">
        <strong>${escapeHtml(requestedName)}</strong>
        <div class="nyu-rmp-actions">
          <button class="nyu-rmp-refresh" type="button" aria-label="${escapeHtml(refreshLabel(requestedName))}">Refresh</button>
          <a class="nyu-rmp-search" href="${escapeHtml(rmpSearchUrl(requestedName))}" target="_blank" rel="noreferrer noopener" aria-label="${escapeHtml(searchLabel(requestedName))}">Search RMP</a>
          ${statusMarkup("No RMP match")}
        </div>
      </div>
    `;
    wireRefreshAction(card, requestedName, lookupProfessor);
    return;
  }

  const rating = rmpScaleNumberOrNull(result.rating);
  const difficulty = rmpScaleNumberOrNull(result.difficulty);
  const wouldTakeAgain = percentNumberOrNull(result.wouldTakeAgain);
  const ratingVerdict = getRatingVerdict(rating);
  const ratingClass = ratingVerdict.className;
  const professorName = result.name || requestedName;
  const ratingsCount = nonNegativeCount(result.ratingsCount);
  const rmpUrl = safeRmpUrl(result.url);
  const department = String(result.department ?? "").trim();
  const updatedAt = formatUpdatedAt(result.cacheUpdatedAt);
  const matchNote = formatMatchNote(professorName, requestedName, result.matchConfidence);
  const comments = asArray(result.topComments)
    .map((comment, index) => formatComment(comment, commentTextId(card, index)))
    .join("");
  const tags = asArray(result.tags)
    .map(normalizeTagName)
    .filter(Boolean)
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("");

  card.classList.add(`rating-${ratingClass}`);
  card.setAttribute(
    "aria-label",
    `RMP rating for ${professorName}: ${formatRatingSummary(rating)}, ${formatRatingsCount(ratingsCount)}`,
  );
  card.innerHTML = `
    <div class="nyu-rmp-card-head">
      <strong>${escapeHtml(professorName)}</strong>
      <div class="nyu-rmp-actions">
        <button class="nyu-rmp-refresh" type="button" aria-label="${escapeHtml(refreshLabel(requestedName))}">Refresh</button>
        <a href="${escapeHtml(rmpUrl)}" target="_blank" rel="noreferrer noopener" aria-label="${escapeHtml(profileLabel(professorName))}">RMP</a>
      </div>
    </div>
    ${department ? `<div class="nyu-rmp-department">${escapeHtml(department)}</div>` : ""}
    ${matchNote ? `<div class="nyu-rmp-match-note">${escapeHtml(matchNote)}</div>` : ""}
    ${updatedAt ? `<div class="nyu-rmp-updated">${escapeHtml(updatedAt)}</div>` : ""}
    <div class="nyu-rmp-score-row">
      <span class="nyu-rmp-score" aria-label="${escapeHtml(formatRatingLabel(rating))}">${formatScore(rating)}</span>
      <span class="nyu-rmp-verdict">${escapeHtml(ratingVerdict.label)}</span>
      <span>${escapeHtml(formatRatingsCount(ratingsCount))}</span>
      <span>Difficulty ${formatScore(difficulty)}</span>
      ${wouldTakeAgain == null ? "" : `<span>${Math.round(wouldTakeAgain)}% take again</span>`}
    </div>
    ${tags ? `<div class="nyu-rmp-tags">${tags}</div>` : ""}
    ${comments ? `<ul class="nyu-rmp-comments">${comments}</ul>` : ""}
  `;
  wireRefreshAction(card, requestedName, lookupProfessor);
  wireCommentToggleActions(card);
}

function updateErrorCard(card, { requestedName, lookupProfessor, message }) {
  card.className = "nyu-rmp-card is-error";
  card.removeAttribute("aria-busy");
  card.setAttribute("aria-label", `RMP lookup failed for ${requestedName}: ${message || "RMP lookup failed"}`);
  card.innerHTML = `
    <div class="nyu-rmp-card-head">
      <strong>${escapeHtml(requestedName)}</strong>
      <div class="nyu-rmp-actions">
        <button class="nyu-rmp-refresh" type="button" aria-label="${escapeHtml(retryLabel(requestedName))}">Retry</button>
        <a class="nyu-rmp-search" href="${escapeHtml(rmpSearchUrl(requestedName))}" target="_blank" rel="noreferrer noopener" aria-label="${escapeHtml(searchLabel(requestedName))}">Search RMP</a>
        ${statusMarkup(message || "RMP lookup failed")}
      </div>
    </div>
  `;
  wireRefreshAction(card, requestedName, lookupProfessor);
}

function statusMarkup(message) {
  return `<span class="nyu-rmp-status" role="status" aria-live="polite" aria-atomic="true">${escapeHtml(message)}</span>`;
}

function wireRefreshAction(card, requestedName, lookupProfessor) {
  card.querySelector(".nyu-rmp-refresh")?.addEventListener("click", () => {
    loadRatingCard({ card, name: requestedName, lookupProfessor, forceRefresh: true });
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
	      gap: 8px;
	      margin: 8px 0 14px;
	      font-family: Aptos, "Segoe UI", sans-serif;
	    }
	    .nyu-rmp-card {
	      border: 1px solid #e4dff0;
	      border-left: 3.5px solid #6b7280;
	      border-radius: 9px;
	      background: #fefdfe;
	      color: #1f1a2e;
	      padding: 11px 13px;
	      box-shadow: 0 1px 3px rgba(26,5,48,0.04), 0 6px 18px rgba(26,5,48,0.06);
	      transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
	    }
	    .nyu-rmp-card:hover {
	      border-color: #d0c8de;
	      box-shadow: 0 2px 4px rgba(26,5,48,0.05), 0 10px 28px rgba(26,5,48,0.09);
	      transform: translateY(-1px);
	    }
	    .nyu-rmp-card-head,
	    .nyu-rmp-score-row,
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
	      letter-spacing: -0.1px;
	      line-height: 1.3;
	    }
	    .nyu-rmp-department {
	      color: #8474a0;
	      font-size: 10.5px;
	      font-weight: 500;
	      letter-spacing: 0.15px;
	      margin: -2px 0 5px;
	      text-transform: uppercase;
	    }
	    .nyu-rmp-match-note {
	      color: #8474a0;
	      font-size: 10.5px;
	      margin: -1px 0 5px;
	    }
	    .nyu-rmp-updated {
	      color: #a094b8;
	      font-size: 10px;
	      margin: -3px 0 6px;
	    }
	    .nyu-rmp-card a,
	    .nyu-rmp-refresh,
	    .nyu-rmp-status {
	      color: #5e4d7a;
	      font-size: 10.5px;
	      font-weight: 600;
	      letter-spacing: 0.3px;
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
	      letter-spacing: -0.3px;
	      line-height: 1;
	    }
	    .rating-good .nyu-rmp-score { color: #1a7a4c; }
	    .rating-mixed .nyu-rmp-score { color: #a0620a; }
	    .rating-weak .nyu-rmp-score { color: #b42318; }
	    .is-error .nyu-rmp-score,
	    .is-loading .nyu-rmp-score,
	    .is-empty .nyu-rmp-score { color: #1f1a2e; }
	    .nyu-rmp-score-row span:not(.nyu-rmp-score),
	    .nyu-rmp-comments {
	      color: #544a66;
	      font-size: 11.5px;
	    }
	    .nyu-rmp-score-row .nyu-rmp-verdict {
	      border: 1px solid #d8cee8;
	      border-radius: 999px;
	      color: #4a3d60;
	      font-size: 10.5px;
	      font-weight: 600;
	      padding: 2px 8px;
	      letter-spacing: 0.1px;
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
	      background: #f4f1f9;
	      border: 1px solid #e4def0;
	      border-radius: 999px;
	      color: #4a3d60;
	      font-size: 10px;
	      font-weight: 500;
	      padding: 2px 8px;
	    }
	    .nyu-rmp-comments {
	      margin: 8px 0 0;
	      padding-left: 14px;
	    }
	    .nyu-rmp-comments li {
	      margin-bottom: 6px;
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
	      letter-spacing: 0.2px;
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
	    .nyu-rmp-comment-meta {
	      color: #a094b8;
	      display: block;
	      font-size: 10px;
	      margin-top: 2px;
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

function formatRatingsCount(value) {
  return `${value} ${value === 1 ? "rating" : "ratings"}`;
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

function formatComment(comment, textId) {
  const normalized = normalizeComment(comment);
  if (!isUsefulCommentText(normalized.text)) {
    return "";
  }

  const preview = truncateComment(normalized.text);
  const isTruncated = preview !== normalized.text;
  const metadata = [
    normalized.helpfulRating == null ? "" : `${normalized.helpfulRating} useful`,
    normalized.clarityRating == null ? "" : `Clarity ${formatScore(normalized.clarityRating)}`,
    normalized.difficultyRating == null ? "" : `Difficulty ${formatScore(normalized.difficultyRating)}`,
  ].filter(Boolean);

  return `
    <li>
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
      ${metadata.length > 0 ? `<span class="nyu-rmp-comment-meta">${metadata.map(escapeHtml).join(" | ")}</span>` : ""}
    </li>
  `;
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

function truncateComment(text) {
  if (text.length <= COMMENT_PREVIEW_LENGTH) {
    return text;
  }
  return `${text.slice(0, COMMENT_PREVIEW_LENGTH).trimEnd()}...`;
}

function normalizeComment(comment) {
  if (typeof comment === "string") {
    return { text: comment };
  }

  return {
    text: comment?.text ?? "",
    helpfulRating: nonNegativeNumberOrNull(comment?.helpfulRating),
    clarityRating: rmpScaleNumberOrNull(comment?.clarityRating),
    difficultyRating: rmpScaleNumberOrNull(comment?.difficultyRating),
  };
}

function isUsefulCommentText(value) {
  const text = String(value ?? "").trim();
  const normalized = text.toLowerCase().replace(/[.!?]+$/g, "").trim();
  return /\p{L}|\p{N}/u.test(text) && !PLACEHOLDER_COMMENT_TEXT.has(normalized);
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

function safeRmpUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    const host = url.hostname.toLowerCase();
    if (url.protocol === "https:" && (host === "www.ratemyprofessors.com" || host === "ratemyprofessors.com")) {
      return url.href;
    }
  } catch {
    return DEFAULT_RMP_URL;
  }

  return DEFAULT_RMP_URL;
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
