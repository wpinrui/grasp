import { useState } from "react";
import { canBuildSides, cornersAt, FEWEST_SIDES, MOST_SIDES } from "../sketch/regular";
import { DialogFrame } from "./DialogFrame";
import "./RegularPolygonDialog.css";

/** The shapes worth a key of their own, in the order a class meets them. */
const SHAPES: { sides: number; name: string }[] = [
  { sides: 3, name: "Triangle" },
  { sides: 4, name: "Square" },
  { sides: 5, name: "Pentagon" },
  { sides: 6, name: "Hexagon" },
  { sides: 7, name: "7-gon" },
  { sides: 8, name: "8-gon" },
];

/**
 * The shape a key offers, drawn as itself. It is laid out by the same corners
 * the sheet would use, so a key looks like what pressing it makes.
 */
function ShapeGlyph({ sides }: { sides: number }) {
  const corners = cornersAt({ x: 16, y: 16 }, 15, sides);
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
      <polygon
        points={corners.map((corner) => `${corner.x} ${corner.y}`).join(" ")}
        fill="var(--color-tool-polygon-fill)"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface RegularPolygonDialogProps {
  /** Where the sheet was clicked, so the box comes up beside the spot. */
  at: { x: number; y: number };
  onApply: (wanted: { sides: number; locked: boolean }) => void;
  onCancel: () => void;
}

/**
 * What regular polygon to build: how many sides, and whether it is held that
 * way. The shapes a class meets get a key each; anything else is typed, and
 * typing takes the keys out of the running, since a number in the box is a
 * plainer answer than a key that happens to still look pressed.
 */
export function RegularPolygonDialog({ at, onApply, onCancel }: RegularPolygonDialogProps) {
  const [picked, setPicked] = useState(SHAPES[0].sides);
  const [typed, setTyped] = useState("");
  const [locked, setLocked] = useState(true);
  const typing = typed.trim() !== "";
  const sides = typing ? Number(typed) : picked;
  const ready = canBuildSides(sides);

  return (
    <DialogFrame
      title="Regular Polygon"
      action="Draw"
      canApply={ready}
      at={at}
      wide
      onApply={() => ready && onApply({ sides, locked })}
      onCancel={onCancel}
    >
      <div className="ngon__keys">
        {SHAPES.map((shape) => (
          <button
            key={shape.sides}
            type="button"
            className={`ngon__key${!typing && shape.sides === picked ? " ngon__key--on" : ""}`}
            disabled={typing}
            aria-pressed={!typing && shape.sides === picked}
            onClick={() => setPicked(shape.sides)}
          >
            <ShapeGlyph sides={shape.sides} />
            <span className="ngon__key-name">{shape.name}</span>
          </button>
        ))}
      </div>

      <label className="ngon__row">
        <span className="ngon__of">Sides</span>
        <input
          className="ngon__field"
          value={typed}
          inputMode="numeric"
          placeholder={`${picked}`}
          aria-label="Sides"
          onChange={(event) => setTyped(event.target.value)}
        />
        <span className="ngon__note">
          {typing && !ready ? `${FEWEST_SIDES} to ${MOST_SIDES}` : "or type your own"}
        </span>
      </label>

      <div className="ngon__row">
        <span className="ngon__of">Hold it</span>
        <button
          type="button"
          role="switch"
          aria-checked={locked}
          aria-label="Hold it regular"
          className={`ngon__switch${locked ? " ngon__switch--on" : ""}`}
          onClick={() => setLocked(!locked)}
        >
          <span className="ngon__switch-knob" />
        </button>
        <span className="ngon__note">
          {locked
            ? "Held regular. Drag a corner to turn and resize the whole shape."
            : "Loose. Every corner moves on its own."}
        </span>
      </div>
    </DialogFrame>
  );
}
