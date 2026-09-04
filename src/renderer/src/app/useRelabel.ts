/**
 * Relabelling a figure: the letters handed out in the order the vertices are
 * clicked.
 *
 * The run belongs to the window rather than to the page, so it is no undo step
 * of its own. Where it has got to is not counted, though: it is read back off
 * the page, as the letters it handed out that the page still holds. That is
 * what keeps the two in step whatever else happens between two clicks. Undoing
 * the last vertex named brings its letter round again, so a vertex clicked
 * twice by mistake costs one Ctrl+Z; undoing anything else leaves the run
 * exactly where it was.
 */

import { useRef, useState } from "react";
import { nameAt } from "../sketch/model";
import type { Naming } from "./labels";

/** Where a run began, and the vertices it has named since, in that order. */
export interface Run {
  from: string;
  given: string[];
}

/** The vertex clicked with no run going, and where to ask about it. */
interface Asked {
  id: string;
  at: { x: number; y: number };
}

/**
 * How far along a run is: one past the last vertex it named that still answers
 * to the letter it gave it. Reading its place back off the page rather than
 * counting clicks is what keeps the run in step through an undo it did not
 * cause, and taking the last rather than the first means it never reverses over
 * a letter the page is still showing: lose a vertex out of the middle of a run
 * and the letters after it are still spoken for.
 */
export function placeOf(run: Run, names: Map<string, string>): number {
  let place = 0;
  for (let at = 0; at < run.given.length; at += 1) {
    if (names.get(run.given[at]) === nameAt(run.from, at)) place = at + 1;
  }
  return place;
}

export interface RelabelContext {
  /** Whether the Text tool is armed for a run at all. */
  armed: boolean;
  naming: Naming;
  /** What everything on the page is called, which is where the run reads its place. */
  names: Map<string, string>;
  /** The page that is up, since a run's letters are on that one and no other. */
  page: string;
}

export function useRelabel({ armed, naming, names, page }: RelabelContext) {
  const [run, setRun] = useState<Run | null>(null);
  const [asked, setAsked] = useState<Asked | null>(null);
  // The run belongs to the tool, and to the page it was started on. Switching
  // tool, arming the Text tool for captions again, or turning to another page
  // ends it wherever it had got to: it reads its place off the page that is up,
  // and another page's letters are not its to read.
  const was = useRef({ armed, page });
  if (was.current.armed !== armed || was.current.page !== page) {
    const ended = !armed || was.current.page !== page;
    was.current = { armed, page };
    if (ended) {
      setRun(null);
      setAsked(null);
    }
  }
  const place = run ? placeOf(run, names) : 0;

  return {
    asked,
    /** The name the next vertex clicked takes, or null before a run has started. */
    nextName: run ? nameAt(run.from, place) : null,

    /**
     * A vertex was clicked with no run going, so ask what letter to start at.
     * A second click while the box is still up is left alone: the box stands
     * beside the vertex it is about, and it is about the first one.
     */
    ask: (id: string, at: { x: number; y: number }) => {
      if (!asked) setAsked({ id, at });
    },

    dropAsk: () => setAsked(null),

    /** The letter was given, so the vertex that was clicked for it takes it. */
    startFrom: (from: string) => {
      if (!asked) return;
      naming.labelAs(asked.id, nameAt(from, 0));
      setRun({ from, given: [asked.id] });
      setAsked(null);
    },

    /** A vertex was clicked during a run, so it takes the next name going. */
    give: (id: string) => {
      if (!run) return;
      naming.labelAs(id, nameAt(run.from, place));
      // Whatever the page has given back since is dropped with it, so the run
      // holds only the letters it is still standing behind.
      setRun({ ...run, given: [...run.given.slice(0, place), id] });
    },
  };
}

/** A relabel run, as the window holds it. */
export type Relabelling = ReturnType<typeof useRelabel>;
