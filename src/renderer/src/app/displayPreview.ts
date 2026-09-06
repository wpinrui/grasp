import type { MenuAction } from "../components/menus";
import { isPoint, nameable, type PointSize, type SketchObject } from "../sketch/model";

/** Display commands change the existing figure, so show their actual appearance. */
export function displayPreview(
  objects: SketchObject[],
  selection: string[],
  action: MenuAction | null,
): SketchObject[] | null {
  if (action?.startsWith("point-size:")) {
    const size = action.slice("point-size:".length) as PointSize;
    return objects.map((object) =>
      selection.includes(object.id) && isPoint(object) ? { ...object, size } : object,
    );
  }
  if (action === "hide-objects" || action === "show-all-hidden") {
    return objects.map((object) =>
      action === "show-all-hidden" || selection.includes(object.id)
        ? { ...object, hidden: action === "hide-objects" }
        : object,
    );
  }
  if (action === "show-labels") {
    const able = objects.filter(
      (object) => (!selection.length || selection.includes(object.id)) && nameable(object, objects),
    );
    const shown = !able.every((object) => object.label?.shown);
    const ids = new Set(able.map((object) => object.id));
    return objects.map((object) =>
      ids.has(object.id) ? { ...object, label: { ...object.label, shown } } : object,
    );
  }
  return null;
}
