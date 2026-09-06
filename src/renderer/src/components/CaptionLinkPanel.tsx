import { type RefObject, useEffect, useState } from "react";
import { type CaptionReading, type LinkFormat, linkFormat } from "../sketch/captionLinks";
import { PLACES } from "../sketch/prefs";
import { FewerPlacesIcon, MorePlacesIcon } from "./icons";
import { PanelButton, PanelShell } from "./MarkPanelShell";

/** Select a whole atomic link so both the text palette and its panel address it. */
export function selectCaptionLink(link: Element) {
  const range = document.createRange();
  range.selectNode(link);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
}

function chosenLink(editor: HTMLElement | null): HTMLElement | null {
  const selection = window.getSelection();
  if (!editor || !selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return null;
  const links = [...editor.querySelectorAll<HTMLElement>("[data-link]")];
  const chosen = links.filter((link) => range.intersectsNode(link));
  return chosen.length === 1 && range.toString() === chosen[0].textContent ? chosen[0] : null;
}

interface CaptionLinkPanelProps {
  editor: RefObject<HTMLDivElement | null>;
  readings: Map<string, CaptionReading>;
  onCommit: () => void;
}

export function CaptionLinkPanel({ editor, readings, onCommit }: CaptionLinkPanelProps) {
  const [link, setLink] = useState<HTMLElement | null>(null);
  const [, redraw] = useState(0);
  useEffect(() => {
    const follow = () => setLink(chosenLink(editor.current));
    follow();
    document.addEventListener("selectionchange", follow);
    return () => document.removeEventListener("selectionchange", follow);
  }, [editor]);
  const reading =
    link && editor.current?.contains(link) ? readings.get(link.dataset.link ?? "") : undefined;
  if (!link || !reading) return null;
  const format = linkFormat(link, reading);
  const box = link.getBoundingClientRect();
  const parent = editor.current?.parentElement?.getBoundingClientRect();
  if (!parent) return null;

  function change(part: Partial<LinkFormat>) {
    if (!link || !reading) return;
    if (part.places !== undefined) link.dataset.places = String(part.places);
    if (part.unit !== undefined) link.dataset.unit = part.unit;
    if (part.showUnit !== undefined) link.dataset.showUnit = String(part.showUnit);
    link.textContent = reading.value(linkFormat(link, reading));
    editor.current?.focus();
    selectCaptionLink(link);
    onCommit();
    redraw((value) => value + 1);
  }

  return (
    <PanelShell
      at={{ x: box.left - parent.left + box.width / 2, y: box.top - parent.top - 8 }}
      colour="var(--color-tool-measure)"
    >
      {reading.units.length > 0 && (
        <>
          <PanelButton
            label="Show units"
            on={format.showUnit}
            onClick={() => change({ showUnit: !format.showUnit })}
          >
            u
          </PanelButton>
          <select
            className="caption-link-unit"
            aria-label="Link unit"
            value={format.unit}
            onMouseDown={(event) => event.stopPropagation()}
            onChange={(event) => change({ unit: event.target.value })}
          >
            {reading.units.map((unit) => (
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
        onClick={() => change({ places: format.places - 1 })}
      >
        <FewerPlacesIcon />
      </PanelButton>
      <PanelButton
        label="One more decimal place"
        tip={`One more decimal place (${format.places} now)`}
        disabled={format.places >= PLACES[PLACES.length - 1]}
        onClick={() => change({ places: format.places + 1 })}
      >
        <MorePlacesIcon />
      </PanelButton>
    </PanelShell>
  );
}
