import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { type Labelling, labelAnchor, labelOff } from "../sketch/labelling";
import {
  anglesAt,
  angleWanted,
  armsAt,
  cornerOf,
  fromSheetTerms,
  placesFor,
  quantitiesOf,
  readingOf,
  readingOfValue,
  sayQuantity,
} from "../sketch/measure";
import {
  type CaptionAlign,
  centreOf,
  clipToRect,
  contentBounds,
  createAngleMark,
  createCircle,
  createInterior,
  createPoint,
  distance,
  edgesRound,
  endsById,
  isArc,
  isButton,
  isCaption,
  isCircle,
  isFunction,
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
  type LineForm,
  lineThrough,
  type MarkForm,
  markAlong,
  markShape,
  markStrokes,
  markSweep,
  nameable,
  namesFor,
  objectAt,
  objectsTouching,
  type PanFrom,
  type PointSize,
  type Position,
  pannedView,
  panTravel,
  pathIn,
  pointOnPath,
  pointsOf,
  type Rect,
  rectBetween,
  type SketchCalculation,
  type SketchCaption,
  type SketchFunction,
  type SketchLine,
  type SketchMeasurement,
  type SketchObject,
  type SketchParameter,
  type SketchPoint,
  settle,
  slackAt,
  spotOnPath,
  union,
  type View,
} from "../sketch/model";
import { demotedUnder } from "../sketch/overlaps";
import { togglePick } from "../sketch/picking";
import type { Sketch } from "../sketch/useSketch";
import { type AngleChoice, AngleChoiceDialog } from "./AngleChoiceDialog";
import { ButtonBox } from "./ButtonBox";
import { CaptionBox } from "./CaptionBox";
import { guideOf } from "./canvas/guides";
import { handlesOn } from "./canvas/handles";
import { type AngleDrag, Arms, Resting, Showing } from "./canvas/layers/Angles";
import { Dimensions } from "./canvas/layers/Dimensions";
import { Boxing, Drawing } from "./canvas/layers/Drawing";
import { Fills } from "./canvas/layers/Fills";
import { GhostCaption, GhostReading } from "./canvas/layers/Ghosts";
import { Guides } from "./canvas/layers/Guides";
import { Holding, MarkCaptions } from "./canvas/layers/Holding";
import { type LabelEdit, Labels } from "./canvas/layers/Labels";
import { Lit } from "./canvas/layers/Lit";
import { Loci } from "./canvas/layers/Locus";
import { MarkGhost, Marks } from "./canvas/layers/Marks";
import { Paths } from "./canvas/layers/Paths";
import { Points } from "./canvas/layers/Points";
import { Preview } from "./canvas/layers/Preview";
import { Handles, Marquee, Snapped } from "./canvas/layers/Snapping";
import { litWith } from "./canvas/lighting";
import { type Marking, markUnder } from "./canvas/marks";
import { type Held, moveBy, takeHold } from "./canvas/moving";
import {
  angleWritten,
  type Measuring,
  pointUnder,
  readingAlready,
  readingBox,
  readingFrom,
} from "./canvas/readings";
import { SheetProvider } from "./canvas/SheetContext";
import {
  ANGLE_AIM,
  CAPTION_WIDTH,
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
  type Snap,
  snapKey,
  stopAbove,
  stopBelow,
  type Tracing,
  type Travel,
} from "./canvas/sheet";
import {
  type Aiming,
  aimAt,
  handleAt,
  heldMove,
  lineUnder,
  pathUnder,
  snapAt,
  spanOfLocus,
  travelOf,
} from "./canvas/steps";
import { useCaptions } from "./canvas/useCaptions";
import { useLabelDrag } from "./canvas/useLabelDrag";
import { useMarking } from "./canvas/useMarking";
import { useReading } from "./canvas/useReading";
import { useView } from "./canvas/useView";
import type { HiddenKinds } from "./HiddenPanel";
import { MarkPanel } from "./MarkPanel";
import { MeasurementBox } from "./MeasurementBox";
import { ReadingPanel } from "./ReadingPanel";
import type { Snapping } from "./SnapPanel";
import { TableBox } from "./TableBox";
import { armedForWriting } from "./tools";
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
  /** What the Text tool is armed with: captions, or a relabel run. */
  labelKind: string;
  /** The name the next vertex clicked would take, or null before a run starts. */
  relabelName: string | null;
  onRelabelAsk: (id: string, at: { x: number; y: number }) => void;
  onRelabelGive: (id: string) => void;
  /**
   * A regular polygon was asked for: where its middle goes on the sheet, and
   * where on the screen the box asking should stand. The two are different
   * coordinate spaces, so they are named rather than ordered.
   */
  onRegularAsk: (asked: { spot: Position; at: { x: number; y: number } }) => void;
  /** What the Marker is armed with: equal sides, parallel sides, or an angle. */
  markForm: string;
  /** The whole kinds being kept out of the way, from the Hidden panel. */
  hiddenKinds: HiddenKinds;
}

interface Grab {
  origin: Position;
  /** When the press went down, which is half of what tells a drag from a click. */
  pressed: number;
  /** What sat under the pointer when it went down, if anything. */
  hitId: string | null;
  moved: boolean;
  /** What the drag has hold of, and where each of those started. */
  held: Held | null;
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
  labelKind,
  relabelName,
  onRelabelAsk,
  onRelabelGive,
  onRegularAsk,
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
  const [naming, setNaming] = useState<LabelEdit | null>(null);
  /** What a drag that began inside a caption or a measurement has hold of. */
  const written = useRef<Held | null>(null);
  /** The box the Text tool is dragging out for a caption that is not made yet. */
  const [boxing, setBoxing] = useState<Rect | null>(null);
  /**
   * The angle mark being dragged out: the corner the press landed on, and where
   * the drag has reached. The way it points out of the corner is which of the
   * angles there is being asked for, the reflex one included.
   */
  const [arming, setArming] = useState<AngleDrag | null>(null);
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
  /** Whether the Text tool is over something it could put a label on. */
  const [overNamed, setOverNamed] = useState(false);
  /** The vertex a relabel run would name next, which is the one under the pointer. */
  const [relabelOver, setRelabelOver] = useState<string | null>(null);
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
  const takesWriting = armedForWriting(arrowKind);

  /** The Measure tool, and what it is armed with, or null when it is not up. */
  const measuring = tool === "measure" ? measureKind : null;
  /** What the Marker would mark, or null while it is not the tool that is up. */
  const marking = tool === "marker" ? (markForm as MarkForm) : null;
  /** Whether the polygon tool is armed for the regular one. */
  const regularArmed = polygonKind === "regular";
  /** Whether the Text tool is handing out letters rather than making captions. */
  const relabelling = tool === "text" && labelKind === "relabel";
  /** The tools that put a point down, and so say what a click would land on. */
  const plotting = drawing || tool === "point" || tool === "polygon";
  // The Text tool says what a click would do before it is made: over a thing
  // that can be named it is the hand that shows and hides labels, and over bare
  // sheet it is the box a caption would be dragged out of. The other pointers
  // belong to the label, the caption and its grip, which carry their own.
  const cursor =
    tool === "text" && (relabelling ? relabelOver !== null : overNamed) ? "text-label" : tool;

  const {
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
  } = useMarking({ sketch, objects, settled, scale, view, marking });

  const {
    panel: readingPanel,
    setPanel: setReadingPanel,
    offering,
    offer,
    offerNothing,
    setBounds,
    setLeaders,
    setTied,
    setPlaces,
    setReflex: setReadingReflex,
  } = useReading(sketch);

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

  const { handleScrollX, handleScrollY, handleWheel, positionOf, scaleNow, viewNow, zoomTo } =
    useView({ view, onView, sheet, horizontal, vertical, viewport, area, zoomable });

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

  // Switching tools drops whatever the straightedge was halfway through, and so
  // does arming the polygon for the regular one: it is not clicked out corner by
  // corner, so a trace left in flight would strand its open gesture and the next
  // thing to cancel would roll the page back over what came after. Crossing into
  // or out of that arming is what does it; moving between the fill and the fill
  // with its edges leaves a trace alone, since both are clicked out the same way
  // and the arming is read again at the close.
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
  }, [activeTool, regularArmed, sketch.cancelGesture]);

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
   * Close the polygon and build it: the fill, and its edges too unless the tool
   * is armed for the fill alone. The edges close back to the first corner, so a
   * polygon is a ring however it was clicked out.
   */
  function closePolygon() {
    if (!tracing || tracing.ids.length < 3) return;
    const before = sketch.read();
    const corners = tracing.ids;
    const made: SketchObject[] = [];
    made.push(createInterior(corners));
    if (polygonKind !== "interior") {
      made.push(...edgesRound(corners));
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
          held: null,
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
        held: null,
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
    const onHandle = tool === "arrow" && !picking ? handleAt(at, aimingNow()) : null;
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
        held: null,
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
        else armFrom.current = lineUnder(at, { objects, settled, scale })?.object.id ?? null;
      }
      return;
    }
    if (tool === "polygon") {
      const aim = aimAt(at, aimingNow());
      // The regular one is not clicked out corner by corner. One click says
      // where the middle goes, and the box that opens says what shape.
      if (regularArmed) {
        onRegularAsk({ spot: aim.spot, at: { x: event.clientX, y: event.clientY } });
      } else polygonClick(aim.found, aim.spot);
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
        held: null,
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
      (tool === "arrow" || tool === "text") && !onHandle
        ? objectAt(at, { objects: tool === "arrow" ? pickable : objects, scale, settled })
        : null;
    // Pressing empty canvas clears at once, it does not wait for the release.
    // That is why a marquee, which starts from empty canvas, replaces the
    // selection rather than adding to it. An arrowhead is not empty canvas.
    if (tool === "arrow" && !hit && !onHandle) sketch.select([]);
    // The protractor is dragged from one side of an angle to the other, the
    // way the Angle marker is.
    if (measuring === "angle")
      armFrom.current = lineUnder(at, { objects, settled, scale })?.object.id ?? null;
    grab.current = {
      origin: at,
      pressed: Date.now(),
      hitId: hit?.id ?? null,
      moved: false,
      held: null,
      marquee: null,
      pan: tool === "hand" ? { view, clientX: event.clientX, clientY: event.clientY } : null,
      handle: onHandle
        ? {
            handle: onHandle,
            span: [...spanOfLocus(onHandle.locus, aimingNow())] as [number, number],
          }
        : null,
      started: false,
    };
    if (onHandle) sketch.beginGesture();
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
      snapping,
      handles: handlesOn({ objects, settled }),
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

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch" && fingers.current.has(event.pointerId)) {
      fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    // A marking tool lights the midpoint of a segment it would snap to.
    if (marking && !picking && !grab.current) {
      const over = positionOf(event);
      const under =
        over && marking !== "angle" ? pathUnder(over, { objects, settled, scale }) : null;
      const snapped =
        under && over && markAlong(under.along, over, scale) === 0.5
          ? spotOnPath(under.along, 0.5)
          : null;
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
    if (tool === "text" && !relabelling && !picking && !grab.current) {
      const over = positionOf(event);
      const found = over ? objectAt(over, { objects: objects, scale, settled }) : null;
      const named = found !== null && nameable(found, everything);
      if (named !== overNamed) setOverNamed(named);
    }

    // A relabel run says which vertex the next letter would land on before the
    // click that lands it, with the letter itself drawn faintly where it will go.
    if (relabelling && !picking && !grab.current) {
      const over = positionOf(event);
      const found = over ? pointUnder(over, { objects, scale }) : null;
      if ((found?.id ?? null) !== relabelOver) setRelabelOver(found?.id ?? null);
    } else if (relabelOver !== null) {
      setRelabelOver(null);
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
      offer(would, already?.id ?? null);
    } else {
      offerNothing();
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
      if (tool === "arrow" && state.hitId) state.held = takeHold(state.hitId, sketch);
    }

    const held = state.held;
    if (held) {
      const went = heldMove(
        held.ids,
        { x: at.x - state.origin.x, y: at.y - state.origin.y },
        aimingNow(),
      );
      moveBy(held, went, sketch);
      setTravel(travelOf({ ...held, went }, aimingNow()));
      return;
    }

    // The Text tool drags out the box the new caption will fill. Armed for a
    // relabel run there is no caption to be had, so it drags out nothing.
    if (tool === "text") {
      if (!relabelling && state.moved && !state.hitId) setBoxing(rectBetween(state.origin, at));
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
      const side = objects.find((object) => object.id === fromSide);
      const landed = lineUnder(at, { objects, settled, scale });
      const pair =
        side && landed && landed.object.id !== fromSide ? cornerOf(side, landed.object) : null;
      if (pair) {
        const [from, corner, to] = pair;
        setArming(null);
        if (marking === "angle") markAngle({ corner, arms: [from, to] });
        else readAngle(corner, [from, to]);
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
            markAngle({ corner: armed.corner, arms: there[0].arms });
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
      const under = pathUnder(at, { objects, settled, scale });
      if (!under) {
        setPanel(null);
        return;
      }
      layTick({ path: under.object, along: under.along, spot: at });
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

    // A relabel run: the vertex clicked takes the next letter going, and the
    // first one clicked asks which letter to start at.
    if (relabelling) {
      const found = state.moved ? null : pointUnder(at, { objects, scale });
      if (found) {
        if (relabelName === null) onRelabelAsk(found.id, { x: event.clientX, y: event.clientY });
        else onRelabelGive(found.id);
      }
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
      if (hit && nameable(hit, everything)) onToggleLabel(hit.id);
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

    if (state.held) {
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
    // The ghost letter stands in for the vertex's own label, so leaving the
    // sheet straight off a vertex would leave that label suppressed under it.
    setRelabelOver(null);
    offerNothing();
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
    if (state.held) sketch.endGesture();
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
   * What a Hot Text link says: an object's name, and a measurement's value, so
   * a sentence that quotes a measurement reads the number as it stands now.
   */
  const linkNames = new Map(names);
  for (const measurement of everything.filter(isMeasurement)) {
    linkNames.set(measurement.id, readingFor(measurement).value);
  }

  const { changeCaption, closeCaption, insertLink, makeCaption, settleCaption } = useCaptions({
    sketch,
    linkNames,
    editing,
    onEditing,
    editor,
    onLabelPick,
    look: captionLook,
  });

  const { dragLabel, dropLabel, startLabelDrag } = useLabelDrag({
    sketch,
    tool,
    editing,
    onCloseCaption: closeCaption,
    onLabelPick,
  });

  /** The hidden caption the dock is pointing at, if that is what it is. */
  function ghostAt(id: string | null): SketchCaption | null {
    const found = id ? everything.find((object) => object.id === id) : null;
    return found && isCaption(found) && found.hidden === true ? found : null;
  }

  /** The hidden measurement the dock is pointing at, if that is what it is. */
  function ghostReadingAt(id: string | null) {
    const found = id ? everything.find((object) => object.id === id) : null;
    if (found?.hidden !== true) return null;
    return isValue(found) || isFunction(found) ? found : null;
  }

  /**
   * A drag that began inside a caption or a measurement. The sheet never sees
   * that press, so the writing reports it here and it moves whatever a press on
   * the sheet would: the whole selection when the writing is part of it, the
   * writing alone when it is not.
   */
  function grabWriting(id: string) {
    written.current = takeHold(id, sketch);
  }

  function dragWriting(by: Position) {
    if (!written.current) return;
    const went = heldMove(written.current.ids, by, aimingNow());
    moveBy(written.current, went, sketch);
    setTravel(travelOf({ ...written.current, went }, aimingNow()));
  }

  function dropWriting() {
    setTravel(null);
    if (!written.current) return;
    written.current = null;
    sketch.endGesture();
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

  /**
   * The letter the vertex under the pointer is about to take, drawn where its
   * label will hang. It stands in for that vertex's own label while it is up,
   * so a vertex being renamed is never drawn saying both names at once.
   */
  function relabelGhost() {
    if (relabelName === null || relabelOver === null) return null;
    const object = objects.find((candidate) => candidate.id === relabelOver);
    const at = object ? labelAnchor(labelling, object) : null;
    if (!object || !at) return null;
    return {
      id: object.id,
      name: relabelName,
      at,
      off: object.label?.off ?? labelOff(labelling, object, at),
      look: labelLook(object.label ?? {}),
    };
  }
  const ghost = relabelGhost();

  /** Every label being shown, with where it hangs and how far off it sits. */
  const labels = objects.flatMap((object) => {
    if (!object.label?.shown || object.id === ghost?.id) return [];
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
    <SheetProvider value={{ objects, everything, settled, selection, scale, ends, spanOf, shown }}>
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
              <Loci />
              <Handles />
              <Paths />
              <Drawing tracing={tracing} pending={pending} middle={middle} />
              <Marks />
              <MarkGhost mark={offering.ghost?.mark ?? null} />
              <Arms arming={arming} arcs={armingArcs()} />
              <Resting
                corner={choosing ? null : overCorner}
                marking={marking === "angle"}
                clearOf={clearOfCorner}
                marks={markingNow()}
              />
              <Showing corner={choosing?.corner ?? null} arms={showingArms} marks={markingNow()} />
              <Points />
              {spotlight && <Lit ids={litWith(spotlight, everything)} />}
              {lit && lit !== spotlight && <Lit ids={litWith(lit, everything)} />}
              {under && under !== spotlight && !selection.includes(under) && (
                <Lit ids={litWith(under, everything)} />
              )}
              <Lit ids={litReading} />
              <Snapped snap={snap} />
              <Holding marks={marks} />
              <Preview
                objects={preview}
                points={previewPoints}
                settled={previewSettled}
                spanOf={spanOf}
              />
              <Dimensions boxOf={boxOf} />
              <Guides guide={guide} />
              <Marquee rect={marquee} />
            </g>
          </svg>

          <Labels
            labels={labels}
            view={view}
            scale={scale}
            picked={labelPick}
            reachable={
              (tool === "arrow" ? takesWriting : tool === "text" && !relabelling) && !picking
            }
            ghost={ghost}
            naming={naming}
            onNaming={setNaming}
            onRename={onRename}
            onGrab={startLabelDrag}
            onDrag={dragLabel}
            onDrop={dropLabel}
          />

          {readingOpen && readingSpot && (
            <ReadingPanel
              reading={readingOpen}
              at={readingSpot}
              onBounds={setBounds}
              onLeaders={setLeaders}
              onTie={setTied}
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
              onReflex={(id) => flipReflex(id, measuringNow())}
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
              lit={offering.held === measurement.id}
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
            <GhostReading
              key={measurement.id}
              measurement={measurement}
              reading={readingFor(measurement)}
              view={view}
              scale={scale}
            />
          ))}

          {/* What the Measure tool would write from where the pointer is. */}
          {offering.ghost && (
            <GhostReading
              measurement={offering.ghost.reading}
              reading={readingFor(offering.ghost.reading)}
              view={view}
              scale={scale}
            />
          )}

          {/* Hidden writing pointed at in the dock. Nothing else says where it
            sits, since a hidden object is not drawn at all. */}
          <GhostCaption caption={ghostAt(spotlight)} names={linkNames} view={view} scale={scale} />
          {(() => {
            const hidden = ghostReadingAt(spotlight);
            return hidden ? (
              <GhostReading
                measurement={hidden}
                reading={readingFor(hidden)}
                view={view}
                scale={scale}
              />
            ) : null;
          })()}

          <Boxing boxing={boxing} view={view} scale={scale} />

          <MarkCaptions marks={marks} spotOf={markAt} view={view} scale={scale} />

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
              if (way === "mark") markAngle({ corner, arms });
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
