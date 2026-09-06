import { expect, it } from "vitest";
import { page, styles } from "./testing/landing";

it("keeps full-width padded landing wrappers inside the mobile viewport", () => {
  const css = styles();
  expect(css).toMatch(/\.r-sect, \.r-hero-grid \{ box-sizing: border-box !important; \}/);

  for (const [handle, selector] of [
    ["r-sect", "#see-it-in-action .r-sect"],
    ["r-hero-grid", ".r-hero-grid"],
  ]) {
    const wrapper = page().querySelector<HTMLElement>(selector);
    expect(wrapper?.style.width).toBe("100%");
    expect(css).toMatch(new RegExp(`\\.${handle} \\{[^}]*padding`));
  }
});
