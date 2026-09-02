/**
 * What the Measure menu reads off the figure, and how it is written.
 *
 * A measurement holds no number. It holds what it was taken from, and the value
 * is worked out here from the settled geometry every time it is drawn, so
 * dragging the figure moves the number with it.
 *
 * A reading has two halves: the name of the quantity, which is written the way
 * it is written in print rather than by the object's own label, and the value
 * in its units. Ratio is the one that stacks, so it carries a fraction instead
 * of a name.
 */

export { amountOf } from "./amount";
export {
  fromSheetTerms,
  inSheetTerms,
  quantityOf,
  quantityOfParameter,
  sayQuantity,
} from "./quantity";
export type { Naming, Reading } from "./reading";
export {
  quantitiesOf,
  readingOf,
  readingOfValue,
  readingText,
  sheetOf,
  wouldMeasure,
} from "./reading";
export type { Arm } from "./shape";
export { anglesAt, angleWanted, armsAt, cornerAngle, cornerOf, endsOf, shoelace } from "./shape";
export { placesFor, sayAngle, sayArea, sayLength, writeIn } from "./units";
