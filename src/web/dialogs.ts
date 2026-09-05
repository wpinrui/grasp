/**
 * The prompts the desktop app gets from the operating system.
 *
 * A tab has none of those: `window.confirm` cannot offer three answers, and
 * what it does offer is drawn by the browser rather than by GRASP. So these are
 * drawn here, over the sheet, in GRASP's own chrome, and each one answers with
 * a promise the way the main process's dialogs do.
 */

/** One button on a prompt: what it says, and what it answers with. */
interface Choice<T> {
  label: string;
  answer: T;
  /** The one the Enter key takes, drawn as the button that stands out. */
  primary?: boolean;
}

/** Put a prompt up and hand back what was pressed. Escape takes the last one. */
function ask<T>(message: string, choices: Choice<T>[]): Promise<T> {
  return new Promise<T>((answer) => {
    const shade = document.createElement("div");
    shade.className = "web-prompt scrim";
    const box = document.createElement("div");
    box.className = "web-prompt__box scrim__panel";
    const said = document.createElement("p");
    said.className = "web-prompt__text";
    said.textContent = message;
    const row = document.createElement("div");
    row.className = "web-prompt__row";

    function done(with_: T) {
      document.removeEventListener("keydown", key, true);
      shade.remove();
      answer(with_);
    }

    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        done(choices[choices.length - 1].answer);
      }
      if (event.key === "Enter") {
        const first = choices.find((choice) => choice.primary) ?? choices[0];
        event.preventDefault();
        done(first.answer);
      }
    }

    for (const choice of choices) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `web-prompt__key${choice.primary ? " web-prompt__key--on" : ""}`;
      button.textContent = choice.label;
      button.addEventListener("click", () => done(choice.answer));
      row.appendChild(button);
    }

    box.append(said, row);
    shade.appendChild(box);
    document.body.appendChild(shade);
    document.addEventListener("keydown", key, true);
    (row.firstElementChild as HTMLElement | null)?.focus();
  });
}

/** The three-way unsaved-changes question, the same one the desktop app asks. */
export function askUnsaved(name: string): Promise<"save" | "discard" | "cancel"> {
  return ask<"save" | "discard" | "cancel">(`Save changes to ${name}?`, [
    { label: "Save", answer: "save", primary: true },
    { label: "Don't Save", answer: "discard" },
    { label: "Cancel", answer: "cancel" },
  ]);
}

export function askDeletePage(name: string): Promise<boolean> {
  return ask<boolean>(`This will delete ${name}. It cannot be undone.`, [
    { label: "Delete", answer: true },
    { label: "Cancel", answer: false, primary: true },
  ]);
}

export function sayError(message: string): Promise<void> {
  return ask<void>(message, [{ label: "OK", answer: undefined, primary: true }]);
}
