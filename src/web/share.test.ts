/**
 * Handing a sketch to the device it is being read on.
 *
 * The share sheet is the one route off a phone, and the whole point of the
 * answer this returns is that a share which did not happen falls back to a
 * save. A share that says it went when it did not leaves the reader with
 * neither, which is why the failure cases are as carefully pinned as the
 * working one.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SKETCH = '{"format":"grasp-sketch","version":10}';

/** The api under test, taken fresh so the module's own state cannot carry. */
async function share(text: string, name: string): Promise<boolean> {
  vi.resetModules();
  const { installWebApi } = await import("./api");
  installWebApi();
  return window.api.file.share(text, name);
}

beforeEach(() => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  });
});

afterEach(() => vi.unstubAllGlobals());

/** A browser that will take files, and remembers what it was handed. */
function sheetTakesFiles(answer: () => Promise<void> = () => Promise.resolve()) {
  const handed: ShareData[] = [];
  vi.stubGlobal("navigator", {
    canShare: () => true,
    share: (data: ShareData) => {
      handed.push(data);
      return answer();
    },
  });
  return handed;
}

describe("handing over the sketch", () => {
  it("hands over a .grasp file carrying the sketch", async () => {
    const handed = sheetTakesFiles();
    expect(await share(SKETCH, "Triangle")).toBe(true);

    const [file] = handed[0].files ?? [];
    expect(file.name).toBe("Triangle.grasp");
    expect(await file.text()).toBe(SKETCH);
  });

  it("declines where the browser has no share sheet at all", async () => {
    vi.stubGlobal("navigator", {});
    expect(await share(SKETCH, "Triangle")).toBe(false);
  });

  it("declines where the browser will not take the file", async () => {
    // Some devices refuse an extension they do not know, and say so before
    // anything is put in front of the reader.
    const share_ = vi.fn();
    vi.stubGlobal("navigator", { canShare: () => false, share: share_ });
    expect(await share(SKETCH, "Triangle")).toBe(false);
    expect(share_).not.toHaveBeenCalled();
  });

  it("counts a sheet the reader backed out of as served", async () => {
    // They saw it and said no. Saving a copy behind their back is not the
    // answer to that.
    sheetTakesFiles(() => Promise.reject(new DOMException("cancelled", "AbortError")));
    expect(await share(SKETCH, "Triangle")).toBe(true);
  });

  it("counts a sheet that failed as not served, so a save can stand in", async () => {
    sheetTakesFiles(() => Promise.reject(new DOMException("blocked", "NotAllowedError")));
    expect(await share(SKETCH, "Triangle")).toBe(false);
  });

  it("counts a sheet that threw something else as not served either", async () => {
    sheetTakesFiles(() => Promise.reject(new TypeError("no")));
    expect(await share(SKETCH, "Triangle")).toBe(false);
  });
});
