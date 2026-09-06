/**
 * Add or remove a target without disturbing the rest of its selection group.
 * Plain canvas clicks toggle. Replacement is used when a drag takes hold of
 * a previously unselected label, so only that label is carried.
 */
export function togglePick(held: string[], id: string, additive: boolean): string[] {
  if (!additive) return [id];
  return held.includes(id) ? held.filter((one) => one !== id) : [...held, id];
}
