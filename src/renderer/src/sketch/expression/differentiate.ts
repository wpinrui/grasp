import { literal, substitute, times } from "./parse";
import type { Expr } from "./syntax";
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
      return literal(1);
    case "number":
    case "constant":
    case "value":
      return literal(0);
    case "unary":
      return { kind: "unary", op: "-", on: slopeOf(expr.on, body) };
    case "binary":
      return overBinary(expr, body);
    case "call":
      return times(slopeOfBuiltIn(expr), slopeOf(expr.on, body));
    case "apply": {
      const inner = body?.(expr.of);
      // A function that cannot be read has nothing that moves.
      if (!inner) return literal(0);
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
        right: { kind: "binary", op: "^", left: expr.right, right: literal(2) },
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
          right: { kind: "binary", op: "-", left: power, right: literal(1) },
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
      return held === null ? { kind: "unary", op: "-", on } : literal(-held);
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
    if (op === "+") return literal(a + b);
    if (op === "-") return literal(a - b);
    if (op === "*") return literal(a * b);
    if (op === "/" && b !== 0) return literal(a / b);
    if (op === "^") return literal(a ** b);
  }
  if (op === "+") {
    if (a === 0) return right;
    if (b === 0) return left;
  }
  if (op === "-" && b === 0) return left;
  if (op === "*") {
    if (a === 0 || b === 0) return literal(0);
    if (a === 1) return right;
    if (b === 1) return left;
  }
  if (op === "/" && b === 1) return left;
  if (op === "^") {
    if (b === 1) return left;
    if (b === 0) return literal(1);
  }
  return { kind: "binary", op, left, right };
}

/** The slope of a built-in at its argument, before the chain rule is applied. */
function slopeOfBuiltIn(expr: Extract<Expr, { kind: "call" }>): Expr {
  const on = expr.on;
  const one = literal(1);
  const square = (of: Expr): Expr => ({ kind: "binary", op: "^", left: of, right: literal(2) });
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
      return over(one, times(literal(2), { kind: "call", fn: "sqrt", on }));
    case "ln":
      return over(one, on);
    case "log":
      return over(one, times(on, { kind: "call", fn: "ln", on: literal(10) }));
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
      return literal(0);
  }
}
