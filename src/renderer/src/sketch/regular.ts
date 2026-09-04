/**
 * A regular polygon, built rather than clicked out corner by corner.
 *
 * It comes two ways. Held, it is a centre and one corner, with every other
 * corner turned about that centre by its share of a full turn: dragging the one
 * free corner turns and resizes the whole shape and it stays regular, because
 * being regular is how it is put together rather than where its corners happen
 * to sit. Loose, the same corners are laid down as plain points that happen to
 * make a regular shape, and every one of them is then free to be moved.
 *
 * Either way it sits flat: the bottom edge is level, so a triangle points up
 * and a square is square rather than a diamond.
 *
 * A held shape dragged down to no size at all is undone rather than dragged
 * back out of: with every corner on one spot there is nothing left to take hold
 * of that is not the pile itself.
 */

import {
  createInterior,
  createPoint,
  lineThrough,
  type PointSize,
  type Position,
  radiansOf,
  type SketchObject,
  type SketchState,
} from "./model";

/** The fewest corners a polygon can have, and the most this will build. */
export const FEWEST_SIDES = 3;
export const MOST_SIDES = 100;

/**
 * How far a corner sits from the middle, in sheet units, before it is dragged.
 * One click cannot say how big a shape is, so it comes out this big and is
 * dragged from there.
 */
const REACH = 100;

/** A whole turn in degrees, shared between however many corners there are. */
const TURN = 360;

/** Whether a number of sides is one a polygon can be built with. */
export function canBuildSides(sides: number): boolean {
  return Number.isInteger(sides) && sides >= FEWEST_SIDES && sides <= MOST_SIDES;
}

/**
 * Where each corner of a flat-bottomed regular polygon sits, going round in one
 * direction from the corner the rest are turned off. Screen angles, so y counts
 * downward and straight down is a quarter turn.
 *
 * The reach is asked for rather than assumed, since the same shape is drawn
 * small on the keys that offer it as well as full size on the sheet.
 */
export function cornersAt(at: Position, reach: number, sides: number): Position[] {
  // Half a step past straight down puts two corners either side of the bottom,
  // which is what makes the bottom edge level.
  const first = TURN / 4 + TURN / (2 * sides);
  return Array.from({ length: sides }, (_, corner) => {
    const angle = radiansOf(first - (corner * TURN) / sides);
    return { x: at.x + reach * Math.cos(angle), y: at.y + reach * Math.sin(angle) };
  });
}

/** What a regular polygon is asked for: where, how many sides, and how held. */
export interface RegularWanted {
  at: Position;
  sides: number;
  size: PointSize;
  /** Held regular, so the corners are turned about the middle rather than placed. */
  locked: boolean;
}

/**
 * A regular polygon as objects: its corners, the fill, and the edges round it.
 * Held, the middle comes with it, since the corners are turned about it and it
 * is what the shape is dragged by.
 */
export function regularPolygon({ at, sides, size, locked }: RegularWanted): SketchObject[] {
  if (!canBuildSides(sides)) return [];
  const spots = cornersAt(at, REACH, sides);
  const first = createPoint(spots[0], size);
  const centre = locked ? createPoint(at, size) : null;
  // Turning each corner by its share of the whole turn is what holds the shape
  // regular. Loose, the same spot is only where a plain point was put.
  const rest = spots.slice(1).map((spot, index) =>
    centre
      ? createPoint(spot, size, {
          kind: "rotate",
          of: first.id,
          centre: centre.id,
          degrees: ((index + 1) * TURN) / sides,
        })
      : createPoint(spot, size),
  );
  const ring = [first, ...rest].map((corner) => corner.id);
  return [...(centre ? [centre] : []), first, ...rest, createInterior(ring), ...edgesRound(ring)];
}

/**
 * The edges round a ring of corners, closing back to the first, so a polygon is
 * a ring however it was made: clicked out corner by corner, or built.
 */
export function edgesRound(ring: string[]): SketchObject[] {
  return ring.map((corner, index) =>
    lineThrough("segment", [corner, ring[(index + 1) % ring.length]]),
  );
}

/**
 * The page with a regular polygon added and nothing but it selected, or the
 * page as it was where the number of sides is not one a polygon has.
 */
export function withRegular(before: SketchState, wanted: RegularWanted): SketchState {
  const made = regularPolygon(wanted);
  if (made.length === 0) return before;
  return {
    ...before,
    objects: [...before.objects, ...made],
    selection: made.map((object) => object.id),
  };
}
