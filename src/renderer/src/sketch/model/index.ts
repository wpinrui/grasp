/**
 * What a page holds, and the geometry the canvas needs to hit-test it.
 *
 * Objects are stored in sheet coordinates: pixels on a sheet with no edges, y
 * downward. The canvas is a window onto it, `view` is the sheet point at the
 * window's top left corner and `scale` is screen pixels per sheet pixel, so
 * screen = (sheet - view) * scale.
 *
 * A dot keeps its size on screen at every zoom, so the sheet it covers, and
 * with it the reach of a click, is its drawn radius divided by the scale.
 *
 * A point is either free, and can be dragged, or an image with a `from` saying
 * how its parents place it. A line is never free: its `span` says which points
 * and lines put it where it is. Parents always come earlier in the list than
 * what hangs off them, so one pass down settles the whole page.
 */

export {
  createArc,
  createButton,
  createCalculation,
  createCaption,
  createCircle,
  createCustomTransform,
  createFill,
  createFunction,
  createInterior,
  createLine,
  createLocus,
  createMeasurement,
  createParameter,
  createPoint,
  createTable,
  createWedge,
  edgesRound,
  lineThrough,
  pointOnPath,
} from "./create";
export { asDuplicated, asPasted, kinOf, PASTE_STEP, sharedPointSize, withFamily } from "./edit";
export type {
  ArcSpan,
  CaptionAlign,
  CircleSpan,
  Derivation,
  Labelled,
  LabelState,
  LineForm,
  LinePattern,
  LineSpan,
  LineWidth,
  MarkedAngle,
  MarkedRatio,
  MarkedVector,
  PointSize,
  SketchArc,
  SketchCaption,
  SketchCircle,
  SketchInterior,
  SketchLine,
  SketchLocus,
  SketchPoint,
} from "./figures";
export {
  cornersOf,
  DEFAULT_LABEL,
  DEFAULT_POINT_SIZE,
  filledPath,
  LINE_FORMS,
  LINE_PATTERNS,
  LINE_WIDTHS,
  POINT_RADII,
  POINT_SIZES,
  PX_PER_CM,
  parentsOf,
  parentsOfArc,
  parentsOfCircle,
  parentsOfSpan,
  partsOfAngle,
  partsOfRatio,
  partsOfVector,
  radiusOf,
  wedgeOf,
} from "./figures";
export type {
  ArcGeometry,
  CircleGeometry,
  LineGeometry,
  LocusShape,
  PathGeometry,
  Position,
  Rect,
  Settled,
} from "./geometry";
export {
  clipToRect,
  degreesOf,
  distance,
  distanceToLine,
  HALF_TURN,
  inLine,
  insideShape,
  isArcPath,
  isRound,
  MAX_SAMPLES,
  MIN_SAMPLES,
  NEARLY,
  POINT_SAMPLES,
  pathIn,
  QUARTER_TURN,
  radiansOf,
  SAMPLE_STEP,
  SHAPE_SAMPLES,
  setPickReach,
  slackAt,
  TINY,
  toSheet,
  union,
} from "./geometry";
export type { SketchState, SketchWriting, View } from "./guards";
export {
  bodyOf,
  DEFAULT_VIEW,
  EMPTY_SKETCH,
  familyOf,
  isArc,
  isButton,
  isCalculation,
  isCaption,
  isCircle,
  isFunction,
  isInterior,
  isLine,
  isLocus,
  isMark,
  isMeasurement,
  isParameter,
  isPoint,
  isTable,
  isTransform,
  isValue,
  isWriting,
  linkedIn,
  markPath,
  movedBy,
  pointsOf,
} from "./guards";
export { fillLook, strokeLook } from "./look";
export type { MarkShape } from "./marks";
export {
  ANGLE_RADIUS,
  createAngleMark,
  createTick,
  isRightAngle,
  LEAST_ANGLE_RADIUS,
  markAlong,
  markReach,
  markShape,
  markStrokes,
  markSweep,
  nearMark,
  tangentOnPath,
} from "./marks";
export {
  canStartAt,
  nameAt,
  nameable,
  namedWhereShown,
  namesAsBuilt,
  namesFor,
  namesToGive,
} from "./naming";
export { centreOf, type PanFrom, pannedView, panTravel } from "./panning";
export {
  alongPath,
  arcAt,
  circleAt,
  crossing,
  crossings,
  distanceToPath,
  imageOf,
  insideWedge,
  lineAlong,
  spotOnPath,
} from "./paths";
export { endsById, objectAt, objectsTouching, rectBetween } from "./pick";
export { contentBounds, readValuesWith, resolve, settle, withDependents } from "./settle";
export type {
  ButtonAction,
  MarkForm,
  MeasureKind,
  ParameterUnit,
  SketchButton,
  SketchCalculation,
  SketchFunction,
  SketchMark,
  SketchMeasurement,
  SketchObject,
  SketchParameter,
  SketchTable,
  SketchTransform,
  TextLook,
} from "./values";
export { MEASURES, MOST_STROKES, PARAMETER_UNITS } from "./values";
