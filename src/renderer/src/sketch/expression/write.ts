import type { Expr } from "./syntax";
/** How tightly each operator binds, so brackets go only where they are needed. */
export const BINDS: Record<"+" | "-" | "*" | "/" | "^", number> = {
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
