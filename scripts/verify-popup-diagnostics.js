import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { EXTENSION_VERSION } from "../src/shared/version.js";

const PERSONAL_DATA_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|https?:\/\/|sis\.portal\.nyu\.edu|albert\.nyu\.edu|C:\\Users[\\/]|%USERPROFILE%/i;

export function verifyPopupDiagnostics(text, { expectedVersion = EXTENSION_VERSION } = {}) {
  const diagnosticText = String(text ?? "");
  const summary = parseDiagnosticsSummary(diagnosticText);
  const result = {
    ok: true,
    expectedVersion,
    ...summary,
  };
  const failures = [];
  if (PERSONAL_DATA_PATTERN.test(diagnosticText)) {
    failures.push("diagnostics contain personal or page-identifying data");
  }
  if (summary.buildVersion !== expectedVersion) {
    failures.push(`popup build version ${summary.buildVersion || "missing"} does not match expected ${expectedVersion}`);
  }
  if (summary.albertVersion !== expectedVersion) {
    failures.push(`Albert content version ${summary.albertVersion || "missing"} does not match expected ${expectedVersion}`);
  }
  if (summary.cardCount > 0 && summary.quickViewCount < summary.cardCount) {
    failures.push(`${summary.cardCount - summary.quickViewCount} Albert RMP card${summary.cardCount - summary.quickViewCount === 1 ? " lacks" : "s lack"} segmented quick views`);
  }
  if (summary.cardCount === 0) {
    failures.push("no Albert RMP cards were reported");
  }
  if (failures.length > 0) {
    const error = new Error([
      "Popup diagnostics do not prove the current Albert segmented layout.",
      ...failures.map((failure) => `- ${failure}`),
      "Load this repository's dist folder, refresh Albert, open the popup, copy diagnostics, then verify again.",
    ].join("\n"));
    error.result = { ...result, ok: false, failures };
    throw error;
  }
  return result;
}

function parseDiagnosticsSummary(text) {
  const match = String(text ?? "").match(
    /Build v(?<buildVersion>[^\s|]+)\s*\|\s*Albert (?<albertVersion>[^\s|]+)\s*\|\s*(?<cardCount>\d+) cards?\s*\|\s*(?<quickViewCount>\d+) quick views?\s*\|\s*(?<processedCellCount>\d+) cells?/i,
  );
  if (!match?.groups) {
    return {
      buildVersion: "",
      albertVersion: "",
      cardCount: 0,
      quickViewCount: 0,
      processedCellCount: 0,
    };
  }
  return {
    buildVersion: match.groups.buildVersion,
    albertVersion: match.groups.albertVersion === "missing" ? "" : match.groups.albertVersion,
    cardCount: Number(match.groups.cardCount),
    quickViewCount: Number(match.groups.quickViewCount),
    processedCellCount: Number(match.groups.processedCellCount),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const diagnosticsPath = process.argv[2];
  if (!diagnosticsPath) {
    throw new Error("Usage: node scripts/verify-popup-diagnostics.js <popup-diagnostics.txt>");
  }
  const result = verifyPopupDiagnostics(await readFile(diagnosticsPath, "utf8"));
  console.log(JSON.stringify(result, null, 2));
}
