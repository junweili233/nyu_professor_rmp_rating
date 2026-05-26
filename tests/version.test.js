import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { EXTENSION_VERSION } from "../src/shared/version.js";

describe("extension version source", () => {
  it("keeps the runtime version aligned with package.json and the Chrome manifest", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    const manifest = JSON.parse(await readFile(new URL("../src/manifest.json", import.meta.url), "utf8"));

    expect(EXTENSION_VERSION).toBe(packageJson.version);
    expect(EXTENSION_VERSION).toBe(manifest.version);
  });
});
