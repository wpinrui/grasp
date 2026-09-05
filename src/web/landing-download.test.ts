import { describe, expect, it } from "vitest";
import { script } from "./testing/landing";

describe("landing desktop download links", () => {
  it.each([
    ["Macintosh", 0, "Download for macOS"],
    ["Linux x86_64", 0, "Download for Linux"],
    ["iPhone", 5, "Desktop releases"],
    ["Macintosh", 5, "Desktop releases"],
    ["Linux Android", 5, "Desktop releases"],
    ["CrOS", 0, "Desktop releases"],
  ])("labels downloads for %s with %s touch points", (userAgent, maxTouchPoints, label) => {
    const make = new Function("DCLogic", "React", "navigator", `${script()}\nreturn Component;`);
    const Component = make(
      class {},
      { createRef: () => ({ current: null }) },
      {
        userAgent,
        platform: "",
        maxTouchPoints,
      },
    );
    const component = new Component({});
    // Exercise the shipped platform selection without mounting scroll/embed observers.
    component.initReveals =
      component.initNav =
      component.initEmbeds =
      component.initTapOverlays =
        () => {};
    const primary = document.createElement("a");
    const alternate = document.createElement("a");
    component.ctaRef.current = primary;
    component.altRef.current = alternate;
    component.componentDidMount();
    expect(primary.getAttribute("href")).toBe("/launch");
    expect(alternate.textContent).toBe(label);
    expect(alternate.getAttribute("href")).toBe("https://github.com/wpinrui/grasp/releases");
  });
});
