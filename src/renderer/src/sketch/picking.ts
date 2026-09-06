/**
 * Add or remove a target without disturbing the rest of its selection group.
 * Plain canvas clicks toggle.
 */
export function togglePick(held: string[], id: string): string[] {
  return held.includes(id) ? held.filter((one) => one !== id) : [...held, id];
}

/**
 * What a label click leaves held. A click that landed on nothing clears the
 * group; one that asked to add toggles its label within it; any other takes
 * that label on its own, which is what a drag does when it takes hold of a
 * label that was not held before.
 */
export function labelClickPick(held: string[], id: string | null, additive?: boolean): string[] {
  if (id === null) return [];
  return additive === true ? togglePick(held, id) : [id];
}
