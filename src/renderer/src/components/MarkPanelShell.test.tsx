/**
 * What a press in a mark or reading panel says when it is pointed at. Every
 * button in both panels leans on the default below for its tooltip, so a break
 * in it would take every one of them away without a single assertion moving:
 * the panels' own tests find their buttons by `aria-label`, which is set either
 * way.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PanelButton } from "./MarkPanelShell";

afterEach(cleanup);

describe("what a press in a panel says", () => {
  it("says its label, which is what almost every one of them wants", () => {
    const { container } = render(
      <PanelButton label="Delete the mark" onClick={vi.fn()}>
        <span>x</span>
      </PanelButton>,
    );
    fireEvent.mouseOver(container.querySelector(".tooltip__of") as Element);
    expect(screen.getByText("Delete the mark").closest(".tooltip")).toBeTruthy();
  });

  it("says something else where it was given something else", () => {
    const { container } = render(
      <PanelButton
        label="One more decimal place"
        tip="One more decimal place (2 now)"
        onClick={vi.fn()}
      >
        <span>+</span>
      </PanelButton>,
    );
    fireEvent.mouseOver(container.querySelector(".tooltip__of") as Element);
    expect(screen.getByText("One more decimal place (2 now)")).toBeTruthy();
  });

  it("says nothing where it was told to say nothing", () => {
    // The count buttons: what they are is drawn on them.
    const { container } = render(
      <PanelButton label="3" tip={null} onClick={vi.fn()}>
        <span>3</span>
      </PanelButton>,
    );
    expect(container.querySelector(".tooltip__of")).toBeNull();
    fireEvent.mouseOver(screen.getByRole("button"));
    expect(document.querySelector(".tooltip")).toBeNull();
  });
});
