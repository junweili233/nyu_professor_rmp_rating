import { extractInstructorNamesFromText, normalizeInstructorName, splitInstructorList } from "./shared/albertParser.js";

const ROOT_CLASS = "nyu-rmp-rating-root";
const STYLE_ID = "nyu-rmp-rating-styles";

export function startAlbertRmpEnhancer({
  document = globalThis.document,
  window = globalThis.window,
  lookupProfessor,
} = {}) {
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

export function scanAlbertPageOnce({ document = globalThis.document, lookupProfessor }) {
  if (!lookupProfessor) {
    throw new Error("lookupProfessor is required");
  }

  injectStyles(document);
  const targets = findInstructorTargets(document);
  const pendingLookups = targets.flatMap((target) => mountRatings({ ...target, document, lookupProfessor }));
  return { targets, pendingLookups };
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
  return element.dataset.nyuRmpProcessed !== "true" && !element.closest(`.${ROOT_CLASS}`);
}

function isInstructorLabel(text) {
  return /^instructor(?:\(s\)|s)?$/i.test(text.trim());
}

function findAdjacentInstructorTarget(element) {
  const nameElement =
    element.nextElementSibling ??
    element.parentElement?.querySelector("[data-instructor-name]") ??
    null;
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
    const pendingLookup = lookupProfessor(name)
      .then((result) => updateRatingCard(card, result))
      .catch((error) => {
        card.classList.add("is-error");
        card.querySelector(".nyu-rmp-status").textContent = error.message;
      });
    pendingLookups.push(pendingLookup);
  }

  if (isTableCell(element)) {
    element.append(container);
  } else {
    element.insertAdjacentElement("afterend", container);
  }
  return pendingLookups;
}

function isTableCell(element) {
  return ["TD", "TH"].includes(element.tagName);
}

function createRatingShell(document, name) {
  const card = document.createElement("article");
  card.className = "nyu-rmp-card is-loading";
  card.innerHTML = `
    <div class="nyu-rmp-card-head">
      <strong></strong>
      <span class="nyu-rmp-status">Checking RMP</span>
    </div>
    <div class="nyu-rmp-skeleton"></div>
  `;
  card.querySelector("strong").textContent = name;
  return card;
}

function updateRatingCard(card, result) {
  const requestedName = card.querySelector("strong")?.textContent ?? "Professor";
  card.classList.remove("is-loading");
  if (!result) {
    card.classList.add("is-empty");
    card.innerHTML = `
      <div class="nyu-rmp-card-head">
        <strong>${escapeHtml(requestedName)}</strong>
        <span class="nyu-rmp-status">No RMP match</span>
      </div>
    `;
    return;
  }

  const ratingClass = result.rating >= 4 ? "good" : result.rating >= 3 ? "mixed" : "weak";
  const comments = result.topComments
    .map((comment) => formatComment(comment))
    .join("");
  const tags = result.tags
    .map((tag) => `<span>${escapeHtml(tag)}</span>`)
    .join("");

  card.classList.add(`rating-${ratingClass}`);
  card.innerHTML = `
    <div class="nyu-rmp-card-head">
      <strong>${escapeHtml(result.name)}</strong>
      <a href="${result.url}" target="_blank" rel="noreferrer">RMP</a>
    </div>
    <div class="nyu-rmp-score-row">
      <span class="nyu-rmp-score">${formatScore(result.rating)}</span>
      <span>${result.ratingsCount} ratings</span>
      <span>Difficulty ${formatScore(result.difficulty)}</span>
      ${result.wouldTakeAgain == null ? "" : `<span>${Math.round(result.wouldTakeAgain)}% take again</span>`}
    </div>
    ${tags ? `<div class="nyu-rmp-tags">${tags}</div>` : ""}
    ${comments ? `<ul class="nyu-rmp-comments">${comments}</ul>` : ""}
  `;
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
    .nyu-rmp-card a,
    .nyu-rmp-status {
      color: #334155;
      font-size: 11px;
      text-transform: uppercase;
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

  const metadata = [
    normalized.helpfulRating == null ? "" : `${normalized.helpfulRating} useful`,
    normalized.clarityRating == null ? "" : `Clarity ${formatScore(normalized.clarityRating)}`,
    normalized.difficultyRating == null ? "" : `Difficulty ${formatScore(normalized.difficultyRating)}`,
  ].filter(Boolean);

  return `
    <li>
      <p>${escapeHtml(normalized.text)}</p>
      ${metadata.length > 0 ? `<span class="nyu-rmp-comment-meta">${metadata.map(escapeHtml).join(" · ")}</span>` : ""}
    </li>
  `;
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
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
