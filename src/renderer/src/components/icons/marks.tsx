/** The marks a figure carries, and the presses that put them on and take them off. */

import { STRAIGHT, ToolSvg } from "./frame";

/**
 * A side with its marks on it, drawn for the rail and for the buttons on the
 * mark panel, so a button shows the mark it lays rather than a number.
 */
export function TickIcon({ form, strokes }: { form: "equal" | "parallel"; strokes: number }) {
  const from = { x: 3.5, y: 15.5 };
  const to = { x: 16.5, y: 4.5 };
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const way = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const across = { x: -way.y, y: way.x };
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const gap = form === "equal" ? 2.7 : 3;
  const half = form === "equal" ? 2.9 : 2.6;
  const depth = 2.8;
  const strokePaths = Array.from({ length: strokes }, (_, nth) => {
    const off = (nth - (strokes - 1) / 2) * gap;
    const centre = { x: mid.x + way.x * off, y: mid.y + way.y * off };
    if (form === "equal") {
      return `M ${centre.x - across.x * half} ${centre.y - across.y * half} L ${
        centre.x + across.x * half
      } ${centre.y + across.y * half}`;
    }
    const tip = { x: centre.x + way.x * (depth / 2), y: centre.y + way.y * (depth / 2) };
    const back = { x: tip.x - way.x * depth, y: tip.y - way.y * depth };
    return `M ${back.x + across.x * half} ${back.y + across.y * half} L ${tip.x} ${tip.y} L ${
      back.x - across.x * half
    } ${back.y - across.y * half}`;
  });
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} />
        {strokePaths.map((stroke) => (
          <path key={stroke} d={stroke} />
        ))}
      </g>
    </ToolSvg>
  );
}

/** An angle with its arcs drawn in, for the rail and the panel's buttons. */
export function AngleIcon({ strokes }: { strokes: number }) {
  const corner = { x: 4, y: 16 };
  const turn = -0.85;
  const arm = 13.5;
  const arcs = Array.from({ length: strokes }, (_, nth) => {
    const radius = 4.6 + nth * 2.2;
    return `M ${corner.x + radius} ${corner.y} A ${radius} ${radius} 0 0 0 ${
      corner.x + Math.cos(turn) * radius
    } ${corner.y + Math.sin(turn) * radius}`;
  });
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d={`M ${corner.x} ${corner.y} L ${corner.x + arm} ${corner.y}`} />
        <path
          d={`M ${corner.x} ${corner.y} L ${corner.x + Math.cos(turn) * arm} ${
            corner.y + Math.sin(turn) * arm
          }`}
        />
        {arcs.map((arc) => (
          <path key={arc} d={arc} />
        ))}
      </g>
    </ToolSvg>
  );
}

/**
 * What the Marker lays down, drawn as the thing itself: a side with a double
 * stroke across it, a side with a chevron on it, and an angle with its arcs.
 */
export function EqualMarkIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M2.5 10 L17.5 10" />
        <path d="M8.6 6.4 L8.6 13.6" />
        <path d="M11.4 6.4 L11.4 13.6" />
      </g>
    </ToolSvg>
  );
}

export function ParallelMarkIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M2.5 10 L17.5 10" />
        <path d="M8 6.6 L11.6 10 L8 13.4" />
      </g>
    </ToolSvg>
  );
}

export function AngleMarkIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M3.4 15.6 L16.6 15.6" />
        <path d="M3.4 15.6 L13.6 4.4" />
        <path d="M8.6 15.6 A 5.2 5.2 0 0 0 6.8 11.7" />
        <path d="M11.2 15.6 A 7.8 7.8 0 0 0 8.4 9.7" />
      </g>
    </ToolSvg>
  );
}

/** The button that takes an angle mark round the other way. */

export function ReflexIcon() {
  const corner = { x: 10, y: 12.5 };
  const arm = 7.5;
  const turn = -0.9;
  const radius = 4.4;
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d={`M ${corner.x} ${corner.y} L ${corner.x + arm} ${corner.y}`} />
        <path
          d={`M ${corner.x} ${corner.y} L ${corner.x + Math.cos(turn) * arm} ${
            corner.y + Math.sin(turn) * arm
          }`}
        />
        <path
          d={`M ${corner.x + radius} ${corner.y} A ${radius} ${radius} 0 1 1 ${
            corner.x + Math.cos(turn) * radius
          } ${corner.y + Math.sin(turn) * radius}`}
        />
      </g>
    </ToolSvg>
  );
}

/** The button that draws an angle mark as the square instead of as arcs. */
export function RightAngleIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M4 16 L16.5 16" />
        <path d="M4 16 L4 3.5" />
        <path d="M4 10.5 L9.5 10.5 L9.5 16" />
      </g>
    </ToolSvg>
  );
}

/** The button that turns an arrow mark round. */
export function FlipIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M4 7.5 L16 7.5" />
        <path d="M7.5 4.5 L4 7.5 L7.5 10.5" />
        <path d="M16 13 L4 13" />
        <path d="M12.5 10 L16 13 L12.5 16" />
      </g>
    </ToolSvg>
  );
}

/** The button that takes a mark off the sheet. */
export function BinIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M4.5 6 L15.5 6" />
        <path d="M8 6 L8 3.8 L12 3.8 L12 6" />
        <path d="M6 6 L6.9 16.2 L13.1 16.2 L14 6" />
      </g>
    </ToolSvg>
  );
}
