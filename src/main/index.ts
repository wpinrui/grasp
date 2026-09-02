import { join } from "node:path";
import icon from "@resources/icon.png?asset";
import { app, BrowserWindow, ipcMain, Menu } from "electron";
import { registerAboutHandlers } from "./about";
import { type OpenedDocument, registerFileHandlers } from "./files";
import { registerObjectHandlers } from "./objects";
import { registerPrintHandlers } from "./printing";
import { flushSettings, keep, MIN_WINDOW, registerSettingsHandlers, settings } from "./settings";

/**
 * The Untitled number each window is showing, keyed by its webContents id. A
 * window drops out once it closes or its sketch takes a file name, which puts
 * that number back in the pool.
 */
const untitledNumbers = new Map<number, number>();

/** The file a window was opened with, keyed by its webContents id. */
const startingFiles = new Map<number, OpenedDocument>();

/** The lowest number no open untitled sketch is using. */
function nextUntitledNumber(): number {
  const taken = new Set(untitledNumbers.values());
  let number = 1;
  while (taken.has(number)) number += 1;
  return number;
}

/** Without a file the window gets a blank sketch and the next Untitled number. */
function createWindow(file?: OpenedDocument): void {
  const remembered = settings();
  const window = new BrowserWindow({
    width: remembered.windowWidth,
    height: remembered.windowHeight,
    minWidth: MIN_WINDOW.width,
    minHeight: MIN_WINDOW.height,
    show: false,
    icon,
    // The chrome is drawn by the renderer, so the OS frame is off.
    frame: false,
    backgroundColor: "#202020",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      sandbox: true,
    },
  });

  // Held on its own, because by `closed` the window and its webContents are
  // destroyed and reading the id off them throws.
  const webContentsId = window.webContents.id;
  if (file) startingFiles.set(webContentsId, file);
  else untitledNumbers.set(webContentsId, nextUntitledNumber());
  window.on("closed", () => {
    untitledNumbers.delete(webContentsId);
    startingFiles.delete(webContentsId);
  });

  // Before the window shows, so it comes up maximised rather than growing.
  if (remembered.windowMaximised) window.maximize();

  // The size held is the one with nothing maximised, so unmaximising later
  // gives back the size the window was actually dragged to.
  const rememberSize = () =>
    keep({
      windowWidth: window.getNormalBounds().width,
      windowHeight: window.getNormalBounds().height,
      windowMaximised: window.isMaximized(),
    });
  window.on("resize", rememberSize);
  window.on("maximize", rememberSize);
  window.on("unmaximize", rememberSize);

  window.on("ready-to-show", () => window.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

/** Backs the custom caption buttons in the renderer's title bar. */
function registerWindowControls(): void {
  ipcMain.on("window:minimise", (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
  ipcMain.on("window:toggle-maximise", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipcMain.on("window:close", (event) => BrowserWindow.fromWebContents(event.sender)?.close());
}

app.whenReady().then(() => {
  // GRASP draws its own menu bar, so the default one would only steal keys.
  Menu.setApplicationMenu(null);
  registerWindowControls();
  registerSettingsHandlers();
  registerAboutHandlers();
  registerObjectHandlers();
  registerPrintHandlers();
  registerFileHandlers({
    newWindow: createWindow,
    startingDocument: (id) => {
      const file = startingFiles.get(id);
      if (file) return { name: file.name, path: file.path, text: file.text };
      return { name: `Untitled ${untitledNumbers.get(id) ?? 1}`, path: null, text: null };
    },
    releaseUntitled: (id) => untitledNumbers.delete(id),
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", flushSettings);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
