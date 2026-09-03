/**
 * Taking a picture of the sketch out of GRASP, to a file or to the clipboard.
 *
 * The selection where there is one, and the whole page where there is not. The
 * picture goes over in both forms, since the save dialog is what settles which
 * one is written.
 */

import type { ExportTo } from "../components/ExportDialog";
import { drawPicture, type PictureOptions } from "../sketch/picture";

export interface ExportWanted {
  options: PictureOptions;
  /** What is picked, which is what a picture of a selection holds. */
  selection: string[];
  /** What the save dialog offers as a name. */
  suggested: string;
  /** Called first, since the dialog is answered whether or not this comes good. */
  onDone: () => void;
}

export async function exportPicture(to: ExportTo, wanted: ExportWanted) {
  wanted.onDone();
  const only = wanted.selection.length > 0 ? new Set(wanted.selection) : null;
  try {
    const drawn = await drawPicture(wanted.options, only);
    if (!drawn) return;
    if (to === "clipboard") await window.api.image.copy(drawn.png);
    else await window.api.image.save({ ...drawn, suggested: wanted.suggested });
  } catch (error) {
    await window.api.file.reportError(
      error instanceof Error ? error.message : "The picture could not be drawn.",
    );
  }
}
