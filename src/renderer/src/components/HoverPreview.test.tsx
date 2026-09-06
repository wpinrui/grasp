import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { createPoint, type SketchState } from "../sketch/model";
import { HoverPreview, previewEvents, useHoverPreview } from "./HoverPreview";

afterEach(cleanup);

function Probe() {
  const { objects, source, show, clear } = useHoverPreview();
  return (
    <>
      <button
        type="button"
        {...previewEvents(
          () => show(source.map((object) => ({ ...object, colour: "red" }))),
          clear,
        )}
      >
        Preview
      </button>
      <output>{objects?.[0].colour ?? "original"}</output>
    </>
  );
}

it("restores the document on leave, Escape, blur, click, and scope changes without reviving stale previews", () => {
  const scope: SketchState = { objects: [createPoint({ x: 10, y: 20 }, "medium")], selection: [] };
  const before = structuredClone(scope);
  const ui = render(
    <HoverPreview scope={scope}>
      <Probe />
    </HoverPreview>,
  );
  const button = ui.getByRole("button");
  const output = ui.getByRole("status");
  for (const leave of [
    () => fireEvent.pointerLeave(button),
    () => fireEvent.keyDown(window, { key: "Escape" }),
    () => fireEvent.blur(window),
    () => fireEvent.pointerDown(button),
    () => fireEvent.click(button),
  ]) {
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    expect(output.textContent).toBe("red");
    expect(scope).toEqual(before);
    leave();
    expect(output.textContent).toBe("original");
  }
  fireEvent.focus(button);
  expect(output.textContent).toBe("red");
  ui.rerender(
    <HoverPreview scope={{ ...scope, selection: [scope.objects[0].id] }}>
      <Probe />
    </HoverPreview>,
  );
  expect(output.textContent).toBe("original");
  ui.rerender(
    <HoverPreview scope={scope}>
      <Probe />
    </HoverPreview>,
  );
  expect(output.textContent).toBe("original");
});

it("suspends appearance previews while a live caption editor is open", () => {
  const scope: SketchState = { objects: [createPoint({ x: 10, y: 20 }, "medium")], selection: [] };
  const ui = render(
    <HoverPreview scope={scope}>
      <Probe />
    </HoverPreview>,
  );
  fireEvent.pointerEnter(ui.getByRole("button"), { pointerType: "mouse" });
  expect(ui.getByRole("status").textContent).toBe("red");
  ui.rerender(
    <HoverPreview scope={scope} editing>
      <Probe />
    </HoverPreview>,
  );
  expect(ui.getByRole("status").textContent).toBe("original");
  fireEvent.focus(ui.getByRole("button"));
  expect(ui.getByRole("status").textContent).toBe("original");
  ui.rerender(
    <HoverPreview scope={scope}>
      <Probe />
    </HoverPreview>,
  );
  expect(ui.getByRole("status").textContent).toBe("original");
});
