import {
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { insertAtCaret } from "../sketch/captions";
import type {
  CaptionAlign,
  LinePattern,
  LineWidth,
  SketchCaption,
  TextLook,
} from "../sketch/model";
import { LINE_PATTERNS, LINE_WIDTHS } from "../sketch/model";
import { FONTS, INKS, NOTATION, SIZES, SYMBOLS } from "./typeset";
import "./Palette.css";

/**
 * The stretch of the caption being typed into that is selected, or null when
 * nothing is: a collapsed caret has no run to format, so the change goes to the
 * caption as a whole instead.
 */
function chosenRun(editor: HTMLDivElement | null): Range | null {
  if (!editor) return null;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return null;
  return range;
}

/** Set the chosen run in its own type, and leave it chosen. */
function wrapRun(range: Range, style: Partial<CSSStyleDeclaration>) {
  const span = document.createElement("span");
  Object.assign(span.style, style);
  span.appendChild(range.extractContents());
  range.insertNode(span);
  const selection = window.getSelection();
  const kept = document.createRange();
  kept.selectNodeContents(span);
  selection?.removeAllRanges();
  selection?.addRange(kept);
}

/**
 * How the text under the caret is set right now, read back off the runs the
 * palette itself wrote. A caption says what it is set in as a whole, but a run
 * inside it can say something else, and the bar has to show where you are
 * rather than what the caption started as.
 */
function caretLook(editor: HTMLDivElement | null): Partial<TextLook> {
  const selection = window.getSelection();
  const node = selection?.focusNode;
  if (!editor || !node || !editor.contains(node)) return {};
  let found = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const look: Partial<TextLook> = {};
  while (found && found !== editor) {
    const { style } = found as HTMLElement;
    if (look.font === undefined && style?.fontFamily) {
      look.font = style.fontFamily.split(",")[0].replace(/["']/g, "").trim();
    }
    if (look.size === undefined && style?.fontSize) {
      look.size = Number.parseFloat(style.fontSize);
    }
    // Written as a token so the sheet keeps one source of truth for red.
    if (look.colour === undefined && style?.color.startsWith("var(")) {
      look.colour = style.color.slice(4, -1).trim();
    }
    found = found.parentElement;
  }
  return look;
}

/** Whether the caret is in bold, italic or underlined text right now. */
function caretMarks(): Record<"bold" | "italic" | "underline", boolean> {
  const read = (command: string) => {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  };
  return { bold: read("bold"), italic: read("italic"), underline: read("underline") };
}

/** How each weight is drawn in its own button, in pixels. */
const WEIGHT_SAMPLE: Record<LineWidth, number> = {
  hairline: 1,
  thin: 1.75,
  medium: 3,
  thick: 4.5,
};

/** How each pattern is drawn in its own button. */
const PATTERN_SAMPLE: Record<LinePattern, string | undefined> = {
  solid: undefined,
  dashed: "6 4",
  dotted: "0.1 3.5",
};

const WEIGHT_NAMES: Record<LineWidth, string> = {
  hairline: "Hairline",
  thin: "Thin",
  medium: "Medium",
  thick: "Thick",
};

const PATTERN_NAMES: Record<LinePattern, string> = {
  solid: "Solid",
  dashed: "Dashed",
  dotted: "Dotted",
};

/** How the next caption is written and ranged, where a tool is armed to write one. */
export interface ArmedText {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: CaptionAlign;
}

/** What the bar is setting, and what of it the selection can take. */
export interface Styling {
  /** The colour token every selected object shares, or null where they differ. */
  colour: string | null;
  weight: LineWidth | null;
  pattern: LinePattern | null;
  /** Whether anything selected can take each of the three. */
  canColour: boolean;
  canWeight: boolean;
  canPattern: boolean;
}

interface PaletteProps {
  /** The caption being typed into. Null when none is open. */
  editor: RefObject<HTMLDivElement | null>;
  /** The caption the palette is set on: the one open, or the one selected. */
  caption: SketchCaption | null;
  /**
   * How the text of whatever is selected reads now. Null when there is no text
   * in the selection, which greys the face and the size.
   */
  look: TextLook | null;
  editing: boolean;
  /**
   * How the picked label is set now, or null when no label is picked. A label
   * has no runs and no caret, so the three style keys read and set the whole
   * of it rather than following where the next keystroke would land.
   */
  labelMarks: Record<"bold" | "italic" | "underline", boolean> | null;
  onLabelMark: (mark: "bold" | "italic" | "underline", on: boolean) => void;
  /**
   * How the tool that is up is armed to write, or null where it writes nothing
   * that carries marks. With no caption open and no label picked there is still
   * something for the three style keys and the ranging to say, which is how the
   * next caption comes out, so they set this rather than greying out.
   */
  armedText: ArmedText | null;
  onArmText: (change: Partial<ArmedText>) => void;
  onCaption: (change: Partial<SketchCaption>) => void;
  styling: Styling;
  onStyle: (change: { colour?: string; weight?: LineWidth; pattern?: LinePattern }) => void;
}

/**
 * The palette: a bar under the sheet saying how whatever is selected is drawn.
 *
 * Two rows, always. The top one is the object itself, its colour, how heavy it
 * is stroked and how it dashes. The bottom one is the text, its face and size,
 * its style and how it is ranged, with the notation and the symbols after them.
 * What the selection cannot take greys out rather than going away, so the bar
 * keeps its shape and the sheet never changes height under it.
 *
 * The bar reads back as well as writes: while a caption is open it follows the
 * caret, so the face, the size, the ink and the three style keys say how the
 * text under the caret is set rather than how the caption started.
 */
export function Palette({
  editor,
  caption,
  look,
  editing,
  labelMarks,
  onLabelMark,
  armedText,
  onArmText,
  onCaption,
  styling,
  onStyle,
}: PaletteProps) {
  // The caret moving is not a render on its own, so the bar asks to be redrawn
  // whenever the selection changes and reads the new position back.
  const [, redraw] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    document.addEventListener("selectionchange", redraw);
    return () => document.removeEventListener("selectionchange", redraw);
  }, []);

  /** Keeps the caret where it is: a press here must not take the focus. */
  function hold(event: MouseEvent) {
    event.preventDefault();
  }

  /** What was just done to the text is now what the caption says. */
  function commit() {
    const element = editor.current;
    if (element) onCaption({ html: element.innerHTML });
  }

  function setFace(style: Partial<CSSStyleDeclaration>, whole: Partial<SketchCaption>) {
    const run = chosenRun(editor.current);
    if (run) {
      wrapRun(run, style);
      commit();
      return;
    }
    onCaption(whole);
  }

  /** Colour goes to a chosen run of text, or to everything selected. */
  function pickColour(token: string) {
    const run = chosenRun(editor.current);
    if (run) {
      wrapRun(run, { color: `var(${token})` });
      commit();
      return;
    }
    onStyle({ colour: token });
  }

  function style(command: "bold" | "italic" | "underline") {
    if (labelMarks) {
      onLabelMark(command, !labelMarks[command]);
      return;
    }
    // Nothing open to type into, so the key arms the tool: the next caption
    // starts out written this way.
    if (!editing && armedText) {
      onArmText({ [command]: !armedText[command] });
      return;
    }
    editor.current?.focus();
    document.execCommand(command);
    commit();
    redraw();
  }

  // What the caret is in beats what the caption is set in, since a run can say
  // something else and the caret is where the next keystroke lands.
  const here = editing ? caretLook(editor.current) : {};
  const marks =
    labelMarks ??
    (editing ? caretMarks() : (armedText ?? { bold: false, italic: false, underline: false }));
  /**
   * The three keys go in at the caret, so they want a caption open or a label
   * picked, and failing both a tool armed to write the next caption.
   */
  const marksOff = !editing && !labelMarks && !armedText;
  /** The ranging: the caption it is set on, or the one about to be written. */
  const ranged = caption ? caption.align : armedText?.align;
  const rangeOff = !caption && !armedText;
  const font = here.font ?? look?.font ?? FONTS[0];
  const size = here.size ?? look?.size ?? 14;
  const inked = here.colour ?? look?.colour ?? styling.colour;
  const colourOff = !styling.canColour && !look;

  return (
    <div className="palette">
      <div className="palette__row">
        <span className={`palette__name${colourOff ? "" : " palette__name--on"}`}>Colour</span>
        <div className="palette__controls palette__controls--inks">
          {INKS.map((ink) => (
            <button
              type="button"
              key={ink.token}
              className={`palette__ink${inked === ink.token ? " palette__ink--on" : ""}`}
              style={{ background: `var(${ink.token})` }}
              aria-label={ink.name}
              title={ink.name}
              disabled={colourOff}
              onMouseDown={hold}
              onClick={() => pickColour(ink.token)}
            />
          ))}
        </div>

        <span className="palette__split" />
        <span className={`palette__name${styling.canWeight ? " palette__name--on" : ""}`}>
          Weight
        </span>
        <div className="palette__controls">
          {LINE_WIDTHS.map((weight) => (
            <button
              type="button"
              key={weight}
              className={`palette__key palette__key--sample${
                styling.weight === weight ? " palette__key--on" : ""
              }`}
              aria-label={WEIGHT_NAMES[weight]}
              title={WEIGHT_NAMES[weight]}
              disabled={!styling.canWeight}
              onMouseDown={hold}
              onClick={() => onStyle({ weight })}
            >
              <Rule width={WEIGHT_SAMPLE[weight]} />
            </button>
          ))}
        </div>

        <span className="palette__split" />
        <span className={`palette__name${styling.canPattern ? " palette__name--on" : ""}`}>
          Pattern
        </span>
        <div className="palette__controls">
          {LINE_PATTERNS.map((pattern) => (
            <button
              type="button"
              key={pattern}
              className={`palette__key palette__key--sample${
                styling.pattern === pattern ? " palette__key--on" : ""
              }`}
              aria-label={PATTERN_NAMES[pattern]}
              title={PATTERN_NAMES[pattern]}
              disabled={!styling.canPattern}
              onMouseDown={hold}
              onClick={() => onStyle({ pattern })}
            >
              <Rule width={2} dash={PATTERN_SAMPLE[pattern]} />
            </button>
          ))}
        </div>
        <span className="palette__gap" />
      </div>

      <div className="palette__rule" />

      <div className="palette__row">
        <span className={`palette__name${look ? " palette__name--on" : ""}`}>Text</span>
        <div className="palette__controls">
          <Picker
            label="Font"
            value={font}
            disabled={!look}
            wide
            face={font}
            onPick={(next) => setFace({ fontFamily: `"${next}"` }, { font: next })}
            options={FONTS.map((one) => ({ value: one, label: one, face: one }))}
          />
          <Picker
            label="Size"
            value={`${size}`}
            disabled={!look}
            onPick={(next) => setFace({ fontSize: `${next}pt` }, { size: Number(next) })}
            options={SIZES.map((one) => ({ value: `${one}`, label: `${one}` }))}
          />
        </div>

        <span className="palette__split" />
        <span className={`palette__name${marksOff ? "" : " palette__name--on"}`}>Style</span>
        <div className="palette__controls">
          <button
            type="button"
            className={`palette__key palette__key--bold${marks.bold ? " palette__key--on" : ""}`}
            aria-label="Bold"
            aria-pressed={marks.bold}
            title="Bold (Ctrl+B)"
            disabled={marksOff}
            onMouseDown={hold}
            onClick={() => style("bold")}
          >
            B
          </button>
          <button
            type="button"
            className={`palette__key palette__key--italic${marks.italic ? " palette__key--on" : ""}`}
            aria-label="Italic"
            aria-pressed={marks.italic}
            title="Italic (Ctrl+I)"
            disabled={marksOff}
            onMouseDown={hold}
            onClick={() => style("italic")}
          >
            I
          </button>
          <button
            type="button"
            className={`palette__key palette__key--underline${
              marks.underline ? " palette__key--on" : ""
            }`}
            aria-label="Underline"
            aria-pressed={marks.underline}
            title="Underline (Ctrl+U)"
            disabled={marksOff}
            onMouseDown={hold}
            onClick={() => style("underline")}
          >
            U
          </button>
          <span className="palette__split palette__split--tight" />
          {(["left", "center", "right"] as CaptionAlign[]).map((way) => (
            <button
              type="button"
              key={way}
              className={`palette__key palette__key--align${
                ranged === way ? " palette__key--on" : ""
              }`}
              aria-label={`Align ${way}`}
              title={`Align ${way} (Alt+${way === "left" ? "Left" : way === "right" ? "Right" : "Up"})`}
              disabled={rangeOff}
              onMouseDown={hold}
              onClick={() => (caption ? onCaption({ align: way }) : onArmText({ align: way }))}
            >
              <span className={`palette__lines palette__lines--${way}`} />
            </button>
          ))}
        </div>

        <span className="palette__split" />

        <div className="palette__openers">
          <Popout name="Notation" sample={"√x"} disabled={!editing}>
            <div className="palette__grid palette__grid--notation">
              {NOTATION.map((mark) => (
                <button
                  type="button"
                  key={mark.id}
                  className="palette__key palette__key--wide"
                  title={mark.name}
                  aria-label={mark.name}
                  onMouseDown={hold}
                  onClick={() => {
                    insertAtCaret(editor.current, mark.html);
                    commit();
                  }}
                >
                  {mark.sample}
                </button>
              ))}
            </div>
          </Popout>

          <Popout name="Symbols" sample={"π"} disabled={!editing}>
            <div className="palette__sets">
              {SYMBOLS.map((set) => (
                <div className="palette__set" key={set.name}>
                  <span className="palette__name palette__name--set">{set.name}</span>
                  <div className="palette__grid">
                    {set.glyphs.map((glyph) => (
                      <button
                        type="button"
                        key={glyph}
                        className="palette__glyph"
                        title={glyph}
                        onMouseDown={hold}
                        onClick={() => {
                          insertAtCaret(editor.current, glyph);
                          commit();
                        }}
                      >
                        {glyph}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Popout>
        </div>
        <span className="palette__gap" />
      </div>
    </div>
  );
}

/** Shut whatever is open as soon as a press lands outside it. */
function useAway(anchor: RefObject<HTMLDivElement | null>, open: boolean, shut: () => void) {
  const close = useRef(shut);
  close.current = shut;
  useEffect(() => {
    if (!open) return;
    function away(event: PointerEvent) {
      if (!anchor.current?.contains(event.target as Node)) close.current();
    }
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [anchor, open]);
}

interface PickerProps {
  label: string;
  value: string;
  disabled: boolean;
  wide?: boolean;
  /** Set the box in the face it names, so it is a specimen of itself. */
  face?: string;
  options: { value: string; label: string; face?: string }[];
  onPick: (value: string) => void;
}

/**
 * A dropdown the bar opens itself. A native select will not do: the press that
 * opens one has to be let through, and letting it through takes the caret out
 * of the caption the palette is set on, which is the thing being set.
 */
function Picker({ label, value, disabled, wide, face, options, onPick }: PickerProps) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  useAway(anchor, open, () => setOpen(false));
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div className={`palette__picker${wide ? " palette__picker--wide" : ""}`} ref={anchor}>
      <button
        type="button"
        className={`palette__box${open ? " palette__box--on" : ""}`}
        aria-label={label}
        disabled={disabled}
        style={face ? { fontFamily: `"${face}", serif` } : undefined}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="palette__value">{value}</span>
        <span className="palette__caret palette__caret--down" />
      </button>
      {open && (
        <div className="palette__list">
          {options.map((option) => (
            <button
              type="button"
              key={option.value}
              className={`palette__option${option.value === value ? " palette__option--on" : ""}`}
              style={option.face ? { fontFamily: `"${option.face}", serif` } : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setOpen(false);
                onPick(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A run of controls too big for a bar: it opens above the bar instead. There is
 * only ever room for two rows, and the notation and the symbols each need more.
 */
function Popout({
  name,
  sample,
  disabled,
  children,
}: {
  name: string;
  sample: string;
  disabled: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  useAway(anchor, open, () => setOpen(false));

  // A run that goes dead while it is open takes its panel down with it.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <div className="palette__opener-anchor" ref={anchor}>
      <button
        type="button"
        className={`palette__opener${open ? " palette__opener--on" : ""}`}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((was) => !was)}
      >
        <span className="palette__sample">{sample}</span>
        {name}
        <span className="palette__caret palette__caret--up" />
      </button>
      {open && <div className="palette__panel">{children}</div>}
    </div>
  );
}

/** A sample of a stroke, drawn the way the button would set it. */
function Rule({ width, dash }: { width: number; dash?: string }) {
  return (
    <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true">
      <line
        x1="2"
        y1="6"
        x2="24"
        y2="6"
        stroke="currentColor"
        strokeWidth={width}
        strokeDasharray={dash}
        strokeLinecap={dash === PATTERN_SAMPLE.dotted ? "round" : "butt"}
      />
    </svg>
  );
}
