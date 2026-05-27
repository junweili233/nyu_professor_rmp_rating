import { describe, expect, it } from "vitest";
import { verifyAlbertRenderedShape } from "../scripts/verify-albert-rendered-shape.js";

describe("Albert rendered shape verifier", () => {
  it("passes when Albert renders current RMP cards in the trailing rating column", () => {
    expect(verifyAlbertRenderedShape(`
      <html data-nyu-rmp-content-script="loaded" data-nyu-rmp-version="0.1.6">
        <body>
          <div role="row">
            <div role="gridcell" data-nyu-rmp-processed="true">
              <div class="nyu-rmp-albert-original">Ada Lovelace</div>
            </div>
            <div role="gridcell" class="nyu-rmp-rating-cell" data-nyu-rmp-rating-cell="true">
              <div class="nyu-rmp-rating-root is-cell-mounted">
                <div class="nyu-rmp-card">
                  <div class="nyu-rmp-quick-grid">
                    <section class="nyu-rmp-quick-section is-score"></section>
                    <section class="nyu-rmp-quick-section is-tools"></section>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `)).toMatchObject({
      ok: true,
      contentScript: "loaded",
      contentVersion: "0.1.6",
      cardCount: 1,
      quickGridCount: 1,
      processedCellCount: 1,
      ratingCellCount: 1,
      trailingRatingRootCount: 1,
      inlineProcessedRatingRootCount: 0,
    });
  });

  it("fails when Albert is still rendering old squeezed card markup", () => {
    expect(() => verifyAlbertRenderedShape(`
      <html data-nyu-rmp-content-script="loaded">
        <body>
          <div data-nyu-rmp-processed="true">
            <div class="nyu-rmp-card">
              <div class="nyu-rmp-card-head"></div>
              <div class="nyu-rmp-comments-panel"></div>
            </div>
          </div>
        </body>
      </html>
    `)).toThrow("Albert page is not rendering the current segmented RMP layout");
    try {
      verifyAlbertRenderedShape(`
        <html data-nyu-rmp-content-script="loaded">
          <body>
            <div class="nyu-rmp-card">
              <div class="nyu-rmp-card-head"></div>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      expect(error.result).toMatchObject({
        ok: false,
        contentVersion: "",
        cardCount: 1,
        quickGridCount: 0,
        failures: [
          "content script version missing does not match expected 0.1.6",
          "1 rendered RMP card still lacks segmented quick views",
        ],
      });
    }
  });

  it("fails when Albert still mounts current cards inside processed instructor cells", () => {
    expect(() => verifyAlbertRenderedShape(`
      <html data-nyu-rmp-content-script="loaded" data-nyu-rmp-version="0.1.6">
        <body>
          <div role="row">
            <div role="gridcell" data-nyu-rmp-processed="true">
              <div class="nyu-rmp-albert-original">Ada Lovelace</div>
              <div class="nyu-rmp-rating-root is-cell-mounted">
                <div class="nyu-rmp-card">
                  <div class="nyu-rmp-quick-grid"></div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `)).toThrow("RMP rating root is still mounted inside processed Albert cells");
  });

  it("fails when a trailing Albert rating column has no rating root", () => {
    try {
      verifyAlbertRenderedShape(`
        <html data-nyu-rmp-content-script="loaded" data-nyu-rmp-version="0.1.6">
          <body>
            <div role="row">
              <div role="gridcell" data-nyu-rmp-processed="true">
                <div class="nyu-rmp-albert-original">Ada Lovelace</div>
              </div>
              <div role="gridcell" class="nyu-rmp-rating-cell" data-nyu-rmp-rating-cell="true">
                <div class="nyu-rmp-card">
                  <div class="nyu-rmp-quick-grid"></div>
                </div>
              </div>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      expect(error.result).toMatchObject({
        ok: false,
        ratingCellCount: 1,
        trailingRatingRootCount: 0,
        failures: [
          "one or more trailing rating columns do not contain an RMP rating root",
        ],
      });
    }
  });

  it("fails when the current content-script marker is missing from the page", () => {
    expect(() => verifyAlbertRenderedShape(`
      <html>
        <body>
          <div class="nyu-rmp-card">
            <div class="nyu-rmp-quick-grid"></div>
          </div>
        </body>
      </html>
    `)).toThrow("current content script marker is missing");
  });
});
