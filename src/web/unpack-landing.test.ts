/**
 * The landing page, checked as the thing that actually gets published.
 *
 * The page is authored packed and unpacked at build time, so what a browser
 * receives is a file no one ever looks at: an asset that failed to decode, a
 * reference left pointing at nothing, or a name that never got written would
 * all pass every other gate and ship a page of broken images.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ASSET_DIR, islandText, unpackLanding } from "../../scripts/unpack-landing";

const BUNDLE = "grasp-landing.html";

/** What each kind of file starts with, which is how a bad decode shows up. */
const SIGNATURE: Record<string, number[]> = {
  ".png": [0x89, 0x50, 0x4e, 0x47],
  ".jpg": [0xff, 0xd8, 0xff],
  ".woff2": [0x77, 0x4f, 0x46, 0x32],
};

/** What a file still packed starts with, whatever it is meant to be. */
const GZIP = [0x1f, 0x8b];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** Read once: the file cannot change under a run, and it is 7.5MB. */
let source: string | null = null;
function bundle(): string {
  if (source === null) source = readFileSync(BUNDLE, "utf8");
  return source;
}

let unpacked: ReturnType<typeof unpackLanding> | null = null;
function page() {
  if (!unpacked) unpacked = unpackLanding(bundle());
  return unpacked;
}

/** Where an asset of that name is asked for, which is what the page says. */
function pathOf(name: string): string {
  return `/${ASSET_DIR}/${name}`;
}

/** How many times a string occurs, since a reference may be made twice. */
function occurrences(inside: string, part: string): number {
  return inside.split(part).length - 1;
}

/** The map the page's own script reads, as the published page sets it. */
function resources(): Record<string, string> {
  const opens = page().html.indexOf("window.__resources = ");
  expect(opens).toBeGreaterThan(-1);
  const from = opens + "window.__resources = ".length;
  return JSON.parse(page().html.slice(from, page().html.indexOf(";", from)));
}

/** The same bundle with one island taken out, tag and all. */
function without(source: string, name: string): string {
  const tag = `<script type="__bundler/${name}">`;
  const opens = source.indexOf(tag);
  const closes = source.indexOf("</script>", opens) + "</script>".length;
  return source.slice(0, opens) + source.slice(closes);
}

/** The same bundle with one island rewritten, to check what that shape does. */
function bundleWith(name: string, json: string): string {
  const was = islandText(bundle(), name);
  return bundle().replace(
    `<script type="__bundler/${name}">\n${was}`,
    `<script type="__bundler/${name}">\n${json}`,
  );
}

describe("the landing page as it is published", () => {
  it("comes out as a document rather than as a payload", () => {
    expect(page().html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(page().html).not.toContain("__bundler/");
  });

  it("asks for every asset it writes", () => {
    const unasked = page()
      .assets.filter((asset) => !page().html.includes(pathOf(asset.name)))
      .map((asset) => asset.name);
    expect(unasked).toEqual([]);
  });

  /**
   * The other direction, counted rather than listed: every mention of the
   * asset folder has to be one of the assets written, so a reference the
   * unpacking built wrongly cannot hide among the ones it built correctly.
   */
  it("writes every asset it asks for", () => {
    const named = page().assets.reduce(
      (running, asset) => running + occurrences(page().html, pathOf(asset.name)),
      0,
    );
    expect(occurrences(page().html, `/${ASSET_DIR}/`)).toBe(named);
  });

  /**
   * The host serves this page at every address it has nothing else for, so a
   * document-relative name would be resolved against whichever of those the
   * visitor arrived at: `/a/b` would send them looking under `/a/`.
   */
  it("asks for its assets from the site root, not from wherever it is served", () => {
    const all = occurrences(page().html, `${ASSET_DIR}/`);
    expect(all).toBeGreaterThan(0);
    expect(occurrences(page().html, `/${ASSET_DIR}/`)).toBe(all);
    expect(occurrences(page().html, `./${ASSET_DIR}/`)).toBe(0);
  });

  /**
   * A packed name left behind is an element pointing at something no server
   * answers to, which is the one failure this step could introduce. Asset
   * paths carry a uuid of their own, so they come out before the count.
   */
  it("leaves no packed name behind", () => {
    let left = page().html;
    for (const asset of page().assets) left = left.split(pathOf(asset.name)).join("");
    expect(left.match(UUID)).toBe(null);
  });

  it("decodes each asset to the file it claims to be", () => {
    const wrong = page()
      .assets.filter((asset) => {
        const want = SIGNATURE[asset.name.slice(asset.name.lastIndexOf("."))];
        return want ? want.some((byte, at) => asset.bytes[at] !== byte) : false;
      })
      .map((asset) => asset.name);
    expect(wrong).toEqual([]);
  });

  /**
   * The scripts are the only assets packed compressed, and they carry no
   * signature of their own to check. One written out still gzipped is a file
   * every browser refuses, so what is checked is that none of them still is.
   */
  it("unpacks what was packed compressed", () => {
    const still = page()
      .assets.filter((asset) => asset.bytes[0] === GZIP[0] && asset.bytes[1] === GZIP[1])
      .map((asset) => asset.name);
    expect(still).toEqual([]);
  });
});

describe("the files the landing page looks up by address", () => {
  /**
   * The map is keyed by the address the file came from, which is the only
   * thing the page's own script has to go on: keyed by anything else it finds
   * nothing and goes back out to the network for a copy.
   */
  it("keys the map by the addresses the page names", () => {
    const named = (JSON.parse(islandText(bundle(), "ext_resources")) as { id: string }[]).map(
      (external) => external.id,
    );
    expect(named.length).toBeGreaterThan(0);
    expect(Object.keys(resources())).toEqual(named);
  });

  it("points every address at a file it wrote", () => {
    const written = page().assets.map((asset) => pathOf(asset.name));
    for (const path of Object.values(resources())) expect(written).toContain(path);
  });

  /**
   * The page's own script reads the map as it runs, and it runs from the head,
   * so the map has to be set above it rather than merely present.
   */
  it("sets the map before the script that reads it", () => {
    expect(page().html.indexOf("window.__resources")).toBeLessThan(
      page().html.indexOf(`<script src="/${ASSET_DIR}/`),
    );
  });

  /**
   * An address is arbitrary text, and one closing tag in it would end the
   * script the map is written into, truncating the page from there down. The
   * island holding the address has the same hazard and escapes it the same
   * way, which is how the address gets in here to be tested at all.
   */
  it("carries an address that would otherwise close the script holding it", () => {
    const uuid = /"uuid": ?"([0-9a-f-]+)"/.exec(islandText(bundle(), "ext_resources"))?.[1];
    const nasty = JSON.stringify([{ id: "https://x/</script><b>", uuid }])
      .split("</")
      .join("<\\/");
    const html = unpackLanding(bundleWith("ext_resources", nasty)).html;
    const opens = html.indexOf("window.__resources = ");
    const line = html.slice(opens, html.indexOf("\n", opens));
    expect(line).toContain("<\\/script>");
    expect(line).not.toContain("/x/</script>");
  });
});

describe("the shapes the landing page cannot be published in", () => {
  /**
   * A framed page is mounted as a blob from inside the browser, which has no
   * standing meaning as a file on disk. Shipping one unpacked would leave the
   * frame blank, so the build is meant to stop instead.
   */
  it("stops rather than publish a framed page it cannot write out", () => {
    const framed = bundleWith("page_order", '["9a2fdc3c-02c6-4219-b69a-aa00e7e43872"]');
    expect(() => unpackLanding(framed)).toThrow(/framed pages/);
  });

  it("stops rather than name a file whose kind it has no suffix for", () => {
    const packed = JSON.parse(islandText(bundle(), "manifest")) as Record<string, { mime: string }>;
    const first = Object.keys(packed)[0] as string;
    (packed[first] as { mime: string }).mime = "image/webp";
    expect(() => unpackLanding(bundleWith("manifest", JSON.stringify(packed)))).toThrow(/webp/);
  });

  it("stops rather than publish an address it carries no file for", () => {
    const nasty = JSON.stringify([
      { id: "https://example.test/x.js", uuid: "not-in-the-manifest" },
    ]);
    expect(() => unpackLanding(bundleWith("ext_resources", nasty))).toThrow(/example\.test/);
  });

  it("stops rather than publish a page with nowhere to hang its resources", () => {
    const headless = bundleWith("template", JSON.stringify("<html><body>hi</body></html>"));
    expect(() => unpackLanding(headless)).toThrow(/head/);
  });

  it("stops rather than read an island it cannot do without", () => {
    expect(() => unpackLanding("<html></html>")).toThrow(/manifest/);
  });

  /**
   * The two islands the format lets a page leave out, which the page's own
   * runtime reads as empty. Stopping on those would refuse a page that serves
   * perfectly well.
   */
  it("publishes a page that leaves out what it is allowed to leave out", () => {
    const spare = without(without(bundle(), "page_order"), "ext_resources");
    expect(spare).not.toContain('<script type="__bundler/page_order">');
    expect(spare).not.toContain('<script type="__bundler/ext_resources">');
    expect(unpackLanding(spare).assets.length).toBe(page().assets.length);
  });
});
