/**
 * Hidden writing, drawn faintly where it sits while the dock points at its row.
 *
 * Nothing else says where a hidden thing is, since a hidden object is not drawn
 * at all, so pointing at its row in the dock is the only way to find it again.
 */

import { withNames } from "../../../sketch/captions";
import { isCaption, type SketchCaption, type View } from "../../../sketch/model";
import { drawnAs } from "../../../sketch/text";
import { onScreen } from "../sheet";

interface GhostCaptionProps {
  /** The caption pointed at, or anything else, which draws nothing. */
  caption: SketchCaption | null;
  /** The readings a link in the caption stands for, by id. */
  names: Map<string, string>;
  view: View;
  scale: number;
}

export function GhostCaption({ caption, names, view, scale }: GhostCaptionProps) {
  if (!caption || !isCaption(caption) || caption.hidden !== true) return null;
  return (
    <div
      className="caption caption--ghost"
      style={{
        ...onScreen(caption, view, scale),
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
