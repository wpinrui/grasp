import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type DrawnLabel, Labels } from "./Labels";

/**
 * A relabel run says what a click will write before it writes it, and that
 * promise is drawn rather than typed: a translucent letter where the label will
 * hang. It compiles either way, so it is pinned here.
 */
const label: DrawnLabel = {
  id: "a",
  name: "A",
  at: { x: 100, y: 100 },
  off: { x: 0, y: -16 },
  look: {},
};

function drawn(ghost: DrawnLabel | null) {
  return render(
    <Labels
      labels={[label]}
      view={{ x: 0, y: 0, scale: 1 }}
      scale={1}
      picked={[]}
      reachable={false}
      ghost={ghost}
      naming={null}
      onNaming={() => {}}
      onRename={() => {}}
      onGrab={() => {}}
      onDrag={() => {}}
      onDrop={() => {}}
    />,
  );
}

describe("the letter a relabel run is about to write", () => {
  it("is drawn faintly where the label will hang", () => {
    const { container } = drawn({ ...label, id: "b", name: "C" });
    const faint = container.querySelector(".canvas__label--ghost");
    expect(faint?.textContent).toBe("C");
  });

  it("is not drawn while no run is going", () => {
    const { container } = drawn(null);
    expect(container.querySelector(".canvas__label--ghost")).toBeNull();
    expect(container.querySelector(".canvas__label")?.textContent).toBe("A");
  });
});
