import { useState } from "react";
import { FlyoutMarker } from "./icons";
import { TOOLS } from "./tools";
import "./Toolbox.css";

const TOOL_PITCH = 50;
const RAIL_PADDING = 6;
const TOOLTIP_OFFSET = 3;

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
}

export function Toolbox({
  activeTool,
  onSelectTool,
  variants,
  onPickVariant,
  onDoubleClickTool,
  off,
}: ToolboxProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const tip = hovered === null ? null : TOOLS[hovered];
  // A tool with variants opens them on hover, in place of its tooltip.
  const opened = tip?.variants?.length && !off[tip.id] ? tip : null;

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
              if (!idle) onSelectTool(tool.id);
            }}
            onDoubleClick={() => {
              if (!idle) onDoubleClickTool(tool.id);
            }}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
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
          style={{ top: `${RAIL_PADDING + hovered * TOOL_PITCH}px` }}
          onMouseEnter={() => setHovered(hovered)}
          onMouseLeave={() => setHovered(null)}
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

      {tip && !opened && hovered !== null && (
        <div
          className="tooltip"
          style={{ top: `${RAIL_PADDING + hovered * TOOL_PITCH + TOOLTIP_OFFSET}px` }}
        >
          {/* A tool with nothing to do says why rather than what it is. */}
          <span className="tooltip__name">{off[tip.id] ?? tip.name}</span>
          {!off[tip.id] && <span className="tooltip__key">{tip.key}</span>}
        </div>
      )}
    </div>
  );
}
