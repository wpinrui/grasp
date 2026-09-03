/**
 * Which dialog is open, and what each one is holding while it is.
 *
 * Every field here is about the window rather than the sketch: closing a dialog
 * and opening it again is not an undo step, and nothing in it reaches a page
 * until the dialog is answered. The scripting modal is the exception worth
 * naming: what was asked for and the script last put in the box outlive being
 * shut, so neither is lost by closing it.
 */

import { useRef, useState } from "react";
import type { ButtonForm } from "../components/ButtonDialog";
import type { ExportTo } from "../components/ExportDialog";
import { NEW_PAGE, type ScriptWay } from "../components/ScriptDialog";
import type { Clash } from "./labels";
import type { CalculatorState, Collecting, ParameterState } from "./values";

export function useDialogs() {
  /**
   * The Calculator: whether it is making a calculation or a function, and which
   * one it is changing where it is not a new one.
   */
  const [calculator, setCalculator] = useState<CalculatorState | null>(null);
  /**
   * New Parameter. It can be opened from the Calculator as well as from the
   * menu, and one opened that way drops the parameter it makes into the
   * expression, which is what `fromCalculator` is for.
   */
  const [parameterDialog, setParameterDialog] = useState<ParameterState | null>(null);
  /** A name waiting to be dropped into the Calculator at its cursor. */
  const [insert, setInsert] = useState<string | null>(null);
  /** Which of the two table dialogs is open, over the one table selected. */
  const [tableDialog, setTableDialog] = useState<"add" | "remove" | null>(null);
  /** Which of the two custom transform dialogs is open. */
  const [customDialog, setCustomDialog] = useState<"define" | "edit" | null>(null);
  /** The kind of action button being made, while its dialog is open. */
  const [buttonDialog, setButtonDialog] = useState<ButtonForm | null>(null);
  const [docOptions, setDocOptions] = useState(false);
  /** Which export is open, and so where its picture goes. */
  const [exportTo, setExportTo] = useState<ExportTo | null>(null);
  /** Whether the About box is up. */
  const [about, setAbout] = useState(false);
  /** A rename waiting on what to do about the name already being in use. */
  const [clash, setClash] = useState<Clash | null>(null);
  /**
   * A run of automatic collection: the table filling up, how many rows are
   * still wanted, how fast they may be taken, and when the last one was. It
   * ends of its own accord once the rows are in.
   */
  const collecting = useRef<Collecting | null>(null);
  /**
   * The scripting modal: which button opened it, what was asked for, the script
   * last put in the box, and where a run is to draw.
   */
  const [scriptWay, setScriptWay] = useState<ScriptWay | null>(null);
  const [request, setRequest] = useState("");
  const [script, setScript] = useState("");
  const [scriptTarget, setScriptTarget] = useState<string>(NEW_PAGE);
  const [scriptErrors, setScriptErrors] = useState<string[]>([]);
  const [scriptRunning, setScriptRunning] = useState(false);

  /**
   * Whether one of these owns the keyboard. The transform dialogs are not in
   * here: they are the sketch's own, and the window asks about them separately.
   */
  const anyOpen =
    calculator !== null ||
    parameterDialog !== null ||
    tableDialog !== null ||
    customDialog !== null ||
    buttonDialog !== null ||
    scriptWay !== null ||
    docOptions;

  return {
    calculator,
    setCalculator,
    parameterDialog,
    setParameterDialog,
    insert,
    setInsert,
    tableDialog,
    setTableDialog,
    customDialog,
    setCustomDialog,
    buttonDialog,
    setButtonDialog,
    docOptions,
    setDocOptions,
    exportTo,
    setExportTo,
    about,
    setAbout,
    clash,
    setClash,
    collecting,
    scriptWay,
    setScriptWay,
    request,
    setRequest,
    script,
    setScript,
    scriptTarget,
    setScriptTarget,
    scriptErrors,
    setScriptErrors,
    scriptRunning,
    setScriptRunning,
    anyOpen,
  };
}

export type Dialogs = ReturnType<typeof useDialogs>;
