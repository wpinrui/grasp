# Hover previews

Hover previews show what a control would do before it is clicked. They leave the document, selection, undo history, and tool defaults unchanged. Moving away restores the original appearance. Appearance previews also clear on a press, keyboard action, window blur, or document change. Supported palette and panel buttons offer the same preview on keyboard focus.

New objects use translucent ghosts so they are distinguishable from the existing figure. Settings that change existing objects use their actual appearance: fading a colour, stroke, or font would make it harder to judge. Visibility controls show the resulting visibility while the control stays in place.

| Area | Preview |
| --- | --- |
| Point, Compass, Straightedge, Polygon | A ghost point shows where a new point would land, including snapping. Existing points retain their snap ring. After the first click, Compass shows its circle, Straightedge shows the full segment, ray, or line, and Polygon shows its developing outline and fill. |
| Arrow | Highlights the object that would be picked, respecting the active filter. |
| Measure | Shows the reading and any required angle mark, or highlights the tool's existing reading. Ambiguous angles retain the corner indication and angle chooser. |
| Marker | Shows a ghost of a new side mark or highlights the existing mark whose panel would open. Angle marking retains its corner and gesture previews. |
| Text | Relabel runs preview the next letter; caption drags preview their box. The cursor distinguishes labelling from starting a caption. |
| Construct and Measure menus | Ghosts of the objects or readings that the current selection would create. Construction role labels identify inputs where order matters. |
| Transform menu | Ghosts for Translate, Rotate, Dilate, and Reflect when their saved inputs are sufficient. Custom transforms show their visible result while keeping intermediate construction dependencies hidden. Transform and Iterate dialogs retain their existing previews. |
| Display menu | Actual point size, label visibility, and object visibility. |
| Palette | Actual colour, weight, pattern, font, size, bold, italic, underline, and caption alignment on eligible selected objects or labels. |
| Labels panel | Label visibility for individual objects, groups, selected objects, or the page. Row hover also identifies the corresponding object. |
| Hidden panel | Individual, group, and Show all visibility, plus the whole-kind Markings and Text switches. Row hover retains its existing object ghost. |
| Mark panel | Stroke count, direction, equal/parallel form, square/arc form, and reflex angle. Associated angle readings follow the same rules as a click. |
| Reading panel | Dimension arrow layout, extension lines, decimal places, unit-suffix visibility, and reflex angle. The panel remains anchored while its reading is previewed. |

## Deliberate exceptions

- **Missing inputs:** a regular polygon needs its parameters; a rotation or dilation needs its centre; a reflection needs its mirror. A complete result is not guessed before those inputs are known.
- **Editing at a caret:** formatting selected text runs and inserting symbols, notation, or linked readings operate on the live editor selection. Hovering does not alter that selection or rewrite the editor DOM. Appearance previews are suspended while a caption is being edited, so visibility changes cannot unmount the live editor. Closed, selected captions support whole-object style previews.
- **Native unit dropdowns and caption-link controls:** native option hover is not reliably exposed across platforms. Caption-link formatting operates inside the live editor. These controls retain their current click/change behavior.
- **Future behavior:** arming a style with no selected target, Label new points, snapping preferences, and tying a reading to its figure do not necessarily change anything visible immediately. Their controls show the current setting; hovering does not create a sample object or move the figure to demonstrate it.
- **Structural and destructive commands:** undo/redo, cut/paste, deletion, Split/Merge, table data changes, and definition editing retain explicit actions. Replaying these as hover effects could obscure their targets or imply changes to dependency structure or history.
- **Document and application operations:** file operations, export, printing, scripts, panel layout, and navigation remain explicit actions. Print Preview retains its dedicated view.
