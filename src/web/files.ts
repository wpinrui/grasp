/**
 * Sketch files in a tab.
 *
 * Chrome and Edge on the desktop can hand a page a handle on a real file and
 * let it write back to that file in place, which is what Save means. Firefox
 * and Safari cannot, so there Open takes an upload and Save pushes a download,
 * and Save is always Save a Copy however it is spelt.
 *
 * The renderer addresses a file by its path. There are no paths here, so each
 * open file gets a made-up one that is unique to it, and the handle it stands
 * for is kept in the browser's own store so Open Recent can go back to it in a
 * later session.
 */

/** The suffix a sketch is written with, as the desktop app writes it. */
const EXTENSION = "grasp";

const DB = "grasp-files";
const STORE = "handles";

/** Whether this browser can hand a page a handle on a real file. */
export function hasPicker(): boolean {
  return typeof window.showOpenFilePicker === "function";
}

/** The store the handles live in, opened on demand. */
function store(): Promise<IDBDatabase> {
  return new Promise((done, fail) => {
    const opening = indexedDB.open(DB, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE);
    opening.onsuccess = () => done(opening.result);
    opening.onerror = () => fail(opening.error);
  });
}

function inStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  return store().then(
    (db) =>
      new Promise<T>((done, fail) => {
        const asked = run(db.transaction(STORE, mode).objectStore(STORE));
        asked.onsuccess = () => done(asked.result as T);
        asked.onerror = () => fail(asked.error);
      }),
  );
}

export function keepHandle(path: string, handle: FileSystemFileHandle): Promise<unknown> {
  return inStore("readwrite", (held) => held.put(handle, path));
}

export function heldHandle(path: string): Promise<FileSystemFileHandle | undefined> {
  return inStore<FileSystemFileHandle | undefined>("readonly", (held) => held.get(path));
}

export function dropHandle(path: string): Promise<unknown> {
  return inStore("readwrite", (held) => held.delete(path));
}

/** A path of GRASP's own, unique to the file it stands for. */
export function pathFor(name: string): string {
  return `grasp:${crypto.randomUUID()}/${name}.${EXTENSION}`;
}

/** What a path is called, which is the file name without the suffix. */
export function nameOf(path: string): string {
  const last = path.slice(path.lastIndexOf("/") + 1);
  return last.endsWith(`.${EXTENSION}`) ? last.slice(0, -(EXTENSION.length + 1)) : last;
}

/** Whether the page may still write to a handle it kept from an earlier visit. */
export async function allowed(handle: FileSystemFileHandle, write: boolean): Promise<boolean> {
  const mode = write ? "readwrite" : "read";
  if ((await handle.queryPermission({ mode })) === "granted") return true;
  return (await handle.requestPermission({ mode })) === "granted";
}

/** Push a file at the browser, which is all a fallback browser can be given. */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Let the click get out before the URL stops standing for anything.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Take an upload, which is all a fallback browser can offer for Open. */
export function upload(accept: string): Promise<File | null> {
  return new Promise((done) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    document.body.appendChild(input);
    // A cancelled picker fires nothing in some browsers, so the window regaining
    // the focus is what says the dialog is done with.
    input.addEventListener("change", () => {
      const file = input.files?.[0] ?? null;
      input.remove();
      done(file);
    });
    window.addEventListener(
      "focus",
      () =>
        setTimeout(() => {
          if (!input.isConnected) return;
          input.remove();
          done(null);
        }, 500),
      { once: true },
    );
    input.click();
  });
}
