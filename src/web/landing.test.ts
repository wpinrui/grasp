/**
 * The landing page is the one file in the repo that every other gate is blind
 * to: Biome excludes it, nothing under `src` imports it, and `build:web`
 * publishes it with a plain `copyFileSync`. It is also the one file that is
 * edited as an encoded payload rather than as source, so a slip that would be
 * a syntax error anywhere else silently ships a blank site instead.
 *
 * These are the checks that make such an edit safe to land: that the payload
 * still decodes, that nothing in it can close the script carrying it, that
 * every responsive handle is joined up at both ends, and that the embed the
 * page hands a phone is the one the app's own embed mode expects.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
 * bundler emitted a line more or less.
 */
function payload(): { encoded: string; html: string } {
  const lines = readFileSync(BUNDLE, "utf8").split("\n");
  const opened = lines.findIndex((line) => line.includes(OPENS_TEMPLATE));
  if (opened < 0) throw new Error(`${BUNDLE}: no ${OPENS_TEMPLATE} in the file`);
  const encoded = lines[opened + 1];
  return { encoded, html: JSON.parse(encoded) as string };
}

/** The page, parsed, so a selector can be asked what it really matches. */
function parsed(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("landing page bundle", () => {
  it("decodes to the page", () => {
    const { html } = payload();
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
  });

  /**
   * The payload sits inside a `<script>`, so the bundler escapes every closing
   * tag in it as `</`. One literal `</` written back by a hand edit ends
   * that element early, truncates the JSON, and publishes a blank page with
   * every other gate still green.
   */
  it("carries nothing that would close the script holding it", () => {
    const { encoded } = payload();
    expect(encoded).not.toContain("</");
  });

  /**
   * A hand edit that leaves a stray closing tag behind still decodes, still
   * carries no bare `</`, and still renders something, so nothing above would
   * notice. What it does is reparent everything after it, which is how a
   * duplicated `</helmet>` puts the whole page inside the head.
   */
  it("closes every tag it opens", () => {
    const { html } = payload();
    // Script bodies hold `<` as a comparison rather than as markup, so they
    // are emptied before the scan rather than parsed.
    const markup = html.replace(/<script\b[\s\S]*?<\/script>/g, "<script></script>");
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
    expect(problems).toEqual([]);
    expect(stack).toEqual([]);
  });

  it("keeps the viewport meta the breakpoints need", () => {
    const { html } = payload();
    const viewport = parsed(html).querySelector('meta[name="viewport"]');
    expect(viewport?.getAttribute("content")).toBe("width=device-width, initial-scale=1");
  });
});

describe("landing page responsive handles", () => {
  /**
   * The responsive layer is 20-odd `r-*` classes applied by hand across the
   * markup and named again in the media queries. A typo at either end is a
   * rule that silently does nothing, so both directions are checked.
   */
  const { html } = payload();
  const doc = parsed(html);
  const inCss = new Set([...html.matchAll(/\.(r-[a-zA-Z0-9_-]+)/g)].map((hit) => hit[1] as string));
  const onElements = new Set<string>();
  for (const element of doc.querySelectorAll("[class]")) {
    for (const name of element.classList) {
      if (name.startsWith("r-")) onElements.add(name);
    }
  }

  it("has handles on both sides", () => {
    expect(inCss.size).toBeGreaterThan(0);
    expect(onElements.size).toBeGreaterThan(0);
  });

  it("every handle a rule names is on an element", () => {
    const unmatched = [...inCss].filter((name) => !doc.querySelector(`.${name}`));
    expect(unmatched).toEqual([]);
  });

  it("every handle on an element is named by a rule", () => {
    const unused = [...onElements].filter((name) => !inCss.has(name));
    expect(unused).toEqual([]);
  });

  /**
   * The phone width is written twice, once as a media query and once as the
   * string `fitEmbeds` matches on, and the two have to agree: a frame sized by
   * CSS for a bare canvas while the script still gave it the full app chrome
   * is the failure this catches.
   */
  it("states the phone breakpoint the same way in the CSS and the script", () => {
    const declared = /static PHONE = "([^"]+)"/.exec(html)?.[1];
    expect(declared).toBeTruthy();
    expect(html).toContain(`@media ${declared}`);
  });
});

describe("landing page embed sources", () => {
  /**
   * `fitEmbeds` decides what each embed loads, and gets no other test: it runs
   * only in a published page, on a phone. Lifting the page's own script out and
   * running it is the only way to pin the URLs it produces against the embed
   * modes `src/web/main.tsx` reads.
   */
  function componentClass(): { new (props: unknown): EmbedFitter } & { PHONE: string } {
    const { html } = payload();
    const script = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1];
    if (!script) throw new Error("no text/x-dc script in the payload");
    const make = new Function("DCLogic", "React", `${script}\nreturn Component;`);
    return make(class {}, { createRef: () => ({ current: null }) });
  }

  interface EmbedFitter {
    initEmbeds(): void;
    fitEmbeds(frames: HTMLIFrameElement[]): void;
  }

  /** The srcs the page ships, read off the payload rather than typed out again. */
  function shippedSrcs(): string[] {
    return [...parsed(payload().html).querySelectorAll("iframe.r-frame")].map(
      (frame) => frame.getAttribute("src") ?? "",
    );
  }

  /**
   * Two frames in a chosen state. `loaded` false is the frame `loading="lazy"`
   * has not reached, which is what a real page has at mount and what jsdom
   * cannot reproduce on its own: an attached iframe gets a live contentWindow
   * here, so the state is set explicitly rather than left to the environment.
   */
  function twoFrames(loaded: boolean): { frames: HTMLIFrameElement[]; replaced: string[] } {
    document.body.innerHTML = shippedSrcs()
      .map((src) => `<iframe class="r-frame" src="${src}"></iframe>`)
      .join("");
    const frames = [...document.querySelectorAll("iframe.r-frame")] as HTMLIFrameElement[];
    const replaced: string[] = [];
    for (const frame of frames) {
      const inside = loaded
        ? {
            location: {
              href: new URL(frame.getAttribute("src") ?? "", window.location.href).href,
              replace: (to: string) => replaced.push(to),
            },
          }
        : null;
      Object.defineProperty(frame, "contentWindow", { configurable: true, value: inside });
    }
    return { frames, replaced };
  }

  function at(width: "phone" | "desktop", Component: { PHONE: string }): void {
    const phone = width === "phone";
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({ matches: phone && query === Component.PHONE, media: query }),
    });
  }

  function srcsAt(width: "phone" | "desktop", passes = 1): string[] {
    const Component = componentClass();
    at(width, Component);
    const { frames } = twoFrames(false);
    const fitter = new Component({});
    fitter.initEmbeds();
    // Further passes prove the derivation reads the shipped src it stashed
    // rather than whatever the previous pass wrote, which is what stops
    // `&chrome=none` stacking up on every crossing of the breakpoint.
    for (let again = 1; again < passes; again++) fitter.fitEmbeds(frames);
    return frames.map((frame) => frame.getAttribute("src") ?? "");
  }

  it("gives a phone the canvas alone", () => {
    expect(srcsAt("phone")).toEqual([
      "/launch/?sketch=sketches/triangle.grasp&chrome=none&locked",
      "/launch/?sketch=sketches/rosette.grasp&locked&chrome=none",
    ]);
  });

  it("leaves a desktop the srcs the page shipped", () => {
    expect(srcsAt("desktop")).toEqual([
      "/launch/?sketch=sketches/triangle.grasp&chrome=none&locked",
      "/launch/?sketch=sketches/rosette.grasp&locked",
    ]);
  });

  it("does not stack chrome=none when it refits", () => {
    expect(srcsAt("phone", 3)).toEqual([
      "/launch/?sketch=sketches/triangle.grasp&chrome=none&locked",
      "/launch/?sketch=sketches/rosette.grasp&locked&chrome=none",
    ]);
  });

  /**
   * Assigning src to a frame that has already navigated pushes an entry onto
   * the joint session history, so every crossing of the breakpoint would cost
   * the reader a Back press that re-fits an embed instead of leaving the page.
   */
  it("navigates a loaded frame by replacing, never by the src attribute", () => {
    const Component = componentClass();
    at("desktop", Component);
    const { frames, replaced } = twoFrames(true);
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
});
