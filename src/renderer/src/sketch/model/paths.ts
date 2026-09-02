import {
  type ArcSpan,
  type CircleSpan,
  type Derivation,
  type LineForm,
  type LineSpan,
  type MarkedAngle,
  type MarkedRatio,
  type MarkedVector,
  PX_PER_CM,
} from "./figures";
import {
  type ArcGeometry,
  type CircleGeometry,
  degreesOf,
  distance,
  distanceToLine,
  isArcPath,
  isRound,
  type LineGeometry,
  type PathGeometry,
  type Position,
  pathIn,
  radiansOf,
  type Settled,
  TINY,
  TURN,
  unit,
} from "./geometry";
/**
 * Every spot two paths meet at, in an order that holds still as they move: a
 * line and a circle in the order they are met running along the line, and two
 * circles with the one to the left of the way between their centres first.
 * Empty when they do not meet where they run.
 */
export function crossings(one: PathGeometry, other: PathGeometry): Position[] {
  // An arc meets things where its circle does, less whatever falls off its
  // ends, so it is worked out as the circle and then cut back.
  if (isArcPath(one) || isArcPath(other)) {
    const met = crossings(wholePath(one), wholePath(other));
    return met.filter(
      (spot) => (!isArcPath(one) || onArc(one, spot)) && (!isArcPath(other) || onArc(other, spot)),
    );
  }
  if (!isRound(one) && !isRound(other)) {
    const met = crossing(one, other);
    return met ? [met] : [];
  }
  if (isRound(one) && isRound(other)) return circlesMeet(one, other);
  const line = isRound(one) ? (other as LineGeometry) : one;
  const round = isRound(one) ? one : (other as CircleGeometry);
  return lineMeetsCircle(line, round);
}

/** The whole path an arc is a stretch of: its circle, or the run it lies on. */
export function wholePath(path: PathGeometry): PathGeometry {
  if (!isArcPath(path)) return path;
  if (path.flat) return { a: path.flat[0], b: path.flat[1], form: "segment" };
  return { at: path.at, radius: path.radius, ref: path.from };
}

/** Where a straight object runs into a circle, in the order it meets them. */
function lineMeetsCircle(line: LineGeometry, round: CircleGeometry): Position[] {
  const dx = line.b.x - line.a.x;
  const dy = line.b.y - line.a.y;
  const gap = { x: line.a.x - round.at.x, y: line.a.y - round.at.y };
  const a = dx * dx + dy * dy;
  if (a < TINY) return [];
  const b = 2 * (gap.x * dx + gap.y * dy);
  const c = gap.x * gap.x + gap.y * gap.y - round.radius * round.radius;
  const under = b * b - 4 * a * c;
  if (under < 0) return [];
  const root = Math.sqrt(under);
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
    .filter((t, index, all) => (index === 0 ? true : Math.abs(t - all[0]) > TINY))
    .filter((t) => runsTo(line.form, t))
    .map((t) => ({ x: line.a.x + dx * t, y: line.a.y + dy * t }));
}

/** Where two circles meet, the left-hand one first. */
function circlesMeet(one: CircleGeometry, other: CircleGeometry): Position[] {
  const apart = distance(one.at, other.at);
  if (apart < TINY) return [];
  if (apart > one.radius + other.radius) return [];
  if (apart < Math.abs(one.radius - other.radius)) return [];
  const way = { x: (other.at.x - one.at.x) / apart, y: (other.at.y - one.at.y) / apart };
  const along =
    (apart * apart + one.radius * one.radius - other.radius * other.radius) / (2 * apart);
  const off = Math.sqrt(Math.max(0, one.radius * one.radius - along * along));
  const foot = { x: one.at.x + way.x * along, y: one.at.y + way.y * along };
  if (off < TINY) return [foot];
  return [
    { x: foot.x - way.y * off, y: foot.y + way.x * off },
    { x: foot.x + way.y * off, y: foot.y - way.x * off },
  ];
}

/**
 * Where two straight objects cross, or null when they do not cross where they
 * run. Parallel objects never cross, and two segments whose lines would only
 * meet beyond their ends do not either.
 */
export function crossing(one: LineGeometry, other: LineGeometry): Position | null {
  const p = { x: one.b.x - one.a.x, y: one.b.y - one.a.y };
  const q = { x: other.b.x - other.a.x, y: other.b.y - other.a.y };
  const twist = p.x * q.y - p.y * q.x;
  if (Math.abs(twist) < TINY) return null;
  const gap = { x: other.a.x - one.a.x, y: other.a.y - one.a.y };
  const t = (gap.x * q.y - gap.y * q.x) / twist;
  const u = (gap.x * p.y - gap.y * p.x) / twist;
  if (!runsTo(one.form, t) || !runsTo(other.form, u)) return null;
  return { x: one.a.x + p.x * t, y: one.a.y + p.y * t };
}

/** Whether an object still exists that far along itself. */
function runsTo(form: LineForm, t: number): boolean {
  if (form === "line") return true;
  if (t < 0) return false;
  return form === "ray" || t <= 1;
}

/** Where an image belongs, or null when what it hangs off has gone. */

/** Which way one spot lies from another, as the sheet counts angles. */
function bearing(from: Position, to: Position): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * The angle a rotation is following, in degrees counterclockwise on screen,
 * which is the way a fixed angle is counted too. Three points give the turn
 * that carries the first arm onto the second.
 */
function angleFollowed(angle: MarkedAngle, settled: Settled): number | null {
  if (angle.kind === "value") {
    const held = settled.values.get(angle.of);
    // Only an angle is an angle. A length says nothing about how far to turn.
    return held && held.angle === 1 && held.length === 0 ? held.value : null;
  }
  const corner = settled.points.get(angle.corner);
  const a = settled.points.get(angle.a);
  const b = settled.points.get(angle.b);
  if (!corner || !a || !b) return null;
  // The sheet's y counts downward, so counterclockwise on screen is the way the
  // bearing decreases.
  return degreesOf(bearing(corner, a) - bearing(corner, b));
}

/** The ratio a dilation is following, or null where it says nothing. */
function ratioFollowed(ratio: MarkedRatio, settled: Settled): number | null {
  if (ratio.kind === "value") {
    const held = settled.values.get(ratio.of);
    // A scale factor has no units: a length would be a ratio of what to what.
    return held && held.angle === 0 && held.length === 0 ? held.value : null;
  }
  if (ratio.kind === "segments") {
    const top = settled.lines.get(ratio.top);
    const bottom = settled.lines.get(ratio.bottom);
    if (!top || !bottom) return null;
    const under = distance(bottom.a, bottom.b);
    return under === 0 ? null : distance(top.a, top.b) / under;
  }
  const a = settled.points.get(ratio.a);
  const b = settled.points.get(ratio.b);
  const c = settled.points.get(ratio.c);
  if (!a || !b || !c) return null;
  // Signed, so C on the far side of A from B dilates through the centre. Read
  // along AB, which is the line all three are meant to lie on.
  const alongX = b.x - a.x;
  const alongY = b.y - a.y;
  const span = alongX * alongX + alongY * alongY;
  return span === 0 ? null : ((c.x - a.x) * alongX + (c.y - a.y) * alongY) / span;
}

/**
 * The vector a translation is following, in sheet pixels. A polar vector can
 * have one half marked and the other left as it was given, so the half that is
 * not marked is read back off the vector the translation is carrying.
 */
function vectorFollowed(
  by: MarkedVector,
  settled: Settled,
  held: { dx: number; dy: number },
): { dx: number; dy: number } | null {
  if (by.kind === "points") {
    const from = settled.points.get(by.from);
    const to = settled.points.get(by.to);
    return from && to ? { dx: to.x - from.x, dy: to.y - from.y } : null;
  }
  const reach = (id: string): number | null => {
    const found = settled.values.get(id);
    // A distance is a distance. An angle or a bare number is not one.
    return found && found.length === 1 && found.angle === 0 ? found.value * PX_PER_CM : null;
  };
  if (by.kind === "distances") {
    const across = reach(by.horizontal);
    const up = reach(by.vertical);
    // Up the screen is the positive way, and the sheet's y counts downward.
    return across === null || up === null ? null : { dx: across, dy: -up };
  }
  const far = by.distance ? reach(by.distance) : Math.hypot(held.dx, held.dy);
  const way = by.angle
    ? angleFollowed(by.angle, settled)
    : degreesOf(Math.atan2(-held.dy, held.dx));
  if (far === null || way === null) return null;
  const radians = radiansOf(way);
  return { dx: far * Math.cos(radians), dy: -far * Math.sin(radians) };
}

export function imageOf(from: Derivation, settled: Settled): Position | null {
  if (from.kind === "on") {
    const path = pathIn(settled, from.path);
    return path ? spotOnPath(path, from.at) : null;
  }
  if (from.kind === "cross") {
    const one = pathIn(settled, from.of);
    const other = pathIn(settled, from.and);
    if (!one || !other) return null;
    const met = crossings(one, other);
    return met[from.pick ?? 0] ?? null;
  }
  const of = settled.points.get(from.of);
  if (!of) return null;
  if (from.kind === "translate") {
    // What it follows where it was told to follow something, and the numbers it
    // was given otherwise.
    const by = from.by ? vectorFollowed(from.by, settled, from) : from;
    if (!by) return null;
    return { x: of.x + by.dx, y: of.y + by.dy };
  }
  if (from.kind === "reflect") {
    const mirror = settled.lines.get(from.mirror);
    if (!mirror) return null;
    const way = unit(mirror.a, mirror.b);
    if (!way) return null;
    // Twice the way to the foot of the perpendicular, less the point itself.
    const across = (of.x - mirror.a.x) * way.x + (of.y - mirror.a.y) * way.y;
    const foot = { x: mirror.a.x + way.x * across, y: mirror.a.y + way.y * across };
    return { x: 2 * foot.x - of.x, y: 2 * foot.y - of.y };
  }
  if (from.kind === "midpoint") {
    const and = settled.points.get(from.and);
    return and ? { x: (of.x + and.x) / 2, y: (of.y + and.y) / 2 } : null;
  }
  const centre = settled.points.get(from.centre);
  if (!centre) return null;
  const dx = of.x - centre.x;
  const dy = of.y - centre.y;
  if (from.kind === "dilate") {
    const ratio = from.by ? ratioFollowed(from.by, settled) : from.ratio;
    if (ratio === null) return null;
    return { x: centre.x + dx * ratio, y: centre.y + dy * ratio };
  }
  const degrees = from.by ? angleFollowed(from.by, settled) : from.degrees;
  if (degrees === null) return null;
  const radians = radiansOf(degrees);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  // Counterclockwise on screen, where y counts downward.
  return { x: centre.x + dx * cos + dy * sin, y: centre.y - dx * sin + dy * cos };
}

/** Where a circle sits, or null when what holds it has gone or it has no size. */
export function circleAt(span: CircleSpan, settled: Settled): CircleGeometry | null {
  const centre = settled.points.get(span.centre);
  if (!centre) return null;
  const at = { x: centre.x, y: centre.y };
  if (span.kind === "through") {
    const edge = settled.points.get(span.edge);
    if (!edge) return null;
    const radius = distance(centre, edge);
    // A point on the circle is measured round from its radius point, so
    // swinging the radius point carries everything on the circle with it.
    return radius < TINY
      ? null
      : { at, radius, ref: Math.atan2(edge.y - centre.y, edge.x - centre.x) };
  }
  const along = settled.lines.get(span.along);
  if (!along) return null;
  const radius = distance(along.a, along.b);
  return radius < TINY ? null : { at, radius, ref: 0 };
}

/** The angle from a centre to a spot, on a sheet whose y counts downward. */
function angleTo(centre: Position, spot: Position): number {
  return Math.atan2(spot.y - centre.y, spot.x - centre.x);
}

/** How far counter-clockwise it is from one angle round to another. */
function turnBetween(from: number, to: number): number {
  const gap = (from - to) % TURN;
  return gap < 0 ? gap + TURN : gap;
}

/** The circle through three points, or null when they lie in a straight line. */
function circleThrough(a: Position, b: Position, c: Position): CircleGeometry | null {
  const twice = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(twice) < TINY) return null;
  const one = a.x * a.x + a.y * a.y;
  const two = b.x * b.x + b.y * b.y;
  const three = c.x * c.x + c.y * c.y;
  const at = {
    x: (one * (b.y - c.y) + two * (c.y - a.y) + three * (a.y - b.y)) / twice,
    y: (one * (c.x - b.x) + two * (a.x - c.x) + three * (b.x - a.x)) / twice,
  };
  return { at, radius: distance(at, a), ref: 0 };
}

/** Whether a spot lies between two others, all three being in a line. */
function between(one: Position, spot: Position, other: Position): boolean {
  const along = (spot.x - one.x) * (other.x - one.x) + (spot.y - one.y) * (other.y - one.y);
  const reach = (other.x - one.x) ** 2 + (other.y - one.y) ** 2;
  return along >= 0 && along <= reach;
}

/**
 * Where an arc runs, or null when it cannot be placed: its three points went
 * straight and the middle one is not between the others, so there is no arc.
 */
export function arcAt(span: ArcSpan, settled: Settled): ArcGeometry | null {
  const from = settled.points.get(span.from);
  const to = settled.points.get(span.to);
  if (!from || !to) return null;
  if (span.kind === "through") {
    const via = settled.points.get(span.via);
    if (!via) return null;
    const round = circleThrough(from, via, to);
    if (!round) {
      // Straight through: an arc of no angle, drawn as the run it makes. With
      // the middle point outside the other two there is no such run.
      const ends: [Position, Position] = [
        { x: from.x, y: from.y },
        { x: to.x, y: to.y },
      ];
      return between(from, via, to)
        ? { at: ends[0], radius: 0, from: 0, sweep: 0, flat: ends }
        : null;
    }
    const start = angleTo(round.at, from);
    const round_to = turnBetween(start, angleTo(round.at, to));
    const round_via = turnBetween(start, angleTo(round.at, via));
    // Counter-clockwise if that is the way past the middle point, the other
    // way about if it is not.
    const sweep = round_via <= round_to ? -round_to : TURN - round_to;
    return { at: round.at, radius: round.radius, from: start, sweep };
  }
  const at =
    span.kind === "on" ? settled.circles.get(span.circle)?.at : settled.points.get(span.centre);
  if (!at) return null;
  const centre = { x: at.x, y: at.y };
  const radius =
    span.kind === "on" ? (settled.circles.get(span.circle)?.radius ?? 0) : distance(centre, from);
  if (radius < TINY) return null;
  const start = angleTo(centre, from);
  return { at: centre, radius, from: start, sweep: -turnBetween(start, angleTo(centre, to)) };
}

/** How far along an arc a spot is, which is past 1 when it is off the end. */
export function turnOn(arc: ArcGeometry, spot: Position): number {
  if (arc.flat) return alongPath({ a: arc.flat[0], b: arc.flat[1], form: "segment" }, spot);
  if (Math.abs(arc.sweep) < TINY) return 0;
  const way = arc.sweep < 0 ? -1 : 1;
  const off = ((((angleTo(arc.at, spot) - arc.from) * way) % TURN) + TURN) % TURN;
  return (off * way) / arc.sweep;
}

/** Whether a spot on the arc's circle is on the stretch the arc runs. */
function onArc(arc: ArcGeometry, spot: Position): boolean {
  const t = turnOn(arc, spot);
  return t >= -0.000001 && t <= 1.000001;
}

/** The spot a given way along a path: a fraction of a line, a turn of a circle. */
export function spotOnPath(path: PathGeometry, at: number): Position {
  if (isArcPath(path)) {
    if (path.flat) {
      return {
        x: path.flat[0].x + (path.flat[1].x - path.flat[0].x) * at,
        y: path.flat[0].y + (path.flat[1].y - path.flat[0].y) * at,
      };
    }
    const angle = path.from + path.sweep * at;
    return {
      x: path.at.x + Math.cos(angle) * path.radius,
      y: path.at.y + Math.sin(angle) * path.radius,
    };
  }
  if (isRound(path)) {
    const angle = path.ref + at * Math.PI * 2;
    return {
      x: path.at.x + Math.cos(angle) * path.radius,
      y: path.at.y + Math.sin(angle) * path.radius,
    };
  }
  return {
    x: path.a.x + (path.b.x - path.a.x) * at,
    y: path.a.y + (path.b.y - path.a.y) * at,
  };
}

/** The two points a line runs through, or null when it cannot be placed. */
export function lineAlong(span: LineSpan, form: LineForm, settled: Settled): LineGeometry | null {
  if (span.kind === "through") {
    const a = settled.points.get(span.ends[0]);
    const b = settled.points.get(span.ends[1]);
    return a && b && distance(a, b) > TINY ? { a, b, form } : null;
  }
  if (span.kind === "bisector") {
    const corner = settled.points.get(span.corner);
    const a = settled.points.get(span.a);
    const b = settled.points.get(span.b);
    if (!corner || !a || !b) return null;
    const one = unit(corner, a);
    const other = unit(corner, b);
    if (!one || !other) return null;
    const half = { x: one.x + other.x, y: one.y + other.y };
    // The arms point opposite ways, so there is no angle to halve.
    if (Math.hypot(half.x, half.y) < TINY) return null;
    return { a: corner, b: { x: corner.x + half.x, y: corner.y + half.y }, form };
  }
  const at = settled.points.get(span.at);
  const to = settled.lines.get(span.to);
  if (!at || !to) return null;
  const along = { x: to.b.x - to.a.x, y: to.b.y - to.a.y };
  const way = span.kind === "parallel" ? along : { x: -along.y, y: along.x };
  return { a: at, b: { x: at.x + way.x, y: at.y + way.y }, form };
}

/**
 * Put every image back where its parents say it belongs, and work out where
 * every line runs. One pass, because parents always come first.
 *
 * The same objects array comes back when nothing moved, so nothing downstream
 * mistakes a selection change for an edit.
 */

/** Whether a spot is inside the part of an arc's circle the fill covers. */
export function insideWedge(arc: ArcGeometry, wedge: "sector" | "segment", at: Position): boolean {
  if (arc.flat) return false;
  if (distance(arc.at, at) > arc.radius) return false;
  if (wedge === "sector") {
    const t = turnOn(arc, at);
    return t >= 0 && t <= 1;
  }
  // The segment is what the chord cuts off: the side of it the arc bulges to.
  const start = spotOnPath(arc, 0);
  const end = spotOnPath(arc, 1);
  const side = (spot: Position) =>
    (end.x - start.x) * (spot.y - start.y) - (end.y - start.y) * (spot.x - start.x);
  const bulge = side(spotOnPath(arc, 0.5));
  return Math.abs(bulge) > TINY && Math.sign(side(at)) === Math.sign(bulge);
}

/**
 * How far along a path a point sits, as the fraction of the way from the first
 * of its two defining points to the second, kept to where the path runs: a
 * segment stops at both ends, a ray at the first, a line at neither.
 */
export function alongPath(path: PathGeometry, at: Position): number {
  // An arc has two ends, so a point on it stops at them the way it stops at
  // the ends of a segment.
  if (isArcPath(path)) return Math.min(1, Math.max(0, turnOn(path, at)));
  if (isRound(path)) {
    // Round a circle there is no end to stop at: the way round wraps.
    const turn = (Math.atan2(at.y - path.at.y, at.x - path.at.x) - path.ref) / (Math.PI * 2);
    return turn - Math.floor(turn);
  }
  const dx = path.b.x - path.a.x;
  const dy = path.b.y - path.a.y;
  const span = dx * dx + dy * dy;
  if (span === 0) return 0;
  const t = ((at.x - path.a.x) * dx + (at.y - path.a.y) * dy) / span;
  if (path.form !== "line" && t < 0) return 0;
  if (path.form === "segment" && t > 1) return 1;
  return t;
}

/** How far a spot is from a path, whichever kind of path it is. */
export function distanceToPath(path: PathGeometry, at: Position): number {
  if (isArcPath(path)) {
    if (path.flat) {
      return distanceToLine({ a: path.flat[0], b: path.flat[1], form: "segment" }, at);
    }
    // Off the end of the arc, the nearest part of it is that end.
    return distance(spotOnPath(path, alongPath(path, at)), at);
  }
  if (!isRound(path)) return distanceToLine(path, at);
  return Math.abs(distance(path.at, at) - path.radius);
}
