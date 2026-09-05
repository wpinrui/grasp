import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { place, Tooltip } from "./Tooltip";

afterEach(cleanup);

/** The pointer GRASP is being used with, which `usePhone` asks the browser for. */
function pointerIs(coarse: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: coarse,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })),
  );
}

beforeEach(() => pointerIs(false));

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
const SRC_DIR = "src";

/** Every JSX file the rule covers. Paths resolve from the project root. */
function jsxFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) jsxFiles(full, found);
    else if (entry.endsWith(".tsx")) found.push(full);
  }
  return found;
}

/** The last tag begun before the attribute, whether or not it has closed. */
function lastTag(source: string, at: number): string {
  const opened = [...source.slice(0, at).matchAll(/<([A-Za-z][\w.]*)/g)];
  return opened.length === 0 ? "" : opened[opened.length - 1][1];
}

/**
 * The tag still open at the attribute, counting `<` against `>` backwards so a
 * nested element in an earlier prop is stepped over: without this
 * `<button icon={<Icon />} title="x">` reads as `Icon` and escapes.
 */
function openTag(source: string, at: number): string {
  let depth = 0;
  for (let index = at - 1; index >= 0; index -= 1) {
    const letter = source[index];
    if (letter === ">") depth += 1;
    else if (letter === "<") {
      if (depth > 0) {
        depth -= 1;
        continue;
      }
      return /^<([A-Za-z][\w.]*)/.exec(source.slice(index))?.[1] ?? "";
    }
  }
  return "";
}

/**
 * What the attribute is written on. Both readings are taken and the lower-case
 * one wins, since either can be fooled on its own: `lastTag` by a nested
 * element in an earlier prop, `openTag` by a `>` inside one, e.g.
 * `disabled={places >= most}`. A rule that misses an offence is worth less than
 * one that occasionally names an innocent tag, which the sweep would surface.
 */
function tagAt(source: string, at: number): string {
  const last = lastTag(source, at);
  const open = openTag(source, at);
  if (open !== "" && open[0] === open[0].toLowerCase()) return open;
  if (last !== "" && last[0] === last[0].toLowerCase()) return last;
  return open || last;
}

/** Where a DOM element is handed a `title`, one line per offence. */
function nativeTitles(source: string, file = ""): string[] {
  const found: string[] = [];
  for (const hit of source.matchAll(/\btitle\s*=/g)) {
    const at = hit.index ?? 0;
    const tag = tagAt(source, at);
    // A capital says it is one of GRASP's own components, taking a prop that
    // never reaches the browser as an attribute.
    if (tag === "" || tag[0] === tag[0].toUpperCase()) continue;
    found.push(`${file}:${source.slice(0, at).split("\n").length}  <${tag} title=`);
  }
  return found;
}

describe("no native title tooltips", () => {
  it("every tooltip is drawn by GRASP", () => {
    const files = jsxFiles(SRC_DIR).filter((file) => !file.endsWith("Tooltip.test.tsx"));
    // Without these the sweep could pass by finding nothing to read, or by
    // narrowing back to the renderer and leaving the web app unread.
    expect(files.length).toBeGreaterThan(20);
    expect(files.some((file) => file.endsWith(join("web", "main.tsx")))).toBe(true);
    const offenders = files.flatMap((file) => nativeTitles(readFileSync(file, "utf8"), file));
    expect(offenders).toEqual([]);
  });

  it("reports a title on a DOM element", () => {
    expect(nativeTitles('<button type="button" title="Bold" />')).toEqual([":1  <button title="]);
  });

  it("leaves a title prop on one of GRASP's own components alone", () => {
    expect(nativeTitles('<DialogFrame title="Preferences" />')).toEqual([]);
    expect(nativeTitles("<TitleBar\n  title={doc.title}\n/>")).toEqual([]);
  });

  it("is not fooled by a tag that closed before the attribute", () => {
    expect(nativeTitles('<Popout sample={<Rule />} title="Notation" />')).toEqual([]);
    expect(nativeTitles('<button icon={<Icon />} title="Bold" />')).toEqual([":1  <button title="]);
  });

  it("is not fooled by a greater-than inside an earlier prop", () => {
    // `disabled={places >= most}`, the shape at ReadingPanel.tsx, closes the tag
    // as far as a bare depth count is concerned, and the offence would walk.
    expect(nativeTitles('<button disabled={a > b} title="Bold" />')).toEqual([
      ":1  <button title=",
    ]);
  });
});

describe("where the chip goes", () => {
  const of = { top: 100, bottom: 130, left: 200, right: 260, width: 60, height: 30 };
  const chip = { width: 80, height: 30 };

  it("hangs off the side it was asked for, centred on what it names", () => {
    // The box spans 200..260, so its middle is 230 and an 80-wide chip starts at 190.
    expect(place(of, chip, "top")).toEqual({ top: 64, left: 190 });
    expect(place(of, chip, "bottom")).toEqual({ top: 136, left: 190 });
    // 100..130 down, middle 115, so a 30-tall chip starts at 100.
    expect(place(of, chip, "left")).toEqual({ top: 100, left: 114 });
    expect(place(of, chip, "right")).toEqual({ top: 100, left: 266 });
  });

  it("stays inside the window rather than off whichever edge it was aimed at", () => {
    const topLeft = { top: 0, bottom: 20, left: 0, right: 20, width: 20, height: 20 };
    expect(place(topLeft, chip, "top")).toEqual({ top: 6, left: 6 });
    expect(place(topLeft, chip, "left")).toEqual({ top: 6, left: 6 });

    const farCorner = {
      top: window.innerHeight - 20,
      bottom: window.innerHeight,
      left: window.innerWidth - 20,
      right: window.innerWidth,
      width: 20,
      height: 20,
    };
    expect(place(farCorner, chip, "bottom")).toEqual({
      top: window.innerHeight - chip.height - 6,
      left: window.innerWidth - chip.width - 6,
    });
    expect(place(farCorner, chip, "right")).toEqual({
      top: window.innerHeight - chip.height - 6,
      left: window.innerWidth - chip.width - 6,
    });
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

  it("opens over a key that is greyed out, which is where it is worth most", () => {
    // A disabled control dispatches no mouse events at all, so a tooltip
    // listening on the control itself would never open on the one key whose
    // name the reader most needs.
    const { container } = render(
      <Tooltip says="One more decimal place">
        <button type="button" disabled>
          +
        </button>
      </Tooltip>,
    );
    const wrapper = container.querySelector(".tooltip__of");
    expect(wrapper).toBeTruthy();
    fireEvent.mouseOver(wrapper as Element);
    expect(screen.getByText("One more decimal place")).toBeTruthy();
    // And it hears the pointer leave, so it cannot be stranded on the sheet.
    fireEvent.mouseOut(wrapper as Element);
    expect(screen.queryByText("One more decimal place")).toBeNull();
  });

  it("leaves what it names holding its own handlers", () => {
    const seen: string[] = [];
    render(
      <Tooltip says="Bold">
        <button
          type="button"
          onClick={() => seen.push("click")}
          onMouseEnter={() => seen.push("enter")}
          onMouseLeave={() => seen.push("leave")}
          onFocus={() => seen.push("focus")}
          onBlur={() => seen.push("blur")}
        >
          B
        </button>
      </Tooltip>,
    );
    const key = screen.getByRole("button");
    fireEvent.mouseOver(key);
    fireEvent.focus(key);
    fireEvent.blur(key);
    fireEvent.mouseOut(key);
    fireEvent.click(key);
    expect(seen).toEqual(["enter", "focus", "blur", "leave", "click"]);
  });

  it("goes down on a press, which is usually what moves what it names", () => {
    const { container } = render(
      <Tooltip says="Add page">
        <button type="button">+</button>
      </Tooltip>,
    );
    const wrapper = container.querySelector(".tooltip__of") as Element;
    fireEvent.mouseOver(wrapper);
    expect(screen.getByText("Add page")).toBeTruthy();
    fireEvent.pointerDown(wrapper);
    expect(screen.queryByText("Add page")).toBeNull();
  });

  it("opens on nothing at all under a finger", () => {
    // A touch screen fires mouse events after a tap out of politeness to pages
    // written before it. A chip answering those would stand over the sheet
    // until the next tap somewhere else.
    pointerIs(true);
    const { container } = render(
      <Tooltip says="Point" keys="P">
        <button type="button">P</button>
      </Tooltip>,
    );
    fireEvent.mouseOver(container.querySelector(".tooltip__of") as Element);
    expect(screen.queryByText("Point")).toBeNull();
  });

  it("stays up for the keyboard while the pointer sweeps over and away", () => {
    // One flag for both would let either source's leave cancel the other's.
    const { container } = render(
      <Tooltip says="Labels">
        <button type="button">L</button>
      </Tooltip>,
    );
    const wrapper = container.querySelector(".tooltip__of") as Element;
    fireEvent.focus(screen.getByRole("button"));
    fireEvent.mouseOver(wrapper);
    fireEvent.mouseOut(wrapper);
    expect(screen.getByText("Labels")).toBeTruthy();
  });

  it("does not come straight back up on the focus the press itself gives", () => {
    const { container } = render(
      <Tooltip says="Add page">
        <button type="button">+</button>
      </Tooltip>,
    );
    const wrapper = container.querySelector(".tooltip__of") as Element;
    fireEvent.mouseOver(wrapper);
    fireEvent.pointerDown(wrapper);
    fireEvent.focus(screen.getByRole("button"));
    expect(screen.queryByText("Add page")).toBeNull();
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
