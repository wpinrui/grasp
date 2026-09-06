# <img src="docs/images/icon-title.png" width="32" align="middle" alt=""> GRASP

**G**RASP **R**enders **A**ll **S**ketches **P**recisely.

A free and open-source geometry sketchpad for your classroom. Draw accurate figures, measure them, produce visual proofs. Help your students grasp geometric intuition.

[Try GRASP in your browser](https://grasp-math.netlify.app), or download a desktop release for Windows, macOS, or Linux.

![The GRASP window: a labelled triangle with its angles, side and area measured](docs/images/window.png)

## Dynamic measurements

Drag one corner and every angle, length and area recalculates. Students can see how each change affects the bigger picture of your geometry.

## Intuitive interface

Enjoy creating sketches with a user-first set of panels. Iterate rapidly with keyboard shortcuts to activate the exact tool you need. Plain clicks toggle individual objects or labels without clearing the other selections. Drag a selection box to include both, press Escape to clear both, or use Select All for visible items allowed by the Arrow filter. Selected labels move together independently of their parent objects.

Selected lines combine a blue highlight with thin blue dashed outlines, and selected fills have parallel 45-degree stripes, 5px wide, that darken the displayed fill by 15%, without accumulating extra darkness where selections overlap.

## Features

- **Construct.** Points, segments, rays, lines, circles, arcs and fills. Midpoints, intersections, parallels, perpendiculars, angle bisectors, regular polygons, points that slide along a path, and loci.
- **Transform.** Translate, rotate, dilate and reflect to create more advanced sketches.
- **Measure.** Keep track of lengths, areas, angles, ratios and more as you iterate your sketch. The Measure menu can create multiple measurements of the same object; the Measure tool reuses its own existing reading.
- **Captions.** With nothing else selected, double-click a caption to switch to the Text tool and edit it. The palette has direct buttons for +, −, ×, ÷, fractions, ∠, °, ≤, ≥, <, and >, with more choices in Notation and Symbols. Stacked fractions grow to fit their numerator and denominator and reserve enough line spacing. In a fraction, Tab moves from numerator to denominator, then out into the sentence. Right Arrow at the end also exits; Shift+Tab or Left Arrow at the start moves out before it. Click a measurement while writing a caption to insert a dynamic link, then continue typing after it. Click a link inside the caption to change its rounding, choose its unit, or hide the unit using the floating toolbar. These settings affect only that link. Each caption has one colour, set from the palette, shared by all its text, fractions, and measurement links.
- **Numbers.** Set parameters, do step-by-step calculations and watch them update.
- **Mark up.** Label sides of a polygon as equal, parallel, or add angle arcs for more polished classroom demos or for worksheet printing.
- **Export.** Export a selection or a page to an image file or to your clipboard. Optimise it for your printed worksheet or your colourful slideshow.

Caption font, size, bold, italic, and underline formatting applies to dynamic measurement links as well as ordinary text. Select a caption to format it as a whole, or select text while editing to format that selection.

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
