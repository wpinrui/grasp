/**
 * The lengths that are drawn out rather than left as a bare number: the run
 * between a segment's ends with an arrowhead at each, and the dotted lines back
 * to the segment where the reading carries them.
 *
 * Where the runs go is worked out elsewhere, since it depends on how big the
 * number came out once it was drawn. This lays out what that comes to.
 */

import { isMeasurement, type SketchMeasurement, type SketchObject } from "../../../sketch/model";
import { dimensionOf } from "../dimensions";
import { useSheet } from "../SheetContext";

interface DimensionsProps {
  /** Everything written on the sheet; only the measurements are drawn out. */
  readings: SketchObject[];
  /**
   * How big a reading came out once it was drawn, which the sheet measures off
   * the box it was drawn into rather than working out again here.
   */
  boxOf: (reading: SketchMeasurement) => { width: number; height: number };
}

export function Dimensions({ readings, boxOf }: DimensionsProps) {
  const { settled, scale } = useSheet();
  return (
    <>
      {readings.filter(isMeasurement).map((reading) => {
        const drawn = dimensionOf(reading, boxOf(reading), { settled, scale });
        if (!drawn) return null;
        return (
          <g key={`dimension-${reading.id}`} data-id={reading.id}>
            {drawn.dotted.map((run) => (
              <path
                key={run}
                className="canvas__dimension canvas__dimension--dotted"
                d={run}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {drawn.lines.map((run) => (
              <path
                key={run}
                className="canvas__dimension"
                d={run}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {drawn.heads.map((run) => (
              <path key={run} className="canvas__dimension-head" d={run} />
            ))}
          </g>
        );
      })}
    </>
  );
}
