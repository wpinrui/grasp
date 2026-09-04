/**
 * What the window has in hand: which tool is up, what the palette has armed it
 * with, what is picked on the sheet that is not the selection, and what is
 * being typed into.
 *
 * None of it belongs to the sketch. Switching tools drops the arming and lets
 * go of any picked label, which is why those three sit together here rather
 * than in three places that have to remember each other.
 */

import { useCallback, useRef, useState } from "react";
import type { HiddenKinds } from "../components/HiddenPanel";
import { armedForWriting } from "../components/tools";
import type { Armed } from "../sketch/armed";
import { DEFAULT_POINT_SIZE, type PointSize } from "../sketch/model";

export function useTooling() {
  const [activeTool, setActiveTool] = useState("arrow");
  /** How big the sheet is on screen, which is how far a new locus reaches. */
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  /** The sheet is plain paper until the grid is asked for. */
  /** What each tool with a flyout is armed with. */
  const [variants, setVariants] = useState<Record<string, string>>({
    straightedge: "segment",
    polygon: "interior-edges",
    measure: "length",
    arrow: "all",
    marker: "equal",
    text: "caption",
  });

  /**
   * The labels picked on the sheet, held as the objects they name, since a
   * label belongs to what it names rather than standing on its own. Picking one
   * lets go of the selection, but the two are held apart rather than kept in
   * step: selecting something afterwards leaves these held and simply wins, and
   * they let go on a tool switch the way the rest of what a tool was doing does.
   */
  const [labelPick, setLabelPick] = useState<string[]>([]);

  /** Arm a tool's flyout with one of what it offers. */
  const pickVariant = useCallback((tool: string, variant: string) => {
    setVariants((armed) => ({ ...armed, [tool]: variant }));
    // An Arrow armed for points, paths or markings cannot reach a label, so it
    // cannot be left holding one either: the palette would be set on something
    // the pointer can no longer touch.
    if (tool === "arrow" && !armedForWriting(variant)) setLabelPick([]);
  }, []);
  /**
   * What the palette has been set to for the tool that is up, which is how the
   * next thing that tool draws comes out. Switching tools puts it back on the
   * defaults, so a tool is always picked up on what GRASP says rather than on
   * what it was left on the last time it was held.
   */
  const [armed, setArmed] = useState<Armed>({});
  const toolWas = useRef(activeTool);
  if (toolWas.current !== activeTool) {
    toolWas.current = activeTool;
    setArmed({});
    setLabelPick([]);
  }
  /** The size a new point is born at, which every Point Style pick resets. */
  const [pointSize, setPointSize] = useState<PointSize>(DEFAULT_POINT_SIZE);
  /** What Escape does to the sheet, for the phone's Cancel key to do the same. */
  const cancelSheet = useRef(() => {});

  /**
   * The kinds being kept out of the way wholesale, which is a different thing
   * from hiding an object: it says nothing about any one of them, and letting
   * them back brings back exactly what was showing before.
   */
  const [hiddenKinds, setHiddenKinds] = useState<HiddenKinds>({ marks: false, text: false });
  /**
   * The tools with nothing to do while a whole kind is being kept out of the
   * way: what they would draw would not be drawn. The Measure tool writes its
   * readings, so it goes with the text.
   */
  const toolsOff: Record<string, string> = {
    ...(hiddenKinds.marks ? { marker: "Markings are hidden" } : {}),
    ...(hiddenKinds.text ? { text: "Text is hidden", measure: "Text is hidden" } : {}),
  };
  // A tool that goes idle hands the sheet back to the Arrow rather than leaving
  // the pointer on something that can do nothing.
  if (toolsOff[activeTool]) setActiveTool("arrow");
  /** The object the label panel is pointing at, lit up on the sheet. */
  const [spotlight, setSpotlight] = useState<string | null>(null);
  /** The caption being typed into. It belongs to the window, not to the page. */
  const [editing, setEditing] = useState<string | null>(null);
  /** Where the text palette reaches the caption being typed into. */
  const editor = useRef<HTMLDivElement | null>(null);
  /** Counted up by a double-click on the Text tool, which asks for a caption. */
  const [captionWanted, setCaptionWanted] = useState(0);

  return {
    activeTool,
    setActiveTool,
    viewport,
    setViewport,
    variants,
    pickVariant,
    labelPick,
    setLabelPick,
    armed,
    setArmed,
    pointSize,
    setPointSize,
    cancelSheet,
    hiddenKinds,
    setHiddenKinds,
    toolsOff,
    spotlight,
    setSpotlight,
    editing,
    setEditing,
    editor,
    captionWanted,
    setCaptionWanted,
  };
}

/** What the window has in hand. */
export type Tools = ReturnType<typeof useTooling>;
