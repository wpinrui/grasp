/**
 * The landing page bundle, read the way the build reads it.
 *
 * This is `landing.test.ts`'s reading of the authored page, kept apart from
 * the cases so that suite stays under the file cap. The page is 9MB and
 * cannot change under a run, so it is read and parsed once.
 *
 * The parsed tree is handed out as it is. Nothing here writes to it, and a
 * caller that did would change what every later case sees.
 */
import { readFileSync } from "node:fs";
import { islandText } from "../../../scripts/unpack-landing";

const BUNDLE = "grasp-landing.html";

/** What an asset is called in the payload, before the build gives it a path. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Elements HTML closes for you, so an unmatched one is not a defect. */
const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * The payload, read the same way the build reads it, so the two cannot come
 * to disagree about where an island begins. Read once; the file cannot change
 * under a run, and it is 9MB.
 */
let read: { encoded: string; html: string } | null = null;
export function payload(): { encoded: string; html: string } {
  if (read) return read;
  const encoded = islandText(readFileSync(BUNDLE, "utf8"), "template");
  read = { encoded, html: JSON.parse(encoded) as string };
  return read;
}

/** The page, parsed, so a selector can be asked what it really matches. */
let tree: Document | null = null;
export function page(): Document {
  if (!tree) tree = new DOMParser().parseFromString(payload().html, "text/html");
  return tree;
}

/** Just the stylesheet bodies, so a rule can be told apart from a mention. */
export function styles(): string {
  return [...payload().html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
    .map((block) => block[1])
    .join("\n");
}

/** The page's own script, which is where the embed behaviour lives. */
export function script(): string {
  const found = /<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/.exec(payload().html);
  if (!found) throw new Error("no text/x-dc script in the payload");
  return found[1];
}

/** Every closing tag that closed the wrong thing, plus anything left open. */
export function unbalanced(markup: string): string[] {
  const stack: string[] = [];
  const problems: string[] = [];
  for (const tag of markup.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*?(\/?)>/g)) {
    const [, closing, name, selfClosing] = tag;
    if (VOID.has(name) || selfClosing === "/") continue;
    if (!closing) {
      stack.push(name);
    } else if (stack[stack.length - 1] === name) {
      stack.pop();
    } else {
      problems.push(`</${name}> closes <${stack[stack.length - 1] ?? "nothing"}>`);
    }
  }
  return [...problems, ...stack.map((name) => `<${name}> never closed`)];
}
