import { type PointerEvent, useEffect, useRef, useState } from "react";
import { usePhone } from "../phone";
import { FlyoutMarker, ShareIcon } from "./icons";
import { TOOLS } from "./tools";
import "./Toolbox.css";

const TOOLTIP_OFFSET = 3;

/**
 * How long a tool is held before its variants come out, and how far a finger
 * may wander in that time and still be holding rather than starting a drag.
 * A press is what stands in for a hover, there being no hover to have.
 *
 * Short of the half second a phone waits before claiming a long press for
 * itself, so the two are not racing for the same gesture.
 */
const HOLD_MS = 350;
const HOLD_SLOP = 8;

interface ToolboxProps {
  activeTool: string;
  onSelectTool: (id: string) => void;
  /** The variant each tool that has a flyout is armed with, by tool id. */
  variants: Record<string, string>;
  onPickVariant: (tool: string, variant: string) => void;
  /** A tool was double-clicked. Only the Text tool makes anything of it. */
  onDoubleClickTool: (id: string) => void;
  /**
   * The tools that have nothing to do as things stand, by id, each with the
   * one line saying why. They grey out, take no press, and open no flyout.
   */
  off: Record<string, string>;
  /**
   * Hand the sketch to the device. Left off where there is nothing to hand it
   * to, which is everywhere the sheet is worked on with a pointer and a file
   * system is a keystroke away.
   */
  onShare?: () => void;
}

export function Toolbox({
  activeTool,
  onSelectTool,
  variants,
  onPickVariant,
  onDoubleClickTool,
  off,
  onShare,
}: ToolboxProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  /**
   * Where the open tool's button is on the screen, which is where whatever it
   * shows is put.
   *
   * Taken from the button rather than counted off a pitch, because the keys are
   * not the same size on every screen; and in screen coordinates rather than the
   * rail's, because the rail scrolls on a touch screen and clips whatever leaves
   * it, so anything placed inside it would be cut off at its edge.
   */
  const [openAt, setOpenAt] = useState({ top: 0, left: 0 });

  /** Open whatever a tool shows, beside the button it belongs to. */
  function show(index: number, button: HTMLButtonElement) {
    const at = button.getBoundingClientRect();
    setOpenAt({ top: at.top, left: at.right });
    setHovered(index);
  }
  const tip = hovered === null ? null : TOOLS[hovered];
  // A tool with variants opens them on hover, in place of its tooltip.
  const opened = tip?.variants?.length && !off[tip.id] ? tip : null;

  const phone = usePhone();
  /** The press being timed, if one is. */
  const holding = useRef<{ x: number; y: number; timer: number } | null>(null);
  /** A hold that came good, so the press that ends it is not also a tap. */
  const opening = useRef(false);

  function dropHold() {
    if (holding.current) window.clearTimeout(holding.current.timer);
    holding.current = null;
  }

  function startHold(index: number, event: PointerEvent<HTMLButtonElement>) {
    const button = event.currentTarget;
    dropHold();
    opening.current = false;
    holding.current = {
      x: event.clientX,
      y: event.clientY,
      timer: window.setTimeout(() => {
        holding.current = null;
        opening.current = true;
        show(index, button);
      }, HOLD_MS),
    };
  }

  function keepHold(event: PointerEvent<HTMLButtonElement>) {
    if (!holding.current) return;
    const gone = Math.hypot(event.clientX - holding.current.x, event.clientY - holding.current.y);
    if (gone > HOLD_SLOP) dropHold();
  }

  // A press still being timed when the rail goes would fire into nothing.
  useEffect(
    () => () => {
      if (holding.current) window.clearTimeout(holding.current.timer);
    },
    [],
  );

  /**
   * With no pointer to move away, what puts the flyout back is a press
   * somewhere else. A press on the flyout itself is one of its own buttons.
   */
  useEffect(() => {
    if (!phone || hovered === null) return;
    function away(event: Event) {
      const target = event.target;
      if (target instanceof Element && target.closest(".variants")) return;
      setHovered(null);
    }
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [phone, hovered]);

  return (
    <div className="toolbox">
      {TOOLS.map((tool, index) => {
        const armed = tool.variants?.find((variant) => variant.id === variants[tool.id]);
        const Icon = armed?.Icon ?? tool.Icon;
        const idle = off[tool.id];
        return (
          <button
            type="button"
            key={tool.id}
            className={`tool${tool.id === activeTool ? " tool--active" : ""}${
              idle ? " tool--off" : ""
            }`}
            style={{ color: `var(--color-tool-${tool.id})` }}
            aria-label={tool.name}
            aria-disabled={idle !== undefined}
            aria-pressed={tool.id === activeTool}
            onClick={() => {
              // The press that opened the variants is spent on opening them.
              if (opening.current) {
                opening.current = false;
                return;
              }
              if (!idle) onSelectTool(tool.id);
            }}
            onDoubleClick={() => {
              if (!idle) onDoubleClickTool(tool.id);
            }}
            // A touch screen sends mouse events of its own after a tap, which
            // would open a flyout on a plain press, so it gets the hold instead
            // and none of the hover.
            onPointerDown={phone && !idle ? (event) => startHold(index, event) : undefined}
            onPointerMove={phone ? keepHold : undefined}
            onPointerUp={phone ? dropHold : undefined}
            onPointerCancel={phone ? dropHold : undefined}
            // The browser's own long press, which would take the gesture.
            onContextMenu={phone ? (event) => event.preventDefault() : undefined}
            onMouseEnter={phone ? undefined : (event) => show(index, event.currentTarget)}
            onMouseLeave={phone ? undefined : () => setHovered(null)}
          >
            {tool.id === activeTool && <span className="tool__rail" />}
            <Icon />
            {tool.flyout && <FlyoutMarker />}
          </button>
        );
      })}

      {opened && hovered !== null && (
        // biome-ignore lint/a11y/noStaticElementInteractions: it only keeps itself open, the variants inside are buttons
        <div
          className="variants"
          style={{ top: `${openAt.top}px`, left: `${openAt.left}px` }}
          onMouseEnter={phone ? undefined : () => setHovered(hovered)}
          onMouseLeave={phone ? undefined : () => setHovered(null)}
        >
          {opened.variants?.map((variant) => (
            <button
              type="button"
              key={variant.id}
              className={`variants__item${
                variants[opened.id] === variant.id ? " variants__item--armed" : ""
              }`}
              style={{ color: `var(--color-tool-${opened.id})` }}
              onClick={() => {
                onPickVariant(opened.id, variant.id);
                onSelectTool(opened.id);
                setHovered(null);
              }}
            >
              <variant.Icon />
              <span className="variants__name">{variant.name}</span>
            </button>
          ))}
          {/* The tooltip is not shown alongside, so the key comes here. */}
          <span className="variants__key">
            <span className="tooltip__key">{opened.key}</span>
          </span>
        </div>
      )}

      {onShare && (
        <button
          type="button"
          className="tool tool--share"
          aria-label="Share this sketch"
          onClick={onShare}
        >
          <ShareIcon />
        </button>
      )}

      {tip && !opened && hovered !== null && (
        <div
          className="tooltip"
          style={{ top: `${openAt.top + TOOLTIP_OFFSET}px`, left: `${openAt.left}px` }}
        >
          {/* A tool with nothing to do says why rather than what it is. */}
          <span className="tooltip__name">{off[tip.id] ?? tip.name}</span>
          {!off[tip.id] && <span className="tooltip__key">{tip.key}</span>}
        </div>
      )}
    </div>
  );
}
