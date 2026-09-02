import type { PictureBackground, PictureFill, PictureInk, PictureOptions } from "../sketch/picture";
import { DialogFrame } from "./DialogFrame";

/** Where the picture goes, which is the only thing the two exports differ by. */
export type ExportTo = "file" | "clipboard";

interface ExportDialogProps {
  to: ExportTo;
  options: PictureOptions;
  onChange: (options: PictureOptions) => void;
  onApply: () => void;
  onCancel: () => void;
}

const BACKGROUNDS: { value: PictureBackground; label: string }[] = [
  { value: "white", label: "White" },
  { value: "transparent", label: "Transparent" },
];

const INKS: { value: PictureInk; label: string }[] = [
  { value: "colour", label: "As Coloured" },
  { value: "black", label: "Pure Black" },
  { value: "white", label: "Pure White" },
];

const FILLS: { value: PictureFill; label: string }[] = [
  { value: "hidden", label: "Hidden" },
  { value: "colour", label: "In Colour" },
  { value: "grey", label: "In Grey" },
  { value: "black", label: "In Black" },
  { value: "white", label: "In White" },
];

/**
 * How the picture is drawn. The same dialog either way: the only difference is
 * whether the picture comes out as a file or on the clipboard.
 */
export function ExportDialog({ to, options, onChange, onApply, onCancel }: ExportDialogProps) {
  return (
    <DialogFrame
      title={to === "clipboard" ? "Export Image to Clipboard" : "Export Image to File"}
      action={to === "clipboard" ? "Copy" : "Save..."}
      canApply
      onApply={onApply}
      onCancel={onCancel}
    >
      <Group label="Background:">
        <div className="dialog__row">
          {BACKGROUNDS.map((choice) => (
            <Radio
              key={choice.value}
              name="background"
              label={choice.label}
              checked={options.background === choice.value}
              onSelect={() => onChange({ ...options, background: choice.value })}
            />
          ))}
        </div>
      </Group>

      <Group label="Ink:">
        <div className="dialog__row">
          {INKS.map((choice) => (
            <Radio
              key={choice.value}
              name="ink"
              label={choice.label}
              checked={options.ink === choice.value}
              onSelect={() => onChange({ ...options, ink: choice.value })}
            />
          ))}
        </div>
      </Group>

      {/* A label stays whether its point is drawn or not, so a figure can name
          its corners with no dots on them. */}
      <Group label="Points:">
        <div className="dialog__row">
          <Radio
            name="points"
            label="Hidden"
            checked={!options.points}
            onSelect={() => onChange({ ...options, points: false })}
          />
          <Radio
            name="points"
            label="Shown"
            checked={options.points}
            onSelect={() => onChange({ ...options, points: true })}
          />
        </div>
      </Group>

      <Group label="Fill:">
        <div className="dialog__row">
          {FILLS.map((choice) => (
            <Radio
              key={choice.value}
              name="fill"
              label={choice.label}
              checked={options.fill === choice.value}
              onSelect={() => onChange({ ...options, fill: choice.value })}
            />
          ))}
        </div>
      </Group>
    </DialogFrame>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="dialog__group">
      <legend className="dialog__legend">{label}</legend>
      {children}
    </fieldset>
  );
}

interface RadioProps {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}

function Radio({ name, label, checked, onSelect }: RadioProps) {
  return (
    <label className="dialog__radio">
      <input type="radio" name={name} checked={checked} onChange={onSelect} />
      <span>{label}</span>
    </label>
  );
}
