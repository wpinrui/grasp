import type { MouseEvent } from "react";
import type { Position, SketchMeasurement } from "../sketch/model";
import { PLACES } from "../sketch/prefs";
import {
  BoundsBrokenIcon,
  BoundsFullIcon,
  BoundsNoneIcon,
  FewerPlacesIcon,
  LeadersIcon,
  MorePlacesIcon,
  ReflexIcon,
} from "./icons";
import "./MarkPanel.css";

interface ReadingPanelProps {
  reading: SketchMeasurement;
  /** Where the reading sits, in screen pixels from the sheet's top left. */
  at: Position;
  onBounds: (id: string, bounds: "broken" | "full" | undefined) => void;
  onLeaders: (id: string, leaders: boolean) => void;
  /** An angle read the long way round instead of the short way. */
  onReflex: (id: string, reflex: boolean) => void;
  /** How many places this reading is written to now, its kind's default included. */
  places: number;
  onPlaces: (id: string, places: number) => void;
}

/**
 * The panel that opens on a reading. On an angle it says which way round the
 * angle is read, and turns the mark that angle carries round with it, so the
 * arcs and the number never disagree.
 *
 * On a length: whether the segment it reads is drawn out
 * as a dimension, and how. Nothing, the arrows broken by the number in the
 * middle, or the arrows running the whole way with the number clear of them.
 * The dotted lines are what let the whole thing be dragged off the segment and
 * still say which segment it is about.
 *
 * Every reading says how far it is written out, whatever else it has to say.
 * That starts at what Preferences asks for and is moved a place at a time from
 * here, so one number can be exact while the rest of the sheet stays round.
 */
export function ReadingPanel({
  reading,
  at,
  onBounds,
  onLeaders,
  onReflex,
  places,
  onPlaces,
}: ReadingPanelProps) {
  const hold = (event: MouseEvent) => event.preventDefault();
  const bounds = reading.bounds;
  const least = PLACES[0];
  const most = PLACES[PLACES.length - 1];
  const decimals = (
    <>
      <button
        type="button"
        className="mark-panel__button"
        aria-label="One fewer decimal place"
        title={`One fewer decimal place (${places} now)`}
        disabled={places <= least}
        onClick={() => onPlaces(reading.id, places - 1)}
      >
        <FewerPlacesIcon />
      </button>
      <button
        type="button"
        className="mark-panel__button"
        aria-label="One more decimal place"
        title={`One more decimal place (${places} now)`}
        disabled={places >= most}
        onClick={() => onPlaces(reading.id, places + 1)}
      >
        <MorePlacesIcon />
      </button>
    </>
  );

  // An angle has one thing to say about it: which way round it is read. The
  // arrows belong to a length, which is the only reading with two ends.
  if (reading.measure === "angle") {
    return (
      <div
        className="mark-panel"
        style={{ left: `${at.x}px`, top: `${at.y}px`, color: "var(--color-tool-measure)" }}
        onMouseDown={hold}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className={`mark-panel__button${reading.reflex ? " mark-panel__button--on" : ""}`}
          aria-label="Read the reflex angle instead"
          title="Read the reflex angle instead"
          onClick={() => onReflex(reading.id, reading.reflex !== true)}
        >
          <ReflexIcon />
        </button>
        <span className="mark-panel__split" />
        {decimals}
      </div>
    );
  }

  // Everything else says only how far it is written out. A length says that and
  // how its segment is drawn out as a dimension.
  if (reading.measure !== "length") {
    return (
      <div
        className="mark-panel"
        style={{ left: `${at.x}px`, top: `${at.y}px`, color: "var(--color-tool-measure)" }}
        onMouseDown={hold}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {decimals}
      </div>
    );
  }

  return (
    <div
      className="mark-panel"
      style={{ left: `${at.x}px`, top: `${at.y}px`, color: "var(--color-tool-measure)" }}
      onMouseDown={hold}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={`mark-panel__button${bounds === undefined ? " mark-panel__button--on" : ""}`}
        aria-label="The number on its own"
        title="The number on its own"
        onClick={() => onBounds(reading.id, undefined)}
      >
        <BoundsNoneIcon />
      </button>
      <button
        type="button"
        className={`mark-panel__button${bounds === "broken" ? " mark-panel__button--on" : ""}`}
        aria-label="Arrows broken by the number"
        title="Arrows broken by the number"
        onClick={() => onBounds(reading.id, "broken")}
      >
        <BoundsBrokenIcon />
      </button>
      <button
        type="button"
        className={`mark-panel__button${bounds === "full" ? " mark-panel__button--on" : ""}`}
        aria-label="Arrows running the whole way"
        title="Arrows running the whole way"
        onClick={() => onBounds(reading.id, "full")}
      >
        <BoundsFullIcon />
      </button>
      <span className="mark-panel__split" />
      <button
        type="button"
        className={`mark-panel__button${reading.leaders ? " mark-panel__button--on" : ""}`}
        aria-label="Dotted lines out to the segment"
        title="Dotted lines out to the segment"
        disabled={bounds === undefined}
        onClick={() => onLeaders(reading.id, reading.leaders !== true)}
      >
        <LeadersIcon />
      </button>
      <span className="mark-panel__split" />
      {decimals}
    </div>
  );
}
