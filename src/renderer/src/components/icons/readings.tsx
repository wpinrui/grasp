/** What a reading says about itself: how far it is written out, and how it is drawn out. */

import { STRAIGHT, ToolSvg } from "./frame";

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

/**
 * The chain that ties a number to what it reads, so the number goes wherever
 * the figure goes. Two links meeting over the run between them, which is the
 * one shape everybody already reads as a link.
 */
export function ChainIcon() {
  return (
    <ToolSvg>
      <g {...STRAIGHT}>
        <path d="M8.8 6.2 H6.6 a 3.8 3.8 0 0 0 0 7.6 h 2.2" />
        <path d="M11.2 6.2 h 2.2 a 3.8 3.8 0 0 1 0 7.6 h -2.2" />
        <path d="M7.2 10 h 5.6" />
      </g>
    </ToolSvg>
  );
}
