import type { ComponentType } from "react";
import {
  AngleMarkIcon,
  ArrowIcon,
  ArrowMarksIcon,
  ArrowPathsIcon,
  ArrowPointsIcon,
  ArrowTextIcon,
  CompassIcon,
  EqualMarkIcon,
  LineIcon,
  MarkerIcon,
  MeasureAngleIcon,
  MeasureAreaIcon,
  MeasureIcon,
  MeasureLengthIcon,
  ParallelMarkIcon,
  PentagonIcon,
  PointIcon,
  PolygonFillIcon,
  PolygonIcon,
  RayIcon,
  RelabelIcon,
  SegmentIcon,
  StraightedgeIcon,
  TextIcon,
} from "./icons";

/** One of the things a tool with a flyout can be armed with. */
export interface ToolVariant {
  id: string;
  name: string;
  Icon: ComponentType;
}

export interface Tool {
  id: string;
  name: string;
  key: string;
  /** Tools whose variants live behind a flyout carry a corner marker. */
  flyout: boolean;
  /** What the flyout offers. Empty where the variants are not specified. */
  variants?: ToolVariant[];
  Icon: ComponentType;
}

/**
 * Whether an Arrow armed this way carries writing: captions, readings, tables
 * and labels. Armed for one kind of geometry it passes over all of them, so
 * this is asked both where the sheet decides what the pointer reaches and where
 * the window decides what it can still be holding.
 */
export function armedForWriting(arrowKind: string): boolean {
  return arrowKind === "all" || arrowKind === "text";
}

/** The toolbox rail, top to bottom. */
export const TOOLS: Tool[] = [
  {
    id: "arrow",
    name: "Arrow",
    key: "A",
    flyout: true,
    // The plain Arrow picks up anything. The rest pick up one kind of thing
    // each, so a figure can be worked on without catching what is beside it.
    variants: [
      { id: "all", name: "All", Icon: ArrowIcon },
      { id: "points", name: "Points", Icon: ArrowPointsIcon },
      { id: "paths", name: "Paths", Icon: ArrowPathsIcon },
      { id: "marks", name: "Markings", Icon: ArrowMarksIcon },
      { id: "text", name: "Text", Icon: ArrowTextIcon },
    ],
    Icon: ArrowIcon,
  },
  { id: "point", name: "Point", key: "P", flyout: false, Icon: PointIcon },
  { id: "compass", name: "Compass", key: "C", flyout: false, Icon: CompassIcon },
  {
    id: "straightedge",
    name: "Straightedge",
    key: "S",
    flyout: true,
    Icon: StraightedgeIcon,
    variants: [
      { id: "segment", name: "Segment", Icon: SegmentIcon },
      { id: "ray", name: "Ray", Icon: RayIcon },
      { id: "line", name: "Line", Icon: LineIcon },
    ],
  },
  {
    id: "polygon",
    name: "Polygon",
    key: "G",
    flyout: true,
    // Edges and a fill together is what a polygon usually wants, so it leads.
    variants: [
      { id: "interior-edges", name: "Polygon and Edges", Icon: PolygonIcon },
      { id: "interior", name: "Polygon", Icon: PolygonFillIcon },
      { id: "regular", name: "Regular Polygon", Icon: PentagonIcon },
    ],
    Icon: PolygonIcon,
  },
  {
    id: "text",
    name: "Text",
    key: "T",
    flyout: true,
    // Captions and labels are both writing on the sheet, so the one tool does
    // both: dragging out something to say, and handing out the letters a
    // figure's vertices are named by.
    variants: [
      { id: "caption", name: "Text", Icon: TextIcon },
      { id: "relabel", name: "Relabel", Icon: RelabelIcon },
    ],
    Icon: TextIcon,
  },
  {
    id: "measure",
    name: "Measure",
    key: "M",
    flyout: true,
    variants: [
      { id: "length", name: "Length", Icon: MeasureLengthIcon },
      { id: "area", name: "Area", Icon: MeasureAreaIcon },
      { id: "angle", name: "Angle", Icon: MeasureAngleIcon },
    ],
    Icon: MeasureIcon,
  },
  {
    id: "marker",
    name: "Marker",
    key: "K",
    flyout: true,
    variants: [
      { id: "equal", name: "Equal Sides", Icon: EqualMarkIcon },
      { id: "parallel", name: "Parallel", Icon: ParallelMarkIcon },
      { id: "angle", name: "Angle", Icon: AngleMarkIcon },
    ],
    Icon: MarkerIcon,
  },
];
