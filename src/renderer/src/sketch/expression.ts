/**
 * What the Calculator holds: an expression, and everything done with one.
 *
 * An expression is a tree, not a string. The string is what is typed and what
 * is written back out; the tree is what is stored, what is evaluated, and what
 * is differentiated. Storing the tree rather than the text means a value it
 * reads can be renamed without the calculation going stale, the way a
 * measurement holds what it measures rather than the number it came to.
 *
 * Everything is worked out in the units readings are written in, so a
 * calculation over centimetres comes out in centimetres and the number on the
 * sheet is the number the arithmetic was done on. What each result is a
 * quantity of is carried along with it: two lengths multiplied make an area,
 * a length over a length makes a plain number, and a length plus an angle makes
 * nothing at all.
 */

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

/** How many of a distance unit make one centimetre. */
const PER_CM: Record<"cm" | "mm" | "in", number> = { cm: 1, mm: 10, in: 1 / 2.54 };

const RADIANS = Math.PI / 180;

// ---------------------------------------------------------------- evaluating

/** An angle in the units readings are written in, said in radians. */
function inRadians(value: number, sheet: Sheet): number {
  return sheet.angle === "radians" ? value : value * RADIANS;
}

/** Radians said back in the units readings are written in. */
function fromRadians(value: number, sheet: Sheet): number {
  return sheet.angle === "radians" ? value : value / RADIANS;
}

/** A literal's unit said in the units readings are written in. */
function asWritten(value: number, unit: LiteralUnit, sheet: Sheet): Quantity {
  if (unit === "°")
    return { value: sheet.angle === "radians" ? value * RADIANS : value, length: 0, angle: 1 };
  if (unit === "rad")
    return { value: sheet.angle === "radians" ? value : value / RADIANS, length: 0, angle: 1 };
  const centimetres = value / PER_CM[unit];
  return { value: centimetres * PER_CM[sheet.distance], length: 1, angle: 0 };
}

function sameQuantity(a: Quantity, b: Quantity): boolean {
  return a.length === b.length && a.angle === b.angle;
}

/**
 * What an expression comes to now, or null where it comes to nothing: a value
 * it reads has gone, the two sides of a sum are quantities of different things,
 * or the arithmetic itself has no answer.
 */
export function evaluate(expr: Expr, sheet: Sheet, at?: Quantity): Quantity | null {
  switch (expr.kind) {
    case "number":
      return expr.unit ? asWritten(expr.value, expr.unit, sheet) : plain(expr.value);
    case "constant":
      return plain(expr.name === "pi" ? Math.PI : Math.E);
    case "value":
      return sheet.value(expr.of);
    case "variable":
      return at ?? null;
    case "unary": {
      const on = evaluate(expr.on, sheet, at);
      return on && { ...on, value: -on.value };
    }
    case "binary":
      return binary(expr, sheet, at);
    case "call":
      return call(expr, sheet, at);
    case "apply": {
      const body = sheet.body(expr.of);
      const on = evaluate(expr.on, sheet, at);
      if (!body || !on) return null;
      return evaluate(body, sheet, on);
    }
  }
}

function binary(
  expr: Extract<Expr, { kind: "binary" }>,
  sheet: Sheet,
  at?: Quantity,
): Quantity | null {
  const left = evaluate(expr.left, sheet, at);
  const right = evaluate(expr.right, sheet, at);
  if (!left || !right) return null;
  switch (expr.op) {
    // Only like adds to like. A length plus an angle is not a number of
    // anything, so it reads as nothing rather than as a number that lies.
    case "+":
      return sameQuantity(left, right) ? { ...left, value: left.value + right.value } : null;
    case "-":
      return sameQuantity(left, right) ? { ...left, value: left.value - right.value } : null;
    case "*":
      return {
        value: left.value * right.value,
        length: left.length + right.length,
        angle: left.angle + right.angle,
      };
    case "/":
      if (right.value === 0) return null;
      return {
        value: left.value / right.value,
        length: left.length - right.length,
        angle: left.angle - right.angle,
      };
    case "^": {
      // A quantity can only be raised to a plain whole number: there is no such
      // thing as a length to the power of a length, or half a centimetre-power.
      if (right.length !== 0 || right.angle !== 0) return null;
      const power = right.value;
      const dimensioned = left.length !== 0 || left.angle !== 0;
      if (dimensioned && !Number.isInteger(power)) return null;
      const value = left.value ** power;
      if (!Number.isFinite(value)) return null;
      return { value, length: left.length * power, angle: left.angle * power };
    }
  }
}

function call(expr: Extract<Expr, { kind: "call" }>, sheet: Sheet, at?: Quantity): Quantity | null {
  const on = evaluate(expr.on, sheet, at);
  if (!on) return null;
  const bare = on.length === 0 && on.angle === 0;
  switch (expr.fn) {
    // These read the number and hand back the same kind of thing.
    case "abs":
      return { ...on, value: Math.abs(on.value) };
    case "round":
      return { ...on, value: Math.round(on.value) };
    case "trunc":
      return { ...on, value: Math.trunc(on.value) };
    // Which side of zero it falls is a plain number whatever went in.
    case "sgn":
      return plain(Math.sign(on.value));
    case "sqrt": {
      if (on.value < 0) return null;
      // The root of an area is a length, so the exponents halve. A quantity
      // that would come out on half an exponent is not one the sheet can write.
      if (on.length % 2 !== 0 || on.angle % 2 !== 0) return null;
      return { value: Math.sqrt(on.value), length: on.length / 2, angle: on.angle / 2 };
    }
    case "ln":
    case "log": {
      if (!bare || on.value <= 0) return null;
      return plain(expr.fn === "ln" ? Math.log(on.value) : Math.log10(on.value));
    }
    // Trigonometry takes an angle. A plain number is taken for radians, which
    // is what a plain number in a trigonometric function means.
    case "sin":
    case "cos":
    case "tan": {
      if (on.angle !== 1 && !bare) return null;
      if (on.length !== 0) return null;
      const radians = on.angle === 1 ? inRadians(on.value, sheet) : on.value;
      const value =
        expr.fn === "sin"
          ? Math.sin(radians)
          : expr.fn === "cos"
            ? Math.cos(radians)
            : Math.tan(radians);
      return Number.isFinite(value) ? plain(value) : null;
    }
    // And the inverses hand an angle back, in the units angles are written in.
    case "asin":
    case "acos":
    case "atan": {
      if (!bare) return null;
      if (expr.fn !== "atan" && Math.abs(on.value) > 1) return null;
      const radians =
        expr.fn === "asin"
          ? Math.asin(on.value)
          : expr.fn === "acos"
            ? Math.acos(on.value)
            : Math.atan(on.value);
      return { value: fromRadians(radians, sheet), length: 0, angle: 1 };
    }
  }
}

// ---------------------------------------------------------------- dependants

/** Every value and function the expression reads, so deleting one takes it. */
export function dependsOn(expr: Expr): string[] {
  const found: string[] = [];
  const walk = (node: Expr) => {
    switch (node.kind) {
      case "value":
      case "apply":
        found.push(node.of);
        if (node.kind === "apply") walk(node.on);
        return;
      case "unary":
        return walk(node.on);
      case "call":
        return walk(node.on);
      case "binary":
        walk(node.left);
        return walk(node.right);
      default:
        return;
    }
  };
  walk(expr);
  return found;
}

// ------------------------------------------------------------------- writing

/** How tightly each operator binds, so brackets go only where they are needed. */
const BINDS: Record<"+" | "-" | "*" | "/" | "^", number> = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
  "^": 4,
};

const SHOWN: Record<"+" | "-" | "*" | "/" | "^", string> = {
  "+": " + ",
  "-": " − ",
  "*": " × ",
  "/": " / ",
  "^": "^",
};

/**
 * The expression written out, as it reads on the sheet and in the Calculator's
 * preview. Names come from the sketch, so renaming a measurement rewrites every
 * calculation that reads it.
 */
export function write(expr: Expr, names: Map<string, string>, binds = 0): string {
  switch (expr.kind) {
    case "number":
      return `${expr.value}${expr.unit ? (expr.unit === "°" ? "°" : ` ${expr.unit}`) : ""}`;
    case "constant":
      return expr.name === "pi" ? "π" : "e";
    case "value":
      return names.get(expr.of) ?? "?";
    case "variable":
      return "x";
    case "unary":
      return `−${write(expr.on, names, 3)}`;
    case "call":
      return `${expr.fn}(${write(expr.on, names)})`;
    case "apply":
      return `${names.get(expr.of) ?? "?"}(${write(expr.on, names)})`;
    case "binary": {
      const mine = BINDS[expr.op];
      // The right of a minus or a divide needs brackets at equal binding too,
      // since a − (b − c) is not a − b − c.
      const right = write(expr.right, names, expr.op === "-" || expr.op === "/" ? mine + 1 : mine);
      const written = `${write(expr.left, names, mine)}${SHOWN[expr.op]}${right}`;
      return mine < binds ? `(${written})` : written;
    }
  }
}

// ------------------------------------------------------------------- parsing

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

interface Token {
  text: string;
  at: number;
  kind: "number" | "name" | "op";
}

const OPERATORS = "+-*/^()";

function tokenise(text: string): Token[] | ParseFailed {
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === " " || char === "\t") {
      index += 1;
      continue;
    }
    // The signs a keypad and a preview write, taken as the ones a keyboard does.
    if (char === "×" || char === "·") {
      tokens.push({ text: "*", at: index, kind: "op" });
      index += 1;
      continue;
    }
    if (char === "÷") {
      tokens.push({ text: "/", at: index, kind: "op" });
      index += 1;
      continue;
    }
    if (char === "−" || char === "–") {
      tokens.push({ text: "-", at: index, kind: "op" });
      index += 1;
      continue;
    }
    if (OPERATORS.includes(char)) {
      tokens.push({ text: char, at: index, kind: "op" });
      index += 1;
      continue;
    }
    if (char === "°") {
      tokens.push({ text: "°", at: index, kind: "name" });
      index += 1;
      continue;
    }
    if (char === "π") {
      tokens.push({ text: "π", at: index, kind: "name" });
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      const start = index;
      while (index < text.length && /[0-9.]/.test(text[index])) index += 1;
      const said = text.slice(start, index);
      if (!Number.isFinite(Number(said))) {
        return { error: `${said} is not a number`, at: start };
      }
      tokens.push({ text: said, at: start, kind: "number" });
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const start = index;
      while (index < text.length && /[A-Za-z0-9_']/.test(text[index])) index += 1;
      tokens.push({ text: text.slice(start, index), at: start, kind: "name" });
      continue;
    }
    return { error: `${char} does not belong in an expression`, at: index };
  }
  return tokens;
}

/**
 * What was typed, as a tree. Names are looked up in the sketch, so `m1 + t1`
 * becomes a sum of the two objects those names belong to rather than of two
 * words. A name nothing answers to is where the parse stops.
 *
 * `variable` says whether `x` stands for a function's argument, which it does
 * only while a function is being defined.
 */
export function parse(text: string, named: Named, variable = false): Expr | ParseFailed {
  const tokens = tokenise(text);
  if (!Array.isArray(tokens)) return tokens;
  if (tokens.length === 0) return { error: "nothing to work out", at: 0 };
  let index = 0;

  const peek = () => tokens[index];
  const end = () => text.length;

  function atom(): Expr | ParseFailed {
    const token = peek();
    if (!token) return { error: "the expression stops short", at: end() };
    if (token.text === "(") {
      index += 1;
      const inside = sum(1);
      if (failed(inside)) return inside;
      if (peek()?.text !== ")") return { error: "no closing bracket", at: token.at };
      index += 1;
      return inside;
    }
    if (token.kind === "number") {
      index += 1;
      const unit = peek();
      // A unit belongs to the number in front of it, and only to a number.
      if (
        unit &&
        unit.kind === "name" &&
        (LITERAL_UNITS as readonly string[]).includes(unit.text)
      ) {
        index += 1;
        return { kind: "number", value: Number(token.text), unit: unit.text as LiteralUnit };
      }
      return { kind: "number", value: Number(token.text) };
    }
    if (token.kind === "name") {
      index += 1;
      if (token.text === "π" || token.text === "pi") return { kind: "constant", name: "pi" };
      if (token.text === "e") return { kind: "constant", name: "e" };
      if (variable && token.text === "x") return { kind: "variable" };
      if ((BUILT_INS as readonly string[]).includes(token.text)) {
        const on = bracketed(token);
        return failed(on) ? on : { kind: "call", fn: token.text as BuiltIn, on };
      }
      const fn = named.fn(token.text);
      if (fn) {
        const on = bracketed(token);
        return failed(on) ? on : { kind: "apply", of: fn, on };
      }
      const value = named.value(token.text);
      if (value) return { kind: "value", of: value };
      return { error: `${token.text} is not a value in this sketch`, at: token.at };
    }
    return { error: `${token.text} does not start an expression`, at: token.at };
  }

  /** A function's argument, which must come in brackets straight after it. */
  function bracketed(token: Token): Expr | ParseFailed {
    if (peek()?.text !== "(") {
      return { error: `${token.text} needs something to work on, in brackets`, at: token.at };
    }
    index += 1;
    const inside = sum(1);
    if (failed(inside)) return inside;
    if (peek()?.text !== ")") return { error: "no closing bracket", at: token.at };
    index += 1;
    return inside;
  }

  /** A minus in front of something, which binds tighter than times. */
  function signed(): Expr | ParseFailed {
    const token = peek();
    if (token?.text === "-") {
      index += 1;
      const on = signed();
      return failed(on) ? on : { kind: "unary", op: "-", on };
    }
    if (token?.text === "+") {
      index += 1;
      return signed();
    }
    return power();
  }

  /** Powers bind tightest and lean right: 2^3^2 is 2^9, not 8^2. */
  function power(): Expr | ParseFailed {
    const base = atom();
    if (failed(base)) return base;
    if (peek()?.text !== "^") return base;
    index += 1;
    const exponent = signed();
    return failed(exponent) ? exponent : { kind: "binary", op: "^", left: base, right: exponent };
  }

  function sum(binds: number): Expr | ParseFailed {
    let left = signed();
    if (failed(left)) return left;
    for (;;) {
      const token = peek();
      if (!token || token.kind !== "op" || token.text === "(" || token.text === ")") break;
      if (token.text === "^") break;
      const op = token.text as "+" | "-" | "*" | "/";
      const mine = BINDS[op];
      if (mine === undefined || mine < binds) break;
      index += 1;
      const right = sum(mine + 1);
      if (failed(right)) return right;
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  const parsed = sum(1);
  if (failed(parsed)) return parsed;
  const over = peek();
  if (over) return { error: `${over.text} has nothing to join on to`, at: over.at };
  return parsed;
}

// ------------------------------------------------------------- differentiating

function number(value: number): Expr {
  return { kind: "number", value };
}

function times(left: Expr, right: Expr): Expr {
  return { kind: "binary", op: "*", left, right };
}

/** A function's body with its variable replaced by what it is applied to. */
function substitute(body: Expr, on: Expr): Expr {
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

/**
 * The derivative with respect to the variable, worked out on the tree and then
 * tidied. Every expression the Calculator can make has one, because every part
 * of it does: anything that does not hold the variable differentiates to zero.
 *
 * `body` reads a function defined in the sketch. A function used inside another
 * one is differentiated by putting its own expression in place of it first, so
 * the chain rule falls out rather than being a rule of its own.
 */
export function differentiate(expr: Expr, body?: (id: string) => Expr | null): Expr {
  return simplify(slopeOf(expr, body));
}

function slopeOf(expr: Expr, body?: (id: string) => Expr | null): Expr {
  switch (expr.kind) {
    case "variable":
      return number(1);
    case "number":
    case "constant":
    case "value":
      return number(0);
    case "unary":
      return { kind: "unary", op: "-", on: slopeOf(expr.on, body) };
    case "binary":
      return overBinary(expr, body);
    case "call":
      return times(slopeOfBuiltIn(expr), slopeOf(expr.on, body));
    case "apply": {
      const inner = body?.(expr.of);
      // A function that cannot be read has nothing that moves.
      if (!inner) return number(0);
      return slopeOf(substitute(inner, expr.on), body);
    }
  }
}

function overBinary(
  expr: Extract<Expr, { kind: "binary" }>,
  body?: (id: string) => Expr | null,
): Expr {
  const left = slopeOf(expr.left, body);
  const right = slopeOf(expr.right, body);
  switch (expr.op) {
    case "+":
    case "-":
      return { kind: "binary", op: expr.op, left, right };
    case "*":
      return {
        kind: "binary",
        op: "+",
        left: times(left, expr.right),
        right: times(expr.left, right),
      };
    case "/":
      return {
        kind: "binary",
        op: "/",
        left: {
          kind: "binary",
          op: "-",
          left: times(left, expr.right),
          right: times(expr.left, right),
        },
        right: { kind: "binary", op: "^", left: expr.right, right: number(2) },
      };
    case "^": {
      const power = expr.right;
      // A power that itself moves with the variable needs the whole rule:
      // u^v times (v' ln u + v u' / u). A constant power needs only the half
      // of it anybody writes out: n times u^(n-1) times u'.
      if (holdsVariable(power)) {
        return times(expr, {
          kind: "binary",
          op: "+",
          left: times(right, { kind: "call", fn: "ln", on: expr.left }),
          right: { kind: "binary", op: "/", left: times(power, left), right: expr.left },
        });
      }
      return times(
        times(power, {
          kind: "binary",
          op: "^",
          left: expr.left,
          right: { kind: "binary", op: "-", left: power, right: number(1) },
        }),
        left,
      );
    }
  }
}

/** Whether the variable appears anywhere in an expression. */
function holdsVariable(expr: Expr): boolean {
  switch (expr.kind) {
    case "variable":
      return true;
    case "unary":
    case "call":
    case "apply":
      return holdsVariable(expr.on);
    case "binary":
      return holdsVariable(expr.left) || holdsVariable(expr.right);
    default:
      return false;
  }
}

/** Whether a node is a plain number, which is what can be folded away. */
function numberIn(expr: Expr): number | null {
  return expr.kind === "number" && expr.unit === undefined ? expr.value : null;
}

/**
 * The expression tidied so it reads as something a person would write. A
 * derivative is built by rule, which throws off a great many times-ones and
 * plus-zeros, and `2 × x^(2 − 1) × 1` is the right answer said badly.
 */
export function simplify(expr: Expr): Expr {
  switch (expr.kind) {
    case "unary": {
      const on = simplify(expr.on);
      const held = numberIn(on);
      return held === null ? { kind: "unary", op: "-", on } : number(-held);
    }
    case "call":
      return { kind: "call", fn: expr.fn, on: simplify(expr.on) };
    case "apply":
      return { kind: "apply", of: expr.of, on: simplify(expr.on) };
    case "binary":
      return foldBinary(expr.op, simplify(expr.left), simplify(expr.right));
    default:
      return expr;
  }
}

function foldBinary(op: "+" | "-" | "*" | "/" | "^", left: Expr, right: Expr): Expr {
  const a = numberIn(left);
  const b = numberIn(right);
  // Two plain numbers are just the number they come to.
  if (a !== null && b !== null) {
    if (op === "+") return number(a + b);
    if (op === "-") return number(a - b);
    if (op === "*") return number(a * b);
    if (op === "/" && b !== 0) return number(a / b);
    if (op === "^") return number(a ** b);
  }
  if (op === "+") {
    if (a === 0) return right;
    if (b === 0) return left;
  }
  if (op === "-" && b === 0) return left;
  if (op === "*") {
    if (a === 0 || b === 0) return number(0);
    if (a === 1) return right;
    if (b === 1) return left;
  }
  if (op === "/" && b === 1) return left;
  if (op === "^") {
    if (b === 1) return left;
    if (b === 0) return number(1);
  }
  return { kind: "binary", op, left, right };
}

/** The slope of a built-in at its argument, before the chain rule is applied. */
function slopeOfBuiltIn(expr: Extract<Expr, { kind: "call" }>): Expr {
  const on = expr.on;
  const one = number(1);
  const square = (of: Expr): Expr => ({ kind: "binary", op: "^", left: of, right: number(2) });
  const over = (top: Expr, bottom: Expr): Expr => ({
    kind: "binary",
    op: "/",
    left: top,
    right: bottom,
  });
  const less = (left: Expr, right: Expr): Expr => ({ kind: "binary", op: "-", left, right });
  switch (expr.fn) {
    case "sin":
      return { kind: "call", fn: "cos", on };
    case "cos":
      return { kind: "unary", op: "-", on: { kind: "call", fn: "sin", on } };
    case "tan":
      return over(one, square({ kind: "call", fn: "cos", on }));
    case "sqrt":
      return over(one, times(number(2), { kind: "call", fn: "sqrt", on }));
    case "ln":
      return over(one, on);
    case "log":
      return over(one, times(on, { kind: "call", fn: "ln", on: number(10) }));
    case "asin":
      return over(one, { kind: "call", fn: "sqrt", on: less(one, square(on)) });
    case "acos":
      return {
        kind: "unary",
        op: "-",
        on: over(one, { kind: "call", fn: "sqrt", on: less(one, square(on)) }),
      };
    case "atan":
      return over(one, { kind: "binary", op: "+", left: one, right: square(on) });
    // Flat wherever they are not a step, and the steps are single points, so
    // the slope is zero everywhere it exists.
    case "abs":
      return { kind: "call", fn: "sgn", on };
    case "sgn":
    case "round":
    case "trunc":
      return number(0);
  }
}
