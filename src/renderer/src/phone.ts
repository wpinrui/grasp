import { useEffect, useState } from "react";

/**
 * Whether GRASP is being used with a finger rather than a pointer.
 *
 * The test is the input, not the width: a narrow desktop window is still a
 * mouse, and wants the desktop chrome however small it is made. A screen that
 * is aimed at with a finger is the one that wants bigger targets, gestures in
 * place of held keys, and the panels that have nowhere to go left out.
 */
const COARSE = "(pointer: coarse)";

export function onAPhone(): boolean {
  return window.matchMedia(COARSE).matches;
}

/** The same, as a hook, so a device that changes its mind is followed. */
export function usePhone(): boolean {
  const [phone, setPhone] = useState(onAPhone);
  useEffect(() => {
    const query = window.matchMedia(COARSE);
    const answer = (event: MediaQueryListEvent) => setPhone(event.matches);
    query.addEventListener("change", answer);
    return () => query.removeEventListener("change", answer);
  }, []);
  return phone;
}
