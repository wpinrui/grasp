/** The box and the stroke every tool icon is drawn in, and the arrow they share. */

export const ARROW_PATH = "M5 2.5 L15.5 11.2 L10.6 11.8 L13.3 16.8 L11.2 17.8 L8.6 12.8 L5 16 Z";

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
