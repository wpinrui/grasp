# Security

## Reporting a vulnerability

Report privately through GitHub's [private vulnerability reporting](https://github.com/wpinrui/grasp/security/advisories/new). Do not open a public issue for a security problem.

## What is worth reporting

GRASP opens sketch files that people send each other, and runs scripts in a sandbox.

- A script that escapes its worker. The worker has no DOM, no bridge to the app and no path to the main process, so anything reaching those or the file system is a finding. Rebuilding a shadowed global such as `fetch` inside the worker is not. The shadowing is tidiness on top of the worker, not a seal, and never claimed to hold.
- A `.grasp` file that does anything but draw when opened: reading or writing files it was not given, running a command, or reaching the network.
- Anything that puts Node or Electron interfaces within reach of the renderer. The desktop app runs with `contextIsolation` and `sandbox` on and `nodeIntegration` off, so a way around any of those is a finding.
- In the browser build, anything that crosses a line GRASP draws itself: a sketch loaded through the `sketch` address bar parameter from somewhere it should not come from, or a way to read the sketches and file handles another person has stored in the same browser. A hole in the browser itself belongs to the browser vendor.

## Which versions get fixed

The most recent release. GRASP keeps no maintenance branches, so a fix ships in the next version rather than being backported.

## What happens after you report

Reports are read and answered. Where one turns out to be real, the fix and the advisory are published together. You are credited in the advisory unless you would rather not be.
