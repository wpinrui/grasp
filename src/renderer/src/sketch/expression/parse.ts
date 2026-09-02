import {
  BUILT_INS,
  type BuiltIn,
  type Expr,
  failed,
  LITERAL_UNITS,
  type LiteralUnit,
  type Named,
  type ParseFailed,
} from "./syntax";
import { BINDS } from "./write";

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
      if (token?.kind !== "op" || token.text === "(" || token.text === ")") break;
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

export function literal(value: number): Expr {
  return { kind: "number", value };
}

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
