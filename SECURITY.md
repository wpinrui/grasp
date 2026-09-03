# Security

## Reporting a vulnerability

Report it privately, using GitHub's [private vulnerability reporting](https://github.com/wpinrui/grasp/security/advisories/new). That form is the right channel and goes straight to the maintainer.

Please do not open a public issue for a security problem. A public issue tells everybody how to exploit it before there is a version that fixes it.

## What is worth reporting

GRASP opens sketch files that people send each other, and runs scripts inside a sandbox. Those two are where the interesting problems live:

- A script that escapes the scripting sandbox and reaches anything beyond the sketch it was asked to draw.
- A `.grasp` file that does something other than draw when it is opened: reading or writing files it was never given, running a command, or reaching the network.
- Anything that gets Node or Electron APIs within reach of the renderer. The desktop app runs with `contextIsolation` and `sandbox` on and `nodeIntegration` off, so a way around any of those is a real finding.
- Anything in the browser build that escapes the tab it is running in.

Sketches that come out wrong are ordinary bugs, not security ones. Please raise those as normal issues, where they get more attention rather than less.

## Which versions get fixed

The most recent release. GRASP is small and keeps no maintenance branches, so a fix ships in the next version rather than being backported to older ones.

## What happens after you report

Reports are read and answered. Where one turns out to be real, the fix and the advisory are published together, and the report is credited in the advisory unless you would rather it were not.
