/**
 * Add or remove a target without disturbing the rest of its selection group.
 * Plain canvas clicks toggle.
 */
export function togglePick(held: string[], id: string): string[] {
  return held.includes(id) ? held.filter((one) => one !== id) : [...held, id];
}

/**
 * Hold one target and nothing else. Used where a drag takes hold of a
 * previously unselected label, so only that label is carried.
 */
export function onlyPick(id: string): string[] {
  return [id];
}
