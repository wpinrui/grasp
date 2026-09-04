/**
 * The marking, and everything asked about it or done to it: laying a tick,
 * marking an angle, dragging one along, turning an angle round, whatever a
 * panel sets, and the questions the sheet asks before it does any of that.
 *
 * The last mark of each kind is remembered here rather than on the page, since
 * it is a thing about the tool rather than about the figure: a new tick comes
 * out the way the last one was left, and a new angle mark stands clear of
 * whatever is already at its corner.
 */

import { useRef, useState } from "react";
import {
  ANGLE_RADIUS,
  alongPath,
  createTick,
  distance,
  isMark,
  isMeasurement,
  LEAST_ANGLE_RADIUS,
  type MarkForm,
  markAlong,
  markReach,
  markShape,
  type PathGeometry,
  type Position,
  pathIn,
  type Settled,
  type SketchMark,
  type SketchMeasurement,
  type SketchObject,
  tangentOnPath,
  type View,
} from "../../sketch/model";
import type { Sketch } from "../../sketch/useSketch";
import { angleMarkOn, angleReadingSpot, type Measuring } from "./readings";
import { ANGLE_ROOM, type LastMark } from "./sheet";

/**
 * What working out where a number hangs takes: where the figure settled, the
 * zoom, and what the number comes out as. A narrow view of the readings, so
 * nothing this hook owns travels back in through its own front door.
 */
export type Reading = Pick<Measuring, "settled" | "scale" | "saying">;

/**
 * What the last mark of each kind was left as. `LastMark` is the narrow view of
 * it the arcs are drawn from; this is the whole of what the tool remembers.
 */
export interface MarkMemory extends LastMark {
  equal: number;
  parallel: number;
  /** The way the last arrowheads pointed, in sheet coordinates. */
  way: Position | null;
}

/** What the sheet hands the marking: the figure, the zoom, and the tool that is up. */
export interface Marked {
  sketch: Sketch;
  objects: SketchObject[];
  settled: Settled;
  scale: number;
  /** Where the page sits on screen, which is where a mark's panel goes. */
  view: View;
  /** What the Marker would mark, or null while it is not the tool that is up. */
  marking: MarkForm | null;
}

/**
 * The marking, and the panel that is open on one. `panel` is the id of the mark
 * whose panel is up, which is a thing about the window rather than the page.
 */
export function useMarking({ sketch, objects, settled, scale, view, marking }: Marked) {
  const [panel, setPanel] = useState<string | null>(null);
  /**
   * What the last mark of each kind was left as, so the next one comes out the
   * same rather than starting from one stroke every time. `way` is the way the
   * last arrowheads pointed, in sheet coordinates, so a second pair of parallel
   * sides is marked the same way round as the first without being told.
   */
  const lastMark = useRef<MarkMemory>({
    equal: 1,
    parallel: 1,
    angle: 1,
    way: null,
    radius: ANGLE_RADIUS,
  });

  /**
   * What dragging a mark does: a tick slides along the path it rides, and an
   * angle mark's arcs stand further off its corner. A mark is never a handle on
   * the figure, so no tool drags anything else by it.
   */
  function dragMark(mark: SketchMark, at: Position) {
    const before = sketch.read();
    if ("path" in mark) {
      const along = pathIn(settled, mark.path);
      if (!along) return;
      const to = alongPath(along, at);
      sketch.updateGesture({
        ...before,
        objects: before.objects.map((object) =>
          object.id === mark.id && isMark(object) && "path" in object
            ? { ...object, at: to }
            : object,
        ),
      });
      return;
    }
    const corner = settled.points.get(mark.corner);
    if (!corner) return;
    const radius = Math.max(LEAST_ANGLE_RADIUS, distance(corner, at) * scale);
    sketch.updateGesture({
      ...before,
      objects: before.objects.map((object) =>
        object.id === mark.id && isMark(object) && !("path" in object)
          ? { ...object, radius }
          : object,
      ),
    });
  }

  /**
   * Whether a tick can be swapped for the other kind. A path carries one of
   * each at most, so where the other kind is already there the swap would have
   * nowhere to land and the panel does not offer it.
   */
  function canSwap(mark: SketchMark | null): boolean {
    if (!mark || !("path" in mark)) return false;
    const other = mark.form === "equal" ? "parallel" : "equal";
    return !objects.some(
      (object) =>
        isMark(object) && "path" in object && object.path === mark.path && object.form === other,
    );
  }

  /** An angle mark left at a new radius is what the next one comes out at. */
  function rememberRadius(id: string) {
    const now = sketch.read().objects.find((object) => object.id === id);
    if (now && isMark(now) && !("path" in now) && now.radius) {
      lastMark.current.radius = now.radius;
    }
  }

  /** Whether a mark is the one the tool that is up deals in. */
  function ownMark(mark: SketchMark | null): boolean {
    return mark !== null && mark.form === marking;
  }

  /** Where a mark is drawn, in screen pixels, which is where its panel goes. */
  function panelSpotOf(id: string): Position | null {
    const mark = objects.find((object) => object.id === id);
    if (!mark || !isMark(mark)) return null;
    const shape = markShape(mark, { settled, objects, scale });
    if (!shape) return null;
    // An angle mark turns about its corner, so its panel clears the arcs.
    const lift = shape.form === "angle" ? shape.radius + 16 : 12;
    return {
      x: (shape.at.x - view.x) * scale,
      y: (shape.at.y - view.y) * scale - lift,
    };
  }

  /** One mark, changed, as one undo step. */
  function reshape(id: string, change: (mark: SketchMark) => SketchMark) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        object.id === id && isMark(object) ? change(object) : object,
      ),
    });
  }

  /** Which way a tick's arrowheads point on the sheet, once it is drawn. */
  function wayOf(mark: SketchMark): Position | null {
    const shape = markShape(mark, { settled, objects, scale });
    return shape && shape.form !== "angle" ? shape.way : null;
  }

  /**
   * What the panel does: the strokes, the direction, the form and the bin.
   *
   * The three that remember what a mark was left at, `setStrokes`, `flipMark`
   * and `setForm`, commit through `reshape`, which reads the live page, and
   * then read the mark back out of this render's own list. That list is a
   * render behind a mark laid in the same turn, which is harmless here: a panel
   * only ever opens on a mark the sheet has already drawn once.
   */
  function setStrokes(id: string, strokes: number) {
    reshape(id, (mark) => ({ ...mark, strokes }));
    const mark = objects.find((object) => object.id === id);
    if (mark && isMark(mark)) lastMark.current[mark.form] = strokes;
  }

  function flipMark(id: string) {
    reshape(id, (mark) => ("path" in mark ? { ...mark, flipped: !mark.flipped } : mark));
    const mark = objects.find((object) => object.id === id);
    if (mark && isMark(mark) && "path" in mark) {
      const way = wayOf(mark);
      // It is about to be drawn the other way round, so that is what to
      // remember for the next one.
      lastMark.current.way = way ? { x: -way.x, y: -way.y } : null;
    }
  }

  /**
   * An angle marked the other way round. The number on it goes round too where
   * that number is the only one, which is why the readings are handed in.
   */
  function flipReflex(id: string, hangsOn: Reading) {
    const mark = objects.find((object) => object.id === id);
    if (!mark || !isMark(mark) || "path" in mark) return;
    // Turning it round would make it the mark the other side of these arms
    // already is, and one angle is marked once.
    const twin = objects.some(
      (object) =>
        isMark(object) &&
        !("path" in object) &&
        object.id !== id &&
        object.corner === mark.corner &&
        object.arms.every((arm) => mark.arms.includes(arm)) &&
        (object.reflex === true) !== (mark.reflex === true),
    );
    if (twin) return;
    const reflex = mark.reflex !== true;
    const turned = { ...mark, reflex };
    // One angle marked once and read once means the mark and the number can
    // only be about the same angle, so the number goes round with the mark,
    // over to the other side of the corner. With more than one of either it is
    // no longer clear which belongs to which, so only the mark turns.
    const readings = objects.filter(
      (object): object is SketchMeasurement =>
        isMeasurement(object) &&
        object.measure === "angle" &&
        object.of.length === 3 &&
        object.of[1] === mark.corner &&
        mark.arms.every((arm) => object.of.includes(arm)),
    );
    const marked = objects.filter(
      (object) =>
        isMark(object) &&
        !("path" in object) &&
        object.corner === mark.corner &&
        object.arms.every((arm) => mark.arms.includes(arm)),
    );
    const alone = readings.length === 1 && marked.length === 1 ? readings[0] : null;
    const hangs = alone
      ? angleReadingSpot({ reading: alone, mark: turned, reflex }, hangsOn)
      : null;
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) => {
        if (object.id === id) return turned;
        if (alone && object.id === alone.id && isMeasurement(object)) {
          return { ...object, reflex, ...(hangs ?? {}) };
        }
        return object;
      }),
    });
  }

  function setSquare(id: string, square: boolean) {
    reshape(id, (mark) => ("path" in mark ? mark : { ...mark, square }));
  }

  function setForm(id: string, form: "equal" | "parallel") {
    reshape(id, (mark) => ("path" in mark ? { ...mark, form } : mark));
    const mark = objects.find((object) => object.id === id);
    if (mark && isMark(mark)) lastMark.current[form] = mark.strokes;
  }

  function dropMark(id: string) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.filter((object) => object.id !== id),
      selection: before.selection.filter((held) => held !== id),
    });
    setPanel(null);
  }

  /**
   * A new tick on a path. It comes out the way the last one of its kind was
   * left, and where a mark of the other kind already sits at that spot the two
   * are grouped: that one moves to the clicked point as well, so the pair ends
   * up centred on it with neither drawn over the other.
   *
   * A path says a thing once: it carries one set of bars and one arrowhead at
   * most. Clicking a path that already says what this tool says opens that
   * mark's panel instead of laying a second one, so a click is either making
   * the mark or getting at the one that is there, and never both.
   */
  function layTick(
    on: { path: SketchObject; along: PathGeometry; spot: Position },
    beside?: SketchMark,
  ) {
    const { path, along, spot } = on;
    const form = marking as "equal" | "parallel";
    const already = objects.find(
      (object) =>
        isMark(object) && "path" in object && object.path === path.id && object.form === form,
    );
    if (already) {
      setPanel(already.id);
      return;
    }
    const at = markAlong(along, spot, scale);
    const way = tangentOnPath(along, at);
    const last = lastMark.current.way;
    const flipped = form === "parallel" && last !== null && way.x * last.x + way.y * last.y < 0;
    const tick = createTick({
      form,
      path: path.id,
      at,
      strokes: lastMark.current[form],
      flipped,
    });
    lastMark.current.way = flipped ? { x: -way.x, y: -way.y } : way;
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: [
        ...before.objects.map((object) =>
          beside && object.id === beside.id && isMark(object) && "path" in object
            ? { ...object, at }
            : object,
        ),
        tick,
      ],
    });
    setPanel(tick.id);
  }

  /**
   * Mark one angle by the two arms it runs between, or open the panel on the
   * mark already there. One angle at a corner is marked once, the same way one
   * path says a thing once.
   */
  function markAngle(angle: { corner: string; arms: [string, string]; reflex?: boolean }) {
    const { corner, arms, reflex = false } = angle;
    const already = objects.find(
      (object) =>
        isMark(object) &&
        !("path" in object) &&
        object.corner === corner &&
        object.arms.every((arm) => arms.includes(arm)) &&
        (object.reflex === true) === reflex,
    );
    if (already) {
      setPanel(already.id);
      return;
    }
    const mark = angleMarkOn({ corner, arms, reflex }, null, {
      objects,
      settled,
      lastMark: lastMark.current,
      clearOf: clearOfCorner,
    });
    addMark(mark);
    setPanel(mark.id);
  }

  /**
   * How far a new angle mark stands off a corner: past everything already
   * marked there, so each angle at a corner gets a ring of its own. Two sets of
   * arcs drawn at the same radius sit on top of one another, and then the
   * second angle cannot be seen or clicked, which reads as a corner refusing to
   * take more than one mark.
   */
  function clearOfCorner(corner: string): number {
    const here = objects.filter(
      (object) => isMark(object) && !("path" in object) && object.corner === corner,
    ) as SketchMark[];
    if (here.length === 0) return lastMark.current.radius;
    const past = Math.max(...here.map((mark) => markReach(mark)));
    return past + ANGLE_ROOM;
  }

  /** A new mark lands on the page without disturbing what is selected. */
  function addMark(mark: SketchMark) {
    const before = sketch.read();
    sketch.commit({ ...before, objects: [...before.objects, mark] });
  }
  return {
    panel,
    setPanel,
    lastMark,
    addMark,
    canSwap,
    clearOfCorner,
    dragMark,
    dropMark,
    flipMark,
    flipReflex,
    layTick,
    markAngle,
    ownMark,
    panelSpotOf,
    rememberRadius,
    setForm,
    setSquare,
    setStrokes,
  };
}
