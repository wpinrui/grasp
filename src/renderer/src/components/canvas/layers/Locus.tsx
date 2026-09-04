/**
 * A locus, drawn as the samples it was worked out to.
 *
 * It is one object however many pieces it is drawn in, so what it says about
 * how it is drawn goes on every one of them, and the samples have no identity
 * of their own to key by. A ghost is the same shape drawn as the preview of one
 * a dialog would make: it carries no colours of its own at all, and is left to
 * the preview class to style.
 */

import { clipToRect, fillLook, isLocus, type LocusShape, strokeLook } from "../../../sketch/model";
import { useSheet } from "../SheetContext";
import { arcPath } from "../shapes";

interface LocusProps {
  id: string;
  shape: LocusShape;
  /** The preview of one a dialog would make, drawn with no colours of its own. */
  ghost?: boolean;
}

export function Locus({ id, shape, ghost = false }: LocusProps) {
  const { everything, selection, shown } = useSheet();
  const kind = `canvas__locus${ghost ? " canvas__locus--preview" : ""}${
    !ghost && selection.includes(id) ? " canvas__locus--selected" : ""
  }`;
  const drawn = everything.find((candidate) => candidate.id === id);
  const look = ghost || !drawn ? undefined : strokeLook(drawn);
  const wash = ghost || !drawn ? undefined : fillLook(drawn, true);

  if (shape.kind === "points") {
    return (
      <polyline
        data-id={id}
        className={kind}
        style={look}
        points={shape.at.map((spot) => `${spot.x},${spot.y}`).join(" ")}
        vectorEffect="non-scaling-stroke"
      />
    );
  }
  if (shape.kind === "arcs") {
    return (
      <g data-id={id}>
        {shape.at.map((arc, index) => (
          <path
            // biome-ignore lint/suspicious/noArrayIndexKey: samples have no identity of their own
            key={index}
            className={kind}
            style={look}
            d={arcPath(arc)}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    );
  }
  if (shape.kind === "circles") {
    return (
      <g data-id={id}>
        {shape.at.map((round, index) => (
          <circle
            // biome-ignore lint/suspicious/noArrayIndexKey: samples have no identity of their own
            key={index}
            className={kind}
            style={look}
            cx={round.at.x}
            cy={round.at.y}
            r={round.radius}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
    );
  }
  if (shape.kind === "lines") {
    return (
      <g data-id={id}>
        {shape.at.map((line, index) => {
          const span = clipToRect(line, shown);
          return span ? (
            <line
              // biome-ignore lint/suspicious/noArrayIndexKey: samples have no identity of their own
              key={index}
              className={kind}
              style={look}
              x1={span[0].x}
              y1={span[0].y}
              x2={span[1].x}
              y2={span[1].y}
              vectorEffect="non-scaling-stroke"
            />
          ) : null;
        })}
      </g>
    );
  }
  return (
    <g data-id={id}>
      {shape.at.map((corners, index) => (
        <polygon
          // biome-ignore lint/suspicious/noArrayIndexKey: samples have no identity of their own
          key={index}
          className={`${kind} canvas__locus-fill`}
          style={wash}
          points={corners.map((corner) => `${corner.x},${corner.y}`).join(" ")}
        />
      ))}
    </g>
  );
}

/** Every locus on the sheet, drawn from where each of them settled. */
export function Loci() {
  const { objects, settled } = useSheet();
  return (
    <>
      {objects.map((object) => {
        if (!isLocus(object)) return null;
        const shape = settled.loci.get(object.id);
        return shape ? <Locus key={object.id} id={object.id} shape={shape} /> : null;
      })}
    </>
  );
}
