const STAFF_TERMS = new Set([
  "staff",
  "tba",
  "tbd",
  "to be announced",
  "to be assigned",
  "to be determined",
  "to be named",
  "department",
  "unassigned",
  "not assigned",
  "not yet assigned",
  "pending assignment",
  "not available",
  "no instructor assigned",
  "department tbd",
  "no faculty assigned",
  "department contact",
  "contact department",
  "ask department",
  "see advisor",
  "online course",
  "n/a",
  "n a",
  "none",
  "multiple instructors",
  "various instructors",
  "see department",
]);
const PLACEHOLDER_WORDS = new Set(["staff", "tba", "tbd"]);
const ROMAN_NAME_SUFFIXES = new Set(["ii", "ii.", "iii", "iii.", "iv", "iv.", "v", "v."]);
const SURNAME_PARTICLES = new Set(["de", "del", "della", "di", "du", "la", "le", "van", "von"]);
const COURSE_METADATA_TERMS = new Set([
  "class",
  "closed",
  "consent",
  "credits",
  "detail",
  "details",
  "enrollment",
  "group",
  "instructor",
  "instruction",
  "location",
  "mode",
  "open",
  "permission",
  "required",
  "requirement",
  "section",
  "status",
  "units",
  "view",
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
const TRAILING_INSTRUCTOR_ROLE_PATTERN =
  /\s*(?:-|:|\u2013|\u2014)\s*(?:primary(?: instructor)?|instructor|lecture|recitation|lab|laboratory|seminar|section)\s*$/i;
const PLACEHOLDER_ANNOTATION_PATTERN =
  /\((?:staff|tba|tbd|to be announced|to be assigned|to be determined|unassigned|not assigned|not available|no instructor assigned|n\/a|none)\)/gi;
const INSTRUCTOR_SEPARATOR_PATTERN = String.raw`(?::|\.|-|\u2013|\u2014)`;
const INSTRUCTOR_LABEL_PATTERN = String.raw`(?:(?:primary\s+)?(?:instructor(?:\(s\)|s)?(?:\s+name(?:\(s\)|s)?)?|instr(?:\.|\b)(?:\(s\)|s)?(?:\s+name(?:\(s\)|s)?)?)|professor(?:\s+name(?:\(s\)|s)?)?|prof\.?(?:\s+name(?:\(s\)|s)?)?|faculty(?:\s+name(?:\(s\)|s)?)?|teacher(?:s)?(?:\s+name(?:\(s\)|s)?)?|taught\s+by)`;
const INSTRUCTOR_LABEL_WITH_SEPARATOR_PATTERN = new RegExp(
  String.raw`\b${INSTRUCTOR_LABEL_PATTERN}\s*${INSTRUCTOR_SEPARATOR_PATTERN}\s*(.*)$`,
  "i",
);
const INSTRUCTOR_LABEL_WITH_WHITESPACE_NAMES_PATTERN = new RegExp(
  String.raw`\b${INSTRUCTOR_LABEL_PATTERN}\s+(.+)$`,
  "i",
);

export function normalizeInstructorName(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  const withoutLabel = value
    .replace(INSTRUCTOR_ROLE_PATTERN, "")
    .replace(TRAILING_INSTRUCTOR_ROLE_PATTERN, "")
    .replace(PLACEHOLDER_ANNOTATION_PATTERN, "")
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

    const separatorMatch = trimmedLine.match(INSTRUCTOR_LABEL_WITH_SEPARATOR_PATTERN);
    if (separatorMatch) {
      const inlineNames = separatorMatch[1].trim();
      readingContinuationNames = !inlineNames;
      if (inlineNames) {
        const filteredInlineNames = splitInstructorList(inlineNames).filter(isLikelyInstructorName);
        addInstructorPieces(filteredInlineNames, { names, seen });
      }
      continue;
    }

    const whitespaceMatch = trimmedLine.match(INSTRUCTOR_LABEL_WITH_WHITESPACE_NAMES_PATTERN);
    if (whitespaceMatch) {
      readingContinuationNames = false;
      const inlineNames = splitInstructorList(whitespaceMatch[1].trim()).filter(isLikelyInstructorName);
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

    const continuationNames = splitInstructorList(trimmedLine).filter(isLikelyInstructorName);
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
  if (isPlaceholderInstructor(cleaned) && !hasInstructorListSeparator(cleaned)) {
    return [];
  }

  const semicolonParts = cleaned
    .split(/\s*(?:;|\/|&|\+|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (semicolonParts.length > 1) {
    return semicolonParts.flatMap(splitInstructorList);
  }

  const commaParts = cleaned.split(/\s*,\s*/).map((part) => part.trim()).filter(Boolean);
  if (commaParts.length > 1 && commaParts.some(isPlaceholderInstructor)) {
    return commaParts.filter((part) => !isPlaceholderInstructor(part));
  }

  if (commaParts.length === 2 && looksLikeAlbertLastFirst(commaParts[0], commaParts[1])) {
    return [formatAlbertLastFirst(commaParts[0], commaParts[1])];
  }
  if (commaParts.length > 2) {
    return pairAlbertLastFirstParts(commaParts);
  }

  const commaLessLastFirstName = formatCommaLessUppercaseAlbertLastFirst(cleaned);
  if (commaLessLastFirstName) {
    return [commaLessLastFirstName];
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

export function isLikelyInstructorName(value) {
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
  return String(value ?? "")
    .replace(INSTRUCTOR_ROLE_PATTERN, "")
    .replace(TRAILING_INSTRUCTOR_ROLE_PATTERN, "")
    .replace(PLACEHOLDER_ANNOTATION_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
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
  const normalized = normalizePlaceholderText(value);
  return STAFF_TERMS.has(normalized) || /\bstaff$/.test(normalized) || isPlaceholderWordCombination(normalized);
}

function normalizePlaceholderText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.,;:|/\\()[\]{}_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasInstructorListSeparator(value) {
  return /(?:;|\/|&|\+|\band\b|,)/i.test(String(value ?? ""));
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
      names.push(formatAlbertLastFirst(current, next));
      index += 1;
    } else {
      names.push(current);
    }
  }
  return names;
}

function formatCommaLessUppercaseAlbertLastFirst(value) {
  const parts = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 5 || !parts.every(isUppercaseNameToken)) {
    return "";
  }

  const surnamePartCount = SURNAME_PARTICLES.has(parts[0].toLowerCase()) && parts.length >= 4 ? 2 : 1;
  const surnameParts = parts.slice(0, surnamePartCount);
  const firstParts = parts.slice(surnamePartCount);
  if (firstParts.length < 2 || isInitialNameToken(firstParts[0])) {
    return "";
  }

  return [...firstParts, ...surnameParts].join(" ");
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

function formatAlbertLastFirst(lastName, firstNames) {
  const firstParts = firstNames.split(/\s+/).filter(Boolean);
  const suffixParts = [];
  while (firstParts.length > 1 && isNameSuffix(firstParts.at(-1))) {
    suffixParts.unshift(firstParts.pop());
  }

  return [...firstParts, lastName, ...suffixParts].join(" ");
}

function isNameToken(value) {
  return /^\p{L}[\p{L}'-]+$/u.test(value);
}

function isUppercaseNameToken(value) {
  return /^(?:\p{Lu}[\p{Lu}'-]+|\p{Lu}\.?)$/u.test(value);
}

function isInitialNameToken(value) {
  return /^\p{L}\.?$/u.test(value);
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
