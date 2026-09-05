/**
 * What a sketch is on disk: one JSON file, `.grasp`, holding the pages and
 * their objects. The selection and the view are things a window does with a
 * page, not part of it, so they are not written.
 *
 * `version` is the seam for later changes to the shape. Anything that is not
 * this shape is refused rather than half-read.
 */

import { BUILT_INS, type Expr, LITERAL_UNITS } from "./expression";
import {
  LINE_FORMS,
  type LineForm,
  type LineSpan,
  MEASURES,
  type MeasureKind,
  namesAsBuilt,
  PARAMETER_UNITS,
  type ParameterUnit,
  POINT_SIZES,
  type PointSize,
  type SketchObject,
} from "./model";
import type { PageContent } from "./pages";
import { ANGLE_UNITS, DISTANCE_UNITS, type Prefs } from "./prefs";

const FORMAT = "grasp-sketch";

/** Bumped when a label started keeping the name it was given. */
const VERSION = 11;

/** The version from which a label carries its own name, and older files are lettered on read. */
const KEPT_NAMES = 11;

interface SketchFile {
  /** Absent on a sketch saved before preferences were in the file. */
  prefs?: Prefs;
  format: typeof FORMAT;
  version: number;
  pages: PageContent[];
}

export function serialise(pages: PageContent[], prefs: Prefs): string {
  const file: SketchFile = { format: FORMAT, version: VERSION, pages, prefs };
  return `${JSON.stringify(file, null, 2)}\n`;
}

function isPoint(value: unknown): value is SketchObject {
  const point = value as Partial<SketchObject> | null;
  return (
    typeof point === "object" &&
    point !== null &&
    point.kind === "point" &&
    typeof point.id === "string" &&
    typeof point.x === "number" &&
    typeof point.y === "number" &&
    POINT_SIZES.includes(point.size as PointSize)
  );
}

function isNames(value: unknown, ...names: string[]): boolean {
  const held = value as Record<string, unknown>;
  return names.every((name) => typeof held[name] === "string");
}

function isSpan(value: unknown): value is LineSpan {
  const span = value as { kind?: string; ends?: unknown } | null;
  if (typeof span !== "object" || span === null) return false;
  if (span.kind === "through") {
    return (
      Array.isArray(span.ends) &&
      span.ends.length === 2 &&
      span.ends.every((end) => typeof end === "string")
    );
  }
  if (span.kind === "parallel" || span.kind === "perpendicular") {
    return isNames(span, "at", "to");
  }
  return span.kind === "bisector" && isNames(span, "corner", "a", "b");
}

function isLine(value: unknown): value is SketchObject {
  const line = value as { kind?: string; form?: string; span?: unknown } | null;
  return (
    typeof line === "object" &&
    line !== null &&
    line.kind === "line" &&
    typeof (line as { id?: unknown }).id === "string" &&
    LINE_FORMS.includes(line.form as LineForm) &&
    isSpan(line.span)
  );
}

function isCircleSpan(value: unknown): boolean {
  const span = value as { kind?: string } | null;
  if (typeof span !== "object" || span === null) return false;
  if (span.kind === "through") return isNames(span, "centre", "edge");
  return span.kind === "radius" && isNames(span, "centre", "along");
}

function isCircle(value: unknown): value is SketchObject {
  const circle = value as { kind?: string; span?: unknown } | null;
  return (
    typeof circle === "object" &&
    circle !== null &&
    circle.kind === "circle" &&
    isNames(circle, "id") &&
    isCircleSpan(circle.span)
  );
}

function isArcSpan(value: unknown): boolean {
  const span = value as { kind?: string } | null;
  if (typeof span !== "object" || span === null) return false;
  if (span.kind === "on") return isNames(span, "circle", "from", "to");
  if (span.kind === "centre") return isNames(span, "centre", "from", "to");
  return span.kind === "through" && isNames(span, "from", "via", "to");
}

function isArc(value: unknown): value is SketchObject {
  const arc = value as { kind?: string; span?: unknown } | null;
  return (
    typeof arc === "object" &&
    arc !== null &&
    arc.kind === "arc" &&
    isNames(arc, "id") &&
    isArcSpan(arc.span)
  );
}

function isInterior(value: unknown): value is SketchObject {
  const shape = value as { kind?: string; vertices?: unknown; of?: unknown } | null;
  if (typeof shape !== "object" || shape === null) return false;
  if (shape.kind !== "interior" || typeof (shape as { id?: unknown }).id !== "string") {
    return false;
  }
  if (typeof shape.of === "string") {
    const wedge = (shape as { wedge?: unknown }).wedge;
    return wedge === undefined || wedge === "sector" || wedge === "segment";
  }
  return (
    Array.isArray(shape.vertices) &&
    shape.vertices.length >= 3 &&
    shape.vertices.every((corner) => typeof corner === "string")
  );
}

function isLocus(value: unknown): value is SketchObject {
  const locus = value as { kind?: string; span?: unknown; samples?: unknown } | null;
  return (
    typeof locus === "object" &&
    locus !== null &&
    locus.kind === "locus" &&
    isNames(locus, "id", "driver", "domain", "driven") &&
    Array.isArray(locus.span) &&
    locus.span.length === 2 &&
    locus.span.every((end) => typeof end === "number") &&
    typeof locus.samples === "number"
  );
}

function isCaption(value: unknown): value is SketchObject {
  const caption = value as {
    kind?: string;
    x?: unknown;
    y?: unknown;
    width?: unknown;
    size?: unknown;
    align?: unknown;
  } | null;
  if (typeof caption !== "object" || caption === null || caption.kind !== "caption") return false;
  return (
    isNames(caption, "id", "html", "font", "colour") &&
    typeof caption.x === "number" &&
    typeof caption.y === "number" &&
    typeof caption.width === "number" &&
    typeof caption.size === "number" &&
    (caption.align === "left" || caption.align === "center" || caption.align === "right")
  );
}

function isMeasurement(value: unknown): value is SketchObject {
  const found = value as { kind?: string; measure?: unknown; of?: unknown } | null;
  if (typeof found !== "object" || found === null || found.kind !== "measurement") return false;
  return (
    isNames(found, "id") &&
    MEASURES.includes(found.measure as MeasureKind) &&
    Array.isArray(found.of) &&
    found.of.length > 0 &&
    found.of.every((one) => typeof one === "string") &&
    typeof (found as { x?: unknown }).x === "number" &&
    typeof (found as { y?: unknown }).y === "number"
  );
}

function isParameter(value: unknown): value is SketchObject {
  const held = value as { kind?: string; unit?: unknown } | null;
  if (typeof held !== "object" || held === null || held.kind !== "parameter") return false;
  return (
    isNames(held, "id") &&
    PARAMETER_UNITS.includes(held.unit as ParameterUnit) &&
    typeof (held as { value?: unknown }).value === "number" &&
    typeof (held as { places?: unknown }).places === "number" &&
    typeof (held as { x?: unknown }).x === "number" &&
    typeof (held as { y?: unknown }).y === "number"
  );
}

/** An expression tree, checked all the way down before any of it is trusted. */
function isExpr(value: unknown): value is Expr {
  const node = value as { kind?: string } | null;
  if (typeof node !== "object" || node === null) return false;
  const held = node as Record<string, unknown>;
  switch (node.kind) {
    case "number":
      return (
        typeof held.value === "number" &&
        (held.unit === undefined || (LITERAL_UNITS as readonly unknown[]).includes(held.unit))
      );
    case "constant":
      return held.name === "pi" || held.name === "e";
    case "value":
      return typeof held.of === "string";
    case "variable":
      return true;
    case "unary":
      return held.op === "-" && isExpr(held.on);
    case "binary":
      return (
        ["+", "-", "*", "/", "^"].includes(held.op as string) &&
        isExpr(held.left) &&
        isExpr(held.right)
      );
    case "call":
      return (BUILT_INS as readonly unknown[]).includes(held.fn) && isExpr(held.on);
    case "apply":
      return typeof held.of === "string" && isExpr(held.on);
    default:
      return false;
  }
}

function isCalculation(value: unknown): value is SketchObject {
  const held = value as { kind?: string; expression?: unknown } | null;
  if (typeof held !== "object" || held === null || held.kind !== "calculation") return false;
  return (
    isNames(held, "id") &&
    isExpr(held.expression) &&
    typeof (held as { x?: unknown }).x === "number" &&
    typeof (held as { y?: unknown }).y === "number"
  );
}

/** One cell of a stored row: a number and what it is a number of. */
function isCell(value: unknown): boolean {
  if (value === null) return true;
  const cell = value as Record<string, unknown> | null;
  return (
    typeof cell === "object" &&
    cell !== null &&
    typeof cell.value === "number" &&
    typeof cell.length === "number" &&
    typeof cell.angle === "number"
  );
}

function isTable(value: unknown): value is SketchObject {
  const held = value as { kind?: string; of?: unknown; rows?: unknown } | null;
  if (typeof held !== "object" || held === null || held.kind !== "table") return false;
  return (
    isNames(held, "id") &&
    Array.isArray(held.of) &&
    held.of.length > 0 &&
    held.of.every((one) => typeof one === "string") &&
    Array.isArray(held.rows) &&
    held.rows.every(
      (row) =>
        Array.isArray(row) && row.length === (held.of as string[]).length && row.every(isCell),
    ) &&
    typeof (held as { x?: unknown }).x === "number" &&
    typeof (held as { y?: unknown }).y === "number"
  );
}

function isFunction(value: unknown): value is SketchObject {
  const held = value as { kind?: string; body?: unknown; of?: unknown } | null;
  if (typeof held !== "object" || held === null || held.kind !== "function") return false;
  // One or the other: an expression that was typed, or the function it is the
  // derivative of. Never both, and never neither.
  const typed = held.body !== undefined && isExpr(held.body) && held.of === undefined;
  const derived = typeof held.of === "string" && held.body === undefined;
  return (
    isNames(held, "id") &&
    (typed || derived) &&
    typeof (held as { x?: unknown }).x === "number" &&
    typeof (held as { y?: unknown }).y === "number"
  );
}

function isCustomTransform(value: unknown): value is SketchObject {
  const held = value as { kind?: string } | null;
  if (typeof held !== "object" || held === null || held.kind !== "transform") return false;
  return isNames(held, "id", "name", "seed", "image");
}

function isMark(value: unknown): value is SketchObject {
  const mark = value as { kind?: string; form?: unknown; strokes?: unknown } | null;
  if (typeof mark !== "object" || mark === null) return false;
  if (mark.kind !== "mark" || typeof (mark as { id?: unknown }).id !== "string") return false;
  if (typeof mark.strokes !== "number") return false;
  if (mark.form === "angle") {
    const arms = (mark as { arms?: unknown }).arms;
    const sides = (mark as { sides?: unknown }).sides;
    return (
      isNames(mark, "corner") &&
      Array.isArray(arms) &&
      arms.length === 2 &&
      arms.every((arm) => typeof arm === "string") &&
      Array.isArray(sides) &&
      sides.length === 2 &&
      sides.every((side) => typeof side === "string")
    );
  }
  return (
    (mark.form === "equal" || mark.form === "parallel") &&
    isNames(mark, "path") &&
    typeof (mark as { at?: unknown }).at === "number"
  );
}

function isObject(value: unknown): value is SketchObject {
  return (
    isPoint(value) ||
    isLine(value) ||
    isCircle(value) ||
    isArc(value) ||
    isInterior(value) ||
    isLocus(value) ||
    isCaption(value) ||
    isMeasurement(value) ||
    isParameter(value) ||
    isCalculation(value) ||
    isTable(value) ||
    isFunction(value) ||
    isCustomTransform(value) ||
    isMark(value)
  );
}

function isPage(value: unknown): value is PageContent {
  const page = value as Partial<PageContent> | null;
  return (
    typeof page === "object" &&
    page !== null &&
    typeof page.name === "string" &&
    Array.isArray(page.objects) &&
    page.objects.every(isObject)
  );
}

/** The file's pages. Throws when the file is not a sketch, or is damaged. */
/** What a sketch holds: its pages, and the preferences it was made under. */
export interface Opened {
  pages: PageContent[];
  /** Absent on a sketch saved before preferences were in the file. */
  prefs?: Prefs;
}

/** A stored colour token, which is a name rather than a colour. */
function isToken(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("--color-");
}

/**
 * The preferences off a file, or nothing where the file has none or what it has
 * cannot be read. A sketch that says nothing about them opens in the defaults
 * a new sketch would, which is what every sketch saved before this did.
 */
function readPrefs(value: unknown): Prefs | undefined {
  const held = value as Partial<Prefs> | undefined;
  const units = held?.units;
  const colours = held?.colours;
  const text = held?.text;
  if (!units || !colours || !text) return undefined;
  if (!ANGLE_UNITS.includes(units.angle) || !DISTANCE_UNITS.includes(units.distance)) {
    return undefined;
  }
  if (!Object.values(colours).every(isToken)) return undefined;
  if (typeof text.font !== "string" || typeof text.size !== "number") return undefined;
  return held as Prefs;
}

/**
 * A sketch written before a label kept its name carries its letters only in the
 * order it was built, so they are written down as it is opened, exactly as that
 * version lettered them.
 *
 * Every object is written down, not only the ones showing a label: that version
 * lettered the whole page and printed those letters in readings, table headings
 * and captions as well, and a file has to open saying what it said when it was
 * saved. Only sketches made from here on letter what is labelled and nothing
 * else.
 */
function letterAsBuilt(page: PageContent): void {
  const names = namesAsBuilt(page.objects);
  for (const object of page.objects) {
    if (object.label?.name !== undefined) continue;
    const name = names.get(object.id);
    if (name) object.label = { ...object.label, name };
  }
}

export function parse(text: string): Opened {
  let file: SketchFile;
  try {
    file = JSON.parse(text) as SketchFile;
  } catch {
    throw new Error("That file is not a GRASP sketch.");
  }
  if (file?.format !== FORMAT) throw new Error("That file is not a GRASP sketch.");
  // Every sketch GRASP has written carries one, so a file without a version is
  // damaged rather than old, and reading it as either would letter it wrongly.
  if (typeof file.version !== "number") {
    throw new Error("That sketch is damaged and cannot be opened.");
  }
  if (file.version > VERSION) {
    throw new Error("That sketch was saved by a newer version of GRASP.");
  }
  const pages = file.pages;
  if (!Array.isArray(pages) || pages.length === 0 || !pages.every(isPage)) {
    throw new Error("That sketch is damaged and cannot be opened.");
  }
  if (file.version < KEPT_NAMES) for (const page of pages) letterAsBuilt(page);
  return { pages, prefs: readPrefs(file.prefs) };
}
