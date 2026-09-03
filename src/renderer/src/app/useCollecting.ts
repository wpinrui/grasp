/**
 * A table filling itself up as the figure moves.
 *
 * Add Table Data can ask for a run of rows rather than one, and this is what
 * takes them: every time the sketch changes, it looks at whether enough time
 * has passed and whether anything actually moved, and records a row if both are
 * true. It ends of its own accord once the rows asked for are in.
 */

import { type RefObject, useEffect } from "react";
import type { Quantity } from "../sketch/expression";
import { isTable, type SketchObject, type SketchTable } from "../sketch/model";
import type { Collecting } from "./values";

export interface CollectingContext {
  objects: SketchObject[];
  /** The run in progress, or null when nothing is being collected. */
  collecting: RefObject<Collecting | null>;
  /** What a table's columns say now, in the sheet's own terms. */
  rowNow: (table: SketchTable) => (Quantity | null)[];
  captureRow: (id: string) => void;
}

export function useCollecting({ objects, collecting, rowNow, captureRow }: CollectingContext) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs when the figure moves, which is what a row records
  useEffect(() => {
    const run = collecting.current;
    if (!run) return;
    const table = objects.find((object) => object.id === run.table);
    if (!table || !isTable(table)) {
      collecting.current = null;
      return;
    }
    const now = Date.now();
    if (now - run.at < 1000 / run.perSecond) return;
    const row = rowNow(table);
    const last = table.rows[table.rows.length - 1];
    // Only a change is worth a row. Without this the first move would fill the
    // table with the same numbers over and over.
    const moved =
      last === undefined ||
      last.some((cell, nth) => {
        const now = row[nth];
        if (cell === null || now === null) return cell !== now;
        return cell.value !== now.value;
      });
    if (!moved) return;
    run.at = now;
    run.left -= 1;
    if (run.left <= 0) collecting.current = null;
    captureRow(table.id);
  }, [objects]);
}
