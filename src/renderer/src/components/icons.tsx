/** Every icon in the shell, traced from the GRASP design doc. */

export function MinimizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0 5h10" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function MaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect
        x="0.5"
        y="0.5"
        width="9"
        height="9"
        rx="1"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0.4 0.4l9.2 9.2M9.6 0.4l-9.2 9.2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function SubmenuArrowIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path
        d="M3.4 1.6 L6.8 5 L3.4 8.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MenuCheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2 6.3 L4.6 9 L10 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FlyoutMarker() {
  return (
    <svg className="tool__flyout" width="4.5" height="4.5" viewBox="0 0 5 5" aria-hidden="true">
      <path d="M5 0 L5 5 L0 5 Z" fill="currentColor" />
    </svg>
  );
}

const ARROW_PATH = "M5 2.5 L15.5 11.2 L10.6 11.8 L13.3 16.8 L11.2 17.8 L8.6 12.8 L5 16 Z";

function ToolSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

const STRAIGHT = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.5",
  strokeLinecap: "round",
} as const;

export function SegmentIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M4.5 15.5 L15.5 4.5" />
        <circle cx="4.5" cy="15.5" r="1.8" fill="currentColor" stroke="none" />
        <circle cx="15.5" cy="4.5" r="1.8" fill="currentColor" stroke="none" />
      </g>
    </ToolSvg>
  );
}

export function RayIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M4.5 15.5 L17.5 2.5" />
        <path d="M12.6 3.4 L17.6 2.4 L16.6 7.4" />
        <circle cx="4.5" cy="15.5" r="1.8" fill="currentColor" stroke="none" />
      </g>
    </ToolSvg>
  );
}

export function LineIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M2.4 17.6 L17.6 2.4" />
        <path d="M12.6 3.4 L17.6 2.4 L16.6 7.4" />
        <path d="M7.4 16.6 L2.4 17.6 L3.4 12.6" />
        <circle cx="7.5" cy="12.5" r="1.6" fill="currentColor" stroke="none" />
        <circle cx="12.5" cy="7.5" r="1.6" fill="currentColor" stroke="none" />
      </g>
    </ToolSvg>
  );
}

export function ArrowIcon() {
  return (
    <ToolSvg>
      <path d={ARROW_PATH} fill="currentColor" />
    </ToolSvg>
  );
}

/** The arrow again at canvas scale, for the status pill. */
export function StatusArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d={ARROW_PATH} fill="var(--color-canvas-accent)" />
    </svg>
  );
}

export function PointIcon() {
  return (
    <ToolSvg>
      <circle cx="10" cy="10" r="3.4" fill="currentColor" />
    </ToolSvg>
  );
}

export function CompassIcon() {
  return (
    <ToolSvg>
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="10" cy="10" r="1.7" fill="currentColor" />
    </ToolSvg>
  );
}

export function StraightedgeIcon() {
  return (
    <ToolSvg>
      <path d="M3.9 16.1 L16.1 3.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="3.9" cy="16.1" r="1.9" fill="currentColor" />
      <circle cx="16.1" cy="3.9" r="1.9" fill="currentColor" />
    </ToolSvg>
  );
}

/** The three polygon tools: the fill, the fill with its edges, the edges. */
export function PolygonEdgesIcon() {
  return (
    <ToolSvg>
      <path
        d="M10 2.6 L17.4 8 L14.6 16.8 L5.4 16.8 L2.6 8 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </ToolSvg>
  );
}

export function PolygonFillIcon() {
  return (
    <ToolSvg>
      <path
        d="M10 2.6 L17.4 8 L14.6 16.8 L5.4 16.8 L2.6 8 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.75"
      />
    </ToolSvg>
  );
}

export function PolygonIcon() {
  return (
    <ToolSvg>
      <path
        d="M10 2.6 L17.4 8 L14.6 16.8 L5.4 16.8 L2.6 8 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="var(--color-tool-polygon-fill)"
      />
    </ToolSvg>
  );
}

export function TextIcon() {
  return (
    <ToolSvg>
      <text
        x="10"
        y="16.4"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        fontFamily="var(--font-label)"
        fontWeight="700"
        fontSize="18"
      >
        T
      </text>
    </ToolSvg>
  );
}

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
/**
 * More and fewer decimal places: a point with the digits after it, and the sign
 * that says which way. The digits are drawn rather than set, so the two icons
 * sit at the same weight as everything else in the panel.
 */
function PlacesIcon({ more }: { more: boolean }) {
  const digit = (x: number) => `M ${x} 10.5 a 2 2 0 1 0 0.01 0 Z`;
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M 3.4 14.6 h 0.01" strokeWidth="2.4" />
        {more ? (
          <>
            <path d={digit(6.2)} />
            <path d={digit(11.2)} />
            <path d="M 15.6 5.4 v 4 M 13.6 7.4 h 4" />
          </>
        ) : (
          <>
            <path d={digit(6.2)} />
            <path d="M 12.4 7.4 h 4" />
          </>
        )}
      </g>
    </ToolSvg>
  );
}

export function MorePlacesIcon() {
  return <PlacesIcon more />;
}

export function FewerPlacesIcon() {
  return <PlacesIcon more={false} />;
}

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

export function MarkerIcon() {
  return (
    <ToolSvg>
      <path
        d="M13.4 3.2 L16.8 6.6 L7.4 16 L3 17 L4 12.6 Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M11.6 5 L15 8.4" stroke="currentColor" strokeWidth="1.6" />
    </ToolSvg>
  );
}

/**
 * The Arrow's variants: the arrow itself in the Arrow's own blue, and beside it
 * the one kind of thing it will pick up, in that kind's own colour.
 */
function ArrowOver({ tint, children }: { tint: string; children: React.ReactNode }) {
  return (
    <ToolSvg>
      <path
        d="M5 2.6 L5 14.4 L8.1 11.5 L10.2 16.4 L12.2 15.4 L10.1 10.7 L14.3 10.4 Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <g fill="none" stroke={tint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </g>
    </ToolSvg>
  );
}

export function ArrowPointsIcon() {
  return (
    <ArrowOver tint="var(--color-tool-point)">
      <circle cx="15.6" cy="4.4" r="2.2" fill="var(--color-tool-point)" stroke="none" />
    </ArrowOver>
  );
}

export function ArrowPathsIcon() {
  return (
    <ArrowOver tint="var(--color-tool-compass)">
      <path d="M10.8 8.6 A 7.4 7.4 0 0 1 18.2 1.6" />
    </ArrowOver>
  );
}

export function ArrowMarksIcon() {
  return (
    <ArrowOver tint="var(--color-tool-marker)">
      <path d="M11.6 7.4 L17.6 1.6" />
      <path d="M13.2 4.2 L16 7" />
    </ArrowOver>
  );
}

export function ArrowTextIcon() {
  return (
    <ArrowOver tint="var(--color-arrow-text)">
      <text
        x="15"
        y="9.4"
        textAnchor="middle"
        fill="var(--color-arrow-text)"
        stroke="none"
        fontFamily="var(--font-label)"
        fontWeight="700"
        fontSize="11"
      >
        T
      </text>
    </ArrowOver>
  );
}

/** The Measure tool: a ruler with a protractor over it. */
export function MeasureIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M2.6 17.4 L17.4 2.6" />
        <path d="M2.6 17.4 L5.4 17.4" />
        <path d="M4.3 15.7 L6.6 18" />
        <path d="M7.1 12.9 L9.4 15.2" />
        <path d="M9.9 10.1 L12.2 12.4" />
        <path d="M3.2 9.6 A 6.8 6.8 0 0 1 10.4 3.2" />
        <path d="M3.2 9.6 L10.4 9.6" />
      </g>
    </ToolSvg>
  );
}

/** The Measure tool's three variants: a length, an area and an angle. */
export function MeasureLengthIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M2.4 7 L17.6 7 L17.6 13 L2.4 13 Z" />
        <path d="M5.4 7 L5.4 10" />
        <path d="M8.2 7 L8.2 9" />
        <path d="M11 7 L11 10" />
        <path d="M13.8 7 L13.8 9" />
      </g>
    </ToolSvg>
  );
}

export function MeasureAreaIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M3.8 4.5 L16.2 4.5 L16.2 15.5 L3.8 15.5 Z" />
        <path d="M6 12.5 L12.5 6.5" />
        <path d="M9 15 L15 8" />
      </g>
    </ToolSvg>
  );
}

export function MeasureAngleIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        {/* The half disc, the inner edge inside it, and the notch on the
            baseline that the protractor is lined up by. */}
        <path d="M2.6 14.4 A 7.4 7.4 0 0 1 17.4 14.4 Z" />
        <path d="M6.4 14.4 A 3.6 3.6 0 0 1 13.6 14.4" />
      </g>
      <circle cx="10" cy="14.4" r="1" fill="currentColor" />
    </ToolSvg>
  );
}

/** How a length is drawn out: as the number alone, or as a dimension. */
export function BoundsNoneIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M5 7.5 L15 7.5" />
        <path d="M5 12.5 L15 12.5" />
      </g>
    </ToolSvg>
  );
}

export function BoundsBrokenIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M2.5 10 L7 10" />
        <path d="M4.6 7.9 L2.5 10 L4.6 12.1" />
        <path d="M13 10 L17.5 10" />
        <path d="M15.4 7.9 L17.5 10 L15.4 12.1" />
        <path d="M8.6 12.4 L11.4 7.6" />
      </g>
    </ToolSvg>
  );
}

export function BoundsFullIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M2.5 12.5 L17.5 12.5" />
        <path d="M4.6 10.4 L2.5 12.5 L4.6 14.6" />
        <path d="M15.4 10.4 L17.5 12.5 L15.4 14.6" />
        <path d="M8.6 8 L11.4 3.2" />
      </g>
    </ToolSvg>
  );
}

/** The dotted lines that let a dimension stand off the segment it is about. */
export function LeadersIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M3 14.5 L17 14.5" />
        <path d="M3 14.5 L3 5" strokeDasharray="2 2.2" />
        <path d="M17 14.5 L17 5" strokeDasharray="2 2.2" />
        <path d="M3 5 L17 5" strokeOpacity="0.35" />
      </g>
    </ToolSvg>
  );
}

/** Labels: a luggage tag, since a label is what a thing is called. */
export function TagIcon() {
  return (
    <ToolSvg>
      <path
        d="M10.4 2.8 H16.4 A0.8 0.8 0 0 1 17.2 3.6 V9.6 L9.6 17.2 A0.8 0.8 0 0 1 8.4 17.2 L2.8 11.6 A0.8 0.8 0 0 1 2.8 10.4 Z"
        fill="var(--color-panel-labels)"
      />
      <circle cx="13.3" cy="6.7" r="1.6" fill="var(--color-panel-hole)" />
    </ToolSvg>
  );
}

/** The text palette: an artist's palette, thumb hole and four blobs of paint. */
export function TextPaletteIcon() {
  return (
    <ToolSvg>
      {/* The board, with a bite out of the right where a brush would rest. */}
      <path
        d="M10 2.4 C14.6 2.4 17.6 5.4 17.6 9 C17.6 11.4 15.8 12 14.4 12.2 C13.3 12.4 12.8 13.1 13.1 14 C13.6 15.6 12.4 17.6 10 17.6 C5.8 17.6 2.4 14.2 2.4 10 C2.4 5.8 5.8 2.4 10 2.4 Z"
        fill="var(--color-panel-steel)"
      />
      <circle cx="8.3" cy="13.1" r="1.9" fill="var(--color-panel-hole)" />
      <circle cx="6.3" cy="6.7" r="1.5" fill="var(--color-paint-red)" />
      <circle cx="10.7" cy="5.3" r="1.5" fill="var(--color-paint-yellow)" />
      <circle cx="14.3" cy="7.6" r="1.5" fill="var(--color-paint-green)" />
      <circle cx="5" cy="10.9" r="1.5" fill="var(--color-paint-blue)" />
    </ToolSvg>
  );
}

/** The Snap panel: a horseshoe magnet, since snapping is what pulls things to. */
export function SnapIcon() {
  return (
    <ToolSvg>
      <g fill="none" strokeWidth="3.2" strokeLinecap="butt">
        <path
          d="M5.4 5 L5.4 10.6 A 4.6 4.6 0 0 0 14.6 10.6 L14.6 5"
          stroke="var(--color-panel-snap)"
        />
        <path d="M5.4 3.4 L5.4 6.2" stroke="var(--color-panel-steel)" />
        <path d="M14.6 3.4 L14.6 6.2" stroke="var(--color-panel-steel)" />
      </g>
    </ToolSvg>
  );
}

/** Hidden: an eye with a stroke through it, for what is being kept off the sheet. */
export function HiddenIcon() {
  return (
    <ToolSvg>
      <path
        d="M2.6 10 C5 6.2 7.4 4.6 10 4.6 C12.6 4.6 15 6.2 17.4 10 C15 13.8 12.6 15.4 10 15.4 C7.4 15.4 5 13.8 2.6 10 Z"
        fill="var(--color-panel-hidden)"
      />
      <circle cx="10" cy="10" r="2.5" fill="var(--color-panel-hole)" />
      {/* Cased in the dark first, so the stroke reads as cut through the eye. */}
      <path
        d="M4.2 16.2 L15.8 3.8"
        stroke="var(--color-panel-hole)"
        strokeWidth="4.4"
        strokeLinecap="round"
      />
      <path
        d="M4.2 16.2 L15.8 3.8"
        stroke="var(--color-panel-steel)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </ToolSvg>
  );
}
