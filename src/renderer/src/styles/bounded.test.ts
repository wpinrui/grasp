// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * What a dialog and an overlay do in a window too small to hold them is carried
 * by the stylesheets alone, and jsdom lays nothing out, so there is nothing to
 * measure in a rendered tree. The rules are read instead, the way the cursor's
 * own placement is pinned in `components/canvas/ToolCursor.test.tsx`.
 *
 * Paths resolve from the project root, which is where the run starts.
 */

const DIALOG_CSS = "src/renderer/src/components/TransformDialog.css";
const BASE_CSS = "src/renderer/src/styles/base.css";

/**
 * Every rule in `css` written against `selector` alone, each as its selector
 * and the declarations under it. A rule that reached the same end through a
 * selector list would not be found, so the first thing every check below does
 * is insist there was something to read.
 */
function rulesFor(css: string, selector: string): string[] {
  const found: string[] = [];
  for (let from = 0; ; ) {
    const at = css.indexOf(`${selector} {`, from);
    if (at === -1) {
      expect(
        found.length,
        `no rule in the sheet is written against ${selector} alone`,
      ).toBeGreaterThan(0);
      return found;
    }
    const end = css.indexOf("}", at);
    found.push(css.slice(at, end));
    from = end;
  }
}

describe("what gives way when the window is too small", () => {
  /**
   * A capped dialog is a column with negative free space in it, so anything
   * left shrinkable is shrunk. The bar and the buttons are what the cap exists
   * to keep, which leaves the body as the only thing that may give.
   */
  it("holds a dialog's bar and buttons at their own height", () => {
    const css = readFileSync(DIALOG_CSS, "utf8");
    expect(rulesFor(css, ".dialog")[0]).toContain("flex-direction: column");
    expect(rulesFor(css, ".dialog__bar")[0]).toContain("flex-shrink: 0");
    expect(rulesFor(css, ".dialog__buttons")[0]).toContain("flex-shrink: 0");
    expect(rulesFor(css, ".dialog__body--tall")[0]).toContain("overflow-y: auto");
  });

  /**
   * An overlay panel is centred in its scrim, so one taller than the window
   * would hang as far off the top as off the bottom and take its title and its
   * close button with it. The cap is a percentage of the scrim, which makes the
   * scrim's padding the gap it leaves: without that padding it is not capped.
   */
  it("bounds an overlay panel by the scrim it is centred in", () => {
    const css = readFileSync(BASE_CSS, "utf8");
    const panel = rulesFor(css, ".scrim__panel")[0];
    expect(panel).toContain("max-height: 100%");
    expect(panel).toContain("overflow-y: auto");
    const scrims = rulesFor(css, ".scrim");
    for (const scrim of scrims) expect(scrim).toMatch(/padding: \d+px/);
    // The phone's among them, where the scrim is pulled onto the visual
    // viewport and the panel has to be measured against that rather than the
    // window the keyboard is covering.
    expect(scrims.some((scrim) => scrim.includes("var(--seen-height)"))).toBe(true);
  });
});
