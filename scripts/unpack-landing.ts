/**
 * The landing page, unpacked at build time rather than in the browser.
 *
 * The page is authored as one self-contained file: every image, font and
 * script is gzipped, base64'd and parked in a JSON island, and a runtime in
 * the page decodes the lot, mints a blob URL per asset, substitutes those into
 * a packed template and replaces the document with the result. That is what a
 * file has to do when it travels alone, and it costs a 7 MB download before
 * anything can be drawn, which is why the page shows a placeholder while it
 * happens.
 *
 * Published to a host, the file does not travel alone. This does the same
 * unpacking once, at build time, and writes the assets out beside the page, so
 * a browser gets an ordinary small document and fetches what it needs in
 * parallel, cached between visits. Nothing about how the page is authored
 * changes: the packed file stays the source, and this reads it.
 *
 * One thing the runtime does that this does not: strip `integrity` and
 * `crossorigin` off the template. It strips them because a blob URL minted in
 * a file:// document has a null origin, which turns those attributes into a
 * CORS fetch that then fails its own check. Assets written beside the page are
 * ordinary same-origin files, where both attributes mean what they say, so
 * they are left alone.
 */

import { gunzipSync } from "node:zlib";

/** One asset, ready to be written beside the page. */
export interface Asset {
  /** The file's name, which is what the page now points at. */
  name: string;
  bytes: Uint8Array;
}

/** The page as an ordinary document, and everything it now asks for. */
export interface Unpacked {
  html: string;
  assets: Asset[];
}

/** One packed asset, as the island holds it. */
interface Entry {
  mime: string;
  compressed: boolean;
  data: string;
}

/** An external file the page reaches by its original address. */
interface External {
  id: string;
  uuid: string;
}

/** Where the assets sit under the published site. */
export const ASSET_DIR = "assets";

/** What each kind of asset is called on disk. */
const SUFFIX: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "font/woff2": ".woff2",
  "text/javascript": ".js",
};

/** The text of the JSON island of that name, which is one string on its own line. */
export function islandText(bundle: string, name: string): string {
  const tag = `<script type="__bundler/${name}">`;
  const opens = bundle.indexOf(tag);
  if (opens < 0) throw new Error(`The landing page carries no ${name}.`);
  const from = bundle.indexOf("\n", opens) + 1;
  return bundle.slice(from, bundle.indexOf("</script>", from)).trim();
}

/** The JSON island of that name, read. */
function island<T>(bundle: string, name: string): T {
  return JSON.parse(islandText(bundle, name)) as T;
}

/** One asset's bytes, gunzipped where it was packed that way. */
function bytesOf(entry: Entry): Uint8Array {
  const packed = Buffer.from(entry.data, "base64");
  return new Uint8Array(entry.compressed ? gunzipSync(packed) : packed);
}

/** What an asset is called, which is its own name and what it is. */
function nameOf(uuid: string, mime: string): string {
  const suffix = SUFFIX[mime];
  if (!suffix) throw new Error(`The landing page carries a ${mime}, which has no suffix here.`);
  return `${uuid}${suffix}`;
}

/**
 * The map the page's own script reads, which reaches its external files by the
 * addresses they came from rather than by substitution. An address with
 * nothing behind it would leave the page quietly going back out to the network
 * for it, so it stops the build instead.
 */
function resourceScript(externals: External[], at: Record<string, string>): string {
  const map: Record<string, string> = {};
  for (const external of externals) {
    const path = at[external.uuid];
    if (!path)
      throw new Error(`The landing page asks for ${external.id}, which it does not carry.`);
    map[external.id] = path;
  }
  // A closing tag inside the JSON would end the script carrying it.
  const json = JSON.stringify(map).split("</").join("<\\/");
  return `<script>window.__resources = ${json};</script>`;
}

/**
 * The script put after <head>, so the doctype stays first and quirks mode off,
 * and so it runs before the page's own script, which reads what it sets.
 */
function withResources(html: string, script: string): string {
  const head = html.match(/<head[^>]*>/i);
  if (!head || head.index === undefined) {
    throw new Error("The landing page carries no head to hang its resources on.");
  }
  const at = head.index + head[0].length;
  return html.slice(0, at) + script + html.slice(at);
}

/**
 * The packed page, as a document and the files beside it.
 *
 * The assets are asked for from the site root rather than from the page. The
 * host serves this page at every address it has nothing else for, so a
 * document-relative name would be resolved against whichever of those a
 * visitor happened to arrive at. Root-absolute is what the page already does
 * for its favicon and for the app it frames.
 *
 * Nested page bundles are a thing the format allows and this page does not
 * use: they are mounted as blobs from inside the browser, which has no
 * standing meaning as a file on disk. One would come through here silently
 * broken, so it stops the build instead.
 */
export function unpackLanding(bundle: string): Unpacked {
  if (island<string[]>(bundle, "page_order").length > 0) {
    throw new Error("The landing page now carries framed pages, which do not unpack to files.");
  }
  const packed = island<Record<string, Entry>>(bundle, "manifest");
  const externals = island<External[]>(bundle, "ext_resources");

  const assets: Asset[] = [];
  const at: Record<string, string> = {};
  for (const [uuid, entry] of Object.entries(packed)) {
    const name = nameOf(uuid, entry.mime);
    assets.push({ name, bytes: bytesOf(entry) });
    at[uuid] = `/${ASSET_DIR}/${name}`;
  }

  let html = island<string>(bundle, "template");
  for (const [uuid, path] of Object.entries(at)) html = html.split(uuid).join(path);
  return { html: withResources(html, resourceScript(externals, at)), assets };
}
