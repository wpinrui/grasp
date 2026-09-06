import type { MenuAction } from "../components/menus";
import { isPoint, type PointSize, type SketchObject } from "../sketch/model";
import { objectsHidden, toggledLabels } from "../sketch/visibility";

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
    const ids = action === "show-all-hidden" ? objects.map((object) => object.id) : selection;
    return objectsHidden(objects, ids, action === "hide-objects");
  }
  if (action === "show-labels") return toggledLabels(objects, selection);
  return null;
}
