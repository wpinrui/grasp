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

/**
 * Held rather than asked for each time. This is read on every hit test, and a
 * media query list answers from what it already knows once it exists.
 */
let coarse: MediaQueryList | null = null;

export function onAPhone(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  coarse ??= window.matchMedia(COARSE);
  return coarse.matches;
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

/**
 * Publish the visible viewport for the stylesheets to measure against.
 *
 * A phone keyboard covers the window rather than resizing it: the layout
 * viewport stays the height it was and `dvh` with it, so anything centred in
 * the window ends up behind the keyboard the moment a field in it is tapped.
 * The visual viewport is the part that moves, so its height and its offset go
 * out as custom properties and the dialogs are laid out in those instead.
 */
export function useVisibleViewport(): void {
  useEffect(() => {
    const view = window.visualViewport;
    if (!view) return;
    function measure() {
      if (!view) return;
      const root = document.documentElement;
      root.style.setProperty("--seen-height", `${view.height}px`);
      root.style.setProperty("--seen-top", `${view.offsetTop}px`);
    }
    measure();
    view.addEventListener("resize", measure);
    view.addEventListener("scroll", measure);
    return () => {
      view.removeEventListener("resize", measure);
      view.removeEventListener("scroll", measure);
    };
  }, []);
}
