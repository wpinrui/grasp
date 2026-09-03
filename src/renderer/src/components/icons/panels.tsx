/** The Dock's panels, one icon each. */

import { MAGNET_PATH, MAGNET_PRONGS, ToolSvg } from "./frame";

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
        <path d={MAGNET_PATH} stroke="var(--color-panel-snap)" />
        {MAGNET_PRONGS.map((prong) => (
          <path key={prong} d={prong} stroke="var(--color-panel-steel)" />
        ))}
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
