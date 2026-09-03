/**
 * Sharing a sketch, and the save that stands in where there is nothing to share
 * with. Every desktop is such a place, and so is a browser whose share sheet
 * will not take the file, so the fallback is the common path rather than the
 * unusual one.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS } from "./prefs";
import { useDocument } from "./useDocument";
import { useSketch } from "./useSketch";

const share = vi.fn();
const saveAs = vi.fn();

beforeEach(() => {
  share.mockReset();
  saveAs.mockReset();
  vi.stubGlobal("api", {
    platform: "web",
    file: {
      share,
      saveAs,
      // The rest of the surface the hook reaches for on its way up. Everything
      // asynchronous answers, so nothing is left waiting on an undefined.
      write: vi.fn().mockResolvedValue(undefined),
      releaseUntitled: vi.fn().mockResolvedValue(undefined),
      recent: () => [],
      startingDocument: vi
        .fn()
        .mockResolvedValue({ name: "Rosette", path: "/sketches/Rosette.grasp", text: null }),
      confirmUnsaved: vi.fn().mockResolvedValue("discard"),
      reportError: vi.fn().mockResolvedValue(undefined),
    },
    window: {
      // The hook asks to be told when the window is closing, and closes it
      // itself once the answer to that is settled.
      onQuit: vi.fn().mockReturnValue(() => undefined),
      close: vi.fn().mockResolvedValue(undefined),
    },
    settings: { read: () => ({}), write: vi.fn() },
  });
});

afterEach(() => vi.unstubAllGlobals());

/**
 * The document surface, over a real sketch, as the app assembles it. The
 * document it opens on is fetched, so the hook is let settle before anything
 * asks it what is open.
 */
async function open() {
  const rendered = renderHook(() => {
    const sketch = useSketch();
    return useDocument(sketch, { read: () => DEFAULT_PREFS, onOpen: () => undefined });
  });
  await act(async () => undefined);
  return rendered;
}

describe("sharing", () => {
  it("hands the sketch over and stops there when the device takes it", async () => {
    share.mockResolvedValue(true);
    const { result } = await open();

    await act(async () => {
      expect(await result.current.share()).toBe(true);
    });
    expect(share).toHaveBeenCalledTimes(1);
    expect(saveAs).not.toHaveBeenCalled();
  });

  it("shares the sketch under the name the document is open as", async () => {
    share.mockResolvedValue(true);
    const { result } = await open();

    await act(async () => {
      await result.current.share();
    });
    const [text, name] = share.mock.calls[0];
    expect(name).toBe("Rosette");
    expect(JSON.parse(text).format).toBe("grasp-sketch");
  });

  it("saves instead where there is nothing to share with", async () => {
    // Which is every desktop, and any browser that will not take a .grasp.
    share.mockResolvedValue(false);
    saveAs.mockResolvedValue({ path: "/tmp/Untitled 1.grasp", name: "Untitled 1" });
    const { result } = await open();

    await act(async () => {
      expect(await result.current.share()).toBe(true);
    });
    expect(saveAs).toHaveBeenCalledTimes(1);
  });

  it("says so when the save it fell back to was called off too", async () => {
    share.mockResolvedValue(false);
    saveAs.mockResolvedValue(null);
    const { result } = await open();

    await act(async () => {
      expect(await result.current.share()).toBe(false);
    });
  });
});
