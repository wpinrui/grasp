# <img src="docs/images/icon-title.png" width="32" align="middle" alt=""> GRASP

**G**RASP **R**enders **A**ll **S**ketches **P**recisely.

A free and open-source geometry sketchpad for your classroom. Draw accurate figures, measure them, produce visual proofs. Help your students grasp geometric intuition.

[Try GRASP in your browser](https://grasp-math.netlify.app), or download a desktop release for Windows, macOS, or Linux.

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

## Getting GRASP

### Online

The online version of GRASP is fully featured and available [here](https://grasp-math.netlify.app/launch). You can also use a simplified version on mobile.

### Desktop

Windows: Go to the [releases](https://github.com/wpinrui/grasp/releases) page and download the installer or portable exe.

Linux (x64): Versioned desktop releases include an AppImage and a Debian package on the [releases](https://github.com/wpinrui/grasp/releases) page. For the AppImage, enable its executable permission (`chmod +x GRASP-*.AppImage`) before opening it. On Debian or Ubuntu, install the `.deb` with `sudo apt install ./GRASP-*.deb`.

macOS (Apple Silicon and Intel): Download the universal `.dmg` from the [releases](https://github.com/wpinrui/grasp/releases) page, open it, and drag GRASP into Applications.

## SmartScreen and Gatekeeper

Windows or macOS may warn you when you first open GRASP because it has no verified publisher certificate or Apple notarization. Only continue if you downloaded it from the official [releases](https://github.com/wpinrui/grasp/releases) page and trust the app.

### Windows

If SmartScreen says **Windows protected your PC**, select **More info**, then **Run anyway** if available. [Microsoft's guidance](https://github.com/MicrosoftDocs/windows-dev-docs/blob/docs/hub/apps/package-and-deploy/publish-first-app.md).

### macOS

1. Try opening GRASP from Applications.
2. Open **System Settings > Privacy & Security**.
3. Find the notice about GRASP, select **Open Anyway**, and confirm.

[Apple's instructions](https://support.apple.com/en-us/102445). These steps are for an unrecognized developer warning, not a malware alert.

If a school or work device blocks these options, use the [browser version](https://grasp-math.netlify.app/launch) or ask its administrator. Keep system-wide protection enabled.

## Building desktop packages

Install dependencies with `yarn install --frozen-lockfile`, then run the command for your computer:

| Platform | Command | Output |
| --- | --- | --- |
| Windows | `yarn package:win` | x64 installer and portable EXE |
| Linux | `yarn package:linux` | x64 AppImage and Debian package |
| macOS | `yarn package:mac` | Universal DMG for Apple Silicon and Intel |

Packages are saved to `dist/desktop/`.

For releases, the [Release desktop workflow](https://github.com/wpinrui/grasp/actions/workflows/release-desktop.yml) builds all three platforms on demand. Start it against a version tag matching `package.json`, with a draft release and notes already prepared. It publishes the draft only after all builds succeed. Ordinary pushes do not start desktop builds; pushing `deploy` deploys only the website.

## Acknowledgements

GRASP was built with [Claude Code](https://claude.com/claude-code). Claude wrote most of the code and this page; the product decisions, the specification and the review were mine.

## Licence

MIT. See [LICENSE](LICENSE).
