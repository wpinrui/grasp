import { useId } from "react";
import { isArc, isCircle, isInterior, isLine, strokeLook } from "../../../sketch/model";
import { useSheet } from "../SheetContext";
import { interiorShape } from "../shapes";
import { InteriorGlyph } from "./Interior";
import { PathGlyph } from "./Paths";
import "./Selection.css";

/** Selection is painted after all geometry so later fills cannot bury it. */
export function Selection() {
  const { objects, selection, settled, scale } = useSheet();
  const patternId = useId();
  const fills = objects.filter(isInterior);
  return (
    <g className="canvas__selection" pointerEvents="none">
      {fills.some((object) => selection.includes(object.id)) && (
        <g className="canvas__selection-fills" opacity={0.15}>
          {fills.map((object, index) => {
            if (!selection.includes(object.id)) return null;
            const shape = interiorShape(object, settled);
            if (!shape) return null;
            const id = `${patternId}-${index}`;
            return (
              <g key={object.id} data-selection-id={object.id}>
                <defs>
                  <pattern
                    id={id}
                    width={12}
                    height={12}
                    patternUnits="userSpaceOnUse"
                    patternTransform={`rotate(45) scale(${1 / scale})`}
                  >
                    <path className="canvas__selection-stripe" d="M 6 0 V 12" />
                  </pattern>
                </defs>
                <InteriorGlyph
                  shape={shape}
                  className="canvas__selection-fill"
                  style={{ fill: `url(#${id})` }}
                />
              </g>
            );
          })}
        </g>
      )}
      {objects.map((object) => {
        if (
          !selection.includes(object.id) ||
          (!isLine(object) && !isArc(object) && !isCircle(object))
        )
          return null;
        const width = Number(strokeLook(object).strokeWidth ?? 1.5);
        return (
          <g key={object.id} data-selection-id={object.id}>
            <PathGlyph
              object={object}
              className="canvas__selection-paper"
              style={{ strokeWidth: width + 8 }}
            />
            <PathGlyph
              object={object}
              className="canvas__selection-dashes"
              style={{ strokeWidth: width + 6 }}
            />
            <PathGlyph
              object={object}
              className="canvas__selection-paper"
              style={{ strokeWidth: width + 4 }}
            />
            <PathGlyph
              object={object}
              className="canvas__selection-highlight"
              style={{ strokeWidth: 7 }}
            />
            <PathGlyph object={object} />
          </g>
        );
      })}
    </g>
  );
}
