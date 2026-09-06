import { useId } from "react";
import {
  isArc,
  isCircle,
  isInterior,
  isLine,
  type SketchInterior,
  type SketchObject,
  strokeLook,
} from "../../../sketch/model";
import { useSheet } from "../SheetContext";
import { interiorShape } from "../shapes";
import { InteriorGlyph } from "./Interior";
import { PathGlyph } from "./Paths";
import "./Selection.css";

/** The stripe tile, in screen pixels, so the spacing holds at any zoom. */
const STRIPE_TILE = 12;

/** How wide each stripe is drawn within its tile. */
const STRIPE_WIDTH = 5;

/** How far the stripes shade the fills they cover, all of them together. */
const STRIPE_SHADE = 0.15;

/**
 * The bands laid along a selected path, widest first, each so many screen
 * pixels wider than the object's own stroke. Paper, blue, then paper again
 * leaves the blue reading as a dashed ring standing clear of the object,
 * whatever the object happens to be drawn over.
 */
const BANDS = [
  { className: "canvas__selection-paper", beyond: 8 },
  { className: "canvas__selection-dashes", beyond: 6 },
  { className: "canvas__selection-paper", beyond: 4 },
];

/** The blue band along the object itself, at one width whatever the object's. */
const HIGHLIGHT = 7;

function hasPath(object: SketchObject): boolean {
  return isLine(object) || isArc(object) || isCircle(object);
}

/**
 * One shading layer over every selected fill, so overlapping selections come
 * out the same shade as a single one rather than accumulating darkness.
 */
function SelectionFills({ fills }: { fills: SketchInterior[] }) {
  const { settled, scale } = useSheet();
  const patternId = useId();
  if (fills.length === 0) return null;
  return (
    <g className="canvas__selection-fills" opacity={STRIPE_SHADE}>
      <defs>
        <pattern
          id={patternId}
          width={STRIPE_TILE}
          height={STRIPE_TILE}
          patternUnits="userSpaceOnUse"
          patternTransform={`rotate(45) scale(${1 / scale})`}
        >
          <path
            className="canvas__selection-stripe"
            style={{ strokeWidth: STRIPE_WIDTH }}
            d={`M ${STRIPE_TILE / 2} 0 V ${STRIPE_TILE}`}
          />
        </pattern>
      </defs>
      {fills.map((object) => {
        const shape = interiorShape(object, settled);
        return shape ? (
          <g key={object.id} data-selection-id={object.id}>
            <InteriorGlyph
              shape={shape}
              className="canvas__selection-fill"
              style={{ fill: `url(#${patternId})` }}
            />
          </g>
        ) : null;
      })}
    </g>
  );
}

/**
 * The bands along every selected path, one pass per band rather than one group
 * per object, so where two selected paths cross neither notches the other.
 */
function SelectionPaths({ paths }: { paths: SketchObject[] }) {
  if (paths.length === 0) return null;
  return (
    <>
      {BANDS.map((band) => (
        <g key={`${band.className}-${band.beyond}`}>
          {paths.map((object) => (
            <PathGlyph
              key={object.id}
              object={object}
              className={band.className}
              look={{ strokeWidth: Number(strokeLook(object).strokeWidth ?? 1.5) + band.beyond }}
            />
          ))}
        </g>
      ))}
      <g>
        {paths.map((object) => (
          <PathGlyph
            key={object.id}
            object={object}
            className="canvas__selection-highlight"
            look={{ strokeWidth: HIGHLIGHT }}
          />
        ))}
      </g>
    </>
  );
}

/**
 * What the window says is selected, painted over every fill but under the
 * objects themselves, so it never punches a hole in the marks, the loci or any
 * geometry that happens to run across it.
 */
export function Selection() {
  const { objects, selection } = useSheet();
  const picked = objects.filter((object) => selection.includes(object.id));
  return (
    <g className="canvas__selection" pointerEvents="none">
      <SelectionFills fills={picked.filter(isInterior)} />
      <SelectionPaths paths={picked.filter(hasPath)} />
    </g>
  );
}
