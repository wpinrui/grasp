import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  type UIEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type WheelEvent,
} from "react";
import { insertAtCaret, linkHtml, plainText, withNames } from "../sketch/captions";
import { LABEL_REACH, type Labelling, labelAnchor, labelOff } from "../sketch/labelling";
import {
  anglesAt,
  angleWanted,
  armsAt,
  endsOf,
  fromSheetTerms,
  placesFor,
  quantitiesOf,
  readingOf,
  readingOfValue,
  sayQuantity,
} from "../sketch/measure";
import {
  ANGLE_RADIUS,
  alongPath,
  type CaptionAlign,
  centreOf,
  clipToRect,
  contentBounds,
  createAngleMark,
  createCaption,
  createCircle,
  createInterior,
  createPoint,
  createTick,
  distance,
  distanceToPath,
  endsById,
  familyOf,
  fillLook,
  isArc,
  isButton,
  isCaption,
  isCircle,
  isFunction,
  isInterior,
  isLine,
  isLocus,
  isMark,
  isMeasurement,
  isPoint,
  isRightAngle,
  isTable,
  isValue,
  isWriting,
  type LabelState,
  LEAST_ANGLE_RADIUS,
  type LineForm,
  type LocusShape,
  lineThrough,
  type MarkForm,
  markAlong,
  markReach,
  markShape,
  markStrokes,
  markSweep,
  movedBy,
  namesFor,
  objectAt,
  objectsTouching,
  type PanFrom,
  type PathGeometry,
  type PointSize,
  type Position,
  pannedView,
  panTravel,
  pathIn,
  pointOnPath,
  pointsOf,
  type Rect,
  radiusOf,
  rectBetween,
  type SketchCalculation,
  type SketchCaption,
  type SketchFunction,
  type SketchLine,
  type SketchLocus,
  type SketchMark,
  type SketchMeasurement,
  type SketchObject,
  type SketchParameter,
  type SketchPoint,
  type SketchWriting,
  settle,
  slackAt,
  spotOnPath,
  strokeLook,
  tangentOnPath,
  toSheet,
  union,
  type View,
} from "../sketch/model";
import { demotedUnder } from "../sketch/overlaps";
import { togglePick } from "../sketch/picking";
import { drawnAs } from "../sketch/text";
import type { Sketch } from "../sketch/useSketch";
import { type AngleChoice, AngleChoiceDialog } from "./AngleChoiceDialog";
import { ButtonBox } from "./ButtonBox";
import { CaptionBox } from "./CaptionBox";
import { guideOf } from "./canvas/guides";
import { Dimensions } from "./canvas/layers/Dimensions";
import { Fills } from "./canvas/layers/Fills";
import { Guides } from "./canvas/layers/Guides";
import { Holding } from "./canvas/layers/Holding";
import { Lit } from "./canvas/layers/Lit";
import { Paths } from "./canvas/layers/Paths";
import { Points } from "./canvas/layers/Points";
import { litWith } from "./canvas/lighting";
import { arcsBetween, type Marking, markUnder } from "./canvas/marks";
import {
  angleMarkOn,
  angleReadingSpot,
  angleWritten,
  type Measuring,
  pointUnder,
  readingAlready,
  readingBox,
  readingFrom,
  sameAngle,
} from "./canvas/readings";
import { SheetProvider } from "./canvas/SheetContext";
import { arcPath, arrowPoints, interiorShape } from "./canvas/shapes";
import {
  ANGLE_AIM,
  ANGLE_ROOM,
  CAPTION_WIDTH,
  clampScale,
  DRAG_THRESHOLD,
  DRAW_HOLD,
  DRAW_REACH,
  type Handle,
  hasPanel,
  LEAST_SPAN,
  MAX_SCALE,
  MIN_CAPTION_WIDTH,
  MIN_SCALE,
  overlaps,
  PAN_FINGERS,
  type Pending,
  SNAP_RING,
  type Snap,
  sameReading,
  snapKey,
  stopAbove,
  stopBelow,
  type Tracing,
  type Travel,
  WHEEL_ZOOM,
  type Written,
} from "./canvas/sheet";
import {
  type Aiming,
  aimAt,
  handleAt,
  heldMove,
  snapAt,
  spanOfLocus,
  travelOf,
} from "./canvas/steps";
import type { HiddenKinds } from "./HiddenPanel";
import { MarkPanel } from "./MarkPanel";
import { MeasurementBox } from "./MeasurementBox";
import { ReadingPanel } from "./ReadingPanel";
import type { Snapping } from "./SnapPanel";
import { TableBox } from "./TableBox";
import "./Canvas.css";

interface CanvasProps {
  activeTool: string;
  /**
   * Filled in with what Escape does to the sheet, so a control outside the
   * canvas can do the same. A phone has no Escape key to press.
   */
  cancelRef?: RefObject<() => void>;
  sketch: Sketch;
  pointSize: PointSize;
  /** Where the page is being looked at. It belongs to the page, not here. */
  view: View;
  onView: (view: View) => void;
  /** A dialog is open: a click feeds it a point and does nothing else. */
  picking: boolean;
  onPick: (id: string) => void;
  /** Which of segment, ray and line the straightedge is armed with. */
  lineForm: LineForm;
  /** Which of the three polygon tools is armed. */
  polygonKind: string;
  /** Ghosts of what an open dialog would make, lines and all. */
  preview: SketchObject[];
  /** Points a dialog is holding on to, each with the caption to draw by it. */
  marks: { id: string; label: string }[];
  /** A label was typed into: the name wanted for that object. */
  onRename: (id: string, name: string) => void;
  /** An object being pointed at somewhere else, lit up so it can be found. */
  spotlight: string | null;
  /** The Text tool clicked an object: show its label, or hide it again. */
  onToggleLabel: (id: string) => void;
  /**
   * The labels the Arrow has picked, which the palette is then set on. Several
   * can be picked at once, with Shift or Ctrl, and set together.
   */
  labelPick: string[];
  onLabelPick: (id: string | null, additive?: boolean) => void;
  /** Double-clicking a parameter or a calculation, which reopens what made it. */
  onEditValue: (id: string) => void;
  /** Pressing an action button, which does whatever it was made to do. */
  onPressButton: (id: string) => void;
  /** Double-clicking a table, which takes a row, and Shift, which gives one back. */
  onCaptureRow: (id: string) => void;
  onDropRow: (id: string) => void;
  /** Double-clicking a straight object with the Arrow, which marks it as the mirror. */
  onMarkMirror: (id: string) => void;
  /** The caption being typed into. It belongs to the window, not to the page. */
  editing: string | null;
  onEditing: (id: string | null) => void;
  /** Where the text palette reaches the caption being typed into. */
  editor: RefObject<HTMLDivElement | null>;
  /**
   * Whether the sheet can be zoomed, from Preferences. Off, the wheel does
   * nothing and the readout is not drawn: there is no state to show and no
   * control that would do anything.
   */
  zoomable: boolean;
  /** Counted up when the Text tool is double-clicked, which asks for a caption. */
  captionWanted: number;
  /**
   * How a caption comes out: what Preferences says a new one is set in, with
   * whatever the palette has armed the Text tool with over the top.
   */
  captionLook: { font: string; size: number; colour: string; align: CaptionAlign };
  /** How much sheet is on screen, which is what a new locus is cut down to. */
  onViewport: (size: { width: number; height: number }) => void;
  /** What a drawing tool holds itself to, from the Snap panel. */
  snapping: Snapping;
  /** What the Measure tool is armed with: a length, an area or an angle. */
  measureKind: string;
  /** What the Arrow is armed with: anything, or one kind of thing. */
  arrowKind: string;
  /** What the Marker is armed with: equal sides, parallel sides, or an angle. */
  markForm: string;
  /** The whole kinds being kept out of the way, from the Hidden panel. */
  hiddenKinds: HiddenKinds;
}

/** What a drag has hold of, and where each of those objects started. */
interface Held {
  ids: string[];
  from: Position[];
}

interface Grab {
  origin: Position;
  /** When the press went down, which is half of what tells a drag from a click. */
  pressed: number;
  /** What sat under the pointer when it went down, if anything. */
  hitId: string | null;
  moved: boolean;
  /** Where the objects being dragged started, so the move stays exact. */
  moving: Position[] | null;
  movingIds: string[];
  marquee: Rect | null;
  /** Set for a hand drag: the view and the pointer where the pan began. */
  pan: PanFrom | null;
  /** Set when the press took hold of a locus arrowhead. */
  handle: { handle: Handle; span: [number, number] } | null;
  /** Set when this press is what started the object being drawn. */
  started: boolean;
}

export function Canvas({
  activeTool,
  sketch,
  pointSize,
  view,
  onView,
  picking,
  onPick,
  preview,
  marks,
  lineForm,
  polygonKind,
  onViewport,
  onRename,
  onEditValue,
  onCaptureRow,
  onDropRow,
  onPressButton,
  onMarkMirror,
  snapping,
  measureKind,
  arrowKind,
  markForm,
  hiddenKinds,
  spotlight,
  onToggleLabel,
  labelPick,
  onLabelPick,
  editing,
  onEditing,
  editor,
  zoomable,
  captionWanted,
  captionLook,
  cancelRef,
}: CanvasProps) {
  const sheet = useRef<HTMLDivElement>(null);
  const horizontal = useRef<HTMLDivElement>(null);
  const vertical = useRef<HTMLDivElement>(null);
  const grab = useRef<Grab | null>(null);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  /** How far the drag in hand has moved what it has hold of, while it lasts. */
  const [travel, setTravel] = useState<Travel | null>(null);
  /** Screen pixels per sheet pixel. */
  const scale = view.scale;
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [pending, setPending] = useState<Pending | null>(null);
  const [tracing, setTracing] = useState<Tracing | null>(null);
  /**
   * Escape: drops a half-drawn line and the end its first click plotted, or
   * clears the selection when there is nothing half drawn.
   */
  const cancel = useRef(() => {});

  /**
   * Where each finger on the sheet is. One finger draws, exactly as a mouse
   * does; two pan, which is the only way the sheet moves on a touch screen,
   * there being no second button to drag with and no key to hold.
   */
  const fingers = useRef(new Map<number, Position>());

  /** The point between the fingers, which is what a two-finger pan follows. */
  function betweenFingers(): Position {
    return centreOf([...fingers.current.values()]);
  }

  /**
   * Let go of everything a press had begun, landing none of it. This is not
   * the same as letting go at the end of a gesture: nothing is recorded, the
   * half-drawn construction goes, and the sheet is left as it was before the
   * finger came down.
   */
  function dropGesture() {
    const dropped = grab.current;
    grab.current = null;
    setMarquee(null);
    setBoxing(null);
    setTravel(null);
    sketch.cancelGesture();
    setPending(null);
    setTracing(null);
    // The angle tools hold a corner between the press and the release. Left
    // set, it stays drawn on the sheet and a later tap on nothing at all can
    // land a mark on it.
    setArming(null);
    armFrom.current = null;
    // A marquee selects as it sweeps, so one abandoned leaves nothing selected
    // rather than whatever it had got as far as.
    if (tool === "arrow" && dropped?.marquee) sketch.select([]);
  }

  /** Take the sheet as far as a pan has carried it, from wherever it began. */
  function panTo(from: PanFrom, at: Position) {
    if (panTravel(from, at) >= DRAG_THRESHOLD) panMoved.current = true;
    onView({ ...viewNow.current, ...pannedView(from, at, scale) });
  }

  /** What a plotting tool would land on, lit up while the pointer is over it. */
  const [snap, setSnap] = useState<Snap | null>(null);
  /** The label being typed into, and what has been typed so far. */
  const [naming, setNaming] = useState<{ id: string; text: string } | null>(null);
  /** A label being dragged: where it started, and where the pointer did. */
  const dragged = useRef<{ id: string; off: Position; from: Position } | null>(null);
  /** What a drag that began inside a caption or a measurement has hold of. */
  const written = useRef<Held | null>(null);
  /** The box the Text tool is dragging out for a caption that is not made yet. */
  const [boxing, setBoxing] = useState<Rect | null>(null);
  /**
   * The angle mark being dragged out: the corner the press landed on, and where
   * the drag has reached. The way it points out of the corner is which of the
   * angles there is being asked for, the reflex one included.
   */
  const [arming, setArming] = useState<{ corner: string; start: Position; at: Position } | null>(
    null,
  );
  /** The mark whose panel is open, or null with no panel showing. */
  const [panel, setPanel] = useState<string | null>(null);
  /** The reading whose panel is open, which only a length ever has. */
  const [readingPanel, setReadingPanel] = useState<string | null>(null);
  /**
   * Which angle at a corner was meant. A corner with more than two sides
   * running out of it makes more than one angle, and a click on the point says
   * only where, so it is asked rather than guessed.
   */
  const [choosing, setChoosing] = useState<{
    corner: string;
    way: "mark" | "read";
    /** Where the click that asked landed, so the dialog comes up beside it. */
    spot: { x: number; y: number };
  } | null>(null);
  /** The angle a row of that dialog is pointing at, drawn on the sheet while it is. */
  const [showingArms, setShowingArms] = useState<[string, string] | null>(null);
  /**
   * The corner an angle tool is resting on. One angle there previews as itself;
   * more than one previews as the whole turn, since which of them a click would
   * ask for is exactly what has not been said yet.
   */
  const [overCorner, setOverCorner] = useState<string | null>(null);
  /**
   * The side an angle gesture was pressed on. Released on another side that
   * shares an end with it, the two name the angle between them and nothing has
   * to be chosen.
   */
  const armFrom = useRef<string | null>(null);
  /** The midpoint a marking tool would snap to, lit while the pointer is near. */
  const [middle, setMiddle] = useState<Position | null>(null);
  /**
   * What the last mark of each kind was left as, so the next one comes out the
   * same rather than starting from one stroke every time. `way` is the way the
   * last arrowheads pointed, in sheet coordinates, so a second pair of parallel
   * sides is marked the same way round as the first without being told.
   */
  const lastMark = useRef<{
    equal: number;
    parallel: number;
    angle: number;
    way: Position | null;
    radius: number;
  }>({ equal: 1, parallel: 1, angle: 1, way: null, radius: ANGLE_RADIUS });
  /**
   * What the Measure tool would write from where the pointer is, drawn as a
   * ghost so the number can be seen before it is asked for. Null over anything
   * the armed measure cannot be taken from.
   */
  const [previewReading, setPreviewReading] = useState<Written | null>(null);
  /**
   * The reading a click would go to rather than write, lit where it sits. Set
   * instead of a ghost, since there is no new number to show.
   */
  const [previewHeld, setPreviewHeld] = useState<string | null>(null);
  /** Whether the Text tool is over something it could put a label on. */
  const [overNamed, setOverNamed] = useState(false);
  /** An object a Hot Text link is being pointed at, lit up where it sits. */
  const [lit, setLit] = useState<string | null>(null);
  /** What a reading under the pointer is taken from, lit up where it sits. */
  const [litReading, setLitReading] = useState<string[]>([]);
  /** What the Arrow is over and would pick up, lit while the pointer is on it. */
  const [under, setUnder] = useState<string | null>(null);
  /**
   * How much room each caption and each measurement takes on screen, measured
   * where it is drawn. Writing is not geometry, so this is the only thing that
   * says whether a marquee has caught one.
   */
  const boxes = useRef(new Map<string, { width: number; height: number }>());
  /** Counted up whenever one of them changes size, so the sheet is drawn again. */
  const [, setMeasured] = useState(0);
  /** Set once a right-button pan has gone somewhere, so it is not a click. */
  const panMoved = useRef(false);
  /**
   * The scroll positions this component last put on the scrollbars, read back
   * after writing so they are the rounded and clamped numbers the browser
   * settled on. A scroll event reporting one of them is this component's own
   * write echoing back, not the user moving anything, and moving the view on it
   * would send the sheet drifting.
   */
  const wrote = useRef({ x: 0, y: 0 });
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);
  const { objects: everything, selection } = sketch.state;
  // A hidden object still holds the figure together, so the geometry is worked
  // out from all of them. Only these are drawn, picked, snapped to or caught.
  //
  // Two ways of being out of the way, and either is enough: hidden as an object
  // in its own right, or one of the kinds being kept away wholesale. Neither
  // knows about the other, so putting every marking away and bringing them back
  // leaves whatever was hidden one at a time exactly as it was.
  const objects = everything.filter(
    (object) =>
      object.hidden !== true &&
      !(hiddenKinds.marks && isMark(object)) &&
      !(hiddenKinds.text && isWriting(object)),
  );
  // Where every line runs, worked out once for drawing, picking and marquees.
  const settled = settle(everything).settled;
  // Space pans whatever tool is up, and hands it back on release. Panning has
  // no tool of its own: space and the right button are how the sheet is moved.
  const tool = spaceHeld ? "hand" : activeTool;
  /** The tools that draw an object between two clicks. */
  const drawing = tool === "straightedge" || tool === "compass";
  /**
   * What the Arrow will pick up. Armed with a kind, it passes over everything
   * else: a marquee catches only that kind, a click lands only on that kind,
   * and what it does not pick up it does not move either.
   */
  function arrowTakes(object: SketchObject): boolean {
    switch (arrowKind) {
      case "points":
        return isPoint(object);
      case "paths":
        // Everything a point can be put on and slide along, and the locus a
        // point draws, which is the same kind of curve by another name.
        return isLine(object) || isCircle(object) || isArc(object) || isLocus(object);
      case "marks":
        return isMark(object);
      case "text":
        return isWriting(object);
      default:
        return true;
    }
  }
  /** The objects the Arrow as armed can land on. */
  const pickable = arrowKind === "all" ? objects : objects.filter(arrowTakes);
  /** Whether writing is the Arrow's to carry, as it is armed. */
  const takesWriting = arrowKind === "all" || arrowKind === "text";

  /** The Measure tool, and what it is armed with, or null when it is not up. */
  const measuring = tool === "measure" ? measureKind : null;
  /** What the Marker would mark, or null while it is not the tool that is up. */
  const marking = tool === "marker" ? (markForm as MarkForm) : null;
  /** The tools that put a point down, and so say what a click would land on. */
  const plotting = drawing || tool === "point" || tool === "polygon";
  // The Text tool says what a click would do before it is made: over a thing
  // that can be named it is the hand that shows and hides labels, and over bare
  // sheet it is the box a caption would be dragged out of. The other pointers
  // belong to the label, the caption and its grip, which carry their own.
  const cursor = tool === "text" && overNamed ? "text-label" : tool;

  const onScreen = {
    x: view.x,
    y: view.y,
    width: viewport.width / scale,
    height: viewport.height / scale,
  };
  /** Where the sketch opens. It is home, and is never scrolled away from. */
  const origin = { x: 0, y: 0, width: viewport.width, height: viewport.height };
  const drawn = contentBounds(objects, scale);
  /**
   * What the scrollbars run over: the sheet you start on, the drawing, and
   * whatever is on screen. Pan out into the blank and it grows to keep up;
   * scroll away from blank that was never drawn on and it is discarded, because
   * only the view was holding it.
   */
  const area = union(drawn ? union(drawn, origin) : origin, onScreen);

  // The scroll and wheel handlers fire outside the render that made them, so
  // they read these from refs rather than a closure that has gone stale.
  const areaNow = useRef(area);
  areaNow.current = area;
  const viewNow = useRef(view);
  viewNow.current = view;
  const scaleNow = useRef(scale);
  scaleNow.current = scale;

  useLayoutEffect(() => {
    const element = sheet.current;
    if (!element) return;
    // Rounded, so the area the scrollbars run over lines up with the whole
    // pixels the scroll position is reported in.
    const observer = new ResizeObserver(([entry]) => {
      const size = {
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      };
      setViewport(size);
      onViewport(size);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onViewport]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Anything being typed into is taking the keys, Escape included: that one
      // closes what is being typed rather than the selection. Space is the one
      // that bites hardest, since the sheet holds it down to pan.
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable === true;
      if (typing) return;
      if (event.key === "Escape") cancel.current();
      if (event.key === "Shift") setShiftHeld(true);
      if (event.code !== "Space" || event.repeat) return;
      setSpaceHeld(true);
      event.preventDefault();
    }
    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === "Shift") setShiftHeld(false);
      if (event.code === "Space") setSpaceHeld(false);
    }
    // A window that loses focus never sees the keys come back up.
    function handleBlur() {
      setSpaceHeld(false);
      setShiftHeld(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // Double-clicking the Text tool asks for a caption without dragging one out,
  // so it lands in the middle of what is on screen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the ask is the trigger
  useEffect(() => {
    if (captionWanted === 0) return;
    makeCaption(
      {
        x: viewNow.current.x + viewport.width / 2 / scaleNow.current,
        y: viewNow.current.y + viewport.height / 2 / scaleNow.current,
      },
      CAPTION_WIDTH,
    );
  }, [captionWanted]);

  // Switching tools drops whatever the straightedge was halfway through.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the tool changing is the whole point
  useEffect(() => {
    sketch.cancelGesture();
    setPending(null);
    setTracing(null);
    setSnap(null);
    setBoxing(null);
    setArming(null);
    // A panel belongs to the tool that opened it, so it goes with the tool.
    setPanel(null);
    setReadingPanel(null);
    setMiddle(null);
  }, [activeTool, sketch.cancelGesture]);

  // Every render, because the area shifts under the view as well as with it.
  useLayoutEffect(() => {
    const across = horizontal.current;
    const down = vertical.current;
    if (across) {
      across.scrollLeft = (view.x - area.x) * scale;
      wrote.current.x = across.scrollLeft;
    }
    if (down) {
      down.scrollTop = (view.y - area.y) * scale;
      wrote.current.y = down.scrollTop;
    }
  });

  /**
   * Where the scrollbar is now, or null when it is only echoing back what this
   * component wrote. Measured against the write rather than against where the
   * view is, because the two part company: the area moves under the view as
   * the sheet is panned, so a scroll event that arrives a frame or two late
   * carries a number that is right for the write it came from and wrong for
   * the view by then. Reading those as the user scrolling is what set the
   * sheet drifting after a pan was released with the mouse still moving.
   */
  function scrolledTo(at: number, axis: "x" | "y"): number | null {
    if (Math.abs(at - wrote.current[axis]) < 0.5) return null;
    wrote.current[axis] = at;
    return at;
  }

  function handleScrollX(event: UIEvent<HTMLDivElement>) {
    const at = scrolledTo(event.currentTarget.scrollLeft, "x");
    if (at === null) return;
    onView({ ...viewNow.current, x: areaNow.current.x + at / scaleNow.current });
  }

  function handleScrollY(event: UIEvent<HTMLDivElement>) {
    const at = scrolledTo(event.currentTarget.scrollTop, "y");
    if (at === null) return;
    onView({ ...viewNow.current, y: areaNow.current.y + at / scaleNow.current });
  }

  /** Where in the sheet element a pointer is, in screen pixels. */
  function screenOf(event: { clientX: number; clientY: number }): Position | null {
    const bounds = sheet.current?.getBoundingClientRect();
    return bounds ? { x: event.clientX - bounds.left, y: event.clientY - bounds.top } : null;
  }

  function positionOf(
    event: PointerEvent<HTMLDivElement> | MouseEvent<HTMLDivElement>,
  ): Position | null {
    const bounds = sheet.current?.getBoundingClientRect();
    return bounds ? toSheet(bounds, event, { view, scale }) : null;
  }

  /** Zoom, holding the sheet still under one point of the canvas. */
  function zoomAround(next: number, at: Position) {
    const scaled = clampScale(next);
    const was = scaleNow.current;
    const held = { x: viewNow.current.x + at.x / was, y: viewNow.current.y + at.y / was };
    onView({ x: held.x - at.x / scaled, y: held.y - at.y / scaled, scale: scaled });
  }

  /** Minus, plus and the readout all hold the middle of the canvas still. */
  function zoomTo(next: number) {
    zoomAround(next, { x: viewport.width / 2, y: viewport.height / 2 });
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!zoomable) return;
    const at = screenOf(event);
    if (!at) return;
    zoomAround(scaleNow.current * Math.exp(-event.deltaY * WHEEL_ZOOM), at);
  }

  /**
   * What a drag on these objects actually moves, and where each of them starts,
   * or null when there is nothing in them that can be moved.
   */
  function whatMoves(carried: string[], objects: SketchObject[]): Held | null {
    // A line has no place of its own, so dragging one carries its two ends. A
    // point that was constructed carries what it was built on instead, so it
    // moves like anything else and takes its whole configuration with it.
    const wanted = new Set<string>();
    const written: SketchWriting[] = [];
    for (const id of carried) {
      const object = objects.find((candidate) => candidate.id === id);
      if (!object) continue;
      // Writing sits where it was put, and what it quotes or reads is not what
      // holds it there: it travels with the drag, and the objects it names stay
      // put unless they were selected in their own right.
      if (isWriting(object)) {
        written.push(object);
        continue;
      }
      // Only a point has a place of its own. Everything else is dragged by
      // whatever holds it: a line by its ends, a circle by its centre and its
      // radius point, a fill by its corners, and so on down.
      if (isPoint(object)) wanted.add(object.id);
      else for (const parent of familyOf(object) ?? []) wanted.add(parent);
    }
    const moving = new Set(movedBy(objects, [...wanted]));
    const dragged: (SketchPoint | SketchWriting)[] = [
      ...pointsOf(objects).filter((point) => moving.has(point.id)),
      ...written,
    ];
    if (dragged.length === 0) return null;
    return {
      ids: dragged.map((object) => object.id),
      from: dragged.map((object) => ({ x: object.x, y: object.y })),
    };
  }

  /**
   * Take hold of what a drag will move. One object already in the selection
   * carries the whole selection with it; one outside it takes the selection
   * over first.
   */
  function takeHold(hitId: string): Held | null {
    const before = sketch.read();
    const carried = before.selection.includes(hitId) ? before.selection : [hitId];
    const held = whatMoves(carried, before.objects);
    if (!held) return null;
    sketch.beginGesture();
    if (carried !== before.selection) sketch.updateGesture({ ...before, selection: carried });
    return held;
  }

  function startMove(state: Grab, hitId: string) {
    const held = takeHold(hitId);
    if (!held) return;
    state.movingIds = held.ids;
    state.moving = held.from;
  }

  /** Put everything a drag has hold of as far along as the pointer has come. */
  function moveBy(held: Held, dx: number, dy: number) {
    const before = sketch.read();
    const geometry = settle(before.objects).settled;
    sketch.updateGesture({
      ...before,
      objects: before.objects.map((object) => {
        const index = held.ids.indexOf(object.id);
        if (index === -1) return object;
        const start = held.from[index];
        const to = { x: start.x + dx, y: start.y + dy };
        const from = isPoint(object) ? object.from : undefined;
        if (from?.kind === "on") {
          // A point on a path slides along it instead of going where the
          // pointer went, and it rides along untouched when its path is
          // being dragged too.
          const path = pathIn(geometry, from.path);
          if (!path || held.ids.includes(from.path)) return object;
          return { ...object, from: { ...from, at: alongPath(path, to) } };
        }
        return { ...object, x: to.x, y: to.y };
      }),
    });
  }

  /** Put down the first of the two points a drawing tool needs. */
  function startDrawing(found: Snap | null, spot: Position) {
    sketch.beginGesture();
    let startId: string;
    if (found?.kind === "point") startId = found.ids[0];
    else {
      const point = endAt(found, spot);
      const before = sketch.read();
      sketch.updateGesture({ ...before, objects: [...before.objects, point] });
      startId = point.id;
    }
    setPending({ start: spot, startId, at: spot, tool });
  }

  /** Land the second point, and the object the two of them make. */
  function finishDrawing(found: Snap | null, spot: Position) {
    if (!pending) return;
    // Back on the point it started from, so there is nothing worth making and
    // the point that click plotted goes back with it.
    const onPoint = found?.kind === "point" ? found.ids[0] : null;
    if (onPoint ? onPoint === pending.startId : distance(spot, pending.start) < slack) {
      cancel.current();
      return;
    }
    const before = sketch.read();
    const made: SketchObject[] = [];
    let endId: string;
    if (onPoint) endId = onPoint;
    else {
      const point = endAt(found, spot);
      made.push(point);
      endId = point.id;
    }
    const drawn =
      pending.tool === "compass"
        ? createCircle({ kind: "through", centre: pending.startId, edge: endId })
        : lineThrough(lineForm, [pending.startId, endId]);
    made.push(drawn);
    // Drawn along something already there, the one underneath steps down a
    // style so the two can be told apart.
    sketch.updateGesture({
      objects: [...demotedUnder(before.objects, made), ...made],
      selection: [drawn.id],
    });
    sketch.endGesture();
    setPending(null);
  }

  /**
   * A corner of the polygon being traced out. The first click opens the
   * gesture, so the whole shape, its corners included, is one undo step.
   */
  function traceCorner(found: Snap | null, spot: Position) {
    if (!tracing) sketch.beginGesture();
    const before = sketch.read();
    let id: string;
    if (found?.kind === "point") id = found.ids[0];
    else {
      const point = endAt(found, spot);
      sketch.updateGesture({ ...before, objects: [...before.objects, point] });
      id = point.id;
    }
    setTracing({
      ids: [...(tracing?.ids ?? []), id],
      spots: [...(tracing?.spots ?? []), spot],
      at: spot,
    });
  }

  /**
   * Close the polygon and build it: the fill, its edges, or both, whichever
   * the tool is armed with. The edges close back to the first corner, so a
   * polygon is a ring however it was clicked out.
   */
  function closePolygon() {
    if (!tracing || tracing.ids.length < 3) return;
    const before = sketch.read();
    const corners = tracing.ids;
    const made: SketchObject[] = [];
    if (polygonKind !== "edges") made.push(createInterior(corners));
    if (polygonKind !== "interior") {
      made.push(
        ...corners.map((corner, index) =>
          lineThrough("segment", [corner, corners[(index + 1) % corners.length]]),
        ),
      );
    }
    sketch.updateGesture({
      objects: [...before.objects, ...made],
      selection: made.map((object) => object.id),
    });
    sketch.endGesture();
    setTracing(null);
  }

  /**
   * Where a polygon click goes: another corner, or the end of the shape. It
   * ends on the corner it started from, which closes it, or on the corner just
   * laid down, which is what a double-click on the last one comes through as.
   */
  function polygonClick(found: Snap | null, spot: Position) {
    const onPoint = found?.kind === "point" ? found.ids[0] : null;
    if (tracing && onPoint && tracing.ids.includes(onPoint)) {
      const first = tracing.ids[0];
      const last = tracing.ids[tracing.ids.length - 1];
      // Three corners is the least a polygon can be made of, so before that a
      // click back on one of them has nothing to close and nothing to add: the
      // same corner twice is not a corner.
      if (tracing.ids.length >= 3 && (onPoint === first || onPoint === last)) closePolygon();
      return;
    }
    traceCorner(found, spot);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (fingers.current.size >= PAN_FINGERS) {
        // Whatever the first finger had begun is dropped rather than landed:
        // the press that added the second finger changed what was being asked
        // for, and half a construction is not what was wanted.
        dropGesture();
        const at = betweenFingers();
        grab.current = {
          origin: positionOf(event) ?? { x: 0, y: 0 },
          pressed: Date.now(),
          hitId: null,
          moved: false,
          moving: null,
          movingIds: [],
          marquee: null,
          pan: { view, clientX: at.x, clientY: at.y },
          handle: null,
          started: false,
        };
        return;
      }
    }
    // The right button pans from anywhere, whatever tool is up and whether or
    // not a dialog is picking. A press that never moves is a right-click still,
    // and the context menu handler cancels on it.
    if (event.button === 2) {
      event.currentTarget.setPointerCapture(event.pointerId);
      grab.current = {
        origin: positionOf(event) ?? { x: 0, y: 0 },
        pressed: Date.now(),
        hitId: null,
        moved: false,
        moving: null,
        movingIds: [],
        marquee: null,
        pan: { view, clientX: event.clientX, clientY: event.clientY },
        handle: null,
        started: false,
      };
      return;
    }
    if (event.button !== 0) return;
    onLabelPick(null);
    const at = positionOf(event);
    if (!at) return;
    // A caption is open: clicking an object drops a link to it into what is
    // being written, and clicking bare sheet finishes the caption. The default
    // is stopped so the caret is not lost on the way.
    if (editing && !picking) {
      const hit = objectAt(at, { objects: objects, scale, settled });
      if (hit && hit.id !== editing) {
        event.preventDefault();
        insertLink(hit.id);
        return;
      }
      closeCaption(null);
    }
    // A press on bare sheet puts away whatever panel is open, whatever tool is
    // up and whichever object the panel is about. A press on a panel itself
    // never reaches here: the panel keeps it.
    if (!objectAt(at, { objects: objects, scale, settled })) {
      setPanel(null);
      setReadingPanel(null);
    }
    // An arrowhead is taken hold of before anything under it is picked.
    const held = tool === "arrow" && !picking ? handleAt(at, aimingNow()) : null;
    // With a dialog open the sheet is only good for handing it a point.
    if (picking) {
      // Whatever is under the pointer goes to the dialog, which knows whether
      // it wanted a point or a straight object and ignores the rest.
      const hit = objectAt(at, { objects: objects, scale, settled });
      if (hit) onPick(hit.id);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    // A marking tool takes hold of a mark that is already there, so a drag
    // slides it along and a click opens its panel. On a bare side, the Angle
    // tool is dragged from one side of the angle to the other.
    if (marking) {
      const found = markUnder(at, { objects, settled, scale });
      // A tool only takes hold of the marks it deals in. Anything else under
      // the pointer is left alone and the press goes to the figure beneath.
      const caught =
        found && (ownMark(found) || (marking !== "angle" && "path" in found)) ? found : null;
      // Nothing is taken hold of: a marking tool does not move a mark, so
      // there is no gesture for it to open.
      const riding = false;
      grab.current = {
        origin: at,
        pressed: Date.now(),
        hitId: caught?.id ?? null,
        moved: false,
        moving: null,
        movingIds: [],
        marquee: null,
        pan: null,
        handle: null,
        started: riding,
      };
      if (riding) sketch.beginGesture();
      if (marking === "angle" && !caught) {
        // An angle mark is dragged out of the vertex. One that is already there
        // is taken hold of instead, and its drag sets how far its arcs stand.
        const corner = pointUnder(at, measuringNow());
        if (corner) setArming({ corner: corner.id, start: at, at });
        // Off the vertex, the press is on one side of an angle and the drag
        // goes to the other.
        else armFrom.current = pathUnder(at, true)?.id ?? null;
      }
      return;
    }
    if (tool === "polygon") {
      const aim = aimAt(at, aimingNow());
      polygonClick(aim.found, aim.spot);
      return;
    }
    // A drawing tool puts its first point down on the press, so it can be
    // dragged out to the second and released there, or left for a second click.
    if (drawing) {
      const aim = aimAt(at, aimingNow());
      const fresh = !pending;
      if (fresh) startDrawing(aim.found, aim.spot);
      grab.current = {
        origin: at,
        pressed: Date.now(),
        hitId: null,
        moved: false,
        moving: null,
        movingIds: [],
        marquee: null,
        pan: null,
        handle: null,
        started: fresh,
      };
      return;
    }
    // The Text tool needs to know too: over an object it is the hand that shows
    // and hides labels, and only over bare sheet does it drag out a caption.
    const hit =
      (tool === "arrow" || tool === "text") && !held
        ? objectAt(at, { objects: tool === "arrow" ? pickable : objects, scale, settled })
        : null;
    // Pressing empty canvas clears at once, it does not wait for the release.
    // That is why a marquee, which starts from empty canvas, replaces the
    // selection rather than adding to it. An arrowhead is not empty canvas.
    if (tool === "arrow" && !hit && !held) sketch.select([]);
    // The protractor is dragged from one side of an angle to the other, the
    // way the Angle marker is.
    if (measuring === "angle") armFrom.current = pathUnder(at, true)?.id ?? null;
    grab.current = {
      origin: at,
      pressed: Date.now(),
      hitId: hit?.id ?? null,
      moved: false,
      moving: null,
      movingIds: [],
      marquee: null,
      pan: tool === "hand" ? { view, clientX: event.clientX, clientY: event.clientY } : null,
      handle: held
        ? { handle: held, span: [...spanOfLocus(held.locus, aimingNow())] as [number, number] }
        : null,
      started: false,
    };
    if (held) sketch.beginGesture();
  }

  /** How a length is drawn out, and whether it carries its dotted lines. */
  function setBounds(id: string, bounds: "broken" | "full" | undefined) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        object.id === id && isMeasurement(object) ? { ...object, bounds } : object,
      ),
    });
  }

  /**
   * An angle read the long way round. The mark on that angle goes round with
   * it: the arcs are what say which of the angles at that corner the number is
   * about, so they cannot say one thing while the number says the other.
   */
  /**
   * How far one reading is written out. It is pinned on that reading, so it
   * keeps what it was given while the rest of the sheet follows Preferences.
   */
  function setPlaces(id: string, places: number) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        object.id === id && isMeasurement(object) ? { ...object, places } : object,
      ),
    });
  }

  function setReadingReflex(id: string, reflex: boolean) {
    const before = sketch.read();
    const reading = before.objects.find((object) => object.id === id);
    if (!reading || !isMeasurement(reading)) return;
    const [one, corner, other] = reading.of;
    // Where this is the only number on that angle, the mark goes round with it.
    // Where both sizes of the angle are written, the arcs cannot agree with
    // both, so they stay where they are.
    const alone =
      before.objects.filter(
        (object) =>
          isMeasurement(object) && object.measure === "angle" && sameAngle(object.of, reading.of),
      ).length === 1;
    sketch.commit({
      ...before,
      objects: before.objects.map((object) => {
        if (object.id === id) return { ...reading, reflex };
        if (
          alone &&
          isMark(object) &&
          !("path" in object) &&
          object.corner === corner &&
          object.arms.every((arm) => arm === one || arm === other)
        ) {
          return { ...object, reflex };
        }
        return object;
      }),
    });
  }

  function setLeaders(id: string, leaders: boolean) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) =>
        object.id === id && isMeasurement(object) ? { ...object, leaders } : object,
      ),
    });
  }

  /** The arcs the angle being dragged out would land as, drawn while it is. */
  function armingArcs(): string[] {
    // Nothing is aimed at yet, so nothing is drawn: arcs here would show a
    // wedge the release is not going to take.
    if (!arming || distance(arming.at, arming.start) < ANGLE_AIM / scale) return [];
    const corner = settled.points.get(arming.corner);
    const wanted = angleAsked(arming.corner, arming.at);
    if (!corner || !wanted) return [];
    const ends = wanted.arms.map((id) => settled.points.get(id));
    if (ends.some((end) => end === undefined)) return [];
    const [one, other] = ends as SketchPoint[];
    const from = Math.atan2(one.y - corner.y, one.x - corner.x);
    const to = Math.atan2(other.y - corner.y, other.x - corner.x);
    const sweep = markSweep(from, to, wanted.reflex);
    return markStrokes(
      {
        form: "angle",
        at: { x: corner.x, y: corner.y },
        from,
        sweep,
        strokes: lastMark.current.angle,
        radius: clearOfCorner(arming.corner),
        // A right angle previews as the square it will land as.
        square: isRightAngle(sweep),
      },
      scale,
    );
  }

  /** The angle a drag out of a corner is asking for, or null when there is none. */
  function angleAsked(corner: string, at: Position) {
    const spot = settled.points.get(corner);
    if (!spot) return null;
    const bearing = Math.atan2(at.y - spot.y, at.x - spot.x);
    return angleWanted(armsAt(corner, objects, settled), bearing);
  }

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

  /** What the panel does: the strokes, the direction, the form and the bin. */
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

  function flipReflex(id: string) {
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
      ? angleReadingSpot({ reading: alone, mark: turned, reflex }, measuringNow())
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

  /** The path under the pointer, which is what a tick rides. */
  function pathUnder(at: Position, straightOnly = false): SketchObject | null {
    for (let index = objects.length - 1; index >= 0; index -= 1) {
      const object = objects[index];
      if (straightOnly ? !isLine(object) : !isLine(object) && !isCircle(object) && !isArc(object)) {
        continue;
      }
      const along = pathIn(settled, object.id);
      if (along && distanceToPath(along, at) <= slackAt(scale)) return object;
    }
    return null;
  }

  /** A new mark lands on the page without disturbing what is selected. */
  /**
   * The point two straight objects meet at, and the far end of each. Null where
   * they do not meet, or meet twice, since neither says an angle.
   */
  function cornerBetween(one: string, other: string) {
    const first = objects.find((object) => object.id === one);
    const second = objects.find((object) => object.id === other);
    if (!first || !second) return null;
    const a = endsOf(first);
    const b = endsOf(second);
    if (!a || !b) return null;
    const shared = a.filter((end) => b.includes(end));
    if (shared.length !== 1) return null;
    const corner = shared[0];
    return {
      corner,
      arms: [a[0] === corner ? a[1] : a[0], b[0] === corner ? b[1] : b[0]] as [string, string],
    };
  }

  /** Mark one angle by the two arms it runs between, or open the mark already on it. */
  function markAngle(corner: string, arms: [string, string], reflex = false) {
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
    const mark = angleMarkOn({ corner, arms, reflex }, null, measuringNow());
    addMark(mark);
    setPanel(mark.id);
  }

  /** Write the number for one angle, by the two arms it runs between. */
  function readAngle(corner: string, arms: [string, string]) {
    const written = angleWritten({ corner, arms, hit: null, named: true }, measuringNow());
    if (!written) return;
    const already = readingAlready(written, measuringNow());
    if (already) {
      sketch.select([already.id]);
      setReadingPanel(hasPanel(written.reading) ? already.id : null);
      return;
    }
    setReadingPanel(hasPanel(written.reading) ? written.reading.id : null);
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: [...before.objects, ...(written.mark ? [written.mark] : []), written.reading],
    });
  }

  /** How big a reading came out, or how big it is going to come out. */
  function boxOf(reading: SketchMeasurement): { width: number; height: number } {
    return boxes.current.get(reading.id) ?? readingBox(reading, measuringNow());
  }

  /** Where the figure settled, the zoom, and what a new mark is set to. */
  function markingNow(): Marking {
    return { settled, scale, lastMark: lastMark.current };
  }

  /**
   * The figure as a click is aimed at it. A drag reads the objects as they
   * stand rather than as this render left them, so those come through a reader
   * rather than as a list.
   */
  function aimingNow(): Aiming {
    return {
      objects,
      settled,
      scale,
      slack,
      snapping,
      handles,
      pending,
      tracing,
      shiftHeld,
      present: () => sketch.read().objects,
    };
  }

  /**
   * The figure as the readings read it. Built where it is asked for rather than
   * held, since every part of it is read off this render anyway.
   */
  function measuringNow(): Measuring {
    return {
      objects,
      settled,
      scale,
      measure: measuring,
      saying: (made) => readingFor(made).value,
      lastMark: lastMark.current,
      clearOf: clearOfCorner,
    };
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

  function addMark(mark: SketchMark) {
    const before = sketch.read();
    sketch.commit({ ...before, objects: [...before.objects, mark] });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" && fingers.current.has(event.pointerId)) {
      fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    // A marking tool lights the midpoint of a segment it would snap to.
    if (marking && !picking && !grab.current) {
      const over = positionOf(event);
      const path = over && marking !== "angle" ? pathUnder(over) : null;
      const along = path ? pathIn(settled, path.id) : null;
      const snapped =
        along && over && markAlong(along, over, scale) === 0.5 ? spotOnPath(along, 0.5) : null;
      if (
        (snapped === null) !== (middle === null) ||
        (snapped && middle && snapped.x !== middle.x)
      ) {
        setMiddle(snapped);
      }
    }
    // The Arrow says what it would pick up before it is pressed, which is what
    // tells one armed for points from one armed for markings without a click.
    if (tool === "arrow" && !picking && !grab.current) {
      const over = positionOf(event);
      const found = over ? objectAt(over, { objects: pickable, scale, settled }) : null;
      if ((found?.id ?? null) !== under) setUnder(found?.id ?? null);
    } else if (under !== null) {
      setUnder(null);
    }
    if (tool === "text" && !picking && !grab.current) {
      const over = positionOf(event);
      const found = over ? objectAt(over, { objects: objects, scale, settled }) : null;
      const named = found !== null && names.has(found.id);
      if (named !== overNamed) setOverNamed(named);
    }

    // Both angle tools say what a corner holds before it is pressed. The
    // protractor's own preview below cannot: it has to know which angle it
    // would read, and at a corner with several that is the question.
    if ((marking === "angle" || measuring === "angle") && !picking && !grab.current) {
      const over = positionOf(event);
      const spot = over ? pointUnder(over, measuringNow()) : null;
      const corner = spot && anglesAt(spot.id, objects, settled).length > 0 ? spot.id : null;
      if (corner !== overCorner) setOverCorner(corner);
    } else if (overCorner !== null) {
      setOverCorner(null);
    }

    // The Measure tool says what it would take before it is clicked: the number
    // it would write, where it would write it, and the marking it would need to
    // put on the angle first.
    if (measuring && !picking && !grab.current) {
      const over = positionOf(event);
      const would = over ? readingFrom(over, measuringNow()) : null;
      const already = would ? readingAlready(would, measuringNow()) : null;
      // What is already there is lit rather than ghosted over: a click will go
      // to it, and drawing a second copy of it on top would say otherwise.
      setPreviewReading((was) =>
        sameReading(was, already ? null : would) ? was : already ? null : would,
      );
      setPreviewHeld(already?.id ?? null);
    } else if (previewReading || previewHeld) {
      setPreviewReading(null);
      setPreviewHeld(null);
    }

    // A plotting tool says what a click would land on: the point, the straight
    // object or the crossing under the pointer lights up, and a half-drawn line
    // takes its loose end there. Not while the sheet is being panned, which
    // every tool allows and which the move belongs to.
    if (plotting && !picking && !grab.current?.pan) {
      const at = positionOf(event);
      if (!at) return;
      const aim = aimAt(at, aimingNow());
      if (snapKey(aim.found) !== snapKey(snap)) setSnap(aim.found);
      if (pending) setPending({ ...pending, at: aim.spot });
      if (tracing) setTracing({ ...tracing, at: aim.spot });
      return;
    }
    const state = grab.current;
    if (!state) return;

    // The sheet follows the hand, so the view goes the other way. Measured off
    // the pointer, because the sheet is moving underneath it.
    if (state.pan) {
      // Two fingers are followed by the point between them, so the sheet does
      // not lurch when one of them moves more than the other.
      const at =
        fingers.current.size >= PAN_FINGERS
          ? betweenFingers()
          : { x: event.clientX, y: event.clientY };
      panTo(state.pan, at);
      return;
    }

    const at = positionOf(event);
    if (!at) return;

    // A press that took hold of a mark drags the mark and nothing else, under
    // every tool. The tool a mark does not belong to leaves it alone.
    const heldMark = state.hitId ? objects.find((object) => object.id === state.hitId) : undefined;
    if (heldMark && isMark(heldMark)) {
      // A marking tool lays marks and opens them. Moving one is the Arrow's
      // job, whichever mark it is and whichever marking tool is up.
      if (marking) return;
      if (!state.moved) {
        if (distance(at, state.origin) < DRAG_THRESHOLD / scale) return;
        state.moved = true;
        sketch.beginGesture();
      }
      dragMark(heldMark, at);
      return;
    }

    if (marking) {
      // A marking press is a click or a drag, and the two mean different
      // things: a click on a corner asks which angle, a drag says which.
      if (!state.moved && distance(at, state.origin) >= DRAG_THRESHOLD / scale) state.moved = true;
      if (arming) setArming({ ...arming, at });
      return;
    }

    if (state.handle) {
      const { handle, span } = state.handle;
      state.moved = true;
      const travelled =
        (at.x - state.origin.x) * handle.way.x + (at.y - state.origin.y) * handle.way.y;
      // The arrowhead points out of the locus, so dragging along it lets the
      // driver run further, whichever end of the domain it is.
      const wanted = span[handle.end] + travelled * handle.step * (handle.end === 1 ? 1 : -1);
      const next: [number, number] =
        handle.end === 1
          ? [span[0], Math.max(wanted, span[0] + LEAST_SPAN)]
          : [Math.min(wanted, span[1] - LEAST_SPAN), span[1]];
      const before = sketch.read();
      sketch.updateGesture({
        ...before,
        objects: before.objects.map((object) =>
          object.id === handle.locus && isLocus(object) ? { ...object, span: next } : object,
        ),
      });
      return;
    }

    if (!state.moved) {
      if (distance(at, state.origin) < DRAG_THRESHOLD / scale) return;
      state.moved = true;
      if (tool === "arrow" && state.hitId) startMove(state, state.hitId);
    }

    if (state.moving) {
      const went = heldMove(
        state.movingIds,
        {
          x: at.x - state.origin.x,
          y: at.y - state.origin.y,
        },
        aimingNow(),
      );
      moveBy({ ids: state.movingIds, from: state.moving }, went.x, went.y);
      setTravel(travelOf({ ids: state.movingIds, from: state.moving, went }, aimingNow()));
      return;
    }

    // The Text tool drags out the box the new caption will fill.
    if (tool === "text") {
      if (state.moved && !state.hitId) setBoxing(rectBetween(state.origin, at));
      return;
    }

    if (tool === "arrow") {
      state.marquee = rectBetween(state.origin, at);
      setMarquee(state.marquee);
      // The highlight tracks the marquee, so pulling it back off an object
      // drops that object again.
      sketch.select(caughtBy(state.marquee));
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") {
      fingers.current.delete(event.pointerId);
      const held = grab.current;
      // Still enough fingers to be panning, so the pan carries on from where
      // the ones left on the glass are now rather than ending under them.
      if (held?.pan && fingers.current.size >= PAN_FINGERS) {
        const at = betweenFingers();
        held.pan = { view: viewNow.current, clientX: at.x, clientY: at.y };
        return;
      }
    }
    const state = grab.current;
    grab.current = null;
    setMarquee(null);
    setTravel(null);
    if (!state) return;
    // A pan changes nothing about the sketch, so there is nothing to land.
    if (state.pan) return;
    if (state.handle) {
      // A press on an arrowhead that never moved changed nothing, so it is not
      // worth an undo step.
      if (state.moved) sketch.endGesture();
      else sketch.cancelGesture();
      return;
    }
    const at = positionOf(event) ?? state.origin;

    // Dragged from one side of an angle to the other. The two sides share one
    // end, that end is the corner, and their far ends are the arms, so nothing
    // is left to guess however many sides run out of the point.
    const fromSide = armFrom.current;
    armFrom.current = null;
    if (fromSide && state.moved && (marking === "angle" || measuring === "angle")) {
      const landed = pathUnder(at, true);
      const pair = landed && landed.id !== fromSide ? cornerBetween(fromSide, landed.id) : null;
      if (pair) {
        setArming(null);
        if (marking === "angle") markAngle(pair.corner, pair.arms);
        else readAngle(pair.corner, pair.arms);
        return;
      }
    }

    // A drag that had hold of a mark moved the mark, and that is the whole of
    // what it did, whichever tool is up.
    const carried = state.hitId ? objects.find((object) => object.id === state.hitId) : undefined;
    if (carried && isMark(carried) && state.moved) {
      sketch.endGesture();
      rememberRadius(carried.id);
      return;
    }

    // The protractor asks the same question the same way: short of the arcs the
    // press is on the corner, and a corner with several angles is asked about.
    if (measuring === "angle" && distance(at, state.origin) < ANGLE_AIM / scale) {
      const spot = objectAt(at, { objects: objects, scale, settled });
      if (spot && isPoint(spot) && anglesAt(spot.id, objects, settled).length > 1) {
        setChoosing({
          corner: spot.id,
          way: "read",
          spot: { x: event.clientX, y: event.clientY },
        });
        return;
      }
    }
    if (measuring && !state.moved) {
      const written = readingFrom(at, measuringNow());
      if (!written) {
        // Bare sheet: the panel goes away, and so does whatever was picked, the
        // same way pressing bare sheet with the Arrow lets go of everything.
        setReadingPanel(null);
        sketch.select([]);
        return;
      }
      // The same thing is only read once. Asking again for a number that is
      // already on the sheet takes you to the one that is there rather than
      // laying another of it on top.
      const already = readingAlready(written, measuringNow());
      if (already) {
        sketch.select([already.id]);
        setReadingPanel(hasPanel(written.reading) ? already.id : null);
        return;
      }
      setReadingPanel(hasPanel(written.reading) ? written.reading.id : null);
      const before = sketch.read();
      sketch.commit({
        ...before,
        objects: [...before.objects, ...(written.mark ? [written.mark] : []), written.reading],
      });
      return;
    }

    if (marking) {
      const armed = arming;
      setArming(null);
      const held = state.hitId ? objects.find((object) => object.id === state.hitId) : undefined;
      if (held && isMark(held)) {
        // Nothing was moved, so whatever the press took hold of is let go of
        // as it was found. With no gesture open this does nothing.
        sketch.cancelGesture();
        if (state.started) sketch.cancelGesture();
        // Clicked with its own tool, it opens its panel. Clicked with the other
        // tick tool, it makes room for a second mark at that spot.
        if (ownMark(held)) {
          setPanel(held.id);
          return;
        }
        const path = "path" in held ? objects.find((object) => object.id === held.path) : undefined;
        const along = path ? pathIn(settled, path.id) : null;
        if (path && along) layTick({ path, along, spot: at }, held);
        return;
      }
      if (marking === "angle") {
        // Clicked rather than dragged: nothing said which way out of the corner
        // was meant. One angle there is the answer, and more than one is asked.
        // Short of the arcs the press is on the corner rather than pointing
        // out of it, so it asks which angle instead of taking one.
        const aimed = armed !== null && distance(at, armed.start) >= ANGLE_AIM / scale;
        if (armed && !aimed) {
          const there = anglesAt(armed.corner, objects, settled);
          if (there.length === 0) {
            setPanel(null);
            return;
          }
          if (there.length === 1) {
            markAngle(armed.corner, there[0].arms);
            return;
          }
          setChoosing({
            corner: armed.corner,
            way: "mark",
            spot: { x: event.clientX, y: event.clientY },
          });
          return;
        }
        // Dragged out of the vertex: the way the drag points says which of the
        // angles there is meant, the reflex one included.
        const wanted = armed ? angleAsked(armed.corner, at) : null;
        if (!armed || !wanted) {
          setPanel(null);
          return;
        }
        // One angle is marked once, and the two ways round the same pair of
        // arms are two angles: a corner can carry the angle and its reflex at
        // the same time. Dragging out the way one of them is already marked
        // opens that mark rather than laying another of it on top.
        const already = objects.find(
          (object) =>
            isMark(object) &&
            !("path" in object) &&
            object.corner === armed.corner &&
            object.arms.every((arm) => wanted.arms.includes(arm)) &&
            (object.reflex === true) === wanted.reflex,
        );
        if (already) {
          setPanel(already.id);
          return;
        }
        const mark = createAngleMark({
          corner: armed.corner,
          arms: wanted.arms,
          sides: wanted.sides,
          strokes: lastMark.current.angle,
          reflex: wanted.reflex,
          radius: clearOfCorner(armed.corner),
        });
        addMark(mark);
        setPanel(mark.id);
        return;
      }
      // A click on a path puts a tick where the pointer landed on it, and a
      // click on nothing puts the panel away.
      const path = pathUnder(at);
      const along = path ? pathIn(settled, path.id) : null;
      if (!path || !along) {
        setPanel(null);
        return;
      }
      layTick({ path, along, spot: at });
      return;
    }

    if (drawing) {
      const aim = aimAt(at, aimingNow());
      // The press that started it and was let go without really pulling
      // anything out leaves it half drawn, for a second click to finish. One
      // that was held and dragged out finishes here.
      const pulled =
        Date.now() - state.pressed >= DRAW_HOLD && distance(at, state.origin) >= DRAW_REACH / scale;
      if (state.started && !pulled) return;
      finishDrawing(aim.found, aim.spot);
      return;
    }

    if (tool === "text") {
      setBoxing(null);
      // Dragged out over bare sheet: a caption that wide, open to type into.
      if (state.moved && !state.hitId) {
        const box = rectBetween(state.origin, at);
        makeCaption({ x: box.x, y: box.y }, Math.max(MIN_CAPTION_WIDTH, box.width * scale));
        return;
      }
      // A click instead: on a thing it shows what that thing is called, and
      // clicking it again puts the label away.
      const hit = objectAt(at, { objects: objects, scale, settled });
      if (hit && names.has(hit.id)) onToggleLabel(hit.id);
      return;
    }

    if (tool === "point") {
      // The point lands where the pointer comes up, dragged there or not. On
      // top of one that is already there it selects that one instead.
      const found = snapAt(at, aimingNow());
      if (found?.kind === "point") {
        sketch.select([found.ids[0]]);
        return;
      }
      // Two paths meeting under the pointer make the point where they meet.
      // On a straight object the point belongs to it and slides along it, and
      // where two of them cross it is the crossing itself.
      const point = endAt(found, found ? found.at : at);
      const before = sketch.read();
      sketch.commit({ objects: [...before.objects, point], selection: [point.id] });
      return;
    }

    if (tool !== "arrow") return;

    if (state.moving) {
      sketch.endGesture();
      return;
    }

    if (state.marquee) {
      sketch.select(caughtBy(state.marquee));
      return;
    }

    // A click on an object puts it in or out of the selection. A click on
    // empty canvas cleared it back on the press.
    if (!state.hitId) return;
    const before = sketch.read();
    if (before.selection.includes(state.hitId)) {
      sketch.select(before.selection.filter((id) => id !== state.hitId));
    } else sketch.select([...before.selection, state.hitId]);
  }

  cancel.current = () => {
    // A dialog is up and Escape belongs to it, seeds and all.
    if (picking) return;
    if (!pending && !tracing) {
      sketch.select([]);
      return;
    }
    sketch.cancelGesture();
    setPending(null);
    setTracing(null);
  };
  // The same again for whoever asked for the handle. The ref the key listener
  // reads stays the one declared here, so that listener is bound once.
  if (cancelRef) cancelRef.current = cancel.current;

  /** Right-click drops a half-drawn line, and never opens a menu on the sheet. */
  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    // The press that panned the sheet was a drag, not a click, so it cancels
    // nothing. Anything else is a right-click and drops what is half drawn.
    if (panMoved.current) panMoved.current = false;
    else cancel.current();
  }

  function handlePointerLeave() {
    setSnap(null);
    setOverNamed(false);
    setPreviewReading(null);
    setPreviewHeld(null);
  }

  /**
   * Double-clicking a mark opens its panel, whatever tool is up. It puts no
   * tool up and picks nothing: the panel is how a mark is set, and that is all
   * this does.
   *
   * With the Arrow up, double-clicking a straight object marks it as the mirror
   * instead, which is the quick way round the Transform menu.
   */
  function handleDoubleClick(event: MouseEvent<HTMLDivElement>) {
    if (picking) return;
    const at = positionOf(event);
    if (!at) return;
    const found = markUnder(at, { objects, settled, scale });
    if (found) {
      setPanel(found.id);
      return;
    }
    if (tool !== "arrow") return;
    const hit = objectAt(at, { objects: objects, scale, settled });
    if (hit && isLine(hit)) onMarkMirror(hit.id);
  }

  function handlePointerCancel(event?: PointerEvent<HTMLDivElement>) {
    if (event?.pointerType === "touch") fingers.current.delete(event.pointerId);
    const state = grab.current;
    grab.current = null;
    setMarquee(null);
    setBoxing(null);
    setTravel(null);
    if (!state) return;
    if (state.handle) {
      sketch.cancelGesture();
      return;
    }
    if (state.moving) sketch.endGesture();
    // The press already cleared the selection, so an abandoned marquee
    // leaves nothing selected.
    else if (tool === "arrow" && state.marquee) sketch.select([]);
  }

  const ends = endsById(everything);
  // Over everything, hidden included, so hiding one object does not renumber
  // the automatic names of the rest and leave the sheet saying one thing while
  // the labels panel says another.
  const names = namesFor(everything);
  // Ghost lines hang off ghost points, which are nowhere in the sketch yet.
  const previewPoints = pointsOf(preview);
  const previewSettled = preview.length ? settle([...objects, ...preview]).settled : settled;
  const slack = slackAt(scale);
  // Lines are drawn only as far as the sheet on screen, plus a little, so a ray
  // running to the horizon is a couple of numbers rather than a huge one.
  const shown = {
    x: onScreen.x - slack * 4,
    y: onScreen.y - slack * 4,
    width: onScreen.width + slack * 8,
    height: onScreen.height + slack * 8,
  };

  function spanOf(line: SketchLine, within = settled): [Position, Position] | null {
    const along = within.lines.get(line.id);
    return along ? clipToRect(along, shown) : null;
  }

  /** The page as the labelling reads it. */
  const labelling: Labelling = { objects, settled, scale, ends, spanOf };

  /**
   * The point a click plots: the crossing itself where two straight objects
   * meet, a point belonging to the one under the pointer, or a loose point.
   */
  function endAt(found: Snap | null, at: Position): SketchPoint {
    if (found?.kind === "cross") {
      return createPoint(at, pointSize, {
        kind: "cross",
        of: found.ids[0],
        and: found.ids[1],
        pick: found.pick,
      });
    }
    if (found?.kind === "line") {
      const path = objects.find((object) => object.id === found.ids[0]);
      const along = pathIn(settled, found.ids[0]);
      if (path && along) {
        const on = pointOnPath({ path, where: along }, at, pointSize);
        if (on) return on;
      }
    }
    return createPoint(at, pointSize);
  }

  /** Drag a label about within its reach of what it names. */
  function moveLabel(id: string, off: Position) {
    const held = Math.hypot(off.x, off.y);
    const kept =
      held <= LABEL_REACH
        ? off
        : { x: (off.x / held) * LABEL_REACH, y: (off.y / held) * LABEL_REACH };
    const before = sketch.read();
    sketch.updateGesture({
      ...before,
      objects: before.objects.map((object) =>
        object.id === id ? { ...object, label: { ...object.label, off: kept } } : object,
      ),
    });
  }

  function startLabelDrag(event: PointerEvent<HTMLSpanElement>, id: string, off: Position) {
    if (event.button !== 0) return;
    event.stopPropagation();
    // A label is picked on its own: what it names is not picked with it, so the
    // palette is set on the label rather than on the object under it.
    if (tool === "arrow") {
      // A caption open to type into is what the bar is set on, so it is settled
      // and put away before a label takes its place: only one of the two is
      // ever the thing the palette is working on.
      if (editing) closeCaption(null);
      onLabelPick(id, event.shiftKey || event.ctrlKey);
      sketch.select([]);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragged.current = { id, off, from: { x: event.clientX, y: event.clientY } };
    sketch.beginGesture();
  }

  function dragLabel(event: PointerEvent<HTMLSpanElement>) {
    const state = dragged.current;
    if (!state) return;
    event.stopPropagation();
    moveLabel(state.id, {
      x: state.off.x + (event.clientX - state.from.x),
      y: state.off.y + (event.clientY - state.from.y),
    });
  }

  function dropLabel(event: PointerEvent<HTMLSpanElement>) {
    const state = dragged.current;
    dragged.current = null;
    if (!state) return;
    event.stopPropagation();
    const moved =
      Math.abs(event.clientX - state.from.x) + Math.abs(event.clientY - state.from.y) > 0;
    if (moved) sketch.endGesture();
    else sketch.cancelGesture();
  }

  const captions = objects.filter(isCaption);
  // Everything written as a line of text with a name in front of it: the
  // numbers, and the functions, which say what they are rather than a number.
  const readings = objects.filter(
    (object): object is SketchMeasurement | SketchParameter | SketchCalculation | SketchFunction =>
      isValue(object) || isFunction(object),
  );

  /** What every number on the sheet comes to now, the whole page in one pass. */
  const quantities = quantitiesOf(settled);

  const tables = objects.filter(isTable);
  const buttons = objects.filter(isButton);

  /** What one of them says, worked out afresh as the figure moves. */
  const readingFor = (
    value: SketchMeasurement | SketchParameter | SketchCalculation | SketchFunction,
  ) =>
    isMeasurement(value)
      ? readingOf(value, { objects: everything, names, settled })
      : readingOfValue(value, quantities.get(value.id) ?? null, { names, objects: everything });

  /**
   * What a marquee has caught: the geometry, and any writing it ran over.
   * Writing is not geometry, so where it covers is read back off the box it was
   * drawn into rather than worked out.
   */
  function caughtBy(rect: Rect): string[] {
    const caught = objectsTouching(rect, { objects: pickable, scale, settled }).map(
      (object) => object.id,
    );
    for (const writing of takesWriting ? [...captions, ...readings, ...tables, ...buttons] : []) {
      const box = boxes.current.get(writing.id);
      if (!box) continue;
      const covers = {
        x: writing.x,
        y: writing.y,
        width: box.width / scale,
        height: box.height / scale,
      };
      if (overlaps(covers, rect)) caught.push(writing.id);
    }
    return caught;
  }

  /**
   * Change a caption. A drag reports every step of itself so the whole of it
   * collapses into one undo step; everything else lands as its own.
   */
  function changeCaption(id: string, change: Partial<SketchCaption>, step: boolean) {
    const before = sketch.read();
    const next = {
      ...before,
      objects: before.objects.map((object) =>
        object.id === id && isCaption(object) ? { ...object, ...change } : object,
      ),
    };
    if (step) sketch.commit(next);
    else sketch.updateGesture(next);
  }

  /**
   * Keep what was written, unless it says nothing: a caption that is blank when
   * it is finished is taken off the sheet rather than left sitting there empty.
   */
  function settleCaption(id: string, html: string) {
    const before = sketch.read();
    const found = before.objects.find((object) => object.id === id);
    if (!found || !isCaption(found)) return;
    if (plainText(html) === "") {
      sketch.commit({
        objects: before.objects.filter((object) => object.id !== id),
        selection: before.selection.filter((one) => one !== id),
      });
      if (editing === id) onEditing(null);
      return;
    }
    if (found.html !== html) changeCaption(id, { html }, true);
  }

  /**
   * What a Hot Text link says: an object's name, and a measurement's value, so
   * a sentence that quotes a measurement reads the number as it stands now.
   */
  const linkNames = new Map(names);
  for (const measurement of everything.filter(isMeasurement)) {
    linkNames.set(measurement.id, readingFor(measurement).value);
  }

  /** Drop a link to what was clicked into the caption being written. */
  function insertLink(id: string) {
    const element = editor.current;
    const name = linkNames.get(id);
    if (!element || !name || !editing) return;
    insertAtCaret(element, linkHtml(id, name));
    changeCaption(editing, { html: element.innerHTML }, true);
  }

  /**
   * Put the open caption away, or open another, keeping whatever was written.
   * The text lives in the browser while a caption is open, so it has to be read
   * back before the field it was typed in goes.
   */
  function closeCaption(next: string | null) {
    const element = editor.current;
    const open = editing ? captions.find((one) => one.id === editing) : null;
    if (open && element) settleCaption(open.id, element.innerHTML);
    // A caption being written into is the one thing the palette is set on, so
    // opening one lets go of the selection and of any picked label rather than
    // setting the bar on two things at once. Putting one away hands it back to
    // the selection, so the bar is still on it and its grip is still there, and
    // a press on bare sheet with the Arrow lets go of that in its own turn. A
    // caption left empty is gone by now, and a selection cannot hold what is
    // not there.
    if (next) {
      sketch.select([]);
      onLabelPick(null);
    } else if (open && sketch.read().objects.some((one) => one.id === open.id)) {
      sketch.select([open.id]);
    }
    onEditing(next);
  }

  /**
   * A hidden caption, drawn faintly where it sits while the dock points at its
   * row. A band round nothing would say nothing, so the caption itself comes
   * back rather than an outline of it.
   */
  function ghostCaption(id: string | null) {
    const found = id ? everything.find((object) => object.id === id) : null;
    if (!found || !isCaption(found) || found.hidden !== true) return null;
    return (
      <div
        className="caption caption--ghost"
        style={{
          left: `${(found.x - view.x) * scale}px`,
          top: `${(found.y - view.y) * scale}px`,
          width: `${found.width}px`,
          textAlign: found.align,
          ...drawnAs(found),
        }}
      >
        <div
          className="caption__body"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the caption's own markup, written here
          dangerouslySetInnerHTML={{ __html: withNames(found.html, linkNames) }}
        />
      </div>
    );
  }

  /**
   * A hidden measurement, drawn faintly where it sits while the dock points at
   * its row, the way a hidden caption is.
   */
  function ghostReading(id: string | null) {
    const found = id ? everything.find((object) => object.id === id) : null;
    if (!found || !(isValue(found) || isFunction(found)) || found.hidden !== true) return null;
    return (
      <MeasurementBox
        measurement={found}
        reading={readingFor(found)}
        view={view}
        scale={scale}
        selected={false}
        tool="none"
        ghost
        linking={false}
        onLink={() => {}}
        onSelect={() => {}}
        onGrab={() => {}}
        onDrag={() => {}}
        onDrop={() => {}}
        onToggleLabel={() => {}}
        onMeasure={() => {}}
      />
    );
  }

  /**
   * A drag that began inside a caption or a measurement. The sheet never sees
   * that press, so the writing reports it here and it moves whatever a press on
   * the sheet would: the whole selection when the writing is part of it, the
   * writing alone when it is not.
   */
  function grabWriting(id: string) {
    written.current = takeHold(id);
  }

  function dragWriting(by: Position) {
    if (!written.current) return;
    const went = heldMove(written.current.ids, by, aimingNow());
    moveBy(written.current, went.x, went.y);
    setTravel(
      travelOf({ ids: written.current.ids, from: written.current.from, went }, aimingNow()),
    );
  }

  function dropWriting() {
    setTravel(null);
    if (!written.current) return;
    written.current = null;
    sketch.endGesture();
  }

  /** A caption of its own, made where it was asked for and opened to type in. */
  function makeCaption(at: Position, width: number) {
    const made = createCaption(at, width, captionLook);
    const before = sketch.read();
    sketch.commit({ objects: [...before.objects, made], selection: [made.id] });
    onEditing(made.id);
  }

  /**
   * How much room a caption or a reading takes, measured where it is drawn.
   * A reading that has changed size is drawn again, since what is drawn around
   * it, the arrows of a dimension and the gap left for the number, is worked
   * out from how big it is. Without this the dimension keeps the size the
   * reading was guessed at before it was ever drawn, and the gap sits off
   * centre by the difference.
   */
  const measureWriting = useCallback((id: string, size: { width: number; height: number }) => {
    const was = boxes.current.get(id);
    boxes.current.set(id, size);
    if (!was || was.width !== size.width || was.height !== size.height) {
      setMeasured((count) => count + 1);
    }
  }, []);

  /**
   * How a label is set, where the palette has said. What it does not say is
   * left to the stylesheet, which is where a label's default lives.
   */
  function labelLook(label: LabelState): CSSProperties {
    const look: CSSProperties = {};
    if (label.font) look.fontFamily = `"${label.font}", serif`;
    if (label.size) look.fontSize = `${label.size}pt`;
    if (label.colour) look.color = `var(${label.colour})`;
    if (label.bold !== undefined) look.fontWeight = label.bold ? "bold" : "normal";
    if (label.italic !== undefined) look.fontStyle = label.italic ? "italic" : "normal";
    if (label.underline !== undefined) look.textDecoration = label.underline ? "underline" : "none";
    return look;
  }

  /** Every label being shown, with where it hangs and how far off it sits. */
  const labels = objects.flatMap((object) => {
    if (!object.label?.shown) return [];
    const name = names.get(object.id);
    const at = name ? labelAnchor(labelling, object) : null;
    if (!at || !name) return [];
    return [
      {
        id: object.id,
        name,
        at,
        off: object.label.off ?? labelOff(labelling, object, at),
        look: labelLook(object.label),
      },
    ];
  });

  /** Where a mark's caption sits: the same spot its label would hang from. */
  function markAt(id: string): Position | null {
    const object = everything.find((candidate) => candidate.id === id);
    return object ? labelAnchor(labelling, object) : null;
  }

  /** Where an end of a locus is, and which way it carries on from there. */
  function handleFor(locus: SketchLocus, shape: LocusShape, end: 0 | 1): Handle | null {
    const domain = objects.find((object) => object.id === locus.domain);
    const along = settled.lines.get(locus.domain);
    if (!domain || !isLine(domain) || !along) return null;
    const length = distance(along.a, along.b);
    if (length < 1) return null;
    const path = { x: (along.b.x - along.a.x) / length, y: (along.b.y - along.a.y) / length };
    const handle = { locus: locus.id, end, step: 1 / length };
    if (shape.kind === "points" && shape.at.length > 1) {
      // A point locus carries its arrowhead at the end of the curve, pointing
      // the way the curve was going.
      const tip = end === 1 ? shape.at[shape.at.length - 1] : shape.at[0];
      const back = end === 1 ? shape.at[shape.at.length - 2] : shape.at[1];
      const reach = distance(back, tip);
      const way =
        reach < 0.001
          ? { x: path.x * (end === 1 ? 1 : -1), y: path.y * (end === 1 ? 1 : -1) }
          : { x: (tip.x - back.x) / reach, y: (tip.y - back.y) / reach };
      return { ...handle, at: tip, way };
    }
    // Anything else has no one end of its own, so the arrowhead sits on the
    // domain, at the far end of the stretch the driver runs over.
    const t = locus.span[end];
    return {
      ...handle,
      at: {
        x: along.a.x + (along.b.x - along.a.x) * t,
        y: along.a.y + (along.b.y - along.a.y) * t,
      },
      way: { x: path.x * (end === 1 ? 1 : -1), y: path.y * (end === 1 ? 1 : -1) },
    };
  }

  /**
   * Every arrowhead on the page. A segment fixes both ends of the domain, a ray
   * fixes only the end it starts from, and a line fixes neither.
   */
  const handles: Handle[] = objects.flatMap((object) => {
    if (!isLocus(object)) return [];
    const shape = settled.loci.get(object.id);
    const domain = objects.find((candidate) => candidate.id === object.domain);
    if (!shape || !domain || !isLine(domain) || domain.form === "segment") return [];
    const ends: (0 | 1)[] = domain.form === "ray" ? [1] : [0, 1];
    return ends.flatMap((end) => {
      const handle = handleFor(object, shape, end);
      return handle ? [handle] : [];
    });
  });

  /** A locus, drawn as the samples it was worked out to. */
  function drawLocus(id: string, shape: LocusShape, ghost: boolean) {
    const kind = `canvas__locus${ghost ? " canvas__locus--preview" : ""}${
      !ghost && selection.includes(id) ? " canvas__locus--selected" : ""
    }`;
    // A locus is one object however many pieces it is drawn in, so what it says
    // about how it is drawn goes on every one of them.
    const drawn = everything.find((candidate) => candidate.id === id);
    const look = ghost || !drawn ? undefined : strokeLook(drawn);
    const wash = ghost || !drawn ? undefined : fillLook(drawn, true);
    if (shape.kind === "points") {
      return (
        <polyline
          key={id}
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
        <g key={id} data-id={id}>
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
        <g key={id} data-id={id}>
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
        <g key={id} data-id={id}>
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
      <g key={id} data-id={id}>
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

  /** The ring at a snap: around the dot it found, or a fixed one on a path. */
  function snapRadius(found: Snap): number {
    const point = found.kind === "point" ? ends.get(found.ids[0]) : undefined;
    return (point ? radiusOf(point) + 5.5 : SNAP_RING) / scale;
  }

  const guide = guideOf({ objects, settled, scale, snapping, travel, pending, tracing });

  // A panel with nothing left to be about closes itself.
  const onPanel = panel ? objects.find((object) => object.id === panel) : undefined;
  const panelMark = onPanel && isMark(onPanel) ? onPanel : null;
  const panelSpot = panelMark ? panelSpotOf(panelMark.id) : null;
  const panelShape = panelMark ? markShape(panelMark, { settled, objects, scale }) : null;
  // The panel on a reading sits just above it, the way a mark's panel does.
  const onReading = readingPanel ? objects.find((object) => object.id === readingPanel) : undefined;
  const readingOpen = onReading && isMeasurement(onReading) ? onReading : null;
  const readingSpot = readingOpen
    ? {
        x: (readingOpen.x - view.x) * scale + boxOf(readingOpen).width / 2,
        y: (readingOpen.y - view.y) * scale - 10,
      }
    : null;

  return (
    <SheetProvider value={{ objects, everything, settled, selection, scale, ends, spanOf }}>
      <div className="canvas">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: the sheet is the drawing surface, where every gesture is a pointer gesture; the keyboard reaches the same work through the menus and their shortcuts */}
        <div
          ref={sheet}
          className={`canvas__sheet canvas__sheet--${cursor}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerLeave}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          onWheel={handleWheel}
        >
          {/* Anything drawn at a size rather than a place keeps that size on
            screen, so it is divided by the scale and its stroke left unscaled. */}
          <svg className="canvas__objects" aria-hidden="true">
            <g transform={`scale(${scale}) translate(${-view.x} ${-view.y})`}>
              <Fills />
              {objects.map((object) => {
                if (!isLocus(object)) return null;
                const shape = settled.loci.get(object.id);
                return shape ? drawLocus(object.id, shape, false) : null;
              })}
              {handles.map((handle) => (
                <polygon
                  key={`${handle.locus}-${handle.end}`}
                  className="canvas__locus-arrow"
                  points={arrowPoints(handle, scale)}
                />
              ))}
              <Paths />
              {tracing && (
                <g>
                  {/* What the polygon would be if it closed here: the fill once
                    there are three corners, the edges laid down so far, and a
                    band from the last corner to the pointer. */}
                  {tracing.spots.length >= 2 && (
                    <polygon
                      className="canvas__interior canvas__interior--preview"
                      points={[...tracing.spots, tracing.at]
                        .map((spot) => `${spot.x},${spot.y}`)
                        .join(" ")}
                    />
                  )}
                  <polyline
                    className="canvas__rubber canvas__rubber--laid"
                    points={tracing.spots.map((spot) => `${spot.x},${spot.y}`).join(" ")}
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    className="canvas__rubber"
                    x1={tracing.spots[tracing.spots.length - 1].x}
                    y1={tracing.spots[tracing.spots.length - 1].y}
                    x2={tracing.at.x}
                    y2={tracing.at.y}
                    vectorEffect="non-scaling-stroke"
                  />
                  {tracing.spots.length >= 2 && (
                    <line
                      className="canvas__rubber"
                      x1={tracing.at.x}
                      y1={tracing.at.y}
                      x2={tracing.spots[0].x}
                      y2={tracing.spots[0].y}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                </g>
              )}
              {pending &&
                (pending.tool === "compass" ? (
                  <circle
                    className="canvas__rubber"
                    cx={pending.start.x}
                    cy={pending.start.y}
                    r={distance(pending.start, pending.at)}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : (
                  <line
                    className="canvas__rubber"
                    x1={pending.start.x}
                    y1={pending.start.y}
                    x2={pending.at.x}
                    y2={pending.at.y}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              {middle && (
                <circle
                  className="canvas__snap"
                  cx={middle.x}
                  cy={middle.y}
                  r={7 / scale}
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {objects.map((object) => {
                if (!isMark(object)) return null;
                const shape = markShape(object, { settled, objects, scale });
                if (!shape) return null;
                const strokes = markStrokes(shape, scale);
                return (
                  <g key={object.id} data-id={object.id}>
                    {selection.includes(object.id) &&
                      strokes.map((stroke, nth) => (
                        <path
                          // biome-ignore lint/suspicious/noArrayIndexKey: stateless paths in a fixed-length list, redrawn whole
                          key={`halo-${object.id}-${nth}`}
                          className="canvas__mark-halo"
                          d={stroke}
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                    {strokes.map((stroke, nth) => (
                      <path
                        // biome-ignore lint/suspicious/noArrayIndexKey: stateless paths in a fixed-length list, redrawn whole
                        key={`${object.id}-${nth}`}
                        className="canvas__mark-stroke"
                        style={strokeLook({ ...object, pattern: undefined })}
                        d={stroke}
                        vectorEffect="non-scaling-stroke"
                      />
                    ))}
                  </g>
                );
              })}
              {/* An angle has to be marked before it can be read, so the arcs
                that click would put on it are part of what it would do. */}
              {previewReading?.mark &&
                (() => {
                  const shape = markShape(previewReading.mark, { settled, objects, scale });
                  if (!shape) return null;
                  return markStrokes(shape, scale).map((stroke) => (
                    <path
                      key={stroke}
                      className="canvas__mark-stroke canvas__mark-stroke--preview"
                      d={stroke}
                      vectorEffect="non-scaling-stroke"
                    />
                  ));
                })()}
              {arming && (
                <g>
                  <line
                    className="canvas__rubber"
                    x1={arming.start.x}
                    y1={arming.start.y}
                    x2={arming.at.x}
                    y2={arming.at.y}
                    vectorEffect="non-scaling-stroke"
                  />
                  {/* The angle the drag is asking for, drawn as it will land. */}
                  {armingArcs().map((stroke) => (
                    <path
                      key={stroke}
                      className="canvas__mark-stroke"
                      d={stroke}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </g>
              )}
              {/* Resting on a corner with an angle tool up. One angle there is
                drawn as itself; more than one is drawn as the whole turn, which
                says a corner is there without claiming which angle is meant. */}
              {overCorner &&
                !choosing &&
                (() => {
                  const spot = settled.points.get(overCorner);
                  if (!spot) return null;
                  const there = anglesAt(overCorner, objects, settled);
                  if (there.length === 1) {
                    // The protractor already ghosts the marking it would lay, so
                    // this is only the Marker's business.
                    if (marking !== "angle") return null;
                    return arcsBetween(
                      { corner: overCorner, arms: there[0].arms, reflex: false },
                      markingNow(),
                    ).map((stroke) => (
                      <path
                        key={stroke}
                        className="canvas__mark-stroke canvas__mark-stroke--preview"
                        d={stroke}
                        vectorEffect="non-scaling-stroke"
                      />
                    ));
                  }
                  return (
                    <circle
                      className="canvas__mark-stroke canvas__mark-stroke--preview"
                      cx={spot.x}
                      cy={spot.y}
                      r={clearOfCorner(overCorner) / scale}
                      fill="none"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })()}
              {/* The angle a row of the which-angle dialog is pointing at: its two
                arms lit up, so which angle is meant is plain at a glance, and
                the arcs it would land as drawn over them. */}
              {choosing &&
                showingArms &&
                (() => {
                  const spot = settled.points.get(choosing.corner);
                  if (!spot) return null;
                  return (
                    <g>
                      {showingArms.map((arm) => {
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
                      {arcsBetween(
                        { corner: choosing.corner, arms: showingArms, reflex: false },
                        markingNow(),
                      ).map((stroke) => (
                        <path
                          key={stroke}
                          className="canvas__mark-stroke"
                          d={stroke}
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                    </g>
                  );
                })()}
              <Points />
              {spotlight && <Lit ids={litWith(spotlight, everything)} />}
              {lit && lit !== spotlight && <Lit ids={litWith(lit, everything)} />}
              {under && under !== spotlight && !selection.includes(under) && (
                <Lit ids={litWith(under, everything)} />
              )}
              <Lit ids={litReading} />
              {snap && (
                <g>
                  {/* The paths a click would attach to, or whose crossing it
                    would build, lit the whole way along. */}
                  {snap.kind !== "point" && <Lit ids={snap.ids} />}
                  <circle
                    className="canvas__snap"
                    cx={snap.at.x}
                    cy={snap.at.y}
                    r={snapRadius(snap)}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              )}
              <Holding marks={marks} />
              {preview.map((object) => {
                if (isArc(object)) {
                  const arc = previewSettled.arcs.get(object.id);
                  return arc ? (
                    <path
                      key={object.id}
                      className="canvas__circle canvas__circle--preview"
                      d={arcPath(arc)}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null;
                }
                if (isCircle(object)) {
                  const round = previewSettled.circles.get(object.id);
                  return round ? (
                    <circle
                      key={object.id}
                      className="canvas__circle canvas__circle--preview"
                      cx={round.at.x}
                      cy={round.at.y}
                      r={round.radius}
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null;
                }
                if (isLocus(object)) {
                  const shape = previewSettled.loci.get(object.id);
                  return shape ? drawLocus(object.id, shape, true) : null;
                }
                if (isInterior(object)) {
                  const shape = interiorShape(object, previewSettled);
                  if (!shape) return null;
                  const ghost = "canvas__interior canvas__interior--preview";
                  if (shape.kind === "path") {
                    return <path key={object.id} className={ghost} d={shape.d} />;
                  }
                  if (shape.kind === "circle") {
                    return (
                      <circle
                        key={object.id}
                        className={ghost}
                        cx={shape.at.x}
                        cy={shape.at.y}
                        r={shape.radius}
                      />
                    );
                  }
                  return <polygon key={object.id} className={ghost} points={shape.points} />;
                }
                if (!isLine(object)) return null;
                const span = spanOf(object, previewSettled);
                return span ? (
                  <line
                    key={object.id}
                    className="canvas__line canvas__line--preview"
                    x1={span[0].x}
                    y1={span[0].y}
                    x2={span[1].x}
                    y2={span[1].y}
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null;
              })}
              {previewPoints.map((point) => (
                <circle
                  key={point.id}
                  className="canvas__point canvas__point--preview"
                  cx={point.x}
                  cy={point.y}
                  r={radiusOf(point) / scale}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <Dimensions readings={readings} boxOf={boxOf} />
              <Guides guide={guide} />
              {marquee && (
                <rect
                  className="canvas__marquee"
                  x={marquee.x}
                  y={marquee.y}
                  width={marquee.width}
                  height={marquee.height}
                  rx={2 / scale}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </g>
          </svg>

          {/*
          The press stops here. Letting it reach the sheet would capture the
          pointer there, and the click that follows would be retargeted to the
          sheet with it, never reaching the button.
        */}
          {labels.map((label) => {
            const where = {
              left: `${(label.at.x - view.x) * scale + label.off.x}px`,
              top: `${(label.at.y - view.y) * scale + label.off.y}px`,
            };
            if (naming?.id === label.id) {
              return (
                <input
                  key={label.id}
                  className="canvas__label-input"
                  style={where}
                  // biome-ignore lint/a11y/noAutofocus: the double-click asked for it
                  autoFocus
                  value={naming.text}
                  onChange={(event) => setNaming({ ...naming, text: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") setNaming(null);
                  }}
                  onBlur={() => {
                    if (naming.text.trim() !== label.name) onRename(label.id, naming.text.trim());
                    setNaming(null);
                  }}
                />
              );
            }
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: a label is dragged and typed into, not pressed
              <span
                key={label.id}
                data-id={label.id}
                className={`canvas__label${
                  labelPick.includes(label.id) ? " canvas__label--picked" : ""
                }`}
                style={{
                  ...where,
                  ...label.look,
                  // A label is dragged and typed into by the two tools that deal
                  // in labels, and is out of the way of every other tool.
                  pointerEvents:
                    (tool === "arrow" || tool === "text") && !picking ? "auto" : "none",
                }}
                onPointerDown={(event) => startLabelDrag(event, label.id, label.off)}
                onPointerMove={dragLabel}
                onPointerUp={dropLabel}
                onDoubleClick={() => setNaming({ id: label.id, text: label.name })}
              >
                {label.name}
              </span>
            );
          })}

          {readingOpen && readingSpot && (
            <ReadingPanel
              reading={readingOpen}
              at={readingSpot}
              onBounds={setBounds}
              onLeaders={setLeaders}
              onReflex={setReadingReflex}
              places={readingOpen.places ?? placesFor(readingOpen.measure)}
              onPlaces={setPlaces}
            />
          )}

          {panelMark && panelSpot && (
            <MarkPanel
              mark={panelMark}
              at={panelSpot}
              onStrokes={setStrokes}
              onFlip={flipMark}
              onReflex={flipReflex}
              onSquare={setSquare}
              square={panelShape?.form === "angle" && panelShape.square}
              canSwap={canSwap(panelMark)}
              onForm={setForm}
              onDelete={dropMark}
            />
          )}

          {captions.map((caption) => (
            <CaptionBox
              key={caption.id}
              caption={caption}
              names={linkNames}
              view={view}
              scale={scale}
              selected={selection.includes(caption.id)}
              editing={editing === caption.id}
              tool={picking || !takesWriting ? "none" : tool}
              editor={editor}
              onEdit={closeCaption}
              onSelect={(id, additive) =>
                sketch.select(togglePick(sketch.read().selection, id, additive))
              }
              onGrab={grabWriting}
              onDrag={dragWriting}
              onDrop={dropWriting}
              onGestureStart={sketch.beginGesture}
              onGestureEnd={sketch.endGesture}
              onWidth={(id, width) => changeCaption(id, { width }, false)}
              onAlign={(id, align: CaptionAlign) => changeCaption(id, { align }, true)}
              onCommit={(id, html) => {
                settleCaption(id, html);
              }}
              onLit={setLit}
              onMeasure={measureWriting}
            />
          ))}

          {readings.map((measurement) => (
            <MeasurementBox
              key={measurement.id}
              measurement={measurement}
              reading={readingFor(measurement)}
              view={view}
              scale={scale}
              selected={selection.includes(measurement.id)}
              lit={previewHeld === measurement.id}
              tool={picking || !takesWriting ? "none" : tool}
              linking={editing !== null}
              onLink={insertLink}
              onSelect={(id, additive) =>
                sketch.select(togglePick(sketch.read().selection, id, additive))
              }
              onGrab={grabWriting}
              onDrag={dragWriting}
              onDrop={dropWriting}
              onToggleLabel={onToggleLabel}
              onMeasure={measureWriting}
              onHover={(id) => {
                const found = id ? everything.find((object) => object.id === id) : null;
                setLitReading(
                  found && isMeasurement(found)
                    ? [...found.of, ...litWith(found.id, everything)]
                    : [],
                );
              }}
              onOpen={(id) => {
                const found = everything.find((object) => object.id === id);
                setReadingPanel(found && isMeasurement(found) && hasPanel(found) ? id : null);
              }}
              onDoubleClick={(id) => {
                const found = everything.find((object) => object.id === id);
                if (!found) return;
                // A number that was made in a dialog goes back to that dialog; a
                // measured one opens the panel that says how it is drawn.
                if (isMeasurement(found)) {
                  if (hasPanel(found)) setReadingPanel(id);
                  return;
                }
                // A derivative holds nothing of its own to edit, so there is
                // nothing to reopen on it.
                if (isValue(found) || (isFunction(found) && found.body)) onEditValue(id);
              }}
            />
          ))}

          {tables.map((table) => (
            <TableBox
              key={table.id}
              table={table}
              headings={table.of.map((id) => names.get(id) ?? "?")}
              rows={table.rows.map((row) =>
                row.map((cell) => (cell ? sayQuantity(fromSheetTerms(cell)) : "—")),
              )}
              live={table.of.map((id) => sayQuantity(quantities.get(id) ?? null))}
              view={view}
              scale={scale}
              selected={selection.includes(table.id)}
              tool={picking || !takesWriting ? "none" : tool}
              onSelect={(id, additive) =>
                sketch.select(togglePick(sketch.read().selection, id, additive))
              }
              onGrab={grabWriting}
              onDrag={dragWriting}
              onDrop={dropWriting}
              onCapture={onCaptureRow}
              onDropLast={onDropRow}
              onMeasure={measureWriting}
            />
          ))}

          {buttons.map((button) => (
            <ButtonBox
              key={button.id}
              button={button}
              view={view}
              scale={scale}
              selected={selection.includes(button.id)}
              tool={picking || !takesWriting ? "none" : tool}
              onPress={onPressButton}
              // A button is pressed rather than dragged, so a plain click adds it
              // to the selection instead of replacing it.
              onSelect={(id) => sketch.select(togglePick(sketch.read().selection, id, true))}
              onGrab={grabWriting}
              onDrag={dragWriting}
              onDrop={dropWriting}
              onMeasure={measureWriting}
            />
          ))}

          {/* Hovering a Measure entry writes the number it would take, as a
            ghost, where it would land. */}
          {preview.filter(isMeasurement).map((measurement) => (
            <MeasurementBox
              key={measurement.id}
              measurement={measurement}
              reading={readingFor(measurement)}
              view={view}
              scale={scale}
              selected={false}
              tool="none"
              ghost
              linking={false}
              onLink={() => {}}
              onSelect={() => {}}
              onGrab={() => {}}
              onDrag={() => {}}
              onDrop={() => {}}
              onToggleLabel={() => {}}
              onMeasure={() => {}}
            />
          ))}

          {/* What the Measure tool would write from where the pointer is. */}
          {previewReading && (
            <MeasurementBox
              measurement={previewReading.reading}
              reading={readingFor(previewReading.reading)}
              view={view}
              scale={scale}
              selected={false}
              tool="none"
              ghost
              linking={false}
              onLink={() => {}}
              onSelect={() => {}}
              onGrab={() => {}}
              onDrag={() => {}}
              onDrop={() => {}}
              onToggleLabel={() => {}}
              onMeasure={() => {}}
            />
          )}

          {/* Hidden writing pointed at in the dock. Nothing else says where it
            sits, since a hidden object is not drawn at all. */}
          {ghostCaption(spotlight)}
          {ghostReading(spotlight)}

          {/* The box a caption is being dragged out to, before there is one. */}
          {boxing && (
            <div
              className="caption-box"
              style={{
                left: `${(boxing.x - view.x) * scale}px`,
                top: `${(boxing.y - view.y) * scale}px`,
                width: `${boxing.width * scale}px`,
                height: `${boxing.height * scale}px`,
              }}
            />
          )}

          {/* A dialog's marks ride above the sheet, keeping their size at any zoom. */}
          {marks.map((mark) => {
            const object = markAt(mark.id);
            if (!object) return null;
            return (
              <span
                key={mark.id}
                className="canvas__caption"
                style={{
                  left: `${(object.x - view.x) * scale}px`,
                  top: `${(object.y - view.y) * scale}px`,
                }}
              >
                {mark.label}
              </span>
            );
          })}

          {zoomable && (
            <div className="canvas__zoom" onPointerDown={(event) => event.stopPropagation()}>
              <button
                type="button"
                className="canvas__zoom-button"
                aria-label="Zoom out"
                disabled={scale <= MIN_SCALE}
                onClick={() => zoomTo(stopBelow(scale))}
              >
                −
              </button>
              <button
                type="button"
                className="canvas__zoom-level"
                aria-label="Zoom to 100%"
                title="Zoom to 100%"
                onClick={() => zoomTo(1)}
              >
                {Math.round(scale * 100)}%
              </button>
              <button
                type="button"
                className="canvas__zoom-button"
                aria-label="Zoom in"
                disabled={scale >= MAX_SCALE}
                onClick={() => zoomTo(stopAbove(scale))}
              >
                +
              </button>
            </div>
          )}
        </div>

        <div
          ref={vertical}
          className="canvas__scroll canvas__scroll--vertical"
          onScroll={handleScrollY}
        >
          <div className="canvas__extent" style={{ height: `${area.height * scale}px` }} />
        </div>
        <div
          ref={horizontal}
          className="canvas__scroll canvas__scroll--horizontal"
          onScroll={handleScrollX}
        >
          <div className="canvas__extent" style={{ width: `${area.width * scale}px` }} />
        </div>
        <div className="canvas__corner" />
        {choosing && (
          <AngleChoiceDialog
            corner={choosing.corner}
            nameOf={(id) => names.get(id) ?? "?"}
            choices={anglesAt(choosing.corner, objects, settled).map(
              (one): AngleChoice => ({ arms: one.arms, turn: one.turn }),
            )}
            way={choosing.way}
            at={choosing.spot}
            onPick={(arms) => {
              const { corner, way } = choosing;
              setChoosing(null);
              setShowingArms(null);
              if (way === "mark") markAngle(corner, arms);
              else readAngle(corner, arms);
            }}
            onShow={setShowingArms}
            onCancel={() => {
              setChoosing(null);
              setShowingArms(null);
            }}
          />
        )}
      </div>
    </SheetProvider>
  );
}
