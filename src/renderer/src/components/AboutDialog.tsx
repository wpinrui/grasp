import iconUrl from "@resources/icon.png";
import { useEffect } from "react";
import "./AboutDialog.css";

/** Where GRASP lives. The main process only opens addresses it knows. */
const HOME = "https://github.com/wpinrui/grasp";

/**
 * About GRASP: the mark, what GRASP is, what it was built as, and the way to
 * the source. It sits over the middle of the window rather than beside it,
 * since there is nothing to do underneath while it is up.
 */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" && event.key !== "Enter") return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const versions = window.api.versions;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a dismiss layer, the card inside takes the focus
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it, from the window listener above
    <div className="about__scrim scrim" onClick={onClose}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: it only stops the press reaching the layer behind */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: it swallows a press rather than doing anything */}
      <div className="about scrim__panel" onClick={(event) => event.stopPropagation()}>
        <img className="about__logo" src={iconUrl} alt="" />
        <h1 className="about__name">GRASP</h1>
        <p className="about__tagline">GRASP Renders All Sketches Precisely.</p>
        <p className="about__version">Version {window.api.about.version()}</p>

        <button
          type="button"
          className="about__link"
          onClick={() => void window.api.about.openLink(HOME)}
        >
          github.com/wpinrui/grasp
        </button>

        {/* What GRASP is running on. A tab is running on the browser, which
            says so itself, so on the web this line has nothing to add. */}
        {window.api.platform !== "web" && (
          <p className="about__built">
            Electron {versions.electron}, Chromium {versions.chrome}, Node {versions.node}
          </p>
        )}
        <p className="about__licence">MIT licensed.</p>

        <button type="button" className="about__close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
