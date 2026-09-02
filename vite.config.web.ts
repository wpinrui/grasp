/**
 * The web build: the same renderer, hosted by a browser tab rather than by the
 * Electron main process. Its entry puts a browser `window.api` in place and
 * then renders the same App, so nothing under `src/renderer` knows which host
 * it is running in beyond the one flag that surface carries.
 *
 * Netlify publishes `dist/web`, where the site root is the landing page and the
 * app itself sits under `/launch`. Asset paths are relative, so the same build
 * works at a domain root or under a path.
 */

import { copyFileSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

const WEB = resolve("dist/web");

/**
 * The landing page is one self-contained file with everything packed into it,
 * so publishing it is a copy rather than a build. It goes to the site root and
 * the app goes under it, which is what puts the landing page at `/`.
 */
function landingPage(): Plugin {
  return {
    name: "grasp-landing-page",
    // The app's own `emptyOutDir` only clears `dist/web/launch`, so the landing
    // page is cleared here instead. The file rather than the directory: on
    // Windows something holding `dist/web` open makes removing it EPERM, and
    // the one file is all this plugin puts there.
    buildStart() {
      rmSync(resolve(WEB, "index.html"), { force: true });
      rmSync(resolve(WEB, "favicon.png"), { force: true });
    },
    closeBundle() {
      copyFileSync(resolve("grasp-landing.html"), resolve(WEB, "index.html"));
      // One favicon at the site root, which is where both pages point at it:
      // the landing page is self-contained and cannot carry a hashed asset,
      // and the app under /launch reaches the same file by an absolute path.
      copyFileSync(resolve("resources/favicon.png"), resolve(WEB, "favicon.png"));
    },
  };
}

export default defineConfig({
  root: resolve("src/web"),
  base: "./",
  define: { __GRASP_VERSION__: JSON.stringify(version) },
  resolve: {
    alias: {
      "@renderer": resolve("src/renderer/src"),
      "@resources": resolve("resources"),
    },
  },
  plugins: [react(), landingPage()],
  build: {
    outDir: resolve(WEB, "launch"),
    emptyOutDir: true,
  },
});
