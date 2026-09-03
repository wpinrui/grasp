import { type Expr, type LiteralUnit, plain, type Quantity, type Sheet } from "./syntax";

/** How many of a distance unit make one centimetre. */
const PER_CM: Record<"cm" | "mm" | "in", number> = { cm: 1, mm: 10, in: 1 / 2.54 };

// A degree in radians. Spelt out rather than taken from the model's radiansOf,
// because the model imports this module and cannot be imported back.
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
