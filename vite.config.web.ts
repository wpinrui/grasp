/**
 * The web build: the same renderer, hosted by a browser tab rather than by the
 * Electron main process. Its entry puts a browser `window.api` in place and
 * then renders the same App, so nothing under `src/renderer` knows which host
 * it is running in beyond the one flag that surface carries.
 *
 * Netlify publishes `dist/web`, where the site root is the landing page and the
 * app itself sits under `/launch`. The app's asset paths are relative, so the
 * same build works at a domain root or under a path. The landing page's are
 * anchored at the root instead, since the host serves that page at every
 * address it has nothing else for and a relative name would be resolved
 * against whichever of those a visitor arrived at.
 */

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { ASSET_DIR, unpackLanding } from "./scripts/unpack-landing";

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

const WEB = resolve("dist/web");

/**
 * The landing page is one self-contained file with everything packed into it,
 * which is a shape for a file that travels alone. Published to a host it does
 * not, so it is unpacked here instead of in the browser: the page goes to the
 * site root as an ordinary document and its assets go beside it, which is what
 * lets a browser fetch them in parallel and keep them between visits. The app
 * goes under the page, which is what puts the landing page at `/`.
 */
function landingPage(): Plugin {
  return {
    name: "grasp-landing-page",
    // The app's own `emptyOutDir` only clears `dist/web/launch`, so the landing
    // page is cleared here instead. What this plugin puts there rather than
    // `dist/web` itself: on Windows something holding that open makes removing
    // it EPERM.
    buildStart() {
      rmSync(resolve(WEB, "index.html"), { force: true });
      rmSync(resolve(WEB, "favicon.png"), { force: true });
      rmSync(resolve(WEB, ASSET_DIR), { recursive: true, force: true });
    },
    closeBundle() {
      const page = unpackLanding(readFileSync(resolve("grasp-landing.html"), "utf8"));
      writeFileSync(resolve(WEB, "index.html"), page.html);
      mkdirSync(resolve(WEB, ASSET_DIR), { recursive: true });
      for (const asset of page.assets) {
        writeFileSync(resolve(WEB, ASSET_DIR, asset.name), asset.bytes);
      }
      // One favicon at the site root, which is where both pages point at it:
      // each names it at the absolute path `/favicon.png`, the landing page in
      // its own markup and the app from under /launch.
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
