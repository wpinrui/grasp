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

export { differentiate, simplify } from "./differentiate";
export { dependsOn, evaluate } from "./evaluate";
export { parse } from "./parse";
export type { BuiltIn, Expr, LiteralUnit, Named, ParseFailed, Quantity, Sheet } from "./syntax";
export { BUILT_INS, failed, LITERAL_UNITS, PLAIN, plain } from "./syntax";
export { write } from "./write";
