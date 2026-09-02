/**
 * What the text palette offers: the faces a caption can be set in, the sizes
 * and inks it can take, the mathematical notation it can hold, and the symbols
 * that are quicker to click than to type.
 *
 * The colours are token names rather than colours, so the sheet keeps one
 * source of truth for what red is.
 */

import type { CaptionAlign } from "../sketch/model";

export const FONTS = [
  "Times New Roman",
  "Georgia",
  "Segoe UI",
  "Arial",
  "Courier New",
  "Cambria Math",
] as const;

export const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];

export interface Ink {
  name: string;
  token: string;
}

export const INKS: Ink[] = [
  { name: "Black", token: "--color-ink-black" },
  { name: "Grey", token: "--color-ink-grey" },
  { name: "Red", token: "--color-ink-red" },
  { name: "Orange", token: "--color-ink-orange" },
  { name: "Green", token: "--color-ink-green" },
  { name: "Blue", token: "--color-ink-blue" },
  { name: "Purple", token: "--color-ink-purple" },
  { name: "Magenta", token: "--color-ink-magenta" },
];

/** What a caption is set in until the palette says otherwise. */
export const DEFAULT_CAPTION = {
  font: "Times New Roman",
  size: 14,
  colour: "--color-ink-black",
};

/** How a caption is ranged across its box until the palette says otherwise. */
export const DEFAULT_ALIGN: CaptionAlign = "left";

/**
 * The mark a notation drops in for the part that is still to be typed. Tab
 * steps from one to the next, so a fraction can be filled in without reaching
 * for the pointer.
 */
export const SLOT = "?";

export interface Notation {
  id: string;
  name: string;
  /** What the button shows, already filled in with the slot mark. */
  sample: string;
  /** What it inserts. Every slot is a `?` for Tab to land on. */
  html: string;
}

const slot = `<span class="cap-slot">${SLOT}</span>`;

export const NOTATION: Notation[] = [
  {
    id: "fraction",
    name: "Fraction",
    sample: "a/b",
    html: `<span class="cap-frac"><span class="cap-frac__top">${slot}</span><span class="cap-frac__bottom">${slot}</span></span>`,
  },
  {
    id: "root",
    name: "Square root",
    sample: "√",
    html: `<span class="cap-root"><span class="cap-root__sign">√</span><span class="cap-root__of">${slot}</span></span>`,
  },
  {
    id: "power",
    name: "Superscript",
    sample: "x²",
    html: `<sup>${slot}</sup>`,
  },
  {
    id: "index",
    name: "Subscript",
    sample: "x₂",
    html: `<sub>${slot}</sub>`,
  },
  {
    id: "overbar",
    name: "Overbar",
    sample: "AB",
    html: `<span class="cap-bar">${slot}</span>`,
  },
  {
    id: "group",
    name: "Grouping",
    sample: "( )",
    html: `<span class="cap-group">(${slot})</span>`,
  },
];

/** Rows of symbols, gathered so a Greek letter is not hunted for among signs. */
export const SYMBOLS: { name: string; glyphs: string[] }[] = [
  {
    name: "Greek",
    glyphs: [
      "α",
      "β",
      "γ",
      "δ",
      "ε",
      "θ",
      "λ",
      "μ",
      "π",
      "ρ",
      "σ",
      "φ",
      "ω",
      "Γ",
      "Δ",
      "Θ",
      "Σ",
      "Ω",
    ],
  },
  {
    name: "Relations",
    glyphs: ["=", "≠", "≈", "≡", "<", ">", "≤", "≥", "∝", "∼", "≅", "∥", "⊥", "∠", "∆", "△"],
  },
  {
    name: "Operators",
    glyphs: ["+", "−", "±", "×", "÷", "∓", "√", "∫", "∑", "∏", "∞", "°", "′", "″", "→", "⇒"],
  },
  {
    name: "Sets",
    glyphs: ["∈", "∉", "⊂", "⊆", "∪", "∩", "∅", "∀", "∃", "¬", "∧", "∨", "ℝ", "ℕ", "ℤ", "ℚ"],
  },
];
