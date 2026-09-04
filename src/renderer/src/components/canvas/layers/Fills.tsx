/**
 * The filled shapes, which go down first so that what sits on them stays
 * visible. A fill is a polygon's inside, a whole circle's, or the wedge cut out
 * of an arc.
 */

import { fillLook, isInterior } from "../../../sketch/model";
import { useSheet } from "../SheetContext";
import { interiorShape } from "../shapes";
import { InteriorGlyph } from "./Interior";

export function Fills() {
  const { objects, settled, selection } = useSheet();
  return (
    <>
      {objects.map((object) => {
        if (!isInterior(object)) return null;
        const shape = interiorShape(object, settled);
        if (!shape) return null;
        return (
          <InteriorGlyph
            key={object.id}
            shape={shape}
            dataId={object.id}
            className={`canvas__interior${
              selection.includes(object.id) ? " canvas__interior--selected" : ""
            }`}
            style={fillLook(object, true)}
          />
        );
      })}
    </>
  );
}
