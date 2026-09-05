import type { Position, SketchMeasurement } from "../sketch/model";
import { PLACES } from "../sketch/prefs";
import {
  BoundsBrokenIcon,
  BoundsFullIcon,
  BoundsNoneIcon,
  ChainIcon,
  FewerPlacesIcon,
  LeadersIcon,
  MorePlacesIcon,
  ReflexIcon,
} from "./icons";
import { PanelButton, PanelShell, PanelSplit } from "./MarkPanelShell";

const MEASURE_COLOUR = "var(--color-tool-measure)";

interface ReadingPanelProps {
  reading: SketchMeasurement;
  /** Where the reading sits, in screen pixels from the sheet's top left. */
  at: Position;
  onBounds: (id: string, bounds: "broken" | "full" | undefined) => void;
  onLeaders: (id: string, leaders: boolean) => void;
  /** The number tied to what it reads, so it goes wherever the figure goes. */
  onTie: (id: string, tied: boolean) => void;
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
 * Every reading the Measure tool wrote says whether its number is tied to what
 * it reads. Tied, the number holds its place against the figure and goes
 * wherever the figure goes, the way the arrows and the arcs already do; loose,
 * it sits where it was put.
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
  onTie,
  onReflex,
  places,
  onPlaces,
}: ReadingPanelProps) {
  const bounds = reading.bounds;
  const least = PLACES[0];
  const most = PLACES[PLACES.length - 1];
  // Only what the Measure tool wrote is offered the chain. A reading from the
  // Measure menu is a row of numbers in the corner of the view rather than a
  // number set down beside a figure, so it has no figure to be tied to.
  const chain = reading.bare ? (
    <>
      <PanelButton
        label="Move the number with the figure"
        tip="Move the number with the figure"
        on={reading.tied !== undefined}
        onClick={() => onTie(reading.id, reading.tied === undefined)}
      >
        <ChainIcon />
      </PanelButton>
      <PanelSplit />
    </>
  ) : null;
  const decimals = (
    <>
      <PanelButton
        label="One fewer decimal place"
        tip={`One fewer decimal place (${places} now)`}
        disabled={places <= least}
        onClick={() => onPlaces(reading.id, places - 1)}
      >
        <FewerPlacesIcon />
      </PanelButton>
      <PanelButton
        label="One more decimal place"
        tip={`One more decimal place (${places} now)`}
        disabled={places >= most}
        onClick={() => onPlaces(reading.id, places + 1)}
      >
        <MorePlacesIcon />
      </PanelButton>
    </>
  );

  // An angle has one thing to say about it: which way round it is read. The
  // arrows belong to a length, which is the only reading with two ends.
  if (reading.measure === "angle") {
    return (
      <PanelShell at={at} colour={MEASURE_COLOUR}>
        <PanelButton
          label="Read the reflex angle instead"
          tip="Read the reflex angle instead"
          on={reading.reflex}
          onClick={() => onReflex(reading.id, reading.reflex !== true)}
        >
          <ReflexIcon />
        </PanelButton>
        <PanelSplit />
        {chain}
        {decimals}
      </PanelShell>
    );
  }

  // Everything else says only how far it is written out. A length says that and
  // how its segment is drawn out as a dimension.
  if (reading.measure !== "length") {
    return (
      <PanelShell at={at} colour={MEASURE_COLOUR}>
        {chain}
        {decimals}
      </PanelShell>
    );
  }

  return (
    <PanelShell at={at} colour={MEASURE_COLOUR}>
      <PanelButton
        label="The number on its own"
        tip="The number on its own"
        on={bounds === undefined}
        onClick={() => onBounds(reading.id, undefined)}
      >
        <BoundsNoneIcon />
      </PanelButton>
      <PanelButton
        label="Arrows broken by the number"
        tip="Arrows broken by the number"
        on={bounds === "broken"}
        onClick={() => onBounds(reading.id, "broken")}
      >
        <BoundsBrokenIcon />
      </PanelButton>
      <PanelButton
        label="Arrows running the whole way"
        tip="Arrows running the whole way"
        on={bounds === "full"}
        onClick={() => onBounds(reading.id, "full")}
      >
        <BoundsFullIcon />
      </PanelButton>
      <PanelSplit />
      <PanelButton
        label="Dotted lines out to the segment"
        tip="Dotted lines out to the segment"
        on={reading.leaders}
        disabled={bounds === undefined}
        onClick={() => onLeaders(reading.id, reading.leaders !== true)}
      >
        <LeadersIcon />
      </PanelButton>
      <PanelSplit />
      {chain}
      {decimals}
    </PanelShell>
  );
}
