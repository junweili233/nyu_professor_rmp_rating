const RMP_GRAPHQL_URL = "https://www.ratemyprofessors.com/graphql";
const NYU_SCHOOL_ID = "U2Nob29sLTEzODE=";

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
  const response = await fetchImpl(RMP_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
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

  if (!response.ok) {
    throw new Error(`Rate My Professors request failed with ${response.status}`);
  }

  const payload = await response.json();
  const teachers = payload?.data?.newSearch?.teachers?.edges?.map((edge) => edge.node) ?? [];
  const bestMatch = pickBestTeacher(name, teachers);

  return bestMatch ? toProfessorRating(bestMatch) : null;
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

function toProfessorRating(teacher) {
  const name = `${teacher.firstName ?? ""} ${teacher.lastName ?? ""}`.trim();
  const comments = teacher?.ratings?.edges
    ?.map((edge) => edge?.node)
    .filter((rating) => rating?.comment?.trim())
    .sort((left, right) => Number(right.helpfulRating ?? 0) - Number(left.helpfulRating ?? 0))
    .map((rating) => rating.comment.trim())
    .filter(Boolean)
    .slice(0, 2) ?? [];

  return {
    id: teacher.id,
    name,
    department: teacher.department ?? "",
    rating: numberOrNull(teacher.avgRating),
    difficulty: numberOrNull(teacher.avgDifficulty),
    ratingsCount: Number(teacher.numRatings ?? 0),
    wouldTakeAgain: numberOrNull(teacher.wouldTakeAgainPercent),
    tags: teacher.teacherRatingTags?.map((tag) => tag.tagName).filter(Boolean).slice(0, 3) ?? [],
    topComments: comments,
    url: teacher.legacyId
      ? `https://www.ratemyprofessors.com/professor/${teacher.legacyId}`
      : "https://www.ratemyprofessors.com/",
  };
}

function teacherScore(target, teacher) {
  const name = compactName(`${teacher.firstName ?? ""} ${teacher.lastName ?? ""}`);
  let score = 0;
  if (name === target) {
    score += 100;
  }
  if (name.includes(target) || target.includes(name)) {
    score += 25;
  }
  if (/computer|cs|courant/i.test(teacher.department ?? "")) {
    score += 10;
  }
  score += Math.min(Number(teacher.numRatings ?? 0), 50) / 10;
  return score;
}

function compactName(value) {
  return String(value).toLowerCase().replace(/[^a-z]/g, "");
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
