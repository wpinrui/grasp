import { useEffect } from "react";
import { type PageSetup, PX_PER_CM, paperSize, printableArea, sheetsFor } from "../sketch/paper";
import type { Drawn } from "../sketch/picture";
import "./PrintPreviewDialog.css";

/** How much room the sheets are drawn in, in pixels. */
const STAGE = { width: 660, height: 460 };

/** Millimetres to the centimetre, since page setup holds paper in millimetres. */
const MM_PER_CM = 10;

/** The gap drawn between one sheet and the next, in pixels. */
const SHEET_GAP = 10;

interface PrintPreviewDialogProps {
  setup: PageSetup;
  /** The figure as it will print, or null when the page has nothing on it. */
  picture: Drawn | null;
  onPrint: () => void;
  onSetup: () => void;
  onClose: () => void;
}

/**
 * Print Preview: every sheet that will come out of the printer, the margins on
 * each, and the figure where it will land. It is drawn from the same picture
 * Print sends and the same Page Setup, so the two cannot disagree.
 *
 * Scaled to fit is one sheet with the figure shrunk onto it. At its own size it
 * is as many sheets as the figure needs, laid out the way they will print.
 */
export function PrintPreviewDialog({
  setup,
  picture,
  onPrint,
  onSetup,
  onClose,
}: PrintPreviewDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const paper = paperSize(setup);
  const area = printableArea(setup);
  const sheets = sheetsFor(setup, picture?.width ?? 0, picture?.height ?? 0);
  const full = {
    width: (paper.width / MM_PER_CM) * PX_PER_CM,
    height: (paper.height / MM_PER_CM) * PX_PER_CM,
  };

  // Every sheet is drawn at one scale, and they all have to fit the stage.
  const gap = SHEET_GAP;
  const wide = full.width * sheets.across + gap * (sheets.across - 1);
  const tall = full.height * sheets.down + gap * (sheets.down - 1);
  const shown = Math.min(STAGE.width / wide, STAGE.height / tall);
  const margin = setup.marginCm * PX_PER_CM * shown;

  const pages: { row: number; column: number }[] = [];
  for (let row = 0; row < sheets.down; row += 1) {
    for (let column = 0; column < sheets.across; column += 1) pages.push({ row, column });
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a dismiss layer, the card inside takes the focus
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it, from the window listener above
    <div className="preview__scrim scrim" onClick={onClose}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: it only stops the press reaching the layer behind */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: it swallows a press rather than doing anything */}
      <div className="preview scrim__panel" onClick={(event) => event.stopPropagation()}>
        <div className="preview__bar">
          <span className="preview__title">Print Preview</span>
        </div>

        <div
          className="preview__stage"
          style={{ width: `${STAGE.width}px`, height: `${STAGE.height}px` }}
        >
          <div
            className="preview__sheets"
            style={{
              gridTemplateColumns: `repeat(${sheets.across}, ${full.width * shown}px)`,
              gap: `${gap * shown}px`,
            }}
          >
            {pages.map((page) => (
              <div
                key={`${page.row}-${page.column}`}
                className="preview__sheet"
                style={{ width: `${full.width * shown}px`, height: `${full.height * shown}px` }}
              >
                <div className="preview__margins" style={{ inset: `${margin}px` }}>
                  {picture && (
                    <div
                      className={`preview__figure preview__figure--${setup.fit}`}
                      style={
                        setup.fit === "actual"
                          ? {
                              position: "absolute",
                              left: `${-page.column * area.width * shown}px`,
                              top: `${-page.row * area.height * shown}px`,
                              width: `${picture.width * shown}px`,
                              height: `${picture.height * shown}px`,
                            }
                          : undefined
                      }
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: the picture GRASP drew itself, off its own sheet
                      dangerouslySetInnerHTML={{ __html: picture.svg }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="preview__buttons">
          <span className="preview__gap" />
          <button type="button" className="dialog__button" onClick={onClose}>
            Close
          </button>
          <button type="button" className="dialog__button" onClick={onSetup}>
            Page Setup...
          </button>
          <button
            type="button"
            className="dialog__button dialog__button--go"
            disabled={!picture}
            onClick={onPrint}
          >
            Print...
          </button>
        </div>
      </div>
    </div>
  );
}
