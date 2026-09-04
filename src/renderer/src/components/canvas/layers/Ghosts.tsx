/**
 * Writing that is on the sheet but not of it: hidden writing drawn faintly
 * where it sits while the dock points at its row, and the ghost of a reading
 * the Measure tool would write.
 *
 * Nothing else says where a hidden thing is, since a hidden object is not drawn
 * at all, so pointing at its row in the dock is the only way to find it again.
 */

import { withNames } from "../../../sketch/captions";
import type { SketchCaption, View } from "../../../sketch/model";
import { drawnAs } from "../../../sketch/text";
import { MeasurementBox } from "../../MeasurementBox";
import { screenSpot } from "../sheet";

interface GhostCaptionProps {
  /** The hidden caption the dock is pointing at, or nothing to draw. */
  caption: SketchCaption | null;
  /** The readings a link in the caption stands for, by id. */
  names: Map<string, string>;
  view: View;
  scale: number;
}

export function GhostCaption({ caption, names, view, scale }: GhostCaptionProps) {
  if (!caption) return null;
  return (
    <div
      className="caption caption--ghost"
      style={{
        ...screenSpot(caption, view, scale),
        width: `${caption.width}px`,
        textAlign: caption.align,
        ...drawnAs(caption),
      }}
    >
      <div
        className="caption__body"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the caption's own markup, written here
        dangerouslySetInnerHTML={{ __html: withNames(caption.html, names) }}
      />
    </div>
  );
}

/**
 * A hidden measurement, drawn faintly where it sits, and the same box drawn as
 * the ghost of one the Measure tool would write.
 *
 * A ghost is not on the page and is not the pointer's to take, so every way of
 * reaching it is tied off here rather than at each of the places one is drawn.
 */
export function GhostReading({
  measurement,
  reading,
  view,
  scale,
}: {
  measurement: Parameters<typeof MeasurementBox>[0]["measurement"];
  /** The measurement as it reads, which is what the box writes out. */
  reading: Parameters<typeof MeasurementBox>[0]["reading"];
  view: View;
  scale: number;
}) {
  return (
    <MeasurementBox
      measurement={measurement}
      reading={reading}
      view={view}
      scale={scale}
      selected={false}
      tool="none"
      ghost
      linking={false}
      onLink={() => {}}
      onSelect={() => {}}
      onGrab={() => {}}
      onDrag={() => {}}
      onDrop={() => {}}
      onToggleLabel={() => {}}
      onMeasure={() => {}}
    />
  );
}
