/** The functions the Calculator offers, after the reference app's list. */
export const BUILT_INS = [
  "abs",
  "sqrt",
  "ln",
  "log",
  "sgn",
  "round",
  "trunc",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
] as const;

export type BuiltIn = (typeof BUILT_INS)[number];

/** A unit a bare number in an expression can be given. */
export const LITERAL_UNITS = ["°", "rad", "cm", "mm", "in"] as const;

export type LiteralUnit = (typeof LITERAL_UNITS)[number];

export type Expr =
  | { kind: "number"; value: number; unit?: LiteralUnit }
  | { kind: "constant"; name: "pi" | "e" }
  /** A measurement, parameter or calculation on the sheet, by id. */
  | { kind: "value"; of: string }
  /** What a function's argument stands for, inside that function's body. */
  | { kind: "variable" }
  | { kind: "unary"; op: "-"; on: Expr }
  | { kind: "binary"; op: "+" | "-" | "*" | "/" | "^"; left: Expr; right: Expr }
  | { kind: "call"; fn: BuiltIn; on: Expr }
  /** A function defined in the sketch, applied to something. */
  | { kind: "apply"; of: string; on: Expr };

/**
 * A number together with what it is a number of, as exponents: a length is
 * `{ length: 1, angle: 0 }`, an area `{ length: 2 }`, a plain number neither.
 * Only these two, because a sketch measures only these two.
 */
export interface Quantity {
  value: number;
  length: number;
  angle: number;
}

export const PLAIN = { length: 0, angle: 0 } as const;

export function plain(value: number): Quantity {
  return { value, length: 0, angle: 0 };
}

/** What an expression is read against: the sketch, and how it is written. */
export interface Sheet {
  /** What a value on the sheet comes to now, or null where it says nothing. */
  value(id: string): Quantity | null;
  /** The body of a function defined in the sketch, for applying it. */
  body(id: string): Expr | null;
  angle: "degrees" | "radians";
  distance: "cm" | "mm" | "in";
}

export interface ParseFailed {
  error: string;
  /** How far along the text the trouble starts, for reddening the rest of it. */
  at: number;
}

export function failed(result: Expr | ParseFailed): result is ParseFailed {
  return "error" in result;
}

/** What a name in the text stands for: a value on the sheet, or a function. */
export interface Named {
  value(name: string): string | null;
  fn(name: string): string | null;
}

/** A number as an expression, which is what the arithmetic folds down to. */
export function literal(value: number): Expr {
  return { kind: "number", value };
}

/** One expression multiplied by another. */
export function times(left: Expr, right: Expr): Expr {
  return { kind: "binary", op: "*", left, right };
}

/** A function's body with its variable replaced by what it is applied to. */
export function substitute(body: Expr, on: Expr): Expr {
  switch (body.kind) {
    case "variable":
      return on;
    case "unary":
    case "call":
    case "apply":
      return { ...body, on: substitute(body.on, on) };
    case "binary":
      return { ...body, left: substitute(body.left, on), right: substitute(body.right, on) };
    default:
      return body;
  }
}
