import { extractInstructorNamesFromText, normalizeInstructorName, splitInstructorList } from "./shared/albertParser.js";

const ROOT_CLASS = "nyu-rmp-rating-root";
const STYLE_ID = "nyu-rmp-rating-styles";
const COMMENT_PREVIEW_LENGTH = 150;

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
  const candidates = Array.from(document.querySelectorAll("td, th, div, span, li, p"))
    .filter(isUnprocessedVisibleCandidate)
    .flatMap((element) => findInstructorTargetsForElement(element));

  return preferMostSpecificTargets(candidates);
}

function findInstructorTargetsForElement(element) {
  const text = element.textContent ?? "";
  if (/\binstructor(?:\(s\)|s)?\s*:/i.test(text) && text.length < 700) {
    const names = extractInstructorNamesFromText(text);
    return names.length > 0 ? [{ element, names }] : [];
  }

  if (isInstructorLabel(text)) {
    const adjacentTarget = findAdjacentInstructorTarget(element);
    return adjacentTarget ? [adjacentTarget] : [];
  }

  return [];
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
  return style?.display === "none" || style?.visibility === "hidden" || style?.visibility === "collapse";
}

function isInstructorLabel(text) {
  return /^instructor(?:\(s\)|s)?$/i.test(text.trim());
}

function findAdjacentInstructorTarget(element) {
  const nameElement =
    element.nextElementSibling ??
    element.parentElement?.querySelector("[data-instructor-name]") ??
    null;
  if (!nameElement || !isElementVisible(nameElement)) {
    return null;
  }
  const adjacentText = nameElement?.textContent ?? "";
  const names = splitInstructorList(adjacentText).map(normalizeInstructorName).filter(Boolean);
  return names.length > 0 ? { element: nameElement, processedElements: [element, nameElement], names } : null;
}

function preferMostSpecificTargets(targets) {
  return targets.filter((target) => {
    return !targets.some((other) => {
      return other !== target && target.element.contains(other.element);
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
  for (const name of names.flatMap(splitInstructorList).map(normalizeInstructorName).filter(Boolean)) {
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
  return ["TD", "TH"].includes(element.tagName);
}

function createRatingShell(document, name) {
  const card = document.createElement("article");
  card.className = "nyu-rmp-card is-loading";
  setCardLoading(card, name, "Checking RMP");
  return card;
}

function setCardLoading(card, name, status) {
  card.className = "nyu-rmp-card is-loading";
  card.innerHTML = `
    <div class="nyu-rmp-card-head">
      <strong></strong>
      <span class="nyu-rmp-status">${escapeHtml(status)}</span>
    </div>
    <div class="nyu-rmp-skeleton"></div>
  `;
  card.querySelector("strong").textContent = name;
}

function updateRatingCard(card, result, { requestedName = "Professor", lookupProfessor } = {}) {
  card.classList.remove("is-loading");
  if (!result) {
    card.classList.add("is-empty");
    card.innerHTML = `
      <div class="nyu-rmp-card-head">
        <strong>${escapeHtml(requestedName)}</strong>
        <div class="nyu-rmp-actions">
          <button class="nyu-rmp-refresh" type="button" aria-label="${escapeHtml(refreshLabel(requestedName))}">Refresh</button>
          <a class="nyu-rmp-search" href="${escapeHtml(rmpSearchUrl(requestedName))}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(searchLabel(requestedName))}">Search RMP</a>
          <span class="nyu-rmp-status">No RMP match</span>
        </div>
      </div>
    `;
    wireRefreshAction(card, requestedName, lookupProfessor);
    return;
  }

  const ratingVerdict = getRatingVerdict(result.rating);
  const ratingClass = ratingVerdict.className;
  const professorName = result.name || requestedName;
  const ratingsCount = numberOrNull(result.ratingsCount) ?? 0;
  const rmpUrl = result.url || "https://www.ratemyprofessors.com/";
  const department = String(result.department ?? "").trim();
  const updatedAt = formatUpdatedAt(result.cacheUpdatedAt);
  const matchNote = formatMatchNote(professorName, requestedName, result.matchConfidence);
  const comments = asArray(result.topComments)
    .map((comment) => formatComment(comment))
    .join("");
  const tags = asArray(result.tags)
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("");

  card.classList.add(`rating-${ratingClass}`);
  card.innerHTML = `
    <div class="nyu-rmp-card-head">
      <strong>${escapeHtml(professorName)}</strong>
      <div class="nyu-rmp-actions">
        <button class="nyu-rmp-refresh" type="button" aria-label="${escapeHtml(refreshLabel(requestedName))}">Refresh</button>
        <a href="${escapeHtml(rmpUrl)}" target="_blank" rel="noreferrer">RMP</a>
      </div>
    </div>
    ${department ? `<div class="nyu-rmp-department">${escapeHtml(department)}</div>` : ""}
    ${matchNote ? `<div class="nyu-rmp-match-note">${escapeHtml(matchNote)}</div>` : ""}
    ${updatedAt ? `<div class="nyu-rmp-updated">${escapeHtml(updatedAt)}</div>` : ""}
    <div class="nyu-rmp-score-row">
      <span class="nyu-rmp-score">${formatScore(result.rating)}</span>
      <span class="nyu-rmp-verdict">${escapeHtml(ratingVerdict.label)}</span>
      <span>${ratingsCount} ratings</span>
      <span>Difficulty ${formatScore(result.difficulty)}</span>
      ${result.wouldTakeAgain == null ? "" : `<span>${Math.round(result.wouldTakeAgain)}% take again</span>`}
    </div>
    ${tags ? `<div class="nyu-rmp-tags">${tags}</div>` : ""}
    ${comments ? `<ul class="nyu-rmp-comments">${comments}</ul>` : ""}
  `;
  wireRefreshAction(card, requestedName, lookupProfessor);
  wireCommentToggleActions(card);
}

function updateErrorCard(card, { requestedName, lookupProfessor, message }) {
  card.className = "nyu-rmp-card is-error";
  card.innerHTML = `
    <div class="nyu-rmp-card-head">
      <strong>${escapeHtml(requestedName)}</strong>
      <div class="nyu-rmp-actions">
        <button class="nyu-rmp-refresh" type="button" aria-label="${escapeHtml(retryLabel(requestedName))}">Retry</button>
        <a class="nyu-rmp-search" href="${escapeHtml(rmpSearchUrl(requestedName))}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(searchLabel(requestedName))}">Search RMP</a>
        <span class="nyu-rmp-status">${escapeHtml(message || "RMP lookup failed")}</span>
      </div>
    </div>
  `;
  wireRefreshAction(card, requestedName, lookupProfessor);
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
      margin: 8px 0 12px;
      font-family: Aptos, "Segoe UI", sans-serif;
    }
    .nyu-rmp-card {
      border: 1px solid #d9dee7;
      border-left: 4px solid #6b7280;
      border-radius: 8px;
      background: #fbfcfe;
      color: #172033;
      padding: 10px 12px;
      box-shadow: 0 8px 24px rgba(18, 31, 53, 0.08);
      transition: transform 160ms ease, box-shadow 160ms ease;
    }
    .nyu-rmp-card:hover {
      box-shadow: 0 12px 30px rgba(18, 31, 53, 0.12);
      transform: translateY(-1px);
    }
    .nyu-rmp-card-head,
    .nyu-rmp-score-row,
    .nyu-rmp-tags {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .nyu-rmp-card-head {
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .nyu-rmp-card strong {
      font-size: 13px;
      letter-spacing: 0;
    }
    .nyu-rmp-department,
    .nyu-rmp-match-note {
      color: #64748b;
      font-size: 11px;
      margin: -2px 0 6px;
    }
    .nyu-rmp-updated {
      color: #64748b;
      font-size: 11px;
      margin: -3px 0 7px;
    }
    .nyu-rmp-card a,
    .nyu-rmp-refresh,
    .nyu-rmp-status {
      color: #334155;
      font-size: 11px;
      text-transform: uppercase;
    }
    .nyu-rmp-actions {
      align-items: center;
      display: flex;
      gap: 8px;
    }
    .nyu-rmp-refresh {
      background: transparent;
      border: 0;
      cursor: pointer;
      font-family: inherit;
      padding: 0;
    }
    .nyu-rmp-refresh:active {
      transform: translateY(1px);
    }
    .nyu-rmp-score {
      color: #111827;
      font-size: 20px;
      font-weight: 800;
      line-height: 1;
    }
    .nyu-rmp-score-row span:not(.nyu-rmp-score),
    .nyu-rmp-comments {
      color: #475569;
      font-size: 12px;
    }
    .nyu-rmp-score-row .nyu-rmp-verdict {
      border: 1px solid #d8e0ea;
      border-radius: 999px;
      color: #334155;
      font-size: 11px;
      padding: 2px 7px;
    }
    .nyu-rmp-tags span {
      background: #eef2f7;
      border: 1px solid #d8e0ea;
      border-radius: 999px;
      color: #334155;
      font-size: 11px;
      padding: 3px 7px;
    }
    .nyu-rmp-comments {
      margin: 8px 0 0;
      padding-left: 16px;
    }
    .nyu-rmp-comments p {
      margin: 0;
    }
    .nyu-rmp-comment-toggle {
      background: transparent;
      border: 0;
      color: #334155;
      cursor: pointer;
      font-family: inherit;
      font-size: 11px;
      margin-top: 3px;
      padding: 0;
      text-transform: uppercase;
    }
    .nyu-rmp-comment-toggle:active {
      transform: translateY(1px);
    }
    .nyu-rmp-comment-meta {
      color: #64748b;
      display: block;
      font-size: 11px;
      margin-top: 2px;
    }
    .nyu-rmp-skeleton {
      animation: nyu-rmp-shimmer 1.2s infinite linear;
      background: linear-gradient(90deg, #e8edf3, #f7f9fc, #e8edf3);
      background-size: 220% 100%;
      border-radius: 6px;
      height: 18px;
    }
    .nyu-rmp-card.rating-good { border-left-color: #1f8a5b; }
    .nyu-rmp-card.rating-mixed { border-left-color: #b7791f; }
    .nyu-rmp-card.rating-weak,
    .nyu-rmp-card.is-error { border-left-color: #b42318; }
    @keyframes nyu-rmp-shimmer {
      to { background-position: -220% 0; }
    }
  `;
  document.documentElement.append(style);
}

function formatScore(value) {
  return value == null ? "N/A" : Number(value).toFixed(1);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatComment(comment) {
  const normalized = normalizeComment(comment);
  if (!normalized.text) {
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
      <p class="nyu-rmp-comment-text">${escapeHtml(preview)}</p>
      ${isTruncated ? `
        <button
          class="nyu-rmp-comment-toggle"
          type="button"
          aria-expanded="false"
          data-preview-text="${escapeHtml(preview)}"
          data-full-text="${escapeHtml(normalized.text)}"
        >Show more</button>
      ` : ""}
      ${metadata.length > 0 ? `<span class="nyu-rmp-comment-meta">${metadata.map(escapeHtml).join(" | ")}</span>` : ""}
    </li>
  `;
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
    helpfulRating: numberOrNull(comment?.helpfulRating),
    clarityRating: numberOrNull(comment?.clarityRating),
    difficultyRating: numberOrNull(comment?.difficultyRating),
  };
}

function numberOrNull(value) {
  if (value == null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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
  return String(value ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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

function rmpSearchUrl(name) {
  return `https://www.ratemyprofessors.com/search/professors/1381?q=${encodeURIComponent(name)}`;
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
