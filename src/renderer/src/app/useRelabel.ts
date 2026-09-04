/**
 * Relabelling a figure: the letters handed out in the order the vertices are
 * clicked.
 *
 * The run belongs to the window rather than to the page, so it is no undo step
 * of its own. Where it has got to in the alphabet does step back with the page,
 * though, so a vertex clicked twice by mistake costs one Ctrl+Z: the name it
 * took is given back and so is the letter, leaving the rest of the run where it
 * was rather than shifted along by one.
 */

import { useRef, useState } from "react";
import type { Naming } from "./labels";

/** The letters a run walks, which is the run points are named from. */
const CAPITALS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Whether a run can start at what was typed. One letter, and nothing else. */
export function canStartAt(from: string): boolean {
  return /^[A-Za-z]$/.test(from);
}

/**
 * The name a run started at one letter hands out on its nth click, counting
 * from zero. The alphabet wraps, so the name after Z is A again, which is what
 * the automatic run does too. A lower-case start walks the lower-case letters.
 */
export function nameAt(from: string, step: number): string {
  const letters = from === from.toLowerCase() ? CAPITALS.toLowerCase() : CAPITALS;
  const at = letters.indexOf(from);
  if (at < 0) return from;
  return letters[(at + step) % letters.length];
}

/** Where a run has got to: the letter it began at, and how far along it is. */
interface Run {
  from: string;
  /** How many names it has handed out, which is the next one's place in the run. */
  handed: number;
  /** How many it has given back, each of which a redo hands out again. */
  ahead: number;
}

/** The vertex clicked with no run going, and where to ask about it. */
export interface Asked {
  id: string;
  at: { x: number; y: number };
}

export function useRelabel({ armed, naming }: { armed: boolean; naming: Naming }) {
  const [run, setRun] = useState<Run | null>(null);
  const [asked, setAsked] = useState<Asked | null>(null);
  // The run belongs to the tool. Switching tool, or arming the Text tool for
  // captions again, ends it wherever it had got to.
  const wasArmed = useRef(armed);
  if (wasArmed.current !== armed) {
    wasArmed.current = armed;
    if (!armed) {
      setRun(null);
      setAsked(null);
    }
  }

  return {
    asked,
    /** The name the next vertex clicked takes, or null before a run has started. */
    nextName: run ? nameAt(run.from, run.handed) : null,

    /** A vertex was clicked with no run going, so ask what letter to start at. */
    ask: (id: string, at: { x: number; y: number }) => setAsked({ id, at }),

    dropAsk: () => setAsked(null),

    /** The letter was given, so the vertex that was clicked for it takes it. */
    startFrom: (from: string) => {
      if (!asked) return;
      naming.labelAs(asked.id, nameAt(from, 0));
      setRun({ from, handed: 1, ahead: 0 });
      setAsked(null);
    },

    /** A vertex was clicked during a run, so it takes the next name going. */
    give: (id: string) => {
      if (!run) return;
      naming.labelAs(id, nameAt(run.from, run.handed));
      setRun({ ...run, handed: run.handed + 1, ahead: 0 });
    },

    /** The page stepped back, so the last name handed out is the next one again. */
    steppedBack: () =>
      setRun((held) =>
        held && held.handed > 0
          ? { ...held, handed: held.handed - 1, ahead: held.ahead + 1 }
          : held,
      ),

    /** The page stepped forward again, so the letter goes back where it was. */
    steppedForward: () =>
      setRun((held) =>
        held && held.ahead > 0 ? { ...held, handed: held.handed + 1, ahead: held.ahead - 1 } : held,
      ),
  };
}

/** A relabel run, as the window holds it. */
export type Relabelling = ReturnType<typeof useRelabel>;
