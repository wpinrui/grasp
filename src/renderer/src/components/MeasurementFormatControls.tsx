import type { LinkFormat } from "../sketch/captionLinks";
import { PLACES } from "../sketch/prefs";
import { FewerPlacesIcon, MorePlacesIcon } from "./icons";
import { PanelButton } from "./MarkPanelShell";

interface MeasurementFormatControlsProps {
  format: LinkFormat;
  units: readonly string[];
  unitLabel: string;
  onPreview?: (change: Partial<LinkFormat>) => void;
  onChange: (change: Partial<LinkFormat>) => void;
}

/** Display settings shared by standalone readings and caption links. */
export function MeasurementFormatControls({
  format,
  units,
  unitLabel,
  onChange,
  onPreview,
}: MeasurementFormatControlsProps) {
  return (
    <>
      {units.length > 0 && (
        <>
          <PanelButton
            label="Show units"
            on={format.showUnit}
            onPreview={() => onPreview?.({ showUnit: !format.showUnit })}
            onClick={() => onChange({ showUnit: !format.showUnit })}
          >
            u
          </PanelButton>
          <select
            className="caption-link-unit"
            aria-label={unitLabel}
            value={format.unit}
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) => onChange({ unit: event.target.value })}
          >
            {units.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </>
      )}
      <PanelButton
        label="One fewer decimal place"
        tip={`One fewer decimal place (${format.places} now)`}
        disabled={format.places <= PLACES[0]}
        onPreview={() => onPreview?.({ places: format.places - 1 })}
        onClick={() => onChange({ places: format.places - 1 })}
      >
        <FewerPlacesIcon />
      </PanelButton>
      <PanelButton
        label="One more decimal place"
        tip={`One more decimal place (${format.places} now)`}
        disabled={format.places >= PLACES[PLACES.length - 1]}
        onPreview={() => onPreview?.({ places: format.places + 1 })}
        onClick={() => onChange({ places: format.places + 1 })}
      >
        <MorePlacesIcon />
      </PanelButton>
    </>
  );
}
