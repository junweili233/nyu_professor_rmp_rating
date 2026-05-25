const STAFF_TERMS = new Set([
  "staff",
  "tba",
  "tbd",
  "to be announced",
  "to be determined",
  "department",
  "unassigned",
  "not assigned",
  "no instructor assigned",
  "n/a",
  "none",
]);
const PLACEHOLDER_WORDS = new Set(["staff", "tba", "tbd"]);
const ROMAN_NAME_SUFFIXES = new Set(["ii", "ii.", "iii", "iii.", "iv", "iv.", "v", "v."]);
const SURNAME_PARTICLES = new Set(["de", "del", "della", "di", "du", "la", "le", "van", "von"]);
const COURSE_METADATA_TERMS = new Set([
  "class",
  "closed",
  "consent",
  "credits",
  "enrollment",
  "group",
  "location",
  "open",
  "requirement",
  "section",
  "status",
  "units",
  "waitlist",
]);
const TITLE_NAME_SUFFIXES = new Map([
  ["jr", "Jr"],
  ["jr.", "Jr."],
  ["sr", "Sr"],
  ["sr.", "Sr."],
]);
const ACADEMIC_CREDENTIAL_PATTERN =
  /(?:,?\s*(?:ph\.?\s*d\.?|m\.?\s*d\.?|m\.?\s*f\.?\s*a\.?|m\.?\s*b\.?\s*a\.?|j\.?\s*d\.?))+\.?\s*$/i;
const INSTRUCTOR_ROLE_PATTERN =
  /\((?:primary(?: instructor)?|instructor|lecture|recitation|lab|laboratory|seminar|section)\)/gi;
const INSTRUCTOR_SEPARATOR_PATTERN = String.raw`(?::|\.|-|\u2013|\u2014)`;
const INSTRUCTOR_LABEL_PATTERN = String.raw`(?:primary\s+)?instructor(?:\(s\)|s)?`;
const INSTRUCTOR_LABEL_WITH_NAMES_PATTERN = new RegExp(
  String.raw`\b${INSTRUCTOR_LABEL_PATTERN}\s*${INSTRUCTOR_SEPARATOR_PATTERN}\s*(.*)$`,
  "i",
);

export function normalizeInstructorName(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  const withoutLabel = value
    .replace(INSTRUCTOR_ROLE_PATTERN, "")
    .replace(new RegExp(String.raw`^(?:${INSTRUCTOR_LABEL_PATTERN}|professor|prof)\s*(?:${INSTRUCTOR_SEPARATOR_PATTERN}|[.:])?\s*`, "i"), "")
    .replace(/^(?:dr|doctor)\.?\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const withoutCredentials = stripAcademicCredentials(withoutLabel);
  if (!withoutCredentials) {
    return "";
  }

  const normalized = titleCaseName(stripTrailingInstructorPunctuation(withoutCredentials));
  if (!normalized || isPlaceholderInstructor(normalized)) {
    return "";
  }

  return normalized;
}

export function extractInstructorNamesFromText(text) {
  if (!text || typeof text !== "string") {
    return [];
  }

  const names = [];
  const seen = new Set();
  const lines = text.split(/\r?\n/);
  let readingContinuationNames = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      continue;
    }

    const match = trimmedLine.match(INSTRUCTOR_LABEL_WITH_NAMES_PATTERN);
    if (match) {
      const inlineNames = match[1].trim();
      readingContinuationNames = !inlineNames;
      addInstructorPieces(inlineNames, { names, seen });
      continue;
    }

    if (new RegExp(String.raw`^${INSTRUCTOR_LABEL_PATTERN}$`, "i").test(trimmedLine)) {
      readingContinuationNames = true;
      continue;
    }

    if (!readingContinuationNames) {
      continue;
    }

    const continuationNames = splitInstructorList(trimmedLine).filter(isLikelyInstructorContinuation);
    if (continuationNames.length === 0) {
      readingContinuationNames = false;
      continue;
    }

    addInstructorPieces(continuationNames, { names, seen });
  }

  return names;
}

export function splitInstructorList(value) {
  const cleaned = stripAcademicCredentials(stripInstructorRoleAnnotations(value));
  if (isPlaceholderInstructor(cleaned)) {
    return [];
  }

  const semicolonParts = cleaned
    .split(/\s*(?:;|\/|&|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (semicolonParts.length > 1) {
    return semicolonParts.flatMap(splitInstructorList);
  }

  const commaParts = cleaned.split(/\s*,\s*/).map((part) => part.trim()).filter(Boolean);
  if (commaParts.length === 2 && looksLikeAlbertLastFirst(commaParts[0], commaParts[1])) {
    return [`${commaParts[1]} ${commaParts[0]}`];
  }
  if (commaParts.length > 2) {
    return pairAlbertLastFirstParts(commaParts);
  }

  return cleaned
    .split(/\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function addInstructorPieces(value, { names, seen }) {
  const pieces = Array.isArray(value) ? value : splitInstructorList(value);
  for (const piece of pieces) {
    const name = normalizeInstructorName(piece);
    const key = name.toLowerCase();
    if (name && !seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  }
}

function isLikelyInstructorContinuation(value) {
  const normalized = normalizeInstructorName(value);
  if (!normalized) {
    return false;
  }

  const words = normalized.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.some((word) => COURSE_METADATA_TERMS.has(word))) {
    return false;
  }

  return words.length >= 2 && words.length <= 5;
}

function stripInstructorRoleAnnotations(value) {
  return String(value ?? "").replace(INSTRUCTOR_ROLE_PATTERN, "").replace(/\s+/g, " ").trim();
}

function stripAcademicCredentials(value) {
  return String(value ?? "").replace(ACADEMIC_CREDENTIAL_PATTERN, "").trim();
}

function stripTrailingInstructorPunctuation(value) {
  const trimmed = String(value ?? "").trim();
  if (/\b(?:jr|sr)\.$/i.test(trimmed)) {
    return trimmed;
  }
  return trimmed.replace(/[.;|]+$/g, "").trim();
}

function isPlaceholderInstructor(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return STAFF_TERMS.has(normalized) || /\bstaff$/.test(normalized) || isPlaceholderWordCombination(normalized);
}

function isPlaceholderWordCombination(value) {
  const words = value.split(/\s+/).filter(Boolean);
  return words.length > 1 && words.every((word) => PLACEHOLDER_WORDS.has(word));
}

function pairAlbertLastFirstParts(parts) {
  const names = [];
  for (let index = 0; index < parts.length; index += 1) {
    const current = parts[index];
    const next = parts[index + 1];
    if (next && looksLikeAlbertLastFirst(current, next)) {
      names.push(`${next} ${current}`);
      index += 1;
    } else {
      names.push(current);
    }
  }
  return names;
}

function looksLikeAlbertLastFirst(lastName, firstNames) {
  return looksLikeLastName(lastName) && /^\p{L}[\p{L}'. -]+$/u.test(firstNames);
}

function looksLikeLastName(value) {
  if (/^\p{L}[\p{L}'-]+$/u.test(value)) {
    return true;
  }

  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length > 1 && isNameSuffix(parts.at(-1)) && parts.slice(0, -1).every(isNameToken)) {
    return true;
  }

  return parts.length > 1 && SURNAME_PARTICLES.has(parts[0].toLowerCase()) && parts.every(isNameToken);
}

function isNameToken(value) {
  return /^\p{L}[\p{L}'-]+$/u.test(value);
}

function isNameSuffix(value) {
  const normalized = value.toLowerCase();
  return TITLE_NAME_SUFFIXES.has(normalized) || ROMAN_NAME_SUFFIXES.has(normalized);
}

function titleCaseName(value) {
  return value
    .split(" ")
    .map((token) => {
      const lowerToken = token.toLowerCase();
      if (ROMAN_NAME_SUFFIXES.has(lowerToken)) {
        return token.replace(/\.$/, "").toUpperCase();
      }
      if (TITLE_NAME_SUFFIXES.has(lowerToken)) {
        return TITLE_NAME_SUFFIXES.get(lowerToken);
      }
      if (/^[A-Z]\.$/.test(token)) {
        return token;
      }
      if (token.includes("-")) {
        return token
          .split("-")
          .map(capitalizeToken)
          .join("-");
      }
      if (token.includes("'")) {
        return token
          .split("'")
          .map(capitalizeToken)
          .join("'");
      }
      return capitalizeToken(token);
    })
    .join(" ");
}

function capitalizeToken(token) {
  if (!token) {
    return token;
  }
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}
