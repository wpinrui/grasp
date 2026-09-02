/// <reference types="vite/client" />

/** The version GRASP was built as, put in by the web build from package.json. */
declare const __GRASP_VERSION__: string;

/**
 * The File System Access API, which TypeScript's DOM library does not yet
 * describe. Only the part the web app uses is written out here, and every call
 * is behind the check that the browser has it at all.
 */
interface FilePickerType {
  description: string;
  accept: Record<string, string[]>;
}

interface FilePermission {
  mode?: "read" | "readwrite";
}

interface FileSystemFileHandle {
  queryPermission(want?: FilePermission): Promise<"granted" | "denied" | "prompt">;
  requestPermission(want?: FilePermission): Promise<"granted" | "denied" | "prompt">;
}

interface Window {
  showOpenFilePicker(options?: {
    types?: FilePickerType[];
    multiple?: boolean;
  }): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(options?: {
    suggestedName?: string;
    types?: FilePickerType[];
  }): Promise<FileSystemFileHandle>;
}
