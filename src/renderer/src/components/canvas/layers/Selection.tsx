import { cloneElement, type ReactElement, type SVGProps } from "react";
import { cornersOf, isArc, isCircle, isInterior, isLine, strokeLook } from "../../../sketch/model";
import { useSheet } from "../SheetContext";
import { interiorShape } from "../shapes";
import { InteriorGlyph } from "./Interior";
import { PathGlyph } from "./Paths";
import "./Selection.css";

/** Opaque contrasting rails stay legible over any ink or stack of fills. */
function Outline({ glyph, width }: { glyph: ReactElement<SVGProps<SVGElement>>; width: number }) {
  return (
    <>
      {cloneElement(glyph, {
        className: "canvas__selection-paper",
        style: { strokeWidth: width + 5 },
      })}
      {cloneElement(glyph, {
        className: "canvas__selection-ink",
        style: { strokeWidth: width + 2 },
      })}
    </>
  );
}

/** Selection is painted after all geometry so later objects cannot bury it. */
export function Selection() {
  const { objects, selection, settled, scale } = useSheet();
  const picked = objects.filter((object) => selection.includes(object.id));
  return (
    <g className="canvas__selection" pointerEvents="none">
      {picked.map((object) => {
        if (!isInterior(object)) return null;
        const shape = interiorShape(object, settled);
        if (!shape) return null;
        return (
          <g key={object.id} data-selection-id={object.id}>
            <Outline width={0} glyph={<InteriorGlyph shape={shape} className="" fixedStroke />} />
          </g>
        );
      })}
      {picked.map((object) => {
        if (!isLine(object) && !isArc(object) && !isCircle(object)) return null;
        const look = strokeLook(object);
        const width = Number(look.strokeWidth ?? 1.5);
        const glyph = <PathGlyph object={object} />;
        return (
          <g key={object.id} data-selection-id={object.id}>
            <Outline width={width + 6} glyph={glyph} />
            <PathGlyph
              object={object}
              className="canvas__selection-paper"
              style={{ strokeWidth: width + 4 }}
            />
            {glyph}
          </g>
        );
      })}
      {picked.map((object) => {
        if (!isInterior(object)) return null;
        const corners = settled.shapes.get(object.id);
        return corners?.map((corner, index) => (
          <rect
            key={`${object.id}-${cornersOf(object)?.[index]}`}
            className="canvas__selection-corner"
            x={corner.x - 3 / scale}
            y={corner.y - 3 / scale}
            width={6 / scale}
            height={6 / scale}
            vectorEffect="non-scaling-stroke"
          />
        ));
      })}
    </g>
  );
}
