import { useEffect, useRef, useState } from "react";
import {
  BUILT_INS,
  type Expr,
  evaluate,
  failed,
  LITERAL_UNITS,
  type Named,
  type ParseFailed,
  parse,
  type Sheet,
  write,
} from "../sketch/expression";
import { sayQuantity } from "../sketch/measure";
import { DialogFrame } from "./DialogFrame";
import "./CalculatorDialog.css";

/** One thing that can be dropped into the expression from a pop-up. */
interface Offer {
  /** What goes into the text. */
  text: string;
  /** What the pop-up calls it, where that is not the text itself. */
  label?: string;
  /** Set on the entry that does something rather than inserting anything. */
  act?: () => void;
}

interface CalculatorDialogProps {
  /** Defining a function rather than a calculation, which is what x is for. */
  forFunction?: boolean;
  /** What the function will be called, so the dialog reads f(x) = rather than a guess. */
  lead?: string;
  /** What it opens holding, for an expression being changed rather than made. */
  start?: Expr;
  /** The sketch's numbers, as the Values pop-up lists them. */
  values: { name: string; says: string }[];
  /** The functions already defined, as the Functions pop-up lists them. */
  functions: string[];
  /** What a name in the text stands for. */
  named: Named;
  /** What the expression is worked out against, for the preview. */
  sheet: Sheet;
  names: Map<string, string>;
  /**
   * A name to drop in at the cursor, which is how clicking a value on the sheet
   * reaches the expression. Cleared through `onInserted` once it has landed.
   */
  insert: string | null;
  onInserted: () => void;
  onNewParameter: () => void;
  onApply: (expr: Expr) => void;
  onCancel: () => void;
  /** Set while New Parameter is open over it, so the keys belong to that. */
  quiet?: boolean;
}

/** A pop-up of things to drop in, opened from the button that names it. */
function Popup({
  name,
  offers,
  disabled,
  onPick,
}: {
  name: string;
  offers: Offer[];
  disabled?: boolean;
  onPick: (offer: Offer) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="calc__popup">
      <button
        type="button"
        className="calc__popup-button"
        disabled={disabled || offers.length === 0}
        onClick={() => setOpen(!open)}
      >
        {name}
        <span className="calc__caret" />
      </button>
      {open && (
        <>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: dismiss layer, the entries stay reachable */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: the entries are buttons and take the keyboard themselves */}
          <div className="calc__dismiss" onClick={() => setOpen(false)} />
          <div className="calc__list">
            {offers.map((offer) => (
              <button
                key={offer.label ?? offer.text}
                type="button"
                className="calc__list-item"
                onClick={() => {
                  setOpen(false);
                  onPick(offer);
                }}
              >
                {offer.label ?? offer.text}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** The keypad, four rows of five. The last cell is x, and only for a function. */
const KEYS = [
  "7",
  "8",
  "9",
  "(",
  ")",
  "4",
  "5",
  "6",
  "÷",
  "×",
  "1",
  "2",
  "3",
  "−",
  "+",
  "0",
  ".",
  "^",
];

/**
 * The Calculator: one dialog for a calculation and for a function, since both
 * are an expression and the only difference is whether x means anything.
 *
 * The reference app makes you build the expression by clicking its keypad. Here
 * the field is a field: type into it, and let the keypad, the pop-ups and the
 * sheet itself drop things in at the cursor for the parts that are quicker to
 * click than to spell. The preview says what it comes to as well as how it
 * reads, so the number is there before the dialog is closed, and an expression
 * that does not work says why in words rather than only turning red.
 */
export function CalculatorDialog({
  forFunction,
  lead,
  start,
  values,
  functions,
  named,
  sheet,
  names,
  insert,
  onInserted,
  onNewParameter,
  onApply,
  onCancel,
  quiet,
}: CalculatorDialogProps) {
  const [text, setText] = useState(() => (start ? write(start, names) : ""));
  const field = useRef<HTMLInputElement>(null);

  /** Drop something in where the cursor is, and leave the cursor after it. */
  function drop(said: string) {
    const input = field.current;
    const from = input?.selectionStart ?? text.length;
    const to = input?.selectionEnd ?? text.length;
    const next = `${text.slice(0, from)}${said}${text.slice(to)}`;
    setText(next);
    // The field has to come back before the caret can be put anywhere in it.
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(from + said.length, from + said.length);
    });
  }

  // A value clicked on the sheet lands at the cursor, which is what the
  // reference app does and the quickest way to name a measurement.
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs on the name arriving, not on the text moving under it
  useEffect(() => {
    if (insert === null) return;
    drop(insert);
    onInserted();
  }, [insert]);

  const parsed = parse(text, named, forFunction);
  const trouble: ParseFailed | null = failed(parsed) ? parsed : null;
  const expr: Expr | null = trouble ? null : (parsed as Expr);
  // A function is read at nothing in particular, so it previews how it reads
  // rather than what it comes to. A calculation has a number now.
  const worked = expr && !forFunction ? evaluate(expr, sheet) : null;

  const preview =
    text.trim() === ""
      ? forFunction
        ? "Write it in x."
        : "Type an expression, or click a number on the sheet."
      : trouble
        ? trouble.error
        : expr
          ? forFunction
            ? write(expr, names)
            : `${write(expr, names)}  =  ${sayQuantity(worked)}`
          : "";

  const valueOffers: Offer[] = [
    ...values.map((value) => ({ text: value.name, label: `${value.name}   ${value.says}` })),
    { text: "π" },
    { text: "e" },
    { text: "", label: "New Parameter…", act: onNewParameter },
  ];

  return (
    <DialogFrame
      title={forFunction ? "New Function" : "Calculate"}
      action={start ? "Change" : "Add"}
      canApply={expr !== null}
      onApply={() => expr && onApply(expr)}
      onCancel={onCancel}
      quiet={quiet}
      wide
    >
      <div className="calc__input">
        {forFunction && <span className="calc__lead">{lead ?? "f"}(x) =</span>}
        {/* Behind the field, so the part that stops making sense reads red. */}
        <div className="calc__well">
          {trouble && (
            <div className="calc__ghost" aria-hidden="true">
              <span>{text.slice(0, trouble.at)}</span>
              <span className="calc__ghost-bad">{text.slice(trouble.at)}</span>
            </div>
          )}
          <input
            ref={field}
            className={`calc__field${trouble ? " calc__field--bad" : ""}`}
            value={text}
            // biome-ignore lint/a11y/noAutofocus: the expression is the whole point of the dialog
            autoFocus
            spellCheck={false}
            aria-label="Expression"
            onChange={(event) => setText(event.target.value)}
          />
        </div>
      </div>

      <p className={`calc__preview${trouble ? " calc__preview--bad" : ""}`}>{preview}</p>

      <div className="calc__popups">
        <Popup
          name="Values"
          offers={valueOffers}
          onPick={(offer) => (offer.act ? offer.act() : drop(offer.text))}
        />
        <Popup
          name="Functions"
          offers={[...functions, ...BUILT_INS].map((fn) => ({ text: `${fn}(`, label: fn }))}
          onPick={(offer) => drop(offer.text)}
        />
        <Popup
          name="Units"
          offers={LITERAL_UNITS.map((unit) => ({
            text: unit === "°" ? "°" : ` ${unit}`,
            label: unit,
          }))}
          onPick={(offer) => drop(offer.text)}
        />
      </div>

      <div className="calc__keys">
        {KEYS.map((key) => (
          <button key={key} type="button" className="calc__key" onClick={() => drop(key)}>
            {key}
          </button>
        ))}
        <button
          type="button"
          className="calc__key calc__key--back"
          aria-label="Back"
          onClick={() => setText(text.slice(0, -1))}
        >
          ⌫
        </button>
        {forFunction && (
          <button type="button" className="calc__key calc__key--x" onClick={() => drop("x")}>
            x
          </button>
        )}
      </div>
    </DialogFrame>
  );
}
