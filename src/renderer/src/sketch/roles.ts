/**
 * What each selected object is doing in the construction under the pointer, so
 * hovering an entry says which point is the centre before it is built.
 *
 * Only where the roles differ: two points that are both ends of a segment have
 * nothing to tell apart, while a centre and a point on the rim do.
 */
import type { MenuAction } from "../components/menus";
import { alongAndThrough, type Building, bisector, locusParts } from "./builds";
import { isCircle, isPoint } from "./model";

export function rolesFor(
  page: Building,
  action: MenuAction | null,
): { id: string; label: string }[] {
  const nth = (index: number, label: string) =>
    page.selected[index] ? [{ id: page.selected[index].id, label }] : [];
  if (action === "circle-centre-point") {
    return [...nth(0, "CENTER"), ...nth(1, "POINT ON CIRCUMFERENCE")];
  }
  if (action === "circle-centre-radius") {
    return [
      ...(page.chosenPoints[0] ? [{ id: page.chosenPoints[0].id, label: "CENTER" }] : []),
      ...(page.chosenLines[0] ? [{ id: page.chosenLines[0].id, label: "RADIUS" }] : []),
    ];
  }
  if (action === "arc-on-circle") {
    const round = page.selected.find(isCircle);
    if (!round) return [...nth(0, "CENTER"), ...nth(1, "FROM"), ...nth(2, "TO")];
    const ends = page.selected.filter(isPoint);
    return [
      { id: round.id, label: "CIRCLE" },
      ...(ends[0] ? [{ id: ends[0].id, label: "FROM" }] : []),
      ...(ends[1] ? [{ id: ends[1].id, label: "TO" }] : []),
    ];
  }
  if (action === "arc-through") {
    return [...nth(0, "FROM"), ...nth(1, "THROUGH"), ...nth(2, "TO")];
  }
  if (action === "ray") return [...nth(0, "FROM"), ...nth(1, "TOWARD")];
  if (action === "parallel" || action === "perpendicular") {
    const found = alongAndThrough(page);
    if (!found) return [];
    return [
      { id: found.line.id, label: action === "parallel" ? "PARALLEL TO" : "PERPENDICULAR TO" },
      ...found.points.map((point) => ({ id: point.id, label: "THROUGH" })),
    ];
  }
  if (action === "bisector") {
    const span = bisector(page);
    return span?.kind === "bisector" ? [{ id: span.corner, label: "CORNER" }] : [];
  }
  if (action === "locus") {
    const parts = locusParts(page);
    if (!parts) return [];
    return [
      { id: parts.driver.id, label: "DRIVER" },
      { id: parts.domain.id, label: "DOMAIN" },
      { id: parts.driven.id, label: "DRIVEN" },
    ];
  }
  if (action === "measure-distance") {
    // Between two points there is nothing to tell apart. From a point to a
    // straight object there is.
    if (page.chosenPoints.length === page.selected.length) return [];
    const point = page.chosenPoints[0];
    const line = page.chosenLines[0];
    if (!point || !line) return [];
    return [
      { id: point.id, label: "FROM" },
      { id: line.id, label: "TO" },
    ];
  }
  if (action === "measure-angle") {
    // Two straight objects: the first is the side it turns from, the second
    // the side it turns to, and the corner is theirs already.
    if (page.chosenLines.length === 2) {
      return [
        { id: page.chosenLines[0].id, label: "FROM" },
        { id: page.chosenLines[1].id, label: "TO" },
      ];
    }
    return [...nth(0, "FROM"), ...nth(1, "VERTEX"), ...nth(2, "TO")];
  }
  if (action === "measure-arc-angle" || action === "measure-arc-length") {
    const round = page.selected.find(isCircle);
    if (!round) return [];
    const ends = page.selected.filter(isPoint);
    const jobs = ends.length === 3 ? ["FROM", "THROUGH", "TO"] : ["FROM", "TO"];
    return [
      { id: round.id, label: "CIRCLE" },
      ...ends.flatMap((end, index) => (jobs[index] ? [{ id: end.id, label: jobs[index] }] : [])),
    ];
  }
  if (action === "measure-ratio") {
    if (page.chosenLines.length === 2) {
      return [
        { id: page.chosenLines[0].id, label: "NUMERATOR" },
        { id: page.chosenLines[1].id, label: "DENOMINATOR" },
      ];
    }
    return [...nth(0, "ORIGIN"), ...nth(1, "UNIT"), ...nth(2, "POINT")];
  }
  return [];
}
