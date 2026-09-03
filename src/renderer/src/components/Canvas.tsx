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
  sayAngle,
  sayArea,
  sayLength,
  sayQuantity,
  shoelace,
} from "../sketch/measure";
import {
  ANGLE_RADIUS,
  type ArcGeometry,
  alongPath,
  type CaptionAlign,
  centreOf,
  clipToRect,
  contentBounds,
  createAngleMark,
  createCaption,
  createCircle,
  createInterior,
  createMeasurement,
  createPoint,
  createTick,
  crossings,
  degreesOf,
  distance,
  distanceToPath,
  endsById,
  familyOf,
  filledPath,
  fillLook,
  HALF_TURN,
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
  type LineGeometry,
  type LocusShape,
  lineThrough,
  type MarkForm,
  type MeasureKind,
  markAlong,
  markReach,
  markShape,
  markStrokes,
  markSweep,
  movedBy,
  namesFor,
  nearMark,
  objectAt,
  objectsTouching,
  type PanFrom,
  type PathGeometry,
  type PointSize,
  type Position,
  PX_PER_CM,
  pannedView,
  panTravel,
  pathIn,
  pointOnPath,
  pointsOf,
  QUARTER_TURN,
  type Rect,
  radiansOf,
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
  wedgeOf,
} from "../sketch/model";
import { demotedUnder } from "../sketch/overlaps";
import { togglePick } from "../sketch/picking";
import { drawnAs } from "../sketch/text";
import type { Sketch } from "../sketch/useSketch";
import { type AngleChoice, AngleChoiceDialog } from "./AngleChoiceDialog";
import { ButtonBox } from "./ButtonBox";
import { CaptionBox } from "./CaptionBox";
import {
  ANGLE_AIM,
  ANGLE_READING_OFF,
  ANGLE_ROOM,
  ARROW_GRAB,
  ARROW_HEAD,
  ARROW_SIZE,
  ARROW_WING,
  BREAK_GAP,
  CAPTION_WIDTH,
  CROSS_REACH,
  clampScale,
  DRAG_THRESHOLD,
  DRAW_HOLD,
  DRAW_REACH,
  GUIDE_LIFT,
  GUIDE_OFF,
  GUIDE_RADIUS,
  type Guide,
  type GuideAngle,
  type GuideText,
  type Handle,
  hasPanel,
  LEADER_PAST,
  LEAST_SPAN,
  MAX_SCALE,
  MIN_CAPTION_WIDTH,
  MIN_SCALE,
  overlaps,
  PAN_FINGERS,
  READING_CHAR,
  READING_HEIGHT,
  READING_OFF,
  READING_POINTS,
  SNAP_RING,
  type Snap,
  sameReading,
  snapKey,
  stepped,
  stopAbove,
  stopBelow,
  type Travel,
  WHEEL_ZOOM,
  type Written,
} from "./canvas/sheet";
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
  /** A tool waiting for its second click, and where it is aiming. */
  const [pending, setPending] = useState<{
    start: Position;
    startId: string;
    at: Position;
    /** Which tool is drawing it, since only that tool can finish it. */
    tool: string;
  } | null>(null);
  /** The polygon being traced out, its corners in the order they were clicked. */
  const [tracing, setTracing] = useState<{
    ids: string[];
    spots: Position[];
    /** Where the band from the last corner is aiming. */
    at: Position;
  } | null>(null);
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
  const points = pointsOf(objects);
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

  /** The stretch of its domain a locus is drawn over. */
  function spanOfLocus(id: string): [number, number] {
    const locus = objects.find((object) => object.id === id);
    return locus && isLocus(locus) ? locus.span : [0, 1];
  }

  /** The arrowhead nearest the pointer, if the pointer is on one. */
  function handleAt(at: Position): Handle | null {
    const reach = ARROW_GRAB / scale;
    return handles.find((handle) => distance(handle.at, at) <= reach) ?? null;
  }

  /**
   * Where a click would go and what it would use. Shift holds the direction
   * from the first click to the nearest 15 degrees, and takes over from the
   * snapping while it is down, so the angle is what you asked for.
   */
  function aimAt(at: Position): { found: Snap | null; spot: Position } {
    const from = pending?.start ?? tracing?.spots[tracing.spots.length - 1];
    if (from && shiftHeld) return { found: null, spot: stepped(from, at) };
    // What is already on the sheet comes first: a point, a path or a crossing
    // under the pointer is what a click lands on, whatever the steps are set to.
    const found = snapping.objects ? snapAt(at) : null;
    if (found) return { found, spot: alongWithSteps(found, from, at) };
    return { found: null, spot: from ? heldToSteps(from, at) : at };
  }

  /**
   * Where on a snapped object the click actually lands.
   *
   * A point and a crossing are single spots: landing on one settles it, and the
   * steps have nothing left to say. A path is not. Landing on a path only says
   * the point is somewhere on it, and how far along is still free, so that is
   * what the steps spend. Each step that is switched on offers its own spots
   * along the path, and the click takes whichever of them the pointer is
   * nearest, so having both on offers more places to land rather than fewer.
   */
  function alongWithSteps(found: Snap, from: Position | undefined, at: Position): Position {
    if (found.kind !== "line" || !from) return found.at;
    const along = pathIn(settled, found.ids[0]);
    if (!along) return found.at;
    const spots = stepsAlong(along, from, at);
    if (spots.length === 0) return found.at;
    return spots.reduce((near, spot) => (distance(spot, at) < distance(near, at) ? spot : near));
  }

  /** The whole numbers around one, since the nearest may miss the path. */
  function nearWhole(value: number): number[] {
    const whole = Math.round(value);
    return [whole - 1, whole, whole + 1];
  }

  /**
   * The spots along a path that the steps say a click may land on: where the
   * whole-step rings about the start cross it, and where the whole-step
   * directions out of the start cross it. Only rings and directions either side
   * of where the pointer is, since the rest are too far away to have been meant.
   */
  function stepsAlong(along: PathGeometry, from: Position, at: Position): Position[] {
    const spots: Position[] = [];
    if (snapping.length && snapping.lengthCm > 0) {
      const step = snapping.lengthCm * PX_PER_CM;
      for (const whole of nearWhole(distance(from, at) / step)) {
        if (whole <= 0) continue;
        spots.push(...crossings({ at: from, radius: whole * step, ref: 0 }, along));
      }
    }
    if (snapping.angle && snapping.angleDegrees > 0) {
      const step = radiansOf(snapping.angleDegrees);
      const bearing = Math.atan2(at.y - from.y, at.x - from.x);
      const base = baseAngle(bearing);
      for (const whole of nearWhole((bearing - base) / step)) {
        const angle = base + whole * step;
        const out = { x: from.x + Math.cos(angle), y: from.y + Math.sin(angle) };
        spots.push(...crossings({ a: from, b: out, form: "ray" }, along));
      }
    }
    return spots;
  }

  /**
   * The pointer held to whole steps of length and of angle, where those are
   * switched on. An angle is measured from the straight object already at the
   * corner where there is one, so the number the sheet reads out while the
   * object is being drawn is the number being held.
   */
  function heldToSteps(from: Position, at: Position): Position {
    if (!snapping.length && !snapping.angle) return at;
    let reach = distance(from, at);
    let angle = Math.atan2(at.y - from.y, at.x - from.x);
    if (snapping.length && snapping.lengthCm > 0) {
      const step = snapping.lengthCm * PX_PER_CM;
      reach = Math.max(step, Math.round(reach / step) * step);
    }
    if (snapping.angle && snapping.angleDegrees > 0) {
      const step = radiansOf(snapping.angleDegrees);
      const base = baseAngle(angle);
      angle = base + Math.round((angle - base) / step) * step;
    }
    return { x: from.x + Math.cos(angle) * reach, y: from.y + Math.sin(angle) * reach };
  }

  /**
   * How far a drag actually moves what it has hold of: the pointer's travel
   * held to whole steps of length and of angle, both counted from where the
   * drag started, the angle from the horizontal. A move can come to nothing, so
   * unlike a line being drawn it is not held to at least one step.
   *
   * The steps hold geometry. Writing dragged on its own goes exactly where it
   * is put, and a drag carrying both counts as geometry so that it all moves
   * together.
   */
  function heldMove(ids: string[], by: Position): Position {
    // The steps hold a move only when asked to. Off, a drag goes exactly where
    // it is put, whatever the steps are set to.
    if (!snapping.moving) return by;
    if (!snapping.length && !snapping.angle) return by;
    if (!carriesGeometry(ids)) return by;
    let reach = Math.hypot(by.x, by.y);
    let angle = Math.atan2(by.y, by.x);
    if (snapping.length && snapping.lengthCm > 0) {
      const step = snapping.lengthCm * PX_PER_CM;
      reach = Math.round(reach / step) * step;
    }
    if (snapping.angle && snapping.angleDegrees > 0) {
      const step = radiansOf(snapping.angleDegrees);
      angle = Math.round(angle / step) * step;
    }
    return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach };
  }

  /** Whether a drag has hold of any geometry, rather than writing alone. */
  function carriesGeometry(ids: string[]): boolean {
    const present = sketch.read().objects;
    return ids.some((id) => {
      const object = present.find((candidate) => candidate.id === id);
      return object !== undefined && isPoint(object);
    });
  }

  /**
   * What a move writes on the sheet: from where the first point it carries
   * started to where that point has got to. A drag carrying no geometry says
   * nothing, the way it is held to no steps.
   */
  function travelOf(ids: string[], from: Position[], went: Position): Travel | null {
    if (!carriesGeometry(ids)) return null;
    const start = from[0];
    return { from: start, to: { x: start.x + went.x, y: start.y + went.y } };
  }

  /** What an angle step is counted from: the nearest arm, or the horizontal. */
  function baseAngle(bearing: number): number {
    const arms = pending
      ? armsAt(pending.startId, objects, settled).map((arm) => arm.angle)
      : tracing && tracing.spots.length >= 2
        ? [
            Math.atan2(
              tracing.spots[tracing.spots.length - 2].y - tracing.spots[tracing.spots.length - 1].y,
              tracing.spots[tracing.spots.length - 2].x - tracing.spots[tracing.spots.length - 1].x,
            ),
          ]
        : [];
    let nearest: number | null = null;
    for (const arm of arms) {
      if (
        nearest === null ||
        Math.abs(markSweep(arm, bearing, false)) < Math.abs(markSweep(nearest, bearing, false))
      ) {
        nearest = arm;
      }
    }
    return nearest ?? 0;
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
    const held = tool === "arrow" && !picking ? handleAt(at) : null;
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
      const found = markUnder(at);
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
        const corner = pointUnder(at);
        if (corner) setArming({ corner: corner.id, start: at, at });
        // Off the vertex, the press is on one side of an angle and the drag
        // goes to the other.
        else armFrom.current = pathUnder(at, true)?.id ?? null;
      }
      return;
    }
    if (tool === "polygon") {
      const aim = aimAt(at);
      polygonClick(aim.found, aim.spot);
      return;
    }
    // A drawing tool puts its first point down on the press, so it can be
    // dragged out to the second and released there, or left for a second click.
    if (drawing) {
      const aim = aimAt(at);
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
        ? { handle: held, span: [...spanOfLocus(held.locus)] as [number, number] }
        : null,
      started: false,
    };
    if (held) sketch.beginGesture();
  }

  /** The mark under the pointer, the topmost first, or null. */
  function markUnder(at: Position): SketchMark | null {
    for (let index = objects.length - 1; index >= 0; index -= 1) {
      const object = objects[index];
      if (isMark(object) && nearMark(object, at, { scale, settled, objects })) return object;
    }
    return null;
  }

  /**
   * What a half-drawn object says about itself while it is being placed, all of
   * it drawn on the sheet rather than beside the pointer: how long it is so
   * far, written along it; every angle it makes, written at an arc drawn in
   * that angle; and for a polygon the area it would close at, written where the
   * shape is. It is gone the moment the object lands, since a measurement is
   * the way to keep a number.
   */
  function guideOf(): Guide | null {
    // A move says how far it has gone and which way, read off the horizontal
    // the way a straight object drawn from a bare point is, so what the steps
    // are holding it to is there to be read rather than merely felt.
    // With nothing holding the move there is no step for the run, the length and
    // the angle to read out, so a free drag says nothing and simply moves.
    if (travel && snapping.moving) {
      const corner = wedgeOfArms(travel.from, travel.to, [0]);
      return {
        length: alongText(travel.from, travel.to),
        corners: corner ? [corner] : [],
        datum: travel.from,
        travel,
      };
    }
    // A circle being drawn out says how far its rim is from its centre, which
    // is the number the length steps are holding while it is drawn. The radius
    // itself is not part of the circle, so the line the number sits on is drawn
    // faintly, the way a move's run is.
    if (pending && pending.tool === "compass") {
      return {
        length: alongText(pending.start, pending.at),
        corners: [],
        travel: { from: pending.start, to: pending.at },
      };
    }
    if (pending && pending.tool === "straightedge") {
      // The angle is against whatever already runs out of the point it started
      // from, and the nearest of those is the wedge it is being drawn inside.
      // From a point with nothing at it, it is against the horizontal, which is
      // what the angle snapping counts from as well.
      const arms = armsAt(pending.startId, objects, settled).map((arm) => arm.angle);
      const corner = wedgeOfArms(pending.start, pending.at, arms.length > 0 ? arms : [0]);
      return {
        length: alongText(pending.start, pending.at),
        corners: corner ? [corner] : [],
        datum: arms.length === 0 ? pending.start : undefined,
      };
    }
    if (tracing && tracing.spots.length > 0) {
      const last = tracing.spots[tracing.spots.length - 1];
      const ring = [...tracing.spots, tracing.at];
      // The first edge has no corner behind it, so it reads off the horizontal
      // the way a straight object drawn from a bare point does.
      const first = ring.length < 3 ? wedgeOfArms(last, tracing.at, [0]) : null;
      return {
        length: alongText(last, tracing.at),
        datum: first ? last : undefined,
        // Every corner of the shape as it stands, so the whole figure can be
        // read while it is being laid rather than one angle at a time.
        corners: first
          ? [first]
          : ring.flatMap((corner, nth) => {
              const before = ring[(nth + ring.length - 1) % ring.length];
              const after = ring[(nth + 1) % ring.length];
              const wedge = cornerArc(
                corner,
                angleBetween(corner, before),
                angleBetween(corner, after),
              );
              return wedge ? [wedge] : [];
            }),
        area:
          tracing.spots.length >= 2
            ? { at: middleOf(ring), turn: 0, dy: 5, text: sayArea(shoelace(ring)) }
            : undefined,
      };
    }
    return null;
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

  /** The way one spot lies from another. */
  function angleBetween(from: Position, to: Position): number {
    return Math.atan2(to.y - from.y, to.x - from.x);
  }

  /** The angle a line being drawn makes with the nearest arm at its corner. */
  function wedgeOfArms(corner: Position, to: Position, arms: number[]): GuideAngle | null {
    if (arms.length === 0 || (corner.x === to.x && corner.y === to.y)) return null;
    const bearing = angleBetween(corner, to);
    let nearest = arms[0];
    for (const arm of arms) {
      if (Math.abs(markSweep(arm, bearing, false)) < Math.abs(markSweep(nearest, bearing, false))) {
        nearest = arm;
      }
    }
    return cornerArc(corner, nearest, bearing);
  }

  /** One angle: the arc drawn in it, and its size written just outside that. */
  function cornerArc(corner: Position, from: number, to: number): GuideAngle | null {
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

  /** The middle of a ring of corners, which is where its area is written. */
  function middleOf(corners: Position[]): Position {
    const sum = corners.reduce((held, corner) => ({ x: held.x + corner.x, y: held.y + corner.y }), {
      x: 0,
      y: 0,
    });
    return { x: sum.x / corners.length, y: sum.y / corners.length };
  }

  /**
   * Where the number on an angle hangs: along the bisector of the angle it is
   * about, far enough out to clear the marking on it. The reflex angle is on
   * the other side of the corner, so turning one round moves its number over.
   */
  function angleReadingSpot(
    reading: SketchMeasurement,
    mark: SketchMark,
    reflex: boolean,
  ): Position | null {
    const [one, corner, other] = reading.of;
    const spot = settled.points.get(corner);
    const a = settled.points.get(one);
    const b = settled.points.get(other);
    if (!spot || !a || !b) return null;
    const from = Math.atan2(a.y - spot.y, a.x - spot.x);
    const to = Math.atan2(b.y - spot.y, b.x - spot.x);
    const middle = from + markSweep(from, to, false) / 2;
    const bisector = reflex ? middle + Math.PI : middle;
    const box = readingBox({ ...reading, reflex });
    const way = { x: Math.cos(bisector), y: Math.sin(bisector) };
    const clear =
      markReach(mark) +
      ANGLE_READING_OFF +
      (Math.abs(way.x) * box.width + Math.abs(way.y) * box.height) / 2;
    return { x: spot.x + (way.x * clear) / scale, y: spot.y + (way.y * clear) / scale };
  }

  /**
   * A reading of what was clicked, where the Measure tool can take one from it:
   * a length off a segment, an area off a fill or a circle, an angle off an
   * angle mark or off a corner with two straight objects at it. Anything else
   * is measured from the Measure menu, with the objects picked first.
   *
   * It lands beside what it reads rather than at the pointer, so the figure is
   * not covered by the number taken off it.
   */
  function readingFrom(at: Position): Written | null {
    const hit = objectAt(at, { objects: objects, scale, settled });
    if (!hit) return null;
    const off = (spot: Position, way: Position, far: number) => ({
      x: spot.x + way.x * (far / scale),
      y: spot.y + way.y * (far / scale),
    });
    if (measuring === "length" && isLine(hit) && hit.form === "segment") {
      const along = settled.lines.get(hit.id);
      const ends = endsOf(hit);
      if (!along || !ends) return null;
      const mid = { x: (along.a.x + along.b.x) / 2, y: (along.a.y + along.b.y) / 2 };
      const out = outwardOf(along, ends);
      // Far enough out that the whole of the number clears the segment, which
      // is further on a steep one, where the number lies across it rather than
      // along it.
      const made = newReading("length", [hit.id], mid);
      const box = readingBox(made);
      const clear = READING_OFF + (Math.abs(out.x) * box.width + Math.abs(out.y) * box.height) / 2;
      return { reading: { ...made, ...shift(mid, off(mid, out, clear), made) }, mark: null };
    }
    if (measuring === "area") {
      if (isInterior(hit)) {
        const corners = settled.shapes.get(hit.id);
        const inside = filledPath(hit);
        const round = inside ? settled.circles.get(inside) : undefined;
        const middle = corners
          ? {
              x: corners.reduce((sum, corner) => sum + corner.x, 0) / corners.length,
              y: corners.reduce((sum, corner) => sum + corner.y, 0) / corners.length,
            }
          : round?.at;
        if (!middle) return null;
        return { reading: newReading("area", [hit.id], middle), mark: null };
      }
      if (isCircle(hit)) {
        const round = settled.circles.get(hit.id);
        if (!round) return null;
        return { reading: newReading("area", [hit.id], round.at), mark: null };
      }
      return null;
    }
    if (measuring === "angle") {
      const corner = isMark(hit) && !("path" in hit) ? hit.corner : isPoint(hit) ? hit.id : null;
      if (!corner) return null;
      const at3 =
        isMark(hit) && !("path" in hit) ? [hit.arms[0], corner, hit.arms[1]] : cornerArms(corner);
      if (!at3) return null;
      return angleWritten({ corner, arms: [at3[0], at3[2]] }, hit);
    }
    return null;
  }

  /**
   * The number for one angle, said by its corner and the two arms it runs
   * between, and the mark it has to be given first. `hit` is whatever was under
   * the pointer, where a click is what asked; nothing, where a drag or the
   * dialog named the arms itself.
   */
  function angleWritten(
    angle: { corner: string; arms: [string, string] },
    hit: SketchObject | null,
    named = false,
  ): Written | null {
    const { corner, arms } = angle;
    {
      const at3 = [arms[0], corner, arms[1]];
      const spot = settled.points.get(corner);
      const ends = arms.map((id) => settled.points.get(id));
      if (!spot || ends.some((end) => end === undefined)) return null;
      // An angle has two sizes, and both can be on the sheet. The first click
      // reads the angle itself; asking again reads the reflex angle, which goes
      // on the other side of the corner so the two never sit on each other.
      const taken = (reflex: boolean) =>
        objects.some(
          (object) =>
            isMeasurement(object) &&
            object.measure === "angle" &&
            sameAngle(object.of, at3) &&
            (object.reflex === true) === reflex,
        );
      // Clicking the same corner again is how the reflex angle is asked for, so
      // a click that lands where a number already is means the other way round.
      // Naming an angle is not that: a row picked out of the dialog, or a drag
      // from one side to the other, said which angle it wanted, and the answer
      // to that is the angle it named or the number already on it.
      const reflex = !named && taken(false) && !taken(true);
      // An angle has to be marked before it can be read: the arcs say which of
      // the angles at that corner the number is about. One already there is
      // used as it is, and the number goes outside it.
      const mark = angleMarkOn({ corner, arms, reflex }, hit);
      const made = { ...newReading("angle", at3, spot), reflex };
      const hangs = angleReadingSpot(made, mark, reflex);
      return {
        reading: hangs ? { ...made, ...hangs } : made,
        mark: objects.some((object) => object.id === mark.id) ? null : mark,
      };
    }
  }

  /**
   * The reading already on the sheet that says what this one would say. The
   * same thing is read once: a click on something that already carries the
   * number the tool would write goes to that one rather than laying another of
   * it on top, and the preview says so before the click.
   */
  /**
   * Whether two readings are of the same thing. An angle is three points and the
   * middle one is the corner, so the same three points name three different
   * angles: ∠BEC and ∠ECB are B, E and C either way round, and only where they
   * turn about the same point are they the one angle. Comparing them as a bag of
   * ids says every one of them is already on the sheet.
   */
  function sameMeasured(one: SketchMeasurement, other: SketchMeasurement): boolean {
    if (one.measure !== other.measure || one.of.length !== other.of.length) return false;
    if (one.measure !== "angle" || one.of.length !== 3) {
      return one.of.every((id) => other.of.includes(id));
    }
    if (one.of[1] !== other.of[1]) return false;
    return (
      (one.of[0] === other.of[0] && one.of[2] === other.of[2]) ||
      (one.of[0] === other.of[2] && one.of[2] === other.of[0])
    );
  }

  /** The same three points, read about the same corner, whichever arm comes first. */
  function sameAngle(of: string[], at3: string[]): boolean {
    if (of.length !== 3 || at3.length !== 3 || of[1] !== at3[1]) return false;
    return (of[0] === at3[0] && of[2] === at3[2]) || (of[0] === at3[2] && of[2] === at3[0]);
  }

  function readingAlready(written: Written): SketchMeasurement | null {
    const wanted = written.reading;
    const found = objects.find(
      (object) =>
        isMeasurement(object) &&
        sameMeasured(object, wanted) &&
        (object.reflex === true) === (wanted.reflex === true),
    );
    return found && isMeasurement(found) ? found : null;
  }

  /** The mark on an angle, made where that way round is not marked already. */
  function angleMarkOn(
    angle: { corner: string; arms: [string, string]; reflex: boolean },
    hit: SketchObject | null,
  ): SketchMark {
    const { corner, arms, reflex } = angle;
    if (hit && isMark(hit) && !("path" in hit) && (hit.reflex === true) === reflex) return hit;
    const already = objects.find(
      (object) =>
        isMark(object) &&
        !("path" in object) &&
        object.corner === corner &&
        object.arms.every((arm) => arms.includes(arm)) &&
        (object.reflex === true) === reflex,
    );
    if (already && isMark(already)) return already;
    const sides = armsAt(corner, objects, settled)
      .filter((arm) => arms.includes(arm.end))
      .map((arm) => arm.side);
    return createAngleMark({
      corner,
      arms,
      sides: [sides[0], sides[1]] as [string, string],
      strokes: lastMark.current.angle,
      reflex,
      radius: clearOfCorner(corner),
    });
  }

  /**
   * Which way is out of the figure at a segment: away from the middle of
   * everything its ends are joined to, so a number taken off a polygon's edge
   * lands outside the polygon rather than across it. With nothing joined to it
   * there is no inside to be out of, so it goes up the page.
   */
  function outwardOf(along: LineGeometry, ends: [string, string]): Position {
    const way = { x: along.b.x - along.a.x, y: along.b.y - along.a.y };
    const length = Math.hypot(way.x, way.y) || 1;
    const across = { x: -way.y / length, y: way.x / length };
    const up = across.y > 0 ? { x: -across.x, y: -across.y } : across;
    const ring = joinedTo(ends);
    if (ring.length < 3) return up;
    const middle = {
      x: ring.reduce((sum, spot) => sum + spot.x, 0) / ring.length,
      y: ring.reduce((sum, spot) => sum + spot.y, 0) / ring.length,
    };
    const mid = { x: (along.a.x + along.b.x) / 2, y: (along.a.y + along.b.y) / 2 };
    const outward = (mid.x - middle.x) * across.x + (mid.y - middle.y) * across.y;
    if (Math.abs(outward) < 1e-9) return up;
    return outward > 0 ? across : { x: -across.x, y: -across.y };
  }

  /** Every point joined to these ones by straight objects, however far along. */
  function joinedTo(ends: string[]): Position[] {
    const seen = new Set<string>(ends);
    const queue = [...ends];
    while (queue.length > 0) {
      const id = queue.shift() as string;
      for (const arm of armsAt(id, objects, settled)) {
        if (seen.has(arm.end)) continue;
        seen.add(arm.end);
        queue.push(arm.end);
      }
    }
    return [...seen]
      .map((id) => settled.points.get(id))
      .filter((spot): spot is SketchPoint => spot !== undefined);
  }

  /** About how big a reading comes out on screen, before it has been drawn. */
  function readingBox(made: SketchMeasurement): { width: number; height: number } {
    return {
      width: readingFor(made).value.length * READING_CHAR,
      height: READING_HEIGHT,
    };
  }

  /** A reading moved from where it hangs now to where it should hang. */
  function shift(was: Position, to: Position, made: SketchMeasurement): Position {
    return { x: made.x + (to.x - was.x), y: made.y + (to.y - was.y) };
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

  /**
   * The dimension a length is drawn out as: the arrows from one end of the
   * segment to the other, run out to wherever the number has been dragged, and
   * the dotted lines back to the segment where it carries them.
   *
   * The number itself is drawn over the sheet, so what is drawn here is only
   * what runs around it: where it sits is what says how far off the segment the
   * whole dimension stands.
   */
  function dimensionOf(reading: SketchMeasurement): {
    lines: string[];
    heads: string[];
    dotted: string[];
  } | null {
    if (reading.measure !== "length" || !reading.bounds) return null;
    const along = settled.lines.get(reading.of[0]);
    if (!along) return null;
    const way = { x: along.b.x - along.a.x, y: along.b.y - along.a.y };
    const length = Math.hypot(way.x, way.y);
    if (length === 0) return null;
    const u = { x: way.x / length, y: way.y / length };
    const across = { x: -u.y, y: u.x };
    const box = boxes.current.get(reading.id) ?? readingBox(reading);
    // Where the middle of the number sits, and how far off the segment that is.
    const middle = {
      x: reading.x + box.width / 2 / scale,
      y: reading.y + box.height / 2 / scale,
    };
    const mid = { x: (along.a.x + along.b.x) / 2, y: (along.a.y + along.b.y) / 2 };
    const number = (middle.x - mid.x) * across.x + (middle.y - mid.y) * across.y;
    // The arrows run where the number does, except in the full form, where the
    // number stands clear above them instead of being run through.
    const stand =
      reading.bounds === "full"
        ? (Math.abs(across.x) * box.width + Math.abs(across.y) * box.height) / 2 / scale +
          BREAK_GAP / scale
        : 0;
    const off = number - Math.sign(number || 1) * stand;
    const from = { x: along.a.x + across.x * off, y: along.a.y + across.y * off };
    const to = { x: along.b.x + across.x * off, y: along.b.y + across.y * off };
    const head = ARROW_HEAD / scale;
    const wing = ARROW_WING / scale;
    const spot = (at: Position) => `${at.x} ${at.y}`;
    // A filled head, drawn as the triangle it is rather than as two strokes.
    const arrow = (tip: Position, back: Position) => {
      const point = { x: back.x - tip.x, y: back.y - tip.y };
      const far = Math.hypot(point.x, point.y) || 1;
      const runs = { x: (point.x / far) * head, y: (point.y / far) * head };
      const side = { x: -runs.y / head, y: runs.x / head };
      return `M ${spot(tip)} L ${spot({ x: tip.x + runs.x + side.x * wing, y: tip.y + runs.y + side.y * wing })} L ${spot({ x: tip.x + runs.x - side.x * wing, y: tip.y + runs.y - side.y * wing })} Z`;
    };
    const heads = [arrow(from, to), arrow(to, from)];
    const lines: string[] = [];
    if (reading.bounds === "full") {
      lines.push(`M ${spot(from)} L ${spot(to)}`);
    } else {
      // Broken by the number: the runs stop either side of the room it takes
      // along the dimension, so nothing is drawn under it.
      const gap =
        (Math.abs(u.x) * box.width + Math.abs(u.y) * box.height) / 2 / scale + BREAK_GAP / scale;
      const at = (middle.x - along.a.x) * u.x + (middle.y - along.a.y) * u.y;
      const stop = { x: from.x + u.x * (at - gap), y: from.y + u.y * (at - gap) };
      const start = { x: from.x + u.x * (at + gap), y: from.y + u.y * (at + gap) };
      if (at - gap > 0) lines.push(`M ${spot(from)} L ${spot(stop)}`);
      if (at + gap < length) lines.push(`M ${spot(start)} L ${spot(to)}`);
    }
    // The dotted lines run a little past the arrows, the way a drawn dimension
    // is, so the end of the line is clear of the head.
    const past = {
      x: across.x * Math.sign(off || 1) * (LEADER_PAST / scale),
      y: across.y * Math.sign(off || 1) * (LEADER_PAST / scale),
    };
    const dotted = reading.leaders
      ? [
          `M ${spot(along.a)} L ${spot({ x: from.x + past.x, y: from.y + past.y })}`,
          `M ${spot(along.b)} L ${spot({ x: to.x + past.x, y: to.y + past.y })}`,
        ]
      : [];
    return { lines, heads, dotted };
  }

  /** The two straight objects at a corner, as the three points of its angle. */
  function cornerArms(corner: string): [string, string, string] | null {
    const arms = armsAt(corner, objects, settled);
    return arms.length === 2 ? [arms[0].end, corner, arms[1].end] : null;
  }

  /**
   * A reading as the Measure tool writes it: the number alone, at 16px, hung by
   * the middle of what it says rather than by its top left corner, so it sits
   * where it was asked for instead of hanging down and to the right of there.
   */
  function newReading(measure: MeasureKind, of: string[], at: Position): SketchMeasurement {
    const made = { ...createMeasurement(measure, of, at), size: READING_POINTS, bare: true };
    const box = readingBox(made);
    return { ...made, x: at.x - box.width / 2 / scale, y: at.y - box.height / 2 / scale };
  }

  /** The point under the pointer, which is what an angle is marked at. */
  function pointUnder(at: Position): SketchPoint | null {
    for (let index = points.length - 1; index >= 0; index -= 1) {
      const point = points[index];
      if (distance(point, at) <= radiusOf(point) / scale + slackAt(scale)) return point;
    }
    return null;
  }

  /** The arcs an angle would land as, drawn while it is being asked about. */
  function arcsBetween(corner: string, arms: [string, string], reflex: boolean): string[] {
    const spot = settled.points.get(corner);
    const ends = arms.map((id) => settled.points.get(id));
    if (!spot || ends.some((end) => end === undefined)) return [];
    const [one, other] = ends as SketchPoint[];
    const from = Math.atan2(one.y - spot.y, one.x - spot.x);
    const to = Math.atan2(other.y - spot.y, other.x - spot.x);
    const sweep = markSweep(from, to, reflex);
    return markStrokes(
      {
        form: "angle",
        at: { x: spot.x, y: spot.y },
        from,
        sweep,
        strokes: lastMark.current.angle,
        radius: lastMark.current.radius,
        square: isRightAngle(sweep),
      },
      scale,
    );
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
    const hangs = alone ? angleReadingSpot(alone, turned, reflex) : null;
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
    const mark = angleMarkOn({ corner, arms, reflex }, null);
    addMark(mark);
    setPanel(mark.id);
  }

  /** Write the number for one angle, by the two arms it runs between. */
  function readAngle(corner: string, arms: [string, string]) {
    const written = angleWritten({ corner, arms }, null, true);
    if (!written) return;
    const already = readingAlready(written);
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
      const spot = over ? pointUnder(over) : null;
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
      const would = over ? readingFrom(over) : null;
      const already = would ? readingAlready(would) : null;
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
      const aim = aimAt(at);
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
      const went = heldMove(state.movingIds, {
        x: at.x - state.origin.x,
        y: at.y - state.origin.y,
      });
      moveBy({ ids: state.movingIds, from: state.moving }, went.x, went.y);
      setTravel(travelOf(state.movingIds, state.moving, went));
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
      const written = readingFrom(at);
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
      const already = readingAlready(written);
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
      const aim = aimAt(at);
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
      const found = snapAt(at);
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
    const found = markUnder(at);
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
   * What a click at this spot would land on. A point already there wins, then
   * the crossing of two straight objects, then the one straight object under
   * the pointer, which a new point would belong to.
   */
  function snapAt(at: Position): Snap | null {
    const over = objectAt(at, { objects: objects, scale, settled });
    if (over && isPoint(over))
      return { kind: "point", ids: [over.id], at: { x: over.x, y: over.y } };
    // The paths the pointer is on, the newest first, as picking has them.
    const near: { id: string; along: PathGeometry }[] = [];
    for (let index = objects.length - 1; index >= 0; index -= 1) {
      const object = objects[index];
      if (!isLine(object) && !isCircle(object) && !isArc(object)) continue;
      const along = pathIn(settled, object.id);
      if (along && distanceToPath(along, at) <= slack) near.push({ id: object.id, along });
    }
    if (near.length === 0) return null;
    for (let one = 0; one < near.length; one += 1) {
      for (let other = one + 1; other < near.length; other += 1) {
        // Two paths can meet twice, so the one being pointed at is the one the
        // click builds, and which of the two it is holds still as they move.
        const met = crossings(near[one].along, near[other].along);
        const pick = met.findIndex((spot) => distance(spot, at) <= CROSS_REACH / scale);
        if (pick !== -1) {
          return { kind: "cross", ids: [near[one].id, near[other].id], pick, at: met[pick] };
        }
      }
    }
    const first = near[0];
    return {
      kind: "line",
      ids: [first.id],
      at: spotOnPath(first.along, alongPath(first.along, at)),
    };
  }

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
    const went = heldMove(written.current.ids, by);
    moveBy(written.current, went.x, went.y);
    setTravel(travelOf(written.current.ids, written.current.from, went));
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

  /** The triangle an arrowhead is drawn as, in sheet units. */
  function arrowPoints(handle: Handle): string {
    const size = ARROW_SIZE / scale;
    const back = {
      x: handle.at.x - handle.way.x * size,
      y: handle.at.y - handle.way.y * size,
    };
    const side = { x: -handle.way.y * size * 0.42, y: handle.way.x * size * 0.42 };
    return [
      `${handle.at.x},${handle.at.y}`,
      `${back.x + side.x},${back.y + side.y}`,
      `${back.x - side.x},${back.y - side.y}`,
    ].join(" ");
  }

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

  /** An arc as an SVG path: a stretch of its circle, or the run it flattened to. */
  function arcPath(arc: ArcGeometry): string {
    if (arc.flat) {
      return `M ${arc.flat[0].x} ${arc.flat[0].y} L ${arc.flat[1].x} ${arc.flat[1].y}`;
    }
    const start = spotOnPath(arc, 0);
    const end = spotOnPath(arc, 1);
    const large = Math.abs(arc.sweep) > Math.PI ? 1 : 0;
    // A sweep the positive way is clockwise on screen, which is what SVG calls
    // its sweep flag.
    const way = arc.sweep > 0 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${arc.radius} ${arc.radius} 0 ${large} ${way} ${end.x} ${end.y}`;
  }

  /** An arc's fill: out to its centre, or cut off by its chord. */
  function wedgePath(arc: ArcGeometry, wedge: "sector" | "segment"): string {
    const shape = arcPath(arc);
    return wedge === "sector" ? `${shape} L ${arc.at.x} ${arc.at.y} Z` : `${shape} Z`;
  }

  /**
   * A path lit up because a click would land on it, or because a panel is
   * pointing at it. Hidden objects are lit too: that band is the only way to
   * see where one sits before it is shown again.
   */
  /**
   * What lighting an object up should actually light. An angle is three points
   * and nothing else, which lights three dots and leaves the reader to work out
   * which angle was meant; the arms are what say that, so they are lit too. It
   * is the same for an angle mark, which knows its own two sides.
   */
  function litWith(id: string): string[] {
    const object = everything.find((candidate) => candidate.id === id);
    if (!object) return [id];
    if (isMark(object) && !("path" in object)) return [id, ...object.sides];
    if (!isMeasurement(object) || object.measure !== "angle" || object.of.length !== 3) {
      return [id];
    }
    const [one, corner, other] = object.of;
    const sides = everything
      .filter((side) => {
        const ends = isLine(side) && side.span.kind === "through" ? side.span.ends : null;
        if (!ends?.includes(corner)) return false;
        return ends.includes(one) || ends.includes(other);
      })
      .map((side) => side.id);
    return [id, ...sides];
  }

  function litPath(id: string) {
    const object = everything.find((candidate) => candidate.id === id);
    if (!object) return null;
    if (isArc(object)) {
      const arc = settled.arcs.get(object.id);
      return arc ? (
        <path
          key={id}
          className="canvas__snap-band canvas__snap-band--round"
          d={arcPath(arc)}
          vectorEffect="non-scaling-stroke"
        />
      ) : null;
    }
    if (isCircle(object)) {
      const round = settled.circles.get(object.id);
      return round ? (
        <circle
          key={id}
          className="canvas__snap-band canvas__snap-band--round"
          cx={round.at.x}
          cy={round.at.y}
          r={round.radius}
          vectorEffect="non-scaling-stroke"
        />
      ) : null;
    }
    if (isInterior(object)) {
      const inside = filledPath(object);
      if (inside) {
        const wedge = wedgeOf(object);
        const arc = wedge ? settled.arcs.get(inside) : undefined;
        if (arc) {
          return (
            <path
              key={id}
              className="canvas__snap-band canvas__snap-band--round"
              d={wedgePath(arc, wedge as "sector")}
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        const round = settled.circles.get(inside);
        return round ? (
          <circle
            key={id}
            className="canvas__snap-band canvas__snap-band--round"
            cx={round.at.x}
            cy={round.at.y}
            r={round.radius}
            vectorEffect="non-scaling-stroke"
          />
        ) : null;
      }
      const corners = settled.shapes.get(object.id);
      return corners ? (
        <polygon
          key={id}
          className="canvas__snap-band canvas__snap-band--round"
          points={corners.map((corner) => `${corner.x},${corner.y}`).join(" ")}
          vectorEffect="non-scaling-stroke"
        />
      ) : null;
    }
    if (isPoint(object)) {
      const spot = ends.get(object.id);
      return spot ? (
        <circle
          key={id}
          className="canvas__snap"
          cx={spot.x}
          cy={spot.y}
          r={(radiusOf(spot) + 5.5) / scale}
          vectorEffect="non-scaling-stroke"
        />
      ) : null;
    }
    const span = isLine(object) ? spanOf(object) : null;
    return span ? (
      <line
        key={id}
        className="canvas__snap-band"
        x1={span[0].x}
        y1={span[0].y}
        x2={span[1].x}
        y2={span[1].y}
        vectorEffect="non-scaling-stroke"
      />
    ) : null;
  }

  /** The ring at a snap: around the dot it found, or a fixed one on a path. */
  function snapRadius(found: Snap): number {
    const point = found.kind === "point" ? ends.get(found.ids[0]) : undefined;
    return (point ? radiusOf(point) + 5.5 : SNAP_RING) / scale;
  }

  const guide = guideOf();

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
        x:
          (readingOpen.x - view.x) * scale +
          (boxes.current.get(readingOpen.id)?.width ?? readingBox(readingOpen).width) / 2,
        y: (readingOpen.y - view.y) * scale - 10,
      }
    : null;

  return (
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
        {/* The dots keep their size on screen, so their radii are divided by
            the scale and their strokes are left unscaled. */}
        <svg className="canvas__objects" aria-hidden="true">
          <g transform={`scale(${scale}) translate(${-view.x} ${-view.y})`}>
            {/* Fills go down first, so what sits on them stays visible. */}
            {objects.map((object) => {
              if (!isInterior(object)) return null;
              const kind = `canvas__interior${
                selection.includes(object.id) ? " canvas__interior--selected" : ""
              }`;
              const inside = filledPath(object);
              if (inside) {
                const wedge = wedgeOf(object);
                const arc = wedge ? settled.arcs.get(inside) : undefined;
                if (arc) {
                  return (
                    <path
                      key={object.id}
                      data-id={object.id}
                      className={kind}
                      style={fillLook(object, true)}
                      d={wedgePath(arc, wedge as "sector")}
                    />
                  );
                }
                const where = settled.circles.get(inside);
                return where ? (
                  <circle
                    key={object.id}
                    data-id={object.id}
                    className={kind}
                    style={fillLook(object, true)}
                    cx={where.at.x}
                    cy={where.at.y}
                    r={where.radius}
                  />
                ) : null;
              }
              const corners = settled.shapes.get(object.id);
              if (!corners) return null;
              return (
                <polygon
                  key={object.id}
                  data-id={object.id}
                  className={kind}
                  style={fillLook(object, true)}
                  points={corners.map((corner) => `${corner.x},${corner.y}`).join(" ")}
                />
              );
            })}
            {objects.map((object) => {
              if (!isLocus(object)) return null;
              const shape = settled.loci.get(object.id);
              return shape ? drawLocus(object.id, shape, false) : null;
            })}
            {handles.map((handle) => (
              <polygon
                key={`${handle.locus}-${handle.end}`}
                className="canvas__locus-arrow"
                points={arrowPoints(handle)}
              />
            ))}
            {objects.map((object) => {
              if (!isArc(object)) return null;
              const arc = settled.arcs.get(object.id);
              if (!arc) return null;
              return (
                <g key={object.id} data-id={object.id}>
                  {selection.includes(object.id) && (
                    <path
                      className="canvas__circle-halo"
                      d={arcPath(arc)}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <path
                    className="canvas__circle"
                    style={strokeLook(object)}
                    d={arcPath(arc)}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
            {objects.map((object) => {
              if (!isCircle(object)) return null;
              const round = settled.circles.get(object.id);
              if (!round) return null;
              return (
                <g key={object.id} data-id={object.id}>
                  {selection.includes(object.id) && (
                    <circle
                      className="canvas__circle-halo"
                      cx={round.at.x}
                      cy={round.at.y}
                      r={round.radius}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <circle
                    className="canvas__circle"
                    style={strokeLook(object)}
                    cx={round.at.x}
                    cy={round.at.y}
                    r={round.radius}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
            {objects.map((object) => {
              if (!isLine(object)) return null;
              const span = spanOf(object);
              if (!span) return null;
              return (
                <g key={object.id} data-id={object.id}>
                  {selection.includes(object.id) && (
                    <line
                      className="canvas__line-halo"
                      x1={span[0].x}
                      y1={span[0].y}
                      x2={span[1].x}
                      y2={span[1].y}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  <line
                    className="canvas__line"
                    style={strokeLook(object)}
                    x1={span[0].x}
                    y1={span[0].y}
                    x2={span[1].x}
                    y2={span[1].y}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
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
                  return arcsBetween(overCorner, there[0].arms, false).map((stroke) => (
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
                    {arcsBetween(choosing.corner, showingArms, false).map((stroke) => (
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
            {points.map((object) => (
              <g key={object.id} data-id={object.id}>
                {selection.includes(object.id) && (
                  <circle
                    className="canvas__halo"
                    cx={object.x}
                    cy={object.y}
                    r={(radiusOf(object) + 4.5) / scale}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                <circle
                  className="canvas__point"
                  style={fillLook(object, false)}
                  cx={object.x}
                  cy={object.y}
                  r={radiusOf(object) / scale}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
            {spotlight && litWith(spotlight).map((id) => litPath(id))}
            {lit && lit !== spotlight && litWith(lit).map((id) => litPath(id))}
            {under &&
              under !== spotlight &&
              !selection.includes(under) &&
              litWith(under).map((id) => litPath(id))}
            {litReading.map((id) => litPath(id))}
            {snap && (
              <g>
                {/* The paths a click would attach to, or whose crossing it
                    would build, lit the whole way along. */}
                {snap.kind !== "point" && snap.ids.map((id) => litPath(id))}
                <circle
                  className="canvas__snap"
                  cx={snap.at.x}
                  cy={snap.at.y}
                  r={snapRadius(snap)}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )}
            {marks.map((mark) => {
              const point = ends.get(mark.id);
              if (point) {
                return (
                  <circle
                    key={mark.id}
                    className="canvas__mark"
                    cx={point.x}
                    cy={point.y}
                    r={(radiusOf(point) + 7) / scale}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }
              const line = objects.find((object) => object.id === mark.id);
              const span = line && isLine(line) ? spanOf(line) : null;
              return span ? (
                <line
                  key={mark.id}
                  className="canvas__mark-band"
                  x1={span[0].x}
                  y1={span[0].y}
                  x2={span[1].x}
                  y2={span[1].y}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null;
            })}
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
                const inside = filledPath(object);
                if (inside) {
                  const wedge = wedgeOf(object);
                  const arc = wedge ? previewSettled.arcs.get(inside) : undefined;
                  if (arc) {
                    return (
                      <path
                        key={object.id}
                        className="canvas__interior canvas__interior--preview"
                        d={wedgePath(arc, wedge as "sector")}
                      />
                    );
                  }
                  const where = previewSettled.circles.get(inside);
                  return where ? (
                    <circle
                      key={object.id}
                      className="canvas__interior canvas__interior--preview"
                      cx={where.at.x}
                      cy={where.at.y}
                      r={where.radius}
                    />
                  ) : null;
                }
                const corners = previewSettled.shapes.get(object.id);
                return corners ? (
                  <polygon
                    key={object.id}
                    className="canvas__interior canvas__interior--preview"
                    points={corners.map((corner) => `${corner.x},${corner.y}`).join(" ")}
                  />
                ) : null;
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
            {readings.filter(isMeasurement).map((reading) => {
              const drawn = dimensionOf(reading);
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
            {guide && (
              <g>
                {guide.travel && (
                  <line
                    className="canvas__guide-travel"
                    x1={guide.travel.from.x}
                    y1={guide.travel.from.y}
                    x2={guide.travel.to.x}
                    y2={guide.travel.to.y}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {guide.datum && (
                  <line
                    className="canvas__guide-datum"
                    x1={guide.datum.x}
                    y1={guide.datum.y}
                    x2={guide.datum.x + (GUIDE_RADIUS + GUIDE_OFF) / scale}
                    y2={guide.datum.y}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {guide.corners.map((corner) => (
                  <path
                    key={corner.arc}
                    className="canvas__guide-arc"
                    d={corner.arc}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {[
                  guide.length,
                  ...guide.corners.map((corner) => corner.text),
                  ...(guide.area ? [guide.area] : []),
                ].map((part, nth) => (
                  <text
                    // biome-ignore lint/suspicious/noArrayIndexKey: two corners of a figure can read the same
                    key={nth}
                    className="canvas__guide"
                    textAnchor="middle"
                    transform={`translate(${part.at.x} ${part.at.y}) rotate(${part.turn}) scale(${1 / scale})`}
                    dy={part.dy}
                  >
                    {part.text}
                  </text>
                ))}
              </g>
            )}
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
                pointerEvents: (tool === "arrow" || tool === "text") && !picking ? "auto" : "none",
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
                found && isMeasurement(found) ? [...found.of, ...litWith(found.id)] : [],
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
  );
}
