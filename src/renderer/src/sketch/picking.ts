/**
 * How a click adds to what is picked. A plain click takes the one thing it
 * landed on; a click with Shift or Ctrl adds it to what is already held, or
 * takes it back out if it was there. Objects, captions, readings, tables,
 * buttons and labels all pick this way, so they all come through here.
 */
export function togglePick(held: string[], id: string, additive: boolean): string[] {
  if (!additive) return [id];
  return held.includes(id) ? held.filter((one) => one !== id) : [...held, id];
}
