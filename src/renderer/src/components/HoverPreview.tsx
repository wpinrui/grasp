import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { type SketchObject, type SketchState, settle } from "../sketch/model";
import { readingsPlaced } from "../sketch/tied";

import type { HiddenKinds } from "./HiddenPanel";

export type ShowPreview = (objects: SketchObject[], hiddenKinds?: HiddenKinds) => void;

const HoverContext = createContext<{
  objects: SketchObject[] | null;
  source: SketchObject[];
  hiddenKinds?: HiddenKinds;
  show: ShowPreview;
  clear: () => void;
}>({ objects: null, source: [], show: () => {}, clear: () => {} });

/** Appearance only. The document, selection, tool defaults and history stay live and unchanged. */
export function HoverPreview({
  children,
  scope,
  editing = false,
}: {
  children: ReactNode;
  scope: SketchState;
  editing?: boolean;
}) {
  const [preview, setPreview] = useState<{
    scope: SketchState;
    objects: SketchObject[];
    hiddenKinds?: HiddenKinds;
  } | null>(null);
  const clear = useCallback(() => setPreview(null), []);
  useEffect(() => {
    const key = () => setPreview(null);
    window.addEventListener("blur", clear);
    window.addEventListener("pointerdown", clear, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("blur", clear);
      window.removeEventListener("pointerdown", clear, true);
      window.removeEventListener("keydown", key);
    };
  }, [clear]);
  useEffect(
    () => setPreview((was) => (!editing && was?.scope === scope ? was : null)),
    [scope, editing],
  );
  return (
    <HoverContext.Provider
      value={{
        source: scope.objects,
        hiddenKinds: !editing && preview?.scope === scope ? preview.hiddenKinds : undefined,
        objects: !editing && preview?.scope === scope ? preview.objects : null,
        show: (objects, hiddenKinds) => {
          if (editing) return;
          setPreview({
            scope,
            hiddenKinds,
            objects: readingsPlaced(objects, settle(objects).settled),
          });
        },
        clear,
      }}
    >
      {children}
    </HoverContext.Provider>
  );
}

export const useHoverPreview = () => useContext(HoverContext);

/** Touch presses commit directly; keyboard focus offers the same preview as mouse hover. */
export function previewEvents(show: (() => void) | undefined, clear: () => void) {
  return {
    onPointerEnter: (event: { pointerType: string }) => {
      if (event.pointerType !== "touch") show?.();
    },
    onPointerLeave: clear,
    onFocus: show,
    onBlur: clear,
    onClickCapture: clear,
  };
}
