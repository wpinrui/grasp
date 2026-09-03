/** The box and the stroke every tool icon is drawn in, and the arrow they share. */

export const ARROW_PATH = "M5 2.5 L15.5 11.2 L10.6 11.8 L13.3 16.8 L11.2 17.8 L8.6 12.8 L5 16 Z";

/** The magnet snapping is marked with, on the panel and on the touch bar. */
export const MAGNET_PATH = "M5.4 5 L5.4 10.6 A 4.6 4.6 0 0 0 14.6 10.6 L14.6 5";
export const MAGNET_PRONGS = ["M5.4 3.4 L5.4 6.2", "M14.6 3.4 L14.6 6.2"];

/**
 * A single stroked mark on the same box the tools are drawn on, for the chrome
 * icons that are one path and nothing else.
 */
export function MarkSvg({ d, size = "1em" }: { d: string; size?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

export function ToolSvg({ children }: { children: React.ReactNode }) {
  return (
    <svg width="1em" height="1em" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

export const STRAIGHT = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.5",
  strokeLinecap: "round",
} as const;
