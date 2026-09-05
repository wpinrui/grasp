// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AA_TEXT, AA_UI, AAA_BODY, contrastRatio, loadTokens, relativeLuminance } from "./contrast";

const tokens = loadTokens();

interface Exception {
  pairing: string;
  ratio: number;
  reason: string;
}

const exceptions = JSON.parse(readFileSync("contrast-exceptions.json", "utf8")) as Exception[];
const excepted = new Map(exceptions.map((e) => [e.pairing, e]));

const SURFACES = ["bg", "surface", "surface-raised"] as const;
const FOREGROUNDS: { name: string; floor: number }[] = [
  { name: "text", floor: AA_TEXT },
  { name: "text-muted", floor: AA_TEXT },
  { name: "accent", floor: AA_UI },
];

describe("contrast gate", () => {
  for (const surface of SURFACES) {
    for (const { name, floor } of FOREGROUNDS) {
      const pairing = `${name} on ${surface}`;
      it(`${pairing} clears WCAG ${floor}:1`, () => {
        const ratio = contrastRatio(tokens[name], tokens[surface]);
        const exception = excepted.get(pairing);
        if (exception) {
          console.info(
            `contrast exception: ${pairing} = ${ratio.toFixed(2)}:1 — ${exception.reason}`,
          );
          return;
        }
        expect(ratio).toBeGreaterThanOrEqual(floor);
      });
    }
  }

  /**
   * The pairings the loop above cannot reach, because they are not a listed
   * foreground on a listed surface. Each is somewhere a colour is the only
   * thing carrying the meaning, so it has to be legible on its own.
   */
  const PAIRINGS: { name: string; on: string; over: string; floor: number }[] = [
    // A key on the touch bar that is held down is filled with the accent.
    { name: "a lit key", on: "bg", over: "accent", floor: AA_TEXT },
    // The AI button on a phone, which is the one control drawn in paint.
    { name: "the AI button", on: "ink-black", over: "paint-yellow", floor: AA_TEXT },
  ];

  /**
   * A key on the touch bar that can do nothing is greyed, and the grey is the
   * whole of what says so. Which grey is read out of the stylesheet rather than
   * named here, so that changing it there is what this answers for.
   */
  it("a spent key clears WCAG 3:1 in whatever grey the bar uses", () => {
    const bar = readFileSync("src/renderer/src/components/TouchBar.css", "utf8");
    const rule = /\.touchbar__key:disabled \{[^}]*color: var\(--color-([\w-]+)\)/.exec(bar);
    if (!rule) throw new Error("the touch bar does not say what a spent key looks like");
    expect(contrastRatio(tokens[rule[1]], tokens.surface)).toBeGreaterThanOrEqual(AA_UI);
  });

  for (const { name, on, over, floor } of PAIRINGS) {
    const pairing = `${on} on ${over}`;
    it(`${name} clears WCAG ${floor}:1`, () => {
      const ratio = contrastRatio(tokens[on], tokens[over]);
      const exception = excepted.get(pairing);
      if (exception) {
        console.info(
          `contrast exception: ${pairing} = ${ratio.toFixed(2)}:1 — ${exception.reason}`,
        );
        return;
      }
      expect(ratio).toBeGreaterThanOrEqual(floor);
    });
  }

  it("keeps a luminance step between adjacent surface layers", () => {
    const [bg, surface, raised] = SURFACES.map((s) => relativeLuminance(tokens[s]));
    expect(bg).toBeLessThan(surface);
    expect(surface).toBeLessThan(raised);
  });

  it("keeps the drawn cursor's outline pure white, which is what makes it invert", () => {
    // The outline is differenced against the sheet. Only pure white differences
    // to a true inverse, so any other value would leave the cursor a colour of
    // its own on some papers and invisible on others.
    expect(tokens["cursor-outline"]).toBe("#ffffff");
  });

  it("reports body text (text on bg) against the AAA target", () => {
    const ratio = contrastRatio(tokens.text, tokens.bg);
    if (ratio < AAA_BODY) {
      console.info(`body text ${ratio.toFixed(2)}:1 is below the AAA target ${AAA_BODY}:1`);
    }
    expect(ratio).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
