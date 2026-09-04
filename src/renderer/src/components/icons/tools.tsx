/** One icon per tool in the Toolbox, and one per variant its flyout offers. */

import { ARROW_PATH, STRAIGHT, ToolSvg } from "./frame";

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

/** Relabel: the letters handed out in the order the vertices are clicked. */
export function RelabelIcon() {
  const letter = {
    textAnchor: "middle" as const,
    fill: "currentColor",
    stroke: "none",
    fontFamily: "var(--font-label)",
    fontWeight: "700",
    fontSize: "10",
  };
  return (
    <ToolSvg>
      <text x="5" y="8.5" {...letter}>
        A
      </text>
      <text x="15.5" y="18.5" {...letter}>
        B
      </text>
      <g {...STRAIGHT}>
        <path d="M8 10 L13.6 15.6" />
        <path d="M9.4 15.6 L13.9 15.6 L13.9 11.1" />
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
