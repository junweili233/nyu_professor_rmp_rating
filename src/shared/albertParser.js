const STAFF_TERMS = new Set([
  "staff",
  "tba",
  "tbd",
  "to be announced",
  "department",
  "not assigned",
  "no instructor assigned",
]);
const ROMAN_NAME_SUFFIXES = new Set(["ii", "iii", "iv", "v"]);
const TITLE_NAME_SUFFIXES = new Map([
  ["jr", "Jr"],
  ["jr.", "Jr."],
  ["sr", "Sr"],
  ["sr.", "Sr."],
]);
const INSTRUCTOR_ROLE_PATTERN =
  /\((?:primary(?: instructor)?|instructor|lecture|recitation|lab|laboratory|seminar|section)\)/gi;

export function normalizeInstructorName(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  const withoutLabel = value
    .replace(INSTRUCTOR_ROLE_PATTERN, "")
    .replace(/^(?:instructor\(s\)|instructors?|professor|prof)\s*[:.]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!withoutLabel) {
    return "";
  }

  const normalized = titleCaseName(withoutLabel.replace(/[;|]+$/g, "").trim());
  if (!normalized || STAFF_TERMS.has(normalized.toLowerCase())) {
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

  for (const line of lines) {
    const match = line.match(/\binstructor(?:\(s\)|s)?\s*:\s*(.+)$/i);
    if (!match) {
      continue;
    }

    for (const piece of splitInstructorList(match[1])) {
      const name = normalizeInstructorName(piece);
      const key = name.toLowerCase();
      if (name && !seen.has(key)) {
        seen.add(key);
        names.push(name);
      }
    }
  }

  return names;
}

export function splitInstructorList(value) {
  const cleaned = stripInstructorRoleAnnotations(value);
  const semicolonParts = cleaned
    .split(/\s*(?:;|\/|\band\b)\s*/i)
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

function stripInstructorRoleAnnotations(value) {
  return String(value ?? "").replace(INSTRUCTOR_ROLE_PATTERN, "").replace(/\s+/g, " ").trim();
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
  return /^[A-Z][A-Z'-]+$/.test(lastName) && /^[A-Z][A-Z'. -]+$/.test(firstNames);
}

function titleCaseName(value) {
  return value
    .split(" ")
    .map((token) => {
      const lowerToken = token.toLowerCase();
      if (ROMAN_NAME_SUFFIXES.has(lowerToken)) {
        return token.toUpperCase();
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
