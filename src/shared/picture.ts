/**
 * A drawn picture on its way to a file. Both forms go over, since which one is
 * wanted is only settled by the file the save dialog comes back with.
 */
export interface PictureToSave {
  png: Uint8Array;
  svg: string;
  /** The name to offer in the save dialog, without an extension. */
  suggested: string;
}
