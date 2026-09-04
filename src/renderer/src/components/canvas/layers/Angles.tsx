/**
 * The angles the sheet offers before one is asked for: the wedge a drag out of
 * a corner is aiming at, the corner an angle tool is resting on, and the angle
 * a row of the which-angle dialog is pointing at.
 *
 * All of it is drawn as the marking it would land as, so what a click is about
 * to do is plain before it is done. None of it is on the page.
 */

import { anglesAt } from "../../../sketch/measure";
import type { Position } from "../../../sketch/model";
import { arcsBetween, type Marking } from "../marks";
import { useSheet } from "../SheetContext";

/** The corner a drag out of it is asking about, and where it has got to. */
export interface Arming {
  corner: string;
  start: Position;
  at: Position;
}

/** Which corner the which-angle dialog is open on. */
export interface Choosing {
  corner: string;
}

/** The wedge a drag is asking for, drawn as it will land. */
export function Arms({ arming, arcs }: { arming: Arming | null; arcs: string[] }) {
  if (!arming) return null;
  return (
    <g>
      <line
        className="canvas__rubber"
        x1={arming.start.x}
        y1={arming.start.y}
        x2={arming.at.x}
        y2={arming.at.y}
        vectorEffect="non-scaling-stroke"
      />
      {arcs.map((stroke) => (
        <path
          key={stroke}
          className="canvas__mark-stroke"
          d={stroke}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

interface RestingProps {
  /** The corner an angle tool is resting on, or nothing while it is not. */
  corner: string | null;
  /** Whether the Marker is the tool up, since the protractor ghosts its own. */
  marking: boolean;
  /** How far out a new mark at that corner would sit. */
  clearOf: (corner: string) => number;
  marks: Marking;
}

/**
 * Resting on a corner with an angle tool up. One angle there is drawn as
 * itself; more than one is drawn as the whole turn, which says a corner is
 * there without claiming which angle is meant.
 */
export function Resting({ corner, marking, clearOf, marks }: RestingProps) {
  const { objects, settled, scale } = useSheet();
  if (!corner) return null;
  const spot = settled.points.get(corner);
  if (!spot) return null;
  const there = anglesAt(corner, objects, settled);
  if (there.length === 1) {
    if (!marking) return null;
    return (
      <>
        {arcsBetween({ corner, arms: there[0].arms, reflex: false }, marks).map((stroke) => (
          <path
            key={stroke}
            className="canvas__mark-stroke canvas__mark-stroke--preview"
            d={stroke}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </>
    );
  }
  return (
    <circle
      className="canvas__mark-stroke canvas__mark-stroke--preview"
      cx={spot.x}
      cy={spot.y}
      r={clearOf(corner) / scale}
      fill="none"
      vectorEffect="non-scaling-stroke"
    />
  );
}

interface ShowingProps {
  corner: string | null;
  /** The two arms the row is about, or nothing while no row is pointed at. */
  arms: [string, string] | null;
  marks: Marking;
}

/**
 * The angle a row of the which-angle dialog is pointing at: its two arms lit
 * up, so which angle is meant is plain at a glance, and the arcs it would land
 * as drawn over them.
 */
export function Showing({ corner, arms, marks }: ShowingProps) {
  const { settled } = useSheet();
  if (!corner || !arms) return null;
  const spot = settled.points.get(corner);
  if (!spot) return null;
  return (
    <g>
      {arms.map((arm) => {
        const end = settled.points.get(arm);
        if (!end) return null;
        return (
          <line
            key={arm}
            className="canvas__mark-halo"
            x1={spot.x}
            y1={spot.y}
            x2={end.x}
            y2={end.y}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {arcsBetween({ corner, arms, reflex: false }, marks).map((stroke) => (
        <path
          key={stroke}
          className="canvas__mark-stroke"
          d={stroke}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}
