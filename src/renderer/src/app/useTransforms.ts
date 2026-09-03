/**
 * The transform dialogs, and the marking that feeds them.
 *
 * Everything a dialog is holding lives here rather than in the window: what
 * Rotate was last set to, the point it turns about, what the sketch has been
 * told to follow. It is kept between openings on purpose, so turning several
 * things about the same point does not mean picking it every time.
 *
 * The preview is worked out here too, since it is the same question: what would
 * the dialog make if it were answered now. Nothing to show is also what greys
 * its button.
 */

import { useRef, useState } from "react";
import type { MenuAction } from "../components/menus";
import { type Building, wouldBuild } from "../sketch/builds";
import { DEFAULT_DEPTH, iterated } from "../sketch/iterate";
import {
  markableAngle,
  markableDistances,
  markableMirror,
  markableRatio,
  markableVector,
} from "../sketch/markable";
import {
  isLine,
  isMark,
  isPoint,
  isValue,
  type PointSize,
  partsOfAngle,
  partsOfRatio,
  pathIn,
  type Settled,
  type SketchObject,
} from "../sketch/model";
import { splitMerged, splitMergeFor } from "../sketch/relink";
import { rolesFor } from "../sketch/roles";
import {
  DEFAULT_VALUES,
  type Marks,
  makerFor,
  NO_MARKS,
  type TransformKind,
  type TransformValues,
  transformable,
  transformed,
} from "../sketch/transforms";
import type { Sketch } from "../sketch/useSketch";

export interface TransformContext {
  sketch: Sketch;
  building: Building;
  objects: SketchObject[];
  selection: string[];
  /** Where everything sits, for reading a marked number off the sheet. */
  geometry: Settled;
  /** What everything is called, for the Calculator taking a number off the sheet. */
  names: Map<string, string>;
  pointSize: PointSize;
  /** The Construct entry under the pointer, which the sheet previews. */
  hovered: MenuAction | null;
  /** Set while the Calculator is open, which takes numbers off the sheet itself. */
  calculating: boolean;
  /** A name for the Calculator to drop in at its cursor. */
  setInsert: (name: string | null) => void;
}

export function useTransforms(context: TransformContext) {
  const {
    sketch,
    building,
    objects,
    selection,
    geometry,
    names,
    pointSize,
    hovered,
    calculating,
    setInsert,
  } = context;
  const { chosenPoints } = building;

  /** The open dialog, and what its fields were last left holding. */
  const [dialog, setDialog] = useState<TransformKind | "iterate" | null>(null);

  /**
   * What the sketch has marked for a transform to follow. It stays marked until
   * something of the same kind replaces it, so turning several things by the
   * same angle does not mean marking it again.
   */
  const [follows, setFollows] = useState<Marks>(NO_MARKS);
  /** The clicks collected so far, for a mark that takes more than one. */
  const marking = useRef<string[]>([]);

  const [values, setValues] = useState<TransformValues>(DEFAULT_VALUES);

  /**
   * The point Rotate and Dilate turn about. It belongs to the dialogs, which is
   * where it is picked, and it is kept between them so that turning several
   * things about the same point does not mean picking it every time.
   */
  const [centre, setCentre] = useState<string | null>(null);
  /** The straight object Reflect mirrors across, picked the same way. */
  const [mirror, setMirror] = useState<string | null>(null);

  /** Iterate's map: the seeds it was opened on, and where each one goes. */
  const [seeds, setSeeds] = useState<string[]>([]);
  const [targets, setTargets] = useState<(string | null)[]>([]);
  const [depth, setDepth] = useState(DEFAULT_DEPTH);

  // What the open dialog would make, worked out fresh on every keystroke and
  // every pick. Nothing to show means it cannot be answered yet, which is also
  // what greys its button.
  const transform = dialog === "iterate" ? null : dialog;
  const maker =
    transform && transformable(selection, objects)
      ? makerFor(transform, { values, objects, centre, mirror, marks: follows })
      : null;
  const orbit = dialog === "iterate" ? iterated(objects, { seeds, targets, depth }) : [];
  const preview: SketchObject[] = maker
    ? transformed(selection, maker, { objects, size: pointSize })
    : dialog
      ? orbit
      : // No dialog: the sheet shows what the Construct entry under the pointer
        // would build, so hovering Ray says which way it would run.
        wouldBuild(building, hovered);
  /** The row an Iterate click fills: the first empty one, then round again. */
  const nextSeed = Math.max(targets.indexOf(null), 0);

  const marks = [
    // Hovering Interior: the corners numbered in the order they were picked,
    // since that order is the whole reason the fill comes out the shape it does.
    ...(hovered === "interior" && preview.length > 0
      ? chosenPoints.map((point, index) => ({ id: point.id, label: `${index + 1}` }))
      : []),
    // Hovering anything else that gives its objects different jobs: each one
    // says which job it has, so the order they were picked in is visible
    // before the entry is clicked rather than after.
    ...(preview.length > 0 ? rolesFor(building, hovered) : []),
    // The centre and the mirror are only ever shown while the dialog that uses
    // them is open.
    ...(centre && (dialog === "rotate" || dialog === "dilate")
      ? [{ id: centre, label: "CENTER" }]
      : []),
    ...(mirror && dialog === "reflect" ? [{ id: mirror, label: "MIRROR" }] : []),
    ...(dialog === "iterate"
      ? [
          ...seeds.map((id, index) => ({ id, label: `SEED ${index + 1}` })),
          ...targets.flatMap((id, index) => (id ? [{ id, label: `IMAGE ${index + 1}` }] : [])),
        ]
      : []),
    ...(dialog === "translate" && values.translate.mode === "marked"
      ? [
          ...(values.translate.from ? [{ id: values.translate.from, label: "FROM" }] : []),
          ...(values.translate.to ? [{ id: values.translate.to, label: "TO" }] : []),
        ]
      : []),
  ];

  /**
   * Marking by clicking while a transform dialog is open, which is how the
   * reference marks one without leaving the dialog. What a click means depends
   * on what the dialog has been told to follow. Answers whether it took it.
   */
  function markFromSheet(hit: SketchObject): boolean {
    const wantsAngle =
      (dialog === "rotate" && values.rotate.marked) ||
      (dialog === "translate" && values.translate.markedAngle);
    const wantsRatio = dialog === "dilate" && values.dilate.marked;
    const wantsOneDistance = dialog === "translate" && values.translate.markedDistance;
    const wantsTwoDistances = dialog === "translate" && values.translate.markedPair;
    const held = geometry.values.get(hit.id) ?? null;
    const bare = held !== null && held.length === 0 && held.angle === 0;
    const isAngleValue = held !== null && held.angle === 1 && held.length === 0;
    const isDistanceValue = held !== null && held.length === 1 && held.angle === 0;

    if (wantsAngle) {
      // An angle marker is three points: an arm, the corner, the other arm.
      if (isMark(hit) && "corner" in hit) {
        setFollows({
          ...follows,
          angle: { kind: "points", a: hit.arms[0], corner: hit.corner, b: hit.arms[1] },
        });
        return true;
      }
      if (isAngleValue) {
        setFollows({ ...follows, angle: { kind: "value", of: hit.id } });
        return true;
      }
    }
    if (wantsRatio) {
      if (bare) {
        setFollows({ ...follows, ratio: { kind: "value", of: hit.id } });
        return true;
      }
      // Two segments, clicked one after the other: the first over the second.
      if (isLine(hit) && hit.form === "segment") {
        const got = [...marking.current, hit.id];
        if (got.length < 2) {
          marking.current = got;
          return true;
        }
        marking.current = [];
        setFollows({ ...follows, ratio: { kind: "segments", top: got[0], bottom: got[1] } });
        return true;
      }
    }
    if ((wantsOneDistance || wantsTwoDistances) && isDistanceValue) {
      const wanted = wantsTwoDistances ? 2 : 1;
      const got = [...marking.current, hit.id];
      if (got.length < wanted) {
        marking.current = got;
        return true;
      }
      marking.current = [];
      setFollows({ ...follows, distances: got });
      return true;
    }
    return false;
  }

  /**
   * What Split/Merge would do with the selection as it stands, which is also
   * what the entry calls itself rather than naming both halves at once.
   */
  const splitMerge = splitMergeFor(objects, selection);

  function runSplitMerge() {
    if (!splitMerge) return;
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: splitMerged(before.objects, splitMerge, {
        settled: geometry,
        paths: (id: string) => pathIn(geometry, id),
      }),
      // The point it acted on stays picked, since it is what you are working
      // on. Merging two leaves the one that survived.
      selection: [splitMerge.kind === "join" ? splitMerge.to : splitMerge.point],
    });
  }

  /** A Mark entry, which sets what future transforms follow and leaves the selection alone. */
  function mark(action: MenuAction) {
    if (action === "mark-mirror") {
      const found = markableMirror(building);
      if (found) setMirror(found);
      return;
    }
    if (action === "mark-vector") {
      const ends = markableVector(building);
      if (ends)
        setValues({ ...values, translate: { ...values.translate, from: ends[0], to: ends[1] } });
      return;
    }
    if (action === "mark-angle") {
      const angle = markableAngle(building);
      if (angle) setFollows({ ...follows, angle });
      return;
    }
    if (action === "mark-ratio") {
      const ratio = markableRatio(building);
      if (ratio) setFollows({ ...follows, ratio });
      return;
    }
    const distances = markableDistances(building);
    if (distances.length > 0) setFollows({ ...follows, distances });
  }

  /**
   * What is still marked: a mark whose objects have been deleted is no mark at
   * all, the same rule the centre and the mirror already follow.
   */
  function livingMarks(): Marks {
    const there = (id: string) => objects.some((object) => object.id === id);
    return {
      angle: follows.angle && partsOfAngle(follows.angle).every(there) ? follows.angle : null,
      ratio: follows.ratio && partsOfRatio(follows.ratio).every(there) ? follows.ratio : null,
      distances: follows.distances.every(there) ? follows.distances : [],
    };
  }

  /** A click on the sheet while a dialog is open feeds the dialog. */
  function pick(id: string) {
    const hit = objects.find((object) => object.id === id);
    if (!hit) return;
    // The Calculator takes numbers off the sheet, which is quicker than
    // spelling their names and is how the reference app does it too.
    if (calculating) {
      if (isValue(hit)) setInsert(names.get(hit.id) ?? null);
      return;
    }
    // Reflect wants a straight object to mirror across; everything else wants
    // a point, so a click on the wrong kind of thing is left alone.
    if (markFromSheet(hit)) return;
    if (dialog === "reflect") {
      if (!isPoint(hit)) setMirror(id);
      return;
    }
    if (!isPoint(hit)) return;
    if (dialog === "iterate") {
      setTargets(targets.map((target, index) => (index === nextSeed ? id : target)));
      return;
    }
    if (dialog !== "translate" || values.translate.mode !== "marked") {
      setCentre(id);
      return;
    }
    const vector = values.translate;
    // First click is From, the next is To, a third starts again from From.
    const ends = vector.from === null || vector.to !== null ? { from: id, to: null } : { to: id };
    setValues({ ...values, translate: { ...vector, ...ends } });
  }

  function openIterate() {
    setSeeds([...selection]);
    setTargets(selection.map(() => null));
    setDialog("iterate");
  }

  function applyIterate() {
    if (orbit.length === 0) return;
    // The seeds stay selected: they are still what the orbit was built on.
    sketch.addObjects(orbit, selection);
    setDialog(null);
  }

  function openDialog(kind: TransformKind) {
    // A point picked before a delete is no point at all.
    const alive = (id: string | null) =>
      id && objects.some((object) => object.id === id) ? id : null;
    marking.current = [];
    setFollows(livingMarks());
    setCentre(alive(centre));
    setMirror(alive(mirror));
    setValues({
      ...values,
      translate: {
        ...values.translate,
        from: alive(values.translate.from),
        to: alive(values.translate.to),
      },
    });
    setDialog(kind);
  }

  function construct(action: MenuAction) {
    sketch.addObjects(wouldBuild(building, action));
  }

  function applyDialog() {
    if (!maker) return;
    sketch.addObjects(transformed(selection, maker, { objects, size: pointSize }));
    setDialog(null);
  }

  return {
    dialog,
    setDialog,
    transform,
    values,
    setValues,
    follows,
    centre,
    setCentre,
    mirror,
    setMirror,
    targets,
    depth,
    setDepth,
    maker,
    orbit,
    preview,
    marks,
    nextSeed,
    splitMerge,
    runSplitMerge,
    mark,
    livingMarks,
    pick,
    openIterate,
    applyIterate,
    openDialog,
    construct,
    applyDialog,
  };
}

/** The transform dialogs and their preview. */
export type Moves = ReturnType<typeof useTransforms>;
