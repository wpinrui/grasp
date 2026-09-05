# <img src="docs/images/icon-title.png" width="32" align="middle" alt=""> GRASP

**G**RASP **R**enders **A**ll **S**ketches **P**recisely.

A free and open-source geometry sketchpad for your classroom. Draw accurate figures, measure them, produce visual proofs. Help your students grasp geometric intuition.

[Try GRASP in your browser](https://grasp-math.netlify.app). A Windows version is also available.

![The GRASP window: a labelled triangle with its angles, side and area measured](docs/images/window.png)

## Dynamic measurements

Drag one corner and every angle, length and area recalculates. Students can see how each change affects the bigger picture of your geometry.

## Intuitive interface

Enjoy creating sketches with a user-first set of panels. Iterate rapidly with keyboard shortcuts to activate the exact tool you need.

## Features

- **Construct.** Points, segments, rays, lines, circles, arcs and fills. Midpoints, intersections, parallels, perpendiculars, angle bisectors, regular polygons, points that slide along a path, and loci.
- **Transform.** Translate, rotate, dilate and reflect to create more advanced sketches.
- **Measure.** Keep track of lengths, areas, angles, ratios and more as you iterate your sketch.
- **Numbers.** Set parameters, do step-by-step calculations and watch them update.
- **Mark up.** Label sides of a polygon as equal, parallel, or add angle arcs for more polished classroom demos or for worksheet printing.
- **Export.** Export a selection or a page to an image file or to your clipboard. Optimise it for your printed worksheet or your colourful slideshow.

## AI-powered scripting

GRASP comes with a full scripting language that an AI model can figure out. Generate complex proofs and sketches with minimal effort.

![The Ask an AI dialog](docs/images/ai.png)

## How to use GRASP

### Online

The online version of GRASP is fully featured and available [here](https://grasp-math.netlify.app/launch). You can also use a simplified version on mobile.

### Desktop

Windows: Go to the [releases](https://github.com/wpinrui/grasp/releases) page and download the installer or portable exe.

Linux (x64): Versioned desktop releases include an AppImage and a Debian package on the [releases](https://github.com/wpinrui/grasp/releases) page. For the AppImage, enable its executable permission (`chmod +x GRASP-*.AppImage`) before opening it. On Debian or Ubuntu, install the `.deb` with `sudo apt install ./GRASP-*.deb`.

macOS: Coming soon.

### Building desktop packages

Run `yarn install --frozen-lockfile`, then `yarn package:linux` on Linux or `yarn package:win` on Windows. The x64 packages are written to `dist/desktop/`.

The [Release desktop workflow](https://github.com/wpinrui/grasp/actions/workflows/release-desktop.yml) runs only when explicitly dispatched against a stable version tag. It requires an existing draft release with written notes and a tag matching `package.json`. Both Windows and Linux builds must pass checks before all four packages are attached and the draft is published. Build failures leave the release unpublished. Workflow artifacts are retained for 14 days; published release downloads remain available independently.

| Action | Website | Desktop builds | GitHub Release |
| --- | --- | --- | --- |
| Push a feature branch, open a PR, or merge to `main` | No production deployment | None | None |
| Push `deploy` | Netlify deploys | None | None |
| Dispatch Release desktop against a prepared version tag | No additional web deployment | Windows and Linux | Publishes the prepared draft after both builds succeed |

For a versioned release, first deploy the selected commit and confirm Netlify is ready. Create and push `v<version>` at that exact commit, prepare a draft with `gh release create v<version> --verify-tag --draft --title "GRASP <version>" --notes-file <notes-path>`, then run `gh workflow run release-desktop.yml --ref v<version>`. The workflow must already exist on the default branch. Dispatching publishes the draft automatically on success, preserving its title and notes. A web-only deployment stops after Netlify is ready.

## Acknowledgements

GRASP was built with [Claude Code](https://claude.com/claude-code). Claude wrote most of the code and this page; the product decisions, the specification and the review were mine.

## Licence

MIT. See [LICENSE](LICENSE).
