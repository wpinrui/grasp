import { useState } from "react";
import type { ButtonAction } from "../sketch/model";
import { DialogFrame } from "./DialogFrame";
import "./ButtonDialog.css";

/** Which kind of button is being made, before it knows what it will say. */
export type ButtonForm = ButtonAction["form"];

const TITLES: Record<ButtonForm, string> = {
  "hide-show": "Hide/Show Button",
  link: "Link Button",
  scroll: "Scroll Button",
  present: "Presentation Button",
};

const NAMES: Record<ButtonForm, string> = {
  "hide-show": "Hide",
  link: "Go to page",
  scroll: "Show me",
  present: "Present",
};

interface ButtonDialogProps {
  form: ButtonForm;
  /** What the button would act on, so the dialog can say how much that is. */
  count: number;
  /** The pages this sketch holds, for a Link button to choose between. */
  pages: { id: string; name: string }[];
  onApply: (name: string, does: ButtonAction) => void;
  onCancel: () => void;
}

/**
 * What a new action button needs to know: what to call it, and the one choice
 * its kind leaves open.
 *
 * The reference asks this through a Properties panel that can be reopened.
 * GRASP has no Properties, so the choice is made once, here, where it is made
 * rather than somewhere else afterwards.
 */
export function ButtonDialog({ form, count, pages, onApply, onCancel }: ButtonDialogProps) {
  const [name, setName] = useState(NAMES[form]);
  const [does, setDoes] = useState<"toggle" | "hide" | "show">("toggle");
  const [to, setTo] = useState<"centre" | "corner">("centre");
  const [order, setOrder] = useState<"together" | "in-turn">("in-turn");
  const [page, setPage] = useState(pages[0]?.id ?? "");
  const wanted = name.trim();
  const good = wanted !== "" && (form !== "link" || page !== "");

  function apply() {
    if (form === "hide-show") onApply(wanted, { form, of: [], does });
    else if (form === "scroll") onApply(wanted, { form, point: "", to });
    else if (form === "present") onApply(wanted, { form, of: [], order });
    else onApply(wanted, { form, page });
  }

  return (
    <DialogFrame
      title={TITLES[form]}
      action="Add"
      canApply={good}
      onApply={() => good && apply()}
      onCancel={onCancel}
    >
      <label className="button-dialog__row">
        <span className="button-dialog__name">Says</span>
        <input
          className="button-dialog__field"
          // biome-ignore lint/a11y/noAutofocus: what it says is the first thing to settle
          autoFocus
          value={name}
          aria-label="What the button says"
          onChange={(event) => setName(event.target.value)}
          onFocus={(event) => event.target.select()}
        />
      </label>

      {form === "hide-show" && (
        <Choice
          legend="Pressing it"
          of={[
            ["toggle", "Puts them away and brings them back"],
            ["hide", "Only puts them away"],
            ["show", "Only brings them back"],
          ]}
          picked={does}
          onPick={(next) => setDoes(next as "toggle" | "hide" | "show")}
        />
      )}

      {form === "scroll" && (
        <Choice
          legend="Brings the point"
          of={[
            ["centre", "To the middle of the window"],
            ["corner", "To the top left corner"],
          ]}
          picked={to}
          onPick={(next) => setTo(next as "centre" | "corner")}
        />
      )}

      {form === "present" && (
        <Choice
          legend="Presses them"
          of={[
            ["in-turn", "One after another"],
            ["together", "All at once"],
          ]}
          picked={order}
          onPick={(next) => setOrder(next as "together" | "in-turn")}
        />
      )}

      {form === "link" && (
        <Choice
          legend="Goes to"
          of={pages.map((one) => [one.id, one.name] as [string, string])}
          picked={page}
          onPick={setPage}
        />
      )}

      <p className="button-dialog__note">
        {form === "hide-show" && `${count} ${count === 1 ? "object" : "objects"}.`}
        {form === "present" && `${count} ${count === 1 ? "button" : "buttons"}.`}
        {form === "scroll" && "The point it was made on."}
        {form === "link" && "A link out of the app is not built: only pages of this sketch."}
      </p>
    </DialogFrame>
  );
}

function Choice({
  legend,
  of,
  picked,
  onPick,
}: {
  legend: string;
  of: [string, string][];
  picked: string;
  onPick: (value: string) => void;
}) {
  return (
    <fieldset className="dialog__group">
      <legend className="dialog__legend">{legend}</legend>
      {of.map(([value, said]) => (
        <label className="button-dialog__choice" key={value}>
          <input type="radio" checked={picked === value} onChange={() => onPick(value)} />
          <span>{said}</span>
        </label>
      ))}
    </fieldset>
  );
}
