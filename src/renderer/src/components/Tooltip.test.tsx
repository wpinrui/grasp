import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Tooltip } from "./Tooltip";

afterEach(cleanup);

/**
 * The browser's `title` is not GRASP's tooltip. It is drawn in the browser's
 * colours after a wait nothing here can set, it cannot carry the key chip, and
 * a touch screen never shows it at all. `Tooltip` is the one GRASP draws, so
 * nothing on a plain DOM element may set `title` instead.
 *
 * A `title` prop on a component of GRASP's own is a different thing entirely:
 * `DialogFrame` and `TitleBar` both take one, and neither is a tooltip. So this
 * reads the tag each `title=` belongs to and flags only the lower-case ones,
 * which are the DOM elements React hands straight to the browser.
 */
const SRC_DIR = "src/renderer/src";

/** Every JSX file the rule covers. Paths resolve from the project root. */
function jsxFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) jsxFiles(full, found);
    else if (entry.endsWith(".tsx")) found.push(full);
  }
  return found;
}

/** The opening tag an attribute sits in: the last one begun before it. */
function tagAt(source: string, at: number): string {
  const opened = [...source.slice(0, at).matchAll(/<([A-Za-z][\w.]*)/g)];
  return opened.length === 0 ? "" : opened[opened.length - 1][1];
}

/** Where a DOM element is handed a `title`, one line per offence. */
function nativeTitles(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const found: string[] = [];
  for (const hit of source.matchAll(/\btitle\s*=/g)) {
    const at = hit.index ?? 0;
    const tag = tagAt(source, at);
    // A capital says it is one of GRASP's own components, taking a prop that
    // never reaches the browser as an attribute.
    if (tag === "" || tag[0] === tag[0].toUpperCase()) continue;
    const line = source.slice(0, at).split("\n").length;
    found.push(`${file}:${line}  <${tag} title=`);
  }
  return found;
}

describe("no native title tooltips", () => {
  it("every tooltip is drawn by GRASP", () => {
    const offenders = jsxFiles(SRC_DIR)
      .filter((file) => !file.endsWith("Tooltip.test.tsx"))
      .flatMap(nativeTitles);
    expect(offenders).toEqual([]);
  });

  it("tells a DOM element from one of GRASP's own components", () => {
    const source = '<button title="Bold" />\n<DialogFrame title="Preferences" />';
    expect(tagAt(source, source.indexOf("title"))).toBe("button");
    expect(tagAt(source, source.lastIndexOf("title"))).toBe("DialogFrame");
  });
});

describe("the tooltip itself", () => {
  it("opens on the pointer and says what it names", () => {
    render(
      <Tooltip says="Bold" keys="Ctrl+B">
        <button type="button">B</button>
      </Tooltip>,
    );
    const key = screen.getByRole("button");
    expect(screen.queryByText("Bold")).toBeNull();
    fireEvent.mouseOver(key);
    expect(screen.getByText("Bold")).toBeTruthy();
    expect(screen.getByText("Ctrl+B")).toBeTruthy();
    fireEvent.mouseOut(key);
    expect(screen.queryByText("Bold")).toBeNull();
  });

  it("opens on the keyboard as well, so it is not the pointer's alone", () => {
    render(
      <Tooltip says="Italic">
        <button type="button">I</button>
      </Tooltip>,
    );
    const key = screen.getByRole("button");
    fireEvent.focus(key);
    expect(screen.getByText("Italic")).toBeTruthy();
    fireEvent.blur(key);
    expect(screen.queryByText("Italic")).toBeNull();
  });

  it("keeps the handlers the thing it names already had", () => {
    let pressed = 0;
    let entered = 0;
    render(
      <Tooltip says="Bold">
        <button type="button" onClick={() => (pressed += 1)} onMouseEnter={() => (entered += 1)}>
          B
        </button>
      </Tooltip>,
    );
    const key = screen.getByRole("button");
    fireEvent.mouseOver(key);
    fireEvent.click(key);
    expect(pressed).toBe(1);
    expect(entered).toBe(1);
  });

  it("stays down while something else is showing in its place", () => {
    render(
      <Tooltip says="Point" quiet>
        <button type="button">P</button>
      </Tooltip>,
    );
    fireEvent.mouseOver(screen.getByRole("button"));
    expect(screen.queryByText("Point")).toBeNull();
  });
});
