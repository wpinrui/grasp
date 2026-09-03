import { type MouseEvent, type RefObject, useEffect, useReducer } from "react";
import { insertAtCaret } from "../sketch/captions";
import type {
  CaptionAlign,
  LinePattern,
  LineWidth,
  SketchCaption,
  TextLook,
} from "../sketch/model";
import { LINE_PATTERNS, LINE_WIDTHS } from "../sketch/model";
import { PATTERN_SAMPLE, Picker, Popout, Rule, WEIGHT_SAMPLE } from "./PalettePicker";
import { caretLook, caretMarks, chosenRun, wrapRun } from "./paletteCaret";
import { FONTS, INKS, NOTATION, SIZES, SYMBOLS } from "./typeset";
import "./Palette.css";

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
