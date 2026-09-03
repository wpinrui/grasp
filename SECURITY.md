# Security

## Reporting a vulnerability

Report it privately, using GitHub's [private vulnerability reporting](https://github.com/wpinrui/grasp/security/advisories/new). That form is the right channel and goes straight to the maintainer.

Please do not open a public issue for a security problem. A public issue tells everybody how to exploit it before there is a version that fixes it.

## What is worth reporting

GRASP opens sketch files that people send each other, and runs scripts inside a sandbox. Those two are where the interesting problems live:

- A script that gets out of the worker it runs in. The worker is the boundary: it has no DOM, no bridge to the app and no way to the main process, so a script that reaches any of those, or the file system, is a real finding. Rebuilding a shadowed global such as `fetch` from inside the worker is not one. That is expected and written down: the shadowing is tidiness on top of the worker, not a seal, and it never claimed to hold.
- A `.grasp` file that does something other than draw when it is opened: reading or writing files it was never given, running a command, or reaching the network.
- Anything that gets Node or Electron APIs within reach of the renderer. The desktop app runs with `contextIsolation` and `sandbox` on and `nodeIntegration` off, so a way around any of those is a real finding.
- In the browser build, anything that crosses a line GRASP draws itself: a sketch loaded through the `sketch` parameter in the address bar from somewhere it should not come from, or a way to read the sketches and file handles that another person using the same browser has stored. A hole in the browser itself is one for the browser vendor rather than for us.

Sketches that come out wrong are ordinary bugs, not security ones. Please raise those as normal issues, where they get more attention rather than less.

## Which versions get fixed

The most recent release. GRASP is small and keeps no maintenance branches, so a fix ships in the next version rather than being backported to older ones.

## What happens after you report

Reports are read and answered. Where one turns out to be real, the fix and the advisory are published together, and the report is credited in the advisory unless you would rather it were not.
