// @vitest-environment node

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const HTML = readFileSync("src/manual/index.html", "utf8");

describe("user manual", () => {
  it("covers the core workflow and recovery path", () => {
    for (const section of [
      "quick-start",
      "essentials",
      "select-move",
      "measure-label",
      "save-share",
      "unstuck",
      "shortcuts",
    ]) {
      expect(HTML).toContain(`id="${section}"`);
    }
  });

  it("has a destination for every on-page link", () => {
    const destinations = [...HTML.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
    expect(destinations.length).toBeGreaterThan(0);
    for (const destination of destinations) {
      expect(HTML).toContain(`id="${destination}"`);
    }
  });

  it("links back to both the landing page and the app", () => {
    expect(HTML).toContain('href="/"');
    expect(HTML).toContain('href="/launch"');
  });

  it("ships every screenshot used by the guide", () => {
    const screenshots = [...HTML.matchAll(/src="(\/manual\/images\/[^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(screenshots.length).toBeGreaterThan(0);
    for (const screenshot of screenshots) {
      expect(existsSync(`src${screenshot}`), screenshot).toBe(true);
    }
  });
});
