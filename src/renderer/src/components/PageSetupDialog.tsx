import { FITS, type Fit, PAPERS, type PageSetup, type Paper } from "../sketch/paper";
import type { PictureFill, PictureInk } from "../sketch/picture";
import { DialogFrame } from "./DialogFrame";

interface PageSetupDialogProps {
  setup: PageSetup;
  onChange: (setup: PageSetup) => void;
  /** Page Setup on its own only settles the paper; Print acts on it. */
  onApply: () => void;
  onCancel: () => void;
  /** Straight from here to the paper it just set, without a trip to the menu. */
  onPreview: () => void;
}

const PAPER_NAMES: Record<Paper, string> = {
  A4: "A4",
  A3: "A3",
  Letter: "Letter",
  Legal: "Legal",
};

const FIT_NAMES: Record<Fit, string> = {
  page: "Scale to Fit",
  actual: "Actual Size",
};

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
 * Page Setup: what a printed page is, and how the figure is drawn on it. Print
 * and Print Preview both read it, so nothing about paper is said twice.
 */
export function PageSetupDialog({
  setup,
  onChange,
  onApply,
  onCancel,
  onPreview,
}: PageSetupDialogProps) {
  return (
    <DialogFrame
      title="Page Setup"
      action="Done"
      canApply
      wide
      onApply={onApply}
      onCancel={onCancel}
      extra={
        <button type="button" className="dialog__button" onClick={onPreview}>
          Print Preview...
        </button>
      }
    >
      <Group label="Paper:">
        <div className="dialog__row">
          {PAPERS.map((paper) => (
            <Radio
              key={paper}
              name="paper"
              label={PAPER_NAMES[paper]}
              checked={setup.paper === paper}
              onSelect={() => onChange({ ...setup, paper })}
            />
          ))}
        </div>
        <div className="dialog__row">
          <Radio
            name="way"
            label="Portrait"
            checked={!setup.landscape}
            onSelect={() => onChange({ ...setup, landscape: false })}
          />
          <Radio
            name="way"
            label="Landscape"
            checked={setup.landscape}
            onSelect={() => onChange({ ...setup, landscape: true })}
          />
        </div>
      </Group>

      <Group label="Margins:">
        <div className="dialog__field">
          <input
            className="dialog__input"
            value={`${setup.marginCm}`}
            aria-label="Margin"
            onFocus={(event) => event.target.select()}
            onChange={(event) => {
              const wanted = Number.parseFloat(event.target.value);
              onChange({ ...setup, marginCm: Number.isFinite(wanted) ? Math.max(0, wanted) : 0 });
            }}
          />
          <span className="dialog__unit">cm</span>
        </div>
      </Group>

      <Group label="Size:">
        <div className="dialog__row">
          {FITS.map((fit) => (
            <Radio
              key={fit}
              name="fit"
              label={FIT_NAMES[fit]}
              checked={setup.fit === fit}
              onSelect={() => onChange({ ...setup, fit })}
            />
          ))}
        </div>
      </Group>

      <Group label="Ink:">
        <div className="dialog__row">
          {INKS.map((choice) => (
            <Radio
              key={choice.value}
              name="print-ink"
              label={choice.label}
              checked={setup.ink === choice.value}
              onSelect={() => onChange({ ...setup, ink: choice.value })}
            />
          ))}
        </div>
      </Group>

      {/* A label is printed whether its point is or not, the way an export does. */}
      <Group label="Points:">
        <div className="dialog__row">
          <Radio
            name="print-points"
            label="Hidden"
            checked={!setup.points}
            onSelect={() => onChange({ ...setup, points: false })}
          />
          <Radio
            name="print-points"
            label="Shown"
            checked={setup.points}
            onSelect={() => onChange({ ...setup, points: true })}
          />
        </div>
      </Group>

      <Group label="Fill:">
        <div className="dialog__row">
          {FILLS.map((choice) => (
            <Radio
              key={choice.value}
              name="print-fill"
              label={choice.label}
              checked={setup.fill === choice.value}
              onSelect={() => onChange({ ...setup, fill: choice.value })}
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

function Radio({
  name,
  label,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className="dialog__radio">
      <input type="radio" name={name} checked={checked} onChange={onSelect} />
      <span>{label}</span>
    </label>
  );
}
