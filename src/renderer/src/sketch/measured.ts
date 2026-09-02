/**
 * What the Measure menu would write, and where on the sheet it would land.
 *
 * A measurement is written into the top left of the view, under whatever is
 * written there already, so a run of them stacks rather than piling up in one
 * place. Nothing here touches the page.
 */
import type { MenuAction } from "../components/menus";
import type { Building } from "./builds";
import { wouldMeasure } from "./measure";
import {
  createMeasurement,
  isMeasurement,
  type MeasureKind,
  type Position,
  type SketchObject,
} from "./model";

/** Which reading each Measure entry takes off the selection. */
export const MEASURE_OF: Partial<Record<MenuAction, MeasureKind>> = {
  "measure-length": "length",
  "measure-distance": "distance",
  "measure-perimeter": "perimeter",
  "measure-circumference": "circumference",
  "measure-angle": "angle",
  "measure-area": "area",
  "measure-arc-angle": "arc-angle",
  "measure-arc-length": "arc-length",
  "measure-radius": "radius",
  "measure-ratio": "ratio",
  "measure-value": "value",
};

/** Where the first measurement on a page sits, in screen pixels from the corner. */
const MEASURE_MARGIN = 14;

/** How far below one measurement the next one is written, in screen pixels. */
const MEASURE_ROW = 30;

/**
 * Where the next measurements are written: the top left of what is on screen,
 * each one below the last, stepping down past anything already written there
 * so a new number never lands on top of one that is already showing.
 */
export function landingSpots(page: Building, count: number): Position[] {
  const { x, y, scale } = page.view;
  const margin = MEASURE_MARGIN / scale;
  const row = MEASURE_ROW / scale;
  const left = x + margin;
  const written: Position[] = page.objects.filter(isMeasurement);
  const spots: Position[] = [];
  let top = y + margin;
  for (let index = 0; index < count; index += 1) {
    while (
      [...written, ...spots].some(
        (one) => Math.abs(one.x - left) < row && Math.abs(one.y - top) < row * 0.9,
      )
    ) {
      top += row;
    }
    spots.push({ x: left, y: top });
    top += row;
  }
  return spots;
}

/**
 * What a Measure entry would write: one measurement per object it was given,
 * in the order they were picked. Empty when the selection is not one the
 * entry takes, which is what greys it out.
 */
export function measurements(page: Building, action: MenuAction): SketchObject[] {
  const measure = MEASURE_OF[action];
  if (!measure) return [];
  const groups = wouldMeasure(measure, page.selected, page.geometry);
  if (groups.length === 0) return [];
  const spots = landingSpots(page, groups.length);
  return groups.map((of, index) => createMeasurement(measure, of, spots[index]));
}
