import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import { withNames } from "../sketch/captions";
import type { CaptionAlign, Position, SketchCaption, View } from "../sketch/model";
import { SLOT } from "./typeset";
import "./CaptionBox.css";

/** The least a caption can be dragged down to, in screen pixels. */
const MIN_WIDTH = 48;

/** Pointer travel that turns a press on a caption into a drag. */
const DRAG_THRESHOLD = 3;

interface CaptionBoxProps {
  caption: SketchCaption;
  /** What everything on the page is called, for the links to read. */
  names: Map<string, string>;
  view: View;
  scale: number;
  selected: boolean;
  editing: boolean;
  /** Which tool is up: only the Arrow and the Text tool touch a caption. */
  tool: string;
  /** Where the palette reaches the caption being typed into. */
  editor: RefObject<HTMLDivElement | null>;
  onEdit: (id: string | null) => void;
  onSelect: (id: string, additive: boolean) => void;
  /**
   * A drag is starting. The sheet decides what it moves, since a caption in the
   * selection carries the rest of it along the way any other object does.
   */
  onGrab: (id: string) => void;
  /** How far the drag has come, in sheet units. */
  onDrag: (by: Position) => void;
  onDrop: () => void;
  /** A resize is starting, so the whole of it is one undo step. */
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onWidth: (id: string, width: number) => void;
  onAlign: (id: string, align: CaptionAlign) => void;
  onCommit: (id: string, html: string) => void;
  /** A link is being pointed at: light the object it reads up on the sheet. */
  onLit: (id: string | null) => void;
  onMeasure: (id: string, size: { width: number; height: number }) => void;
}

/** Put the caret in the slot after the one it is in, or the one before it. */
function stepSlot(root: HTMLElement, back: boolean): boolean {
  const slots = [...root.querySelectorAll(".cap-slot")];
  if (slots.length === 0) return false;
  const selection = window.getSelection();
  const here = selection?.anchorNode ?? null;
  const at = slots.findIndex((slot) => here !== null && slot.contains(here));
  const next = at === -1 ? (back ? slots.length - 1 : 0) : at + (back ? -1 : 1);
  const wanted = slots[(next + slots.length) % slots.length];
  const range = document.createRange();
  range.selectNodeContents(wanted);
  selection?.removeAllRanges();
  selection?.addRange(range);
  return true;
}

/** Where in the caption a click landed, so typing starts under the pointer. */
function caretAt(x: number, y: number): Range | null {
  const from = (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range })
    .caretRangeFromPoint;
  return from ? (from.call(document, x, y) ?? null) : null;
}

/**
 * The mathematical notation, whose pieces the caret has to be able to leave.
 * A fraction and a square root lay themselves out as flex boxes so the parts
 * stack and the sign stretches, and a caret cannot walk out of one of those on
 * its own: there is no text position on the far side for it to reach.
 */
const NOTATION = ".cap-frac, .cap-root, .cap-bar, .cap-group, sup, sub";

/** Where the caret is now, as something two moments apart can be compared by. */
function caretSpot(): { node: Node; offset: number } | null {
  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  return { node: range.startContainer, offset: range.startOffset };
}

/** Put the caret just outside the notation it is in, and say whether it went. */
function stepOutOfNotation(editor: HTMLElement, forward: boolean): boolean {
  const at = caretSpot();
  if (!at || !editor.contains(at.node)) return false;
  const from =
    at.node.nodeType === Node.ELEMENT_NODE ? (at.node as Element) : at.node.parentElement;
  const piece = from?.closest(NOTATION);
  if (!piece || !editor.contains(piece)) return false;
  const next = document.createRange();
  if (forward) next.setStartAfter(piece);
  else next.setStartBefore(piece);
  next.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(next);
  return true;
}

/**
 * An arrow the caret could not act on. The browser is left to move it first,
 * and only where it did not move at all does the caret step over the notation
 * it is stuck inside, one piece at a time.
 */
function freeTheCaret(editor: HTMLElement, forward: boolean): void {
  const before = caretSpot();
  if (!before) return;
  requestAnimationFrame(() => {
    const after = caretSpot();
    if (!after) return;
    if (after.node !== before.node || after.offset !== before.offset) return;
    stepOutOfNotation(editor, forward);
  });
}

/**
 * One caption on the sheet: what it says, and everything done to it.
 *
 * It hangs by a spot on the sheet, so it pans with the drawing, but it is drawn
 * over the sheet rather than in it, so it keeps its size at every zoom the way
 * a label does.
 *
 * The Text tool clicks into it to put the caret somewhere and type; the Arrow
 * picks it up, drags it, and opens it with a double-click. Selected or being
 * typed into, it shows the handle at its corner that sets how wide it is, and
 * the text reflows into whatever width it is dragged to.
 */
export function CaptionBox({
  caption,
  names,
  view,
  scale,
  selected,
  editing,
  tool,
  editor,
  onEdit,
  onSelect,
  onGrab,
  onDrag,
  onDrop,
  onGestureStart,
  onGestureEnd,
  onWidth,
  onAlign,
  onCommit,
  onLit,
  onMeasure,
}: CaptionBoxProps) {
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const drag = useRef<{ from: Position; moved: boolean } | null>(null);
  const size = useRef<{ from: number; width: number } | null>(null);
  /** Where the click that opened the caption landed, so the caret starts there. */
  const opened = useRef<{ x: number; y: number } | null>(null);

  // Seeded once, when the caption opens. It is the browser's text from then on,
  // and writing this copy back over it mid-sentence would lose the caret.
  // biome-ignore lint/correctness/useExhaustiveDependencies: opening is the whole trigger
  useLayoutEffect(() => {
    const element = body.current;
    if (!editing || !element) return;
    element.innerHTML = withNames(caption.html, names);
    editor.current = element;
    element.focus();
    const spot = opened.current;
    opened.current = null;
    const selection = window.getSelection();
    // The caret goes where the click landed, or to the end when the caption was
    // opened some other way, ready to carry on writing.
    const range = spot ? caretAt(spot.x, spot.y) : null;
    const wanted = range ?? document.createRange();
    if (!range) {
      wanted.selectNodeContents(element);
      wanted.collapse(false);
    }
    selection?.removeAllRanges();
    selection?.addRange(wanted);
    return () => {
      if (editor.current === element) editor.current = null;
    };
  }, [editing]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      onMeasure(caption.id, { width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [caption.id, onMeasure]);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    // The sheet never sees a press that landed in a caption. Open, the press is
    // the browser's: it moves the caret and selects text.
    event.stopPropagation();
    if (editing) return;
    // The Text tool writes in a caption rather than carrying it about, so a
    // press with it goes straight to the caret.
    if (tool === "text") {
      opened.current = { x: event.clientX, y: event.clientY };
      onEdit(caption.id);
      return;
    }
    if (tool !== "arrow") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { from: { x: event.clientX, y: event.clientY }, moved: false };
  }

  function pullDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const held = drag.current;
    if (!held) return;
    const dx = event.clientX - held.from.x;
    const dy = event.clientY - held.from.y;
    if (!held.moved) {
      if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      held.moved = true;
      onGrab(caption.id);
    }
    onDrag({ x: dx / scale, y: dy / scale });
  }

  function dropDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const held = drag.current;
    drag.current = null;
    if (!held) return;
    event.stopPropagation();
    if (held.moved) {
      onDrop();
      return;
    }
    // A press that went nowhere is a click, which puts the caption in or out of
    // the selection the way a click on anything else does.
    onSelect(caption.id, event.shiftKey || event.ctrlKey);
  }

  function startResize(event: ReactPointerEvent<HTMLSpanElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    size.current = { from: event.clientX, width: caption.width };
    onGestureStart();
  }

  function pullResize(event: ReactPointerEvent<HTMLSpanElement>) {
    const held = size.current;
    if (!held) return;
    event.stopPropagation();
    onWidth(caption.id, Math.max(MIN_WIDTH, held.width + (event.clientX - held.from)));
  }

  function dropResize(event: ReactPointerEvent<HTMLSpanElement>) {
    if (!size.current) return;
    size.current = null;
    event.stopPropagation();
    onGestureEnd();
  }

  function keyed(event: ReactKeyboardEvent<HTMLDivElement>) {
    const element = body.current;
    if (!element) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onCommit(caption.id, element.innerHTML);
      onEdit(null);
      return;
    }
    // Ctrl+Z is the browser's already. Ctrl+R is the other half of that pair
    // for a caption, and nothing here hands it to the menus.
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r") {
      event.preventDefault();
      document.execCommand("redo");
      return;
    }
    // Alt and an arrow sets how the whole caption is ranged across its box.
    if (event.altKey && event.key.startsWith("Arrow")) {
      const align: CaptionAlign =
        event.key === "ArrowLeft" ? "left" : event.key === "ArrowRight" ? "right" : "center";
      event.preventDefault();
      onAlign(caption.id, align);
      return;
    }
    // A caret that cannot get past a fraction or a square root is stuck inside
    // it, and nothing can be typed after one.
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      freeTheCaret(element, event.key === "ArrowRight");
      return;
    }
    if (event.key === "Tab" && element.textContent?.includes(SLOT)) {
      if (stepSlot(element, event.shiftKey)) event.preventDefault();
    }
  }

  /** Pointing at a link lights up what it reads, wherever that sits. */
  function overLink(event: { target: EventTarget | null }) {
    const link = (event.target as HTMLElement | null)?.closest?.("[data-link]");
    onLit(link?.getAttribute("data-link") ?? null);
  }

  const held = tool === "arrow" || tool === "text";
  const shown = `caption${selected ? " caption--selected" : ""}${editing ? " caption--editing" : ""}`;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a caption is written in, not pressed
    <div
      ref={root}
      data-id={caption.id}
      className={shown}
      style={{
        left: `${(caption.x - view.x) * scale}px`,
        top: `${(caption.y - view.y) * scale}px`,
        width: `${caption.width}px`,
        textAlign: caption.align,
        fontFamily: `"${caption.font}", serif`,
        fontSize: `${caption.size}pt`,
        color: `var(${caption.colour})`,
        pointerEvents: held ? "auto" : "none",
      }}
      onPointerDown={startDrag}
      onPointerMove={pullDrag}
      onPointerUp={dropDrag}
      onDoubleClick={(event) => {
        if (editing) return;
        event.stopPropagation();
        opened.current = { x: event.clientX, y: event.clientY };
        onEdit(caption.id);
      }}
      onPointerOver={overLink}
      onPointerOut={() => onLit(null)}
    >
      {editing ? (
        // biome-ignore lint/a11y/useSemanticElements: a caption holds marked-up text, which no input element can
        <div
          ref={body}
          className="caption__body"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          tabIndex={0}
          aria-label="Caption"
          onKeyDown={keyed}
          onBlur={() => onCommit(caption.id, body.current?.innerHTML ?? caption.html)}
        />
      ) : (
        <div
          className="caption__body"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: the caption's own markup, written here
          dangerouslySetInnerHTML={{ __html: withNames(caption.html, names) }}
        />
      )}
      {(selected || editing) && (
        <span
          className="caption__grip"
          onPointerDown={startResize}
          onPointerMove={pullResize}
          onPointerUp={dropResize}
        />
      )}
    </div>
  );
}
