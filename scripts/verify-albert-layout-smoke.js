import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { scanAlbertPageOnce } from "../src/contentDom.js";
import { EXTENSION_VERSION } from "../src/shared/version.js";
import { verifyAlbertRenderedShape } from "./verify-albert-rendered-shape.js";

export async function verifyAlbertLayoutSmoke({ snapshotPath = "" } = {}) {
  const dom = new JSDOM(`<!doctype html>
    <html>
      <body>
        <main aria-label="Albert shopping cart">
          <div role="row" id="albert-smoke-row">
            <div role="gridcell">CSCI-UA 201 Computer Systems Organization</div>
            <div role="gridcell" id="albert-smoke-instructor" aria-label="Instructor">Ada Lovelace</div>
            <div role="gridcell">Open</div>
          </div>
        </main>
      </body>
    </html>
  `);
  const { document } = dom.window;
  document.documentElement.dataset.nyuRmpContentScript = "loaded";
  document.documentElement.dataset.nyuRmpVersion = EXTENSION_VERSION;

  const lookupProfessor = async (name) => ({
    name,
    department: "Computer Science",
    rating: 4.7,
    difficulty: 2.4,
    ratingsCount: 38,
    wouldTakeAgain: 92,
    tags: ["Helpful"],
    topComments: ["Explains computer systems clearly."],
    url: "https://www.ratemyprofessors.com/professor/123",
  });

  const { pendingLookups } = scanAlbertPageOnce({ document, lookupProfessor });
  await Promise.all(pendingLookups);

  const html = dom.serialize();
  if (snapshotPath) {
    await writeFile(snapshotPath, html);
  }

  const shape = verifyAlbertRenderedShape(html);
  return {
    ...shape,
    rowChildTags: Array.from(document.querySelector("#albert-smoke-row")?.children ?? [])
      .map((element) => element.tagName),
    trailingRatingCellIsLast: document.querySelector("[data-nyu-rmp-rating-cell='true']")
      === document.querySelector("#albert-smoke-row")?.lastElementChild,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await verifyAlbertLayoutSmoke({ snapshotPath: process.argv[2] ?? "" });
  console.log(JSON.stringify(result, null, 2));
}
