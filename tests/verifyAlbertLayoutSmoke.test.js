import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { verifyAlbertLayoutSmoke } from "../scripts/verify-albert-layout-smoke.js";

describe("Albert layout smoke verifier", () => {
  it("renders RMP cards into a trailing Albert rating column", async () => {
    await expect(verifyAlbertLayoutSmoke()).resolves.toMatchObject({
      ok: true,
      cardCount: 1,
      quickGridCount: 1,
      processedCellCount: 1,
      ratingCellCount: 1,
      trailingRatingRootCount: 1,
      inlineProcessedRatingRootCount: 0,
      rowChildTags: ["DIV", "DIV", "DIV", "DIV"],
      trailingRatingCellIsLast: true,
    });
  });

  it("can write a snapshot that passes the Albert shape verifier", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nyu-rmp-albert-smoke-"));
    const snapshotPath = join(dir, "albert-smoke.html");

    const result = await verifyAlbertLayoutSmoke({ snapshotPath });
    const snapshot = await readFile(snapshotPath, "utf8");

    expect(result.ok).toBe(true);
    expect(snapshot).toContain("data-nyu-rmp-rating-cell=\"true\"");
    expect(snapshot).toContain("nyu-rmp-quick-grid");
  });
});
