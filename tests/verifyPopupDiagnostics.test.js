import { describe, expect, it } from "vitest";
import { verifyPopupDiagnostics } from "../scripts/verify-popup-diagnostics.js";

describe("popup diagnostics verifier", () => {
  it("passes when copied popup diagnostics prove current segmented Albert cards", () => {
    expect(verifyPopupDiagnostics([
      "NYU Albert RMP Ratings diagnostics",
      "Build v0.1.3 | Albert 0.1.3 | 4 cards | 4 quick views | 4 cells | 4 rating columns",
      "Page status: Albert connected v0.1.3: 4 rating roots, 4 cards, 4 segmented quick views, 1 radar map, 4 Albert cells checked, 4 trailing rating columns, layout OK",
    ].join("\n"))).toMatchObject({
      ok: true,
      expectedVersion: "0.1.3",
      buildVersion: "0.1.3",
      albertVersion: "0.1.3",
      cardCount: 4,
      quickViewCount: 4,
      processedCellCount: 4,
      ratingColumnCount: 4,
    });
  });

  it("fails when Albert reports missing content version and no quick views", () => {
    expect(() => verifyPopupDiagnostics([
      "NYU Albert RMP Ratings diagnostics",
      "Build v0.1.3 | Albert missing | 4 cards | 0 quick views | 4 cells | 0 rating columns",
      "Page status: Albert connected; old squeezed card layout detected.",
    ].join("\n"))).toThrow("Albert content version missing does not match expected 0.1.3");
    try {
      verifyPopupDiagnostics("Build v0.1.3 | Albert missing | 4 cards | 0 quick views | 4 cells | 0 rating columns");
    } catch (error) {
      expect(error.result).toMatchObject({
        ok: false,
        albertVersion: "",
        cardCount: 4,
        quickViewCount: 0,
        failures: [
          "Albert content version missing does not match expected 0.1.3",
          "4 Albert RMP cards lack segmented quick views",
          "4 Albert RMP cards lack a trailing rating column",
        ],
      });
    }
  });

  it("fails when copied diagnostics contain personal or page-identifying data", () => {
    expect(() => verifyPopupDiagnostics([
      "Build v0.1.3 | Albert 0.1.3 | 4 cards | 4 quick views | 4 cells | 4 rating columns",
      "Page status: https://sis.portal.nyu.edu/psp/example",
    ].join("\n"))).toThrow("diagnostics contain personal or page-identifying data");
    expect(() => verifyPopupDiagnostics([
      "Build v0.1.3 | Albert 0.1.3 | 4 cards | 4 quick views | 4 cells | 4 rating columns",
      "Local path: C:\\Users\\Student\\Downloads",
    ].join("\n"))).toThrow("diagnostics contain personal or page-identifying data");
  });
});
