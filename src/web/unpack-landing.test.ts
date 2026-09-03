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
import { ASSET_DIR, unpackLanding } from "../../scripts/unpack-landing";

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
let unpacked: ReturnType<typeof unpackLanding> | null = null;
function page() {
  if (!unpacked) unpacked = unpackLanding(readFileSync(BUNDLE, "utf8"));
  return unpacked;
}

/** Where an asset of that name is asked for, which is what the page says. */
function pathOf(name: string): string {
  return `./${ASSET_DIR}/${name}`;
}

/** How many times a string occurs, since a reference may be made twice. */
function occurrences(inside: string, part: string): number {
  return inside.split(part).length - 1;
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
    expect(occurrences(page().html, `./${ASSET_DIR}/`)).toBe(named);
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

  it("hands the page's own script the external files it looks up by address", () => {
    const opens = page().html.indexOf("window.__resources = ");
    expect(opens).toBeGreaterThan(-1);
    const from = opens + "window.__resources = ".length;
    const map = JSON.parse(page().html.slice(from, page().html.indexOf(";", from))) as Record<
      string,
      string
    >;
    expect(Object.keys(map).length).toBeGreaterThan(0);
    const written = page().assets.map((asset) => pathOf(asset.name));
    for (const path of Object.values(map)) expect(written).toContain(path);
  });

  /**
   * A framed page is mounted as a blob from inside the browser, which has no
   * standing meaning as a file on disk. Shipping one unpacked would leave the
   * frame blank, so the build is meant to stop instead.
   */
  it("stops rather than publish a framed page it cannot write out", () => {
    const framed = readFileSync(BUNDLE, "utf8").replace(
      '<script type="__bundler/page_order">\n[]',
      '<script type="__bundler/page_order">\n["9a2fdc3c-02c6-4219-b69a-aa00e7e43872"]',
    );
    expect(() => unpackLanding(framed)).toThrow(/framed pages/);
  });
});
