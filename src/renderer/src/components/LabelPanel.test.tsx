import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LabelPanel, type LabelRow } from "./LabelPanel";

afterEach(cleanup);

function row(part: Partial<LabelRow> & { id: string; kind: string }): LabelRow {
  return { name: "", shown: false, selected: false, ...part };
}

/** A point named, a segment named, and a segment that has never been labelled. */
const ROWS: LabelRow[] = [
  row({ id: "p1", kind: "point", name: "C", shown: true }),
  row({ id: "s1", kind: "segment", name: "j", shown: true }),
  row({ id: "s2", kind: "segment" }),
];

function panel(shown: (ids: string[], on: boolean) => void = () => {}) {
  return render(
    <LabelPanel
      rows={ROWS}
      onRename={() => {}}
      onShow={shown}
      onSpot={() => {}}
      labelNew={false}
      onLabelNew={() => {}}
    />,
  );
}

/** The heading that folds a group away, which carries its count as well. */
function heading(title: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${title}`) });
}

describe("the labels panel", () => {
  it("starts with the segments folded, and the points open", () => {
    panel();
    expect(screen.getByText("C")).toBeTruthy();
    expect(screen.queryByText("j")).toBeNull();
  });

  it("folds a group away and back on its heading", () => {
    panel();
    fireEvent.click(heading("Segments"));
    expect(screen.getByText("j")).toBeTruthy();
    fireEvent.click(heading("Segments"));
    expect(screen.queryByText("j")).toBeNull();
  });

  it("lists what has a name and leaves out what has none", () => {
    const { container } = panel();
    fireEvent.click(heading("Segments"));
    // Two segments, one of them never labelled, so one row.
    expect(container.querySelectorAll(".labels__row")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "j" })).toHaveLength(1);
  });

  it("counts every one of a kind in the heading, named or not", () => {
    panel();
    expect(heading("Segments").textContent).toContain("1 of 2");
  });

  it("shows the labels of a whole kind, the nameless included", () => {
    const asked: { ids: string[]; on: boolean }[] = [];
    panel((ids, on) => asked.push({ ids, on }));
    // The heading's own button, not one of the bulk rows above the list. It is
    // how something never labelled comes to have a name at all.
    const bulk = within(heading("Segments").parentElement as HTMLElement);
    fireEvent.click(bulk.getByRole("button", { name: "Show" }));
    expect(asked).toEqual([{ ids: ["s1", "s2"], on: true }]);
  });
});
