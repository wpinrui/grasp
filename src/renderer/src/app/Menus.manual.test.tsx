import { fireEvent, render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { MANUAL_URL } from "../../../shared/links";
import { Menus } from "./Menus";

vi.mock("../components/HoverPreview", () => ({
  useHoverPreview: () => ({ clear: vi.fn(), show: vi.fn() }),
}));

vi.mock("../components/MenuBar", () => ({
  MenuBar: ({ onAction }: { onAction: (action: "manual") => void }) => (
    <button type="button" onClick={() => onAction("manual")}>
      User Manual
    </button>
  ),
}));

describe("Help menu", () => {
  it("opens the user manual outside the drawing window", () => {
    const openLink = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, "api", {
      configurable: true,
      value: { about: { openLink } },
    });
    const props = {
      custom: { customs: [] },
      moves: { splitMerge: null },
    } as unknown as ComponentProps<typeof Menus>;

    const view = render(<Menus {...props} />);
    fireEvent.click(view.getByRole("button", { name: "User Manual" }));

    expect(openLink).toHaveBeenCalledWith(MANUAL_URL);
  });
});
