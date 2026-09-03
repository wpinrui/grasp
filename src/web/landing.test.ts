/**
 * The landing page is the one file in the repo that every other gate is blind
 * to: Biome excludes it, nothing under `src` imports it, and `build:web`
 * publishes it with a plain `copyFileSync`. It is also the one file that is
 * edited as an encoded payload rather than as source, so a slip that would be
 * a syntax error anywhere else silently ships a blank site instead.
 *
 * These are the checks that make such an edit safe to land: that the payload
 * still decodes, that nothing in it can close the script carrying it, that
 * every responsive handle is joined up at both ends, and that the embeds are
 * given the src and the reload the page means them to have.
 */

import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";

const BUNDLE = "grasp-landing.html";
const OPENS_TEMPLATE = '<script type="__bundler/template">';

/** Elements HTML closes for you, so an unmatched one is not a defect. */
const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * The payload: one JSON string on the line after the tag that opens it. Found
 * by the tag rather than by a line number, which would rot the first time the
 * bundler emitted a line more or less. Read once; the file cannot change
 * under a run, and it is 7.7MB.
 */
let read: { encoded: string; html: string } | null = null;
function payload(): { encoded: string; html: string } {
  if (read) return read;
  const lines = readFileSync(BUNDLE, "utf8").split("\n");
  const opened = lines.findIndex((line) => line.includes(OPENS_TEMPLATE));
  if (opened < 0) throw new Error(`${BUNDLE}: no ${OPENS_TEMPLATE} in the file`);
  const encoded = lines[opened + 1];
  read = { encoded, html: JSON.parse(encoded) as string };
  return read;
}

/** The page, parsed, so a selector can be asked what it really matches. */
let tree: Document | null = null;
function page(): Document {
  if (!tree) tree = new DOMParser().parseFromString(payload().html, "text/html");
  return tree;
}

/** Just the stylesheet bodies, so a rule can be told apart from a mention. */
function styles(): string {
  return [...payload().html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
    .map((block) => block[1])
    .join("\n");
}

/** The page's own script, which is where the embed behaviour lives. */
function script(): string {
  const found = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(payload().html);
  if (!found) throw new Error("no text/x-dc script in the payload");
  return found[1];
}

/** Every closing tag that closed the wrong thing, plus anything left open. */
function unbalanced(markup: string): string[] {
  const stack: string[] = [];
  const problems: string[] = [];
  for (const tag of markup.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = tag;
    if (VOID.has(name) || selfClosing === "/") continue;
    if (!closing) {
      stack.push(name);
    } else if (stack[stack.length - 1] === name) {
      stack.pop();
    } else {
      problems.push(`</${name}> closes <${stack[stack.length - 1] ?? "nothing"}>`);
    }
  }
  return [...problems, ...stack.map((name) => `<${name}> never closed`)];
}

describe("landing page bundle", () => {
  it("decodes to the page", () => {
    expect(payload().html.startsWith("<!DOCTYPE html>")).toBe(true);
  });

  /**
   * The payload sits inside a `<script>`, so the bundler escapes every closing
   * tag in it. One literal `</` written back by a hand edit ends that element
   * early, truncates the JSON, and publishes a blank page with every other
   * gate still green.
   */
  it("carries nothing that would close the script holding it", () => {
    expect(payload().encoded).not.toContain("</");
  });

  /**
   * A hand edit that leaves a stray closing tag behind still decodes, still
   * carries no bare `</`, and still renders something, so nothing above would
   * notice. What it does is reparent everything after it, which is how a
   * duplicated `</helmet>` puts the whole page inside the head.
   */
  it("closes every tag it opens", () => {
    // Script bodies hold `<` as a comparison rather than as markup, so they
    // are emptied before the scan rather than parsed.
    const markup = payload().html.replace(/<script\b[\s\S]*?<\/script>/g, "<script></script>");
    expect(unbalanced(markup)).toEqual([]);
  });

  it("keeps the viewport meta the breakpoints need", () => {
    const viewport = page().querySelector('meta[name="viewport"]');
    expect(viewport?.getAttribute("content")).toBe("width=device-width, initial-scale=1");
  });
});

describe("landing page responsive handles", () => {
  /**
   * The responsive layer is 20-odd `r-*` classes applied by hand across the
   * markup and named again in the media queries. A typo at either end is a
   * rule that silently does nothing, so both directions are checked, and the
   * stylesheets are read apart from the script: a handle mentioned only in a
   * `querySelector` string is not a handle any rule is styling.
   */
  const named = (source: string): Set<string> =>
    new Set([...source.matchAll(/\.(r-[a-zA-Z0-9_-]+)/g)].map((hit) => hit[1] as string));

  it("styles every handle it names", () => {
    const unmatched = [...named(styles())].filter((name) => !page().querySelector(`.${name}`));
    expect(unmatched).toEqual([]);
  });

  it("names every handle it puts on an element", () => {
    const inCss = named(styles());
    const orphans: string[] = [];
    for (const element of page().querySelectorAll("[class]")) {
      for (const name of element.classList) {
        if (name.startsWith("r-") && !inCss.has(name)) orphans.push(name);
      }
    }
    expect(orphans).toEqual([]);
  });

  it("finds every handle its own script reaches for", () => {
    const unmatched = [...named(script())].filter((name) => !page().querySelector(`.${name}`));
    expect(unmatched).toEqual([]);
  });

  /**
   * The phone width is written twice, once as a media query and once as the
   * string `fitEmbeds` matches on, and the two have to agree: a frame sized by
   * CSS for a bare canvas while the script still gave it the full app chrome
   * is the failure this catches. Matched against the stylesheets alone, since
   * a comment repeating the width would otherwise satisfy it.
   */
  it("states the phone breakpoint the same way in the CSS and the script", () => {
    const declared = /static PHONE = "([^"]+)"/.exec(script())?.[1];
    expect(declared).toBeTruthy();
    expect(styles()).toContain(`@media ${declared}`);
  });
});

describe("landing page embeds", () => {
  interface Embeds {
    initEmbeds(): void;
    fitEmbeds(frames: HTMLIFrameElement[]): void;
    initTapOverlays(): void;
    componentWillUnmount(): void;
  }
  type Embedder = { new (props: unknown): Embeds } & { PHONE: string };

  /**
   * The page's own script, run. Nothing else can reach `fitEmbeds`: it exists
   * only inside a published page, and only a phone or a resize calls it.
   */
  function embedder(): Embedder {
    const make = new Function("DCLogic", "React", `${script()}\nreturn Component;`);
    return make(class {}, { createRef: () => ({ current: null }) });
  }

  /** The srcs the page ships, read off the payload rather than typed out again. */
  function shipped(): string[] {
    return [...page().querySelectorAll("iframe.r-frame")].map(
      (frame) => frame.getAttribute("src") ?? "",
    );
  }

  function at(width: "phone" | "desktop", Component: Embedder): void {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: width === "phone" && query === Component.PHONE,
        media: query,
      }),
    });
  }

  /**
   * The page's two embeds, each frame's browsing context described rather
   * than run: `where` says what its location reports, and any navigation is
   * recorded instead of performed.
   *
   * The states matter and are easy to get wrong. A `loading="lazy"` frame is
   * NOT one without a contentWindow: it gets its browsing context the moment
   * it is inserted and sits at `about:blank` until the fetch happens, which
   * is the state both frames are in when `componentDidMount` runs. A missing
   * contentWindow only arises when reading it throws.
   */
  function embeds(where: (src: string) => string | null, width = 1140) {
    document.body.innerHTML = shipped()
      .map((src) => `<iframe class="r-frame" src="${src}"></iframe>`)
      .join("");
    const frames = [...document.querySelectorAll("iframe.r-frame")] as HTMLIFrameElement[];
    const replaced: string[] = [];
    for (const frame of frames) {
      const href = where(frame.getAttribute("src") ?? "");
      Object.defineProperty(frame, "contentWindow", {
        configurable: true,
        get() {
          if (href === null) throw new Error("cross-origin");
          return { location: { href, replace: (to: string) => replaced.push(to) } };
        },
      });
      // jsdom lays nothing out, so the width the refit keys on has to be said.
      Object.defineProperty(frame, "clientWidth", { configurable: true, value: width });
    }
    return { frames, replaced };
  }

  const lazy = (width?: number) => embeds(() => "about:blank", width);
  const loaded = (width?: number) =>
    embeds((src) => new URL(src, window.location.href).href, width);
  const blind = () => embeds(() => null);

  function srcsAfterMount(width: "phone" | "desktop") {
    const Component = embedder();
    at(width, Component);
    const state = lazy();
    new Component({}).initEmbeds();
    return { ...state, srcs: state.frames.map((frame) => frame.getAttribute("src") ?? "") };
  }

  it("gives a phone the canvas alone", () => {
    expect(srcsAfterMount("phone").srcs).toEqual([
      "/launch/?sketch=sketches/triangle.grasp&chrome=none&locked",
      "/launch/?sketch=sketches/rosette.grasp&locked&chrome=none",
    ]);
  });

  it("leaves a desktop the srcs the page shipped", () => {
    expect(srcsAfterMount("desktop").srcs).toEqual(shipped());
  });

  /**
   * A frame waiting on `loading="lazy"` is pointed at its target and left to
   * fetch it when it scrolls into range. Navigating it here would defeat the
   * lazy loading and boot two app instances at mount, one of them below the
   * fold.
   */
  it("does not navigate a frame that has not loaded", () => {
    expect(srcsAfterMount("phone").replaced).toEqual([]);
    expect(blindAtPhone().replaced).toEqual([]);
  });

  function blindAtPhone() {
    const Component = embedder();
    at("phone", Component);
    const state = blind();
    new Component({}).initEmbeds();
    return state;
  }

  it("still points a frame it cannot see into at the right src", () => {
    expect(blindAtPhone().frames.map((frame) => frame.getAttribute("src"))).toEqual([
      "/launch/?sketch=sketches/triangle.grasp&chrome=none&locked",
      "/launch/?sketch=sketches/rosette.grasp&locked&chrome=none",
    ]);
  });

  /**
   * Crossing the breakpoint and coming back has to land on the shipped src
   * again, which is what proves the derivation reads the src it stashed at
   * mount rather than whatever the previous pass wrote.
   */
  it("returns to the shipped srcs when a phone widens again", () => {
    const Component = embedder();
    at("phone", Component);
    const { frames } = lazy();
    const fitter = new Component({});
    fitter.initEmbeds();
    at("desktop", Component);
    fitter.fitEmbeds(frames);
    expect(frames.map((frame) => frame.getAttribute("src"))).toEqual(shipped());
  });

  /**
   * Assigning src to a frame that has already navigated pushes an entry onto
   * the joint session history, so every crossing of the breakpoint would cost
   * the reader a Back press that re-fits an embed instead of leaving the page.
   */
  it("navigates a loaded frame by replacing, never by the src attribute", () => {
    const Component = embedder();
    at("desktop", Component);
    const { frames, replaced } = loaded();
    const fitter = new Component({});
    fitter.initEmbeds();
    const before = frames.map((frame) => frame.getAttribute("src"));

    at("phone", Component);
    fitter.fitEmbeds(frames);

    expect(replaced).toHaveLength(1);
    expect(replaced[0].endsWith("/launch/?sketch=sketches/rosette.grasp&locked&chrome=none")).toBe(
      true,
    );
    expect(frames.map((frame) => frame.getAttribute("src"))).toEqual(before);
  });

  /**
   * The refit exists because the app fits a sketch to the size it opened at
   * and `locked` never moves the view again. It is keyed on the frame, not
   * the window: both embeds sit in max-width: 1140px containers, so a wide
   * window can change size without either frame moving, and a reload there
   * would throw away a figure the reader had dragged.
   */
  it("leaves a loaded frame alone when its own width has not changed", () => {
    const Component = embedder();
    at("desktop", Component);
    const { frames, replaced } = loaded();
    const fitter = new Component({});
    fitter.initEmbeds();
    fitter.fitEmbeds(frames);
    expect(replaced).toEqual([]);
  });

  it("reloads a loaded frame when its own width changes", () => {
    const Component = embedder();
    at("desktop", Component);
    const { frames, replaced } = loaded();
    const fitter = new Component({});
    fitter.initEmbeds();
    for (const frame of frames) {
      Object.defineProperty(frame, "clientWidth", { configurable: true, value: 320 });
    }
    fitter.fitEmbeds(frames);
    expect(replaced).toHaveLength(2);
  });
});

describe("landing page tap overlay", () => {
  interface Overlays {
    initTapOverlays(): void;
    componentWillUnmount(): void;
  }
  type Entry = { target: Element; isIntersecting: boolean };

  let watching: { nodes: Element[]; fire: (entries: Entry[]) => void; off: boolean };

  beforeEach(() => {
    const seen = { nodes: [] as Element[], fire: (_: Entry[]) => {}, off: false };
    watching = seen;
    Object.defineProperty(globalThis, "IntersectionObserver", {
      configurable: true,
      value: class {
        constructor(callback: (entries: Entry[]) => void) {
          seen.fire = callback;
        }
        observe(node: Element) {
          seen.nodes.push(node);
        }
        disconnect() {
          seen.off = true;
        }
      },
    });
    // The page's own overlay markup, so this tests the shipped structure.
    document.body.innerHTML = [...page().querySelectorAll(".r-frame-wrap")]
      .map((wrap) => wrap.outerHTML)
      .join("");
  });

  function armed(): Overlays {
    const make = new Function("DCLogic", "React", `${script()}\nreturn Component;`);
    const Component = make(class {}, { createRef: () => ({ current: null }) });
    const overlays = new Component({}) as Overlays;
    overlays.initTapOverlays();
    return overlays;
  }

  const taps = () => [...document.querySelectorAll(".r-tap")] as HTMLElement[];

  it("watches the frame wrapper, not the overlay", () => {
    armed();
    // Watching the overlay itself would be self-cancelling: a dismissed one is
    // display:none, reports itself off screen at once, and re-arms in a loop.
    expect(watching.nodes).toHaveLength(2);
    for (const node of watching.nodes) expect(node.classList.contains("r-frame-wrap")).toBe(true);
  });

  it("hands the sketch over on a tap", () => {
    armed();
    taps()[0].click();
    expect(taps()[0].getAttribute("data-off")).toBe("1");
    expect(taps()[1].getAttribute("data-off")).toBe(null);
  });

  it("re-arms an embed that has left the screen", () => {
    armed();
    taps()[0].click();
    watching.fire([{ target: watching.nodes[0], isIntersecting: false }]);
    expect(taps()[0].getAttribute("data-off")).toBe(null);
  });

  it("leaves an embed the reader is still looking at", () => {
    armed();
    taps()[0].click();
    watching.fire([{ target: watching.nodes[0], isIntersecting: true }]);
    expect(taps()[0].getAttribute("data-off")).toBe("1");
  });

  it("stops watching when the page goes away", () => {
    armed().componentWillUnmount();
    expect(watching.off).toBe(true);
  });
});
