/**
 * The numbers the sketch holds: parameters, calculations, functions and the
 * tables that collect them.
 *
 * The window owns the dialogs these are made in, so what is passed in is the
 * page, the selection and the setters for those dialogs. Nothing here reads the
 * window's own state: everything it needs arrives in the context, which is what
 * keeps it out of `App`.
 */

import type { RefObject } from "react";
import type { AddTableData } from "../components/TableDataDialog";
import type { Building } from "../sketch/builds";
import type { Expr, Sheet } from "../sketch/expression";
import { inSheetTerms, sayQuantity } from "../sketch/measure";
import { landingSpots } from "../sketch/measured";
import {
  createCalculation,
  createFunction,
  createParameter,
  createTable,
  isCalculation,
  isFunction,
  isParameter,
  isTable,
  isValue,
  namesFor,
  type ParameterUnit,
  type Position,
  type SketchObject,
  type SketchTable,
  withDependents,
} from "../sketch/model";
import type { Sketch } from "../sketch/useSketch";
import type { CalculatorState, Collecting, ParameterState } from "./useDialogs";

export interface ValueContext {
  sketch: Sketch;
  /** The page, the selection and where a new object lands. */
  building: Building;
  selection: string[];
  /** What everything on the page is called. */
  names: Map<string, string>;
  /** The page as an expression reads it. */
  readable: Sheet;
  calculator: CalculatorState | null;
  setCalculator: (next: CalculatorState | null) => void;
  parameterDialog: ParameterState | null;
  setParameterDialog: (next: ParameterState | null) => void;
  /** A name to drop into the Calculator at its cursor. */
  setInsert: (name: string | null) => void;
  setTableDialog: (next: "add" | "remove" | null) => void;
  collecting: RefObject<Collecting | null>;
}

export function valueActions(context: ValueContext) {
  const {
    sketch,
    building,
    selection,
    names,
    readable,
    calculator,
    setCalculator,
    parameterDialog,
    setParameterDialog,
    setInsert,
    setTableDialog,
    collecting,
  } = context;
  const { objects, selected } = building;

  /** Where a number written by a dialog lands. */
  function valueSpot(): Position {
    return landingSpots(building, 1)[0];
  }

  /** What a calculation being changed may not read: itself, and its own kin. */
  function barredFrom(editing?: string): Set<string> {
    return editing ? withDependents(objects, [editing]) : new Set<string>();
  }

  /**
   * What the Values pop-up offers. Everything the sketch already holds a number
   * for, less the calculation being changed and anything built on it: a
   * calculation cannot be made to read itself, even the long way round.
   */
  function offeredValues(): { name: string; says: string }[] {
    const barred = barredFrom(calculator?.editing);
    return objects
      .filter((object) => isValue(object) && !barred.has(object.id))
      .map((object) => ({
        name: names.get(object.id) ?? "",
        says: sayQuantity(readable.value(object.id)),
      }));
  }

  /** A name in the Calculator's text, read back to what it names. */
  const namedInSketch = {
    value: (name: string) => {
      const found = objects.find((object) => isValue(object) && names.get(object.id) === name);
      return found ? found.id : null;
    },
    fn: (name: string) => {
      const found = objects.find((object) => isFunction(object) && names.get(object.id) === name);
      return found ? found.id : null;
    },
  };

  /**
   * What a new function will be called, so the Calculator says the name it is
   * about to take rather than always saying f.
   */
  function nextFunctionName(): string {
    const taken = new Set(objects.map((object) => names.get(object.id)));
    const letters = "fgh";
    for (let nth = 0; ; nth += 1) {
      const round = Math.floor(nth / letters.length);
      const wanted = round === 0 ? letters[nth % 3] : `${letters[nth % 3]}${round}`;
      if (!taken.has(wanted)) return wanted;
    }
  }

  /** The functions the Calculator offers, less any it is not allowed to read. */
  function offeredFunctions(): string[] {
    const barred = barredFrom(calculator?.editing);
    return objects
      .filter((object) => isFunction(object) && !barred.has(object.id))
      .map((object) => names.get(object.id) ?? "");
  }

  /** The one function selected, which is what a derivative is taken of. */
  function chosenFunction() {
    if (selected.length !== 1) return undefined;
    const only = selected[0];
    return isFunction(only) ? only : undefined;
  }

  function defineDerivative() {
    const of = chosenFunction();
    if (!of) return;
    sketch.addObjects([createFunction(valueSpot(), { of: of.id })]);
  }

  /**
   * Change one object on the page, leaving the rest of it as it stands. The
   * change says what kind it is about and hands anything else back untouched,
   * since an id is only ever the kind that made it.
   */
  function amend(id: string, part: (object: SketchObject) => SketchObject) {
    const before = sketch.read();
    sketch.commit({
      ...before,
      objects: before.objects.map((object) => (object.id === id ? part(object) : object)),
    });
  }

  function landParameter(value: number, unit: ParameterUnit, places: number) {
    const editing = parameterDialog?.editing;
    if (editing) {
      amend(editing, (object) =>
        isParameter(object) ? { ...object, value, unit, places } : object,
      );
      setParameterDialog(null);
      return;
    }
    const made = createParameter({ value, unit, places }, valueSpot());
    // Made from inside the Calculator, it goes into the expression rather than
    // taking the selection over, since the Calculator is still what is in hand.
    if (parameterDialog?.fromCalculator) {
      const called = namesFor([...objects, made]).get(made.id) ?? null;
      sketch.addObjects([made], selection);
      setInsert(called);
    } else {
      sketch.addObjects([made]);
    }
    setParameterDialog(null);
  }

  function landCalculation(expression: Expr) {
    const editing = calculator?.editing;
    if (calculator?.forFunction) {
      if (editing) {
        amend(editing, (object) => (isFunction(object) ? { ...object, body: expression } : object));
      } else {
        sketch.addObjects([createFunction(valueSpot(), { body: expression })]);
      }
      setCalculator(null);
      return;
    }
    if (editing) {
      amend(editing, (object) => (isCalculation(object) ? { ...object, expression } : object));
    } else {
      sketch.addObjects([createCalculation(expression, valueSpot())]);
    }
    setCalculator(null);
  }

  /** The one table selected, which is what the two table entries act on. */
  function chosenTable() {
    if (selected.length !== 1) return undefined;
    const only = selected[0];
    return isTable(only) ? only : undefined;
  }

  /** Every number selected, in the order it was picked, for Tabulate. */
  function chosenValues(): string[] {
    return selected.filter(isValue).map((object) => object.id);
  }

  function tabulate() {
    const of = chosenValues();
    if (of.length === 0) return;
    sketch.addObjects([createTable(of, valueSpot())]);
  }

  /**
   * What a table's columns say now, held in the sheet's own terms so the row
   * still reads right if the sketch is later written in other units.
   */
  function rowNow(table: SketchTable) {
    return table.of.map((id) => {
      const found = readable.value(id);
      return found ? inSheetTerms(found) : null;
    });
  }

  function captureRow(id: string) {
    amend(id, (object) =>
      isTable(object) ? { ...object, rows: [...object.rows, rowNow(object)] } : object,
    );
  }

  /** Take rows off a table: the last capture, or every one of them. */
  function dropRows(id: string, all: boolean) {
    amend(id, (object) =>
      isTable(object) ? { ...object, rows: all ? [] : object.rows.slice(0, -1) } : object,
    );
  }

  function startAdding(wanted: AddTableData) {
    const table = chosenTable();
    setTableDialog(null);
    if (!table) return;
    if (wanted.kind === "one") {
      captureRow(table.id);
      return;
    }
    // Nothing is taken yet: the first row lands when the numbers next move.
    collecting.current = {
      table: table.id,
      left: wanted.rows,
      perSecond: wanted.perSecond,
      at: 0,
    };
  }

  /** What an existing calculation or function holds, for the Calculator to open on. */
  function calculationHeld(id?: string): Expr | undefined {
    const found = id ? objects.find((object) => object.id === id) : undefined;
    if (found && isCalculation(found)) return found.expression;
    if (found && isFunction(found)) return found.body;
    return undefined;
  }

  /** What an existing parameter holds, for the dialog to open on. */
  function parameterHeld(id?: string) {
    const found = id ? objects.find((object) => object.id === id) : undefined;
    if (!found || !isParameter(found)) return undefined;
    return { value: found.value, unit: found.unit, places: found.places };
  }

  /**
   * The one thing selected that was made in a dialog and can go back to it. A
   * derivative holds nothing of its own, so there is nothing in it to edit.
   */
  function editable(): string | null {
    if (selected.length !== 1) return null;
    const only = selected[0];
    if (isParameter(only) || isCalculation(only)) return only.id;
    return isFunction(only) && only.body ? only.id : null;
  }

  /** Double-clicking a number goes back to whatever dialog made it. */
  function editValue(id: string) {
    const found = objects.find((object) => object.id === id);
    if (!found) return;
    if (isParameter(found)) setParameterDialog({ editing: id });
    else if (isCalculation(found)) setCalculator({ editing: id });
    else if (isFunction(found) && found.body) setCalculator({ forFunction: true, editing: id });
  }

  /** Reopen whatever dialog made the one thing selected, where one can be. */
  function editSelected() {
    const found = editable();
    if (found) editValue(found);
  }

  return {
    valueSpot,
    editSelected,
    offeredValues,
    namedInSketch,
    nextFunctionName,
    offeredFunctions,
    chosenFunction,
    defineDerivative,
    landParameter,
    landCalculation,
    chosenTable,
    chosenValues,
    tabulate,
    rowNow,
    captureRow,
    dropRows,
    startAdding,
    calculationHeld,
    parameterHeld,
    editable,
    editValue,
  };
}

/** The numbers the sketch holds, as the window holds them. */
export type Numbers = ReturnType<typeof valueActions>;
