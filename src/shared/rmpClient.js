const RMP_GRAPHQL_URL = "https://www.ratemyprofessors.com/graphql";
const NYU_SCHOOL_ID = "U2Nob29sLTEzODE=";
const MIN_ACCEPTABLE_TEACHER_SCORE = 25;
const DEFAULT_LOOKUP_TIMEOUT_MS = 8000;
const NAME_SUFFIXES = new Set(["ii", "ii.", "iii", "iii.", "iv", "iv.", "v", "v.", "jr", "jr.", "sr", "sr."]);

const PROFESSOR_SEARCH_QUERY = `
  query NewSearchTeachersQuery($query: TeacherSearchQuery!) {
    newSearch {
      teachers(query: $query) {
        edges {
          node {
            id
            legacyId
            firstName
            lastName
            department
            avgRating
            avgDifficulty
            numRatings
            wouldTakeAgainPercent
            teacherRatingTags {
              tagName
            }
            ratings(first: 8) {
              edges {
                node {
                  comment
                  helpfulRating
                  clarityRating
                  difficultyRating
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function findProfessorRating(name, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOOKUP_TIMEOUT_MS;
  for (const queryText of searchNameVariants(name)) {
    const teachers = await searchTeachers(queryText, fetchImpl, timeoutMs);
    const bestMatch = pickBestTeacher(name, teachers);
    if (bestMatch && teacherScore(compactName(name), bestMatch) >= MIN_ACCEPTABLE_TEACHER_SCORE) {
      return toProfessorRating(bestMatch, name);
    }
  }

  return null;
}

async function searchTeachers(name, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetchImpl(RMP_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        query: PROFESSOR_SEARCH_QUERY,
        variables: {
          query: {
            text: name,
            schoolID: NYU_SCHOOL_ID,
            fallback: true,
          },
        },
      }),
    });
  } catch (error) {
    if (error?.name === "AbortError" || controller.signal.aborted) {
      throw new Error("Rate My Professors request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Rate My Professors request failed with ${response.status}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Rate My Professors response was not valid JSON");
  }
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    const message = payload.errors.map((error) => error?.message).filter(Boolean).join("; ");
    throw new Error(`Rate My Professors request failed: ${message || "GraphQL error"}`);
  }
  return payload?.data?.newSearch?.teachers?.edges?.map((edge) => edge?.node).filter(Boolean) ?? [];
}

export function pickBestTeacher(name, teachers) {
  const target = compactName(name);
  return teachers
    .filter(Boolean)
    .sort((left, right) => {
      const leftScore = teacherScore(target, left);
      const rightScore = teacherScore(target, right);
      return rightScore - leftScore;
    })[0] ?? null;
}

function toProfessorRating(teacher, requestedName) {
  const name = `${teacher.firstName ?? ""} ${teacher.lastName ?? ""}`.trim();
  const comments = teacher?.ratings?.edges
    ?.map((edge) => edge?.node)
    .filter((rating) => rating?.comment?.trim())
    .sort((left, right) => commentHelpfulScore(right) - commentHelpfulScore(left))
    .map((rating) => ({
      text: rating.comment.trim(),
      helpfulRating: nonNegativeNumberOrNull(rating.helpfulRating),
      clarityRating: rmpScaleNumberOrNull(rating.clarityRating),
      difficultyRating: rmpScaleNumberOrNull(rating.difficultyRating),
    }))
    .filter(Boolean)
    .slice(0, 2) ?? [];

  return {
    id: teacher.id,
    name,
    matchConfidence: compactName(name) === compactName(requestedName) ? "exact" : "fuzzy",
    department: teacher.department ?? "",
    rating: rmpScaleNumberOrNull(teacher.avgRating),
    difficulty: rmpScaleNumberOrNull(teacher.avgDifficulty),
    ratingsCount: nonNegativeCount(teacher.numRatings),
    wouldTakeAgain: percentNumberOrNull(teacher.wouldTakeAgainPercent),
    tags: teacher.teacherRatingTags?.map((tag) => normalizeTagName(tag?.tagName)).filter(Boolean).slice(0, 3) ?? [],
    topComments: comments,
    url: teacher.legacyId
      ? `https://www.ratemyprofessors.com/professor/${teacher.legacyId}`
      : "https://www.ratemyprofessors.com/",
  };
}

function teacherScore(target, teacher) {
  const firstName = compactName(teacher.firstName ?? "");
  const lastName = compactName(teacher.lastName ?? "");
  const name = compactName(`${teacher.firstName ?? ""} ${teacher.lastName ?? ""}`);
  let score = 0;
  if (name === target) {
    score += 100;
  }
  if (target.includes(name)) {
    score += 25;
  }
  if (firstName && lastName && target.startsWith(firstName) && target.endsWith(lastName)) {
    score += 90;
  }
  if (/computer|cs|courant/i.test(teacher.department ?? "")) {
    score += 10;
  }
  score += Math.min(nonNegativeCount(teacher.numRatings), 50) / 10;
  return score;
}

function normalizeTagName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function commentHelpfulScore(rating) {
  return nonNegativeNumberOrNull(rating?.helpfulRating) ?? 0;
}

function compactName(value) {
  return foldDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function foldDiacritics(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function numberOrNull(value) {
  if (value == null || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonNegativeNumberOrNull(value) {
  const number = numberOrNull(value);
  return number == null || number < 0 ? null : number;
}

function percentNumberOrNull(value) {
  const number = nonNegativeNumberOrNull(value);
  return number == null || number > 100 ? null : number;
}

function rmpScaleNumberOrNull(value) {
  const number = nonNegativeNumberOrNull(value);
  return number == null || number > 5 ? null : number;
}

function nonNegativeCount(value) {
  return nonNegativeNumberOrNull(value) ?? 0;
}

function searchNameVariants(name) {
  const normalized = String(name).trim().replace(/\s+/g, " ");
  const parts = normalized.split(" ").filter((part) => part && !NAME_SUFFIXES.has(part.toLowerCase()));
  const variants = [normalized];
  const folded = foldDiacritics(normalized);

  if (folded && folded !== normalized) {
    variants.push(folded);
  }

  const withoutTitleSuffix = parts.join(" ");

  if (withoutTitleSuffix && withoutTitleSuffix !== normalized) {
    variants.push(withoutTitleSuffix);
  }

  if (parts.length > 2) {
    variants.push(`${parts[0]} ${parts[parts.length - 1]}`);
  }

  return Array.from(new Set(variants));
}
