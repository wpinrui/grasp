/**
 * What the app remembers between runs: chrome, not sketch content. It lives in
 * one JSON file in the user data folder, so it follows the user rather than any
 * sketch, and a sketch file stays the sketch and nothing else.
 *
 * The read is synchronous so the renderer can lay itself out on the first
 * frame instead of flashing a default and correcting it. Writes are the other
 * way round: they arrive on every pixel of a drag or a window resize, so they
 * are merged into what is held and put to disk once the changes stop.
 */

import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { app, ipcMain } from "electron";
import { DEFAULT_SETTINGS, MIN_WINDOW, type Settings } from "../shared/settings";

export { DEFAULT_SETTINGS, MIN_WINDOW, type Settings };

/** How long the writes stop for before what is held goes to disk. */
const SETTLE = 400;

let held: Settings | null = null;
let timer: NodeJS.Timeout | null = null;

function settingsPath(): string {
  return join(app.getPath("userData"), "settings.json");
}

/** A stored number, or the default where it is missing or nonsense. */
function number(value: unknown, fallback: number, least = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(least, value);
}

/**
 * A stored snapping step. Any size will do as long as it is a size: a step of
 * nothing has no steps in it, so that alone falls back to the default.
 */
function step(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

/** A stored colour token, which is a name rather than a colour. */
function token(value: unknown, fallback: string): string {
  return typeof value === "string" && value.startsWith("--color-") ? value : fallback;
}

/** A stored choice, or the default where it is missing or is not one of them. */
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** What was remembered, or the defaults when there is nothing to read. */
function read(): Settings {
  try {
    const stored = JSON.parse(readFileSync(settingsPath(), "utf8")) as Partial<Settings> & {
      /** What the one-panel-at-a-time dock wrote. */
      panel?: string | null;
    };
    return {
      panels: Array.isArray(stored.panels)
        ? stored.panels.filter((id): id is string => typeof id === "string")
        : typeof stored.panel === "string"
          ? [stored.panel]
          : DEFAULT_SETTINGS.panels,
      // The bar comes up with the app, so it is a thing to turn off rather than
      // a thing to find and turn on.
      showPalette: stored.showPalette !== false,
      panelWidth: number(stored.panelWidth, DEFAULT_SETTINGS.panelWidth),
      windowWidth: number(stored.windowWidth, DEFAULT_SETTINGS.windowWidth, MIN_WINDOW.width),
      windowHeight: number(stored.windowHeight, DEFAULT_SETTINGS.windowHeight, MIN_WINDOW.height),
      windowMaximised: stored.windowMaximised === true,
      // A new point says its name from a fresh install, so this is a thing to
      // turn off rather than a thing to find and turn on.
      labelNewPoints: stored.labelNewPoints !== false,
      // A fresh install starts with all three on, so each of them is a thing to
      // turn off rather than a thing to find and turn on.
      snapObjects: stored.snapObjects !== false,
      snapLength: stored.snapLength !== false,
      snapLengthCm: step(stored.snapLengthCm, DEFAULT_SETTINGS.snapLengthCm),
      // The steps hold a drawing from a fresh install and a move only when
      // asked, so this is a thing to turn on rather than a thing to turn off.
      snapMoving: stored.snapMoving === true,
      snapAngle: stored.snapAngle !== false,
      snapAngleDegrees: step(stored.snapAngleDegrees, DEFAULT_SETTINGS.snapAngleDegrees),
      exportBackground: oneOf(stored.exportBackground, ["white", "transparent"] as const, "white"),
      exportInk: oneOf(stored.exportInk, ["colour", "black", "white"] as const, "black"),
      exportPoints: stored.exportPoints === true,
      exportFill: oneOf(
        stored.exportFill,
        ["hidden", "colour", "grey", "black", "white"] as const,
        "colour",
      ),
      paper: oneOf(stored.paper, ["A4", "A3", "Letter", "Legal"] as const, "A4"),
      landscape: stored.landscape === true,
      marginCm: number(stored.marginCm, DEFAULT_SETTINGS.marginCm),
      printFit: oneOf(stored.printFit, ["page", "actual"] as const, "page"),
      printInk: oneOf(stored.printInk, ["colour", "black", "white"] as const, "black"),
      angleUnit: oneOf(stored.angleUnit, ["degrees", "radians"] as const, "degrees"),
      anglePlaces: number(stored.anglePlaces, DEFAULT_SETTINGS.anglePlaces),
      distanceUnit: oneOf(stored.distanceUnit, ["cm", "mm", "in"] as const, "cm"),
      distancePlaces: number(stored.distancePlaces, DEFAULT_SETTINGS.distancePlaces),
      otherPlaces: number(stored.otherPlaces, DEFAULT_SETTINGS.otherPlaces),
      colourPoint: token(stored.colourPoint, DEFAULT_SETTINGS.colourPoint),
      colourPath: token(stored.colourPath, DEFAULT_SETTINGS.colourPath),
      colourFill: token(stored.colourFill, DEFAULT_SETTINGS.colourFill),
      colourMark: token(stored.colourMark, DEFAULT_SETTINGS.colourMark),
      colourLabel: token(stored.colourLabel, DEFAULT_SETTINGS.colourLabel),
      colourSheet: token(stored.colourSheet, DEFAULT_SETTINGS.colourSheet),
      captionFont:
        typeof stored.captionFont === "string" ? stored.captionFont : DEFAULT_SETTINGS.captionFont,
      captionSize: number(stored.captionSize, DEFAULT_SETTINGS.captionSize),
      printPoints: stored.printPoints === true,
      printFill: oneOf(
        stored.printFill,
        ["hidden", "colour", "grey", "black", "white"] as const,
        "colour",
      ),
      recent: Array.isArray(stored.recent)
        ? stored.recent.filter((path): path is string => typeof path === "string")
        : DEFAULT_SETTINGS.recent,
    };
  } catch {
    // Nothing saved yet, or what is there cannot be read. Either way, defaults.
    return DEFAULT_SETTINGS;
  }
}

/** What is remembered right now, read from disk the first time it is asked for. */
export function settings(): Settings {
  if (!held) held = read();
  return held;
}

function flush(): void {
  timer = null;
  if (!held) return;
  void writeFile(settingsPath(), `${JSON.stringify(held, null, 2)}\n`, "utf8").catch(() => {
    // Nothing to tell the user: the sketch is safe either way, and the next
    // write gets another go.
  });
}

/**
 * Change part of what is remembered. Merged rather than replaced, because the
 * renderer sends what the dock is doing while the main process sends what the
 * window is doing, and neither knows about the other.
 */
export function keep(part: Partial<Settings>): void {
  held = { ...settings(), ...part };
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, SETTLE);
}

export function registerSettingsHandlers(): void {
  ipcMain.on("settings:read", (event) => {
    event.returnValue = settings();
  });
  ipcMain.on("settings:write", (_event, part: Partial<Settings>) => keep(part));
}

/** Put anything still held to disk, so quitting does not lose the last change. */
export function flushSettings(): void {
  if (timer) clearTimeout(timer);
  flush();
}
