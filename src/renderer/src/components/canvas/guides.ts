/**
 * What a half-drawn object says about itself while it is being placed.
 *
 * All of it is drawn on the sheet rather than beside the pointer: how long the
 * object is so far, written along it; every angle it makes, written at an arc
 * drawn in that angle; and for a polygon the area it would close at, written
 * where the shape is. It is gone the moment the object lands, since a
 * measurement is the way to keep a number.
 *
 * None of this reads the window. What is being drawn is handed in, so the same
 * numbers come out of the same figure wherever it is asked from.
 */

import { armsAt, sayAngle, sayArea, sayLength, shoelace } from "../../sketch/measure";
import {
  degreesOf,
  distance,
  HALF_TURN,
  markSweep,
  type Position,
  QUARTER_TURN,
} from "../../sketch/model";
import type { Snapping } from "../SnapPanel";
import {
  type Figure,
  GUIDE_LIFT,
  GUIDE_OFF,
  GUIDE_RADIUS,
  type Guide,
  type GuideAngle,
  type GuideText,
  middleOf,
  nearestArm,
  type Pending,
  type Tracing,
  type Travel,
} from "./sheet";

/** The figure as it stands, and what is half drawn over it. */
export interface Placing extends Figure {
  snapping: Snapping;
  travel: Travel | null;
  pending: Pending | null;
  tracing: Tracing | null;
}

/** The way one spot lies from another. */
function angleBetween(from: Position, to: Position): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** How long the line is so far, written along it and never upside down. */
function alongText(from: Position, to: Position): GuideText {
  const turn = degreesOf(angleBetween(from, to));
  return {
    at: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
    turn: turn > QUARTER_TURN || turn <= -QUARTER_TURN ? turn + HALF_TURN : turn,
    dy: -GUIDE_LIFT,
    text: sayLength(distance(from, to)),
  };
}

/** One angle: the arc drawn in it, and its size written just outside that. */
function cornerArc(
  wedge: { corner: Position; from: number; to: number },
  scale: number,
): GuideAngle | null {
  const { corner, from, to } = wedge;
  const sweep = markSweep(from, to, false);
  if (!Number.isFinite(sweep) || Math.abs(sweep) < 1e-6) return null;
  const radius = GUIDE_RADIUS / scale;
  const middle = from + sweep / 2;
  const out = radius + GUIDE_OFF / scale;
  const spot = (angle: number, reach: number) => ({
    x: corner.x + Math.cos(angle) * reach,
    y: corner.y + Math.sin(angle) * reach,
  });
  const start = spot(from, radius);
  const end = spot(from + sweep, radius);
  return {
    arc: `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 ${sweep < 0 ? 0 : 1} ${end.x} ${end.y}`,
    text: {
      at: spot(middle, out),
      turn: 0,
      dy: 5,
      text: sayAngle(degreesOf(Math.abs(sweep))),
    },
  };
}

/** The angle a line being drawn makes with the nearest arm at its corner. */
function wedgeOfArms(
  aimed: { corner: Position; to: Position; arms: number[] },
  scale: number,
): GuideAngle | null {
  const { corner, to, arms } = aimed;
  if (arms.length === 0 || (corner.x === to.x && corner.y === to.y)) return null;
  const bearing = angleBetween(corner, to);
  const nearest = nearestArm(arms, bearing) ?? arms[0];
  return cornerArc({ corner, from: nearest, to: bearing }, scale);
}

/**
 * A move says how far it has gone and which way, read off the horizontal the
 * way a straight object drawn from a bare point is, so what the steps are
 * holding it to is there to be read rather than merely felt. With nothing
 * holding the move there is no step for the run, the length and the angle to
 * read out, so a free drag says nothing and simply moves.
 */
function guideOfTravel(travel: Travel, scale: number): Guide {
  const corner = wedgeOfArms({ corner: travel.from, to: travel.to, arms: [0] }, scale);
  return {
    length: alongText(travel.from, travel.to),
    corners: corner ? [corner] : [],
    datum: travel.from,
    travel,
  };
}

/**
 * A circle being drawn out says how far its rim is from its centre, which is
 * the number the length steps are holding while it is drawn. The radius itself
 * is not part of the circle, so the line the number sits on is drawn faintly,
 * the way a move's run is.
 */
function guideOfCompass(pending: Pending): Guide {
  return {
    length: alongText(pending.start, pending.at),
    corners: [],
    travel: { from: pending.start, to: pending.at },
  };
}

/**
 * The angle is against whatever already runs out of the point it started from,
 * and the nearest of those is the wedge it is being drawn inside. From a point
 * with nothing at it, it is against the horizontal, which is what the angle
 * snapping counts from as well.
 */
function guideOfStraightedge(pending: Pending, placing: Placing): Guide {
  const { objects, settled, scale } = placing;
  const arms = armsAt(pending.startId, objects, settled).map((arm) => arm.angle);
  const corner = wedgeOfArms(
    { corner: pending.start, to: pending.at, arms: arms.length > 0 ? arms : [0] },
    scale,
  );
  return {
    length: alongText(pending.start, pending.at),
    corners: corner ? [corner] : [],
    datum: arms.length === 0 ? pending.start : undefined,
  };
}

/**
 * Every corner of the shape as it stands, so the whole figure can be read while
 * it is being laid rather than one angle at a time. The first edge has no
 * corner behind it, so it reads off the horizontal the way a straight object
 * drawn from a bare point does.
 */
function guideOfTracing(tracing: Tracing, scale: number): Guide {
  const last = tracing.spots[tracing.spots.length - 1];
  const ring = [...tracing.spots, tracing.at];
  const first =
    ring.length < 3 ? wedgeOfArms({ corner: last, to: tracing.at, arms: [0] }, scale) : null;
  return {
    length: alongText(last, tracing.at),
    datum: first ? last : undefined,
    corners: first
      ? [first]
      : ring.flatMap((corner, nth) => {
          const before = ring[(nth + ring.length - 1) % ring.length];
          const after = ring[(nth + 1) % ring.length];
          const wedge = cornerArc(
            { corner, from: angleBetween(corner, before), to: angleBetween(corner, after) },
            scale,
          );
          return wedge ? [wedge] : [];
        }),
    area:
      tracing.spots.length >= 2
        ? { at: middleOf(ring), turn: 0, dy: 5, text: sayArea(shoelace(ring)) }
        : undefined,
  };
}

/** What is being drawn or moved, said on the sheet, or nothing under way. */
export function guideOf(placing: Placing): Guide | null {
  const { scale, snapping, travel, pending, tracing } = placing;
  if (travel && snapping.moving) return guideOfTravel(travel, scale);
  if (pending && pending.tool === "compass") return guideOfCompass(pending);
  if (pending && pending.tool === "straightedge") return guideOfStraightedge(pending, placing);
  if (tracing && tracing.spots.length > 0) return guideOfTracing(tracing, scale);
  return null;
}
