import { type KeyboardEvent, type MouseEvent, type PointerEvent, useRef, useState } from "react";
import "./PageBar.css";

interface PageBarProps {
  pages: { id: string; name: string }[];
  activeId: string;
  onSelectPage: (id: string) => void;
  onAddPage: () => void;
  onRenamePage: (id: string, name: string) => void;
  onDeletePage: (id: string) => void;
  onDuplicatePage: (id: string) => void;
  onMovePage: (id: string, to: number) => void;
  /** Whether the tabs show at all, which Document Options sets for the sketch. */
  tabs: boolean;
  objectCount: number;
}

/** An open right-click menu: the tab it belongs to, and where it was asked for. */
interface TabMenu {
  id: string;
  x: number;
  y: number;
}

/** A tab being dragged, measured against where the tabs sat when it was picked up. */
interface Drag {
  id: string;
  from: number;
  /** The slot it would land in if it were let go now. */
  to: number;
  /** How far the cursor has moved since the tab was picked up. */
  dx: number;
  lefts: number[];
  widths: number[];
  gap: number;
}

/**
 * The slot the dragged tab would land in: the one whose left edge sits nearest
 * the tab's own, with the tab itself taken out of the row.
 */
function landing(drag: Drag, dx: number): number {
  const want = drag.lefts[drag.from] + dx;
  let slot = drag.lefts[0];
  let best = 0;
  let closest = Math.abs(slot - want);
  for (let k = 1; k < drag.widths.length; k += 1) {
    // The tab that ends up ahead of this slot, the dragged one skipped over.
    const ahead = k - 1 < drag.from ? k - 1 : k;
    slot += drag.widths[ahead] + drag.gap;
    const distance = Math.abs(slot - want);
    if (distance < closest) {
      closest = distance;
      best = k;
    }
  }
  return best;
}

/**
 * Where a tab sits mid-drag: the dragged one keeps up with the cursor, and the
 * ones it has passed slide aside by its width to open the gap it would drop into.
 */
/** Past this much travel the press is a drag rather than a click, jitter aside. */
const DRAG_SLACK = 4;

function shift(drag: Drag, index: number): number {
  if (index === drag.from) return drag.dx;
  const step = drag.widths[drag.from] + drag.gap;
  if (drag.to > drag.from && index > drag.from && index <= drag.to) return -step;
  if (drag.to < drag.from && index >= drag.to && index < drag.from) return step;
  return 0;
}

export function PageBar({
  pages,
  activeId,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
  onDuplicatePage,
  onMovePage,
  tabs,
  objectCount,
}: PageBarProps) {
  /** The tab whose name is being edited, if any. */
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [menu, setMenu] = useState<TabMenu | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  /** Where the cursor was when the tab was picked up. */
  const grabbed = useRef(0);
  /** Whether the press has travelled far enough to be a drag. */
  const moved = useRef(false);

  function startRename(id: string, name: string) {
    setMenu(null);
    setDraft(name);
    setEditing(id);
  }

  /** Enter and clicking away both land the name. An empty one is refused. */
  function commit() {
    if (editing) onRenamePage(editing, draft);
    setEditing(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") commit();
    else if (event.key === "Escape") setEditing(null);
  }

  function openMenu(event: MouseEvent, id: string) {
    event.preventDefault();
    setMenu({ id, x: event.clientX, y: event.clientY });
  }

  /** Pick a tab up, taking the row's measurements while it is still at rest. */
  function startDrag(event: PointerEvent<HTMLButtonElement>, from: number, id: string) {
    moved.current = false;
    if (event.button !== 0 || pages.length < 2 || editing) return;
    const tabs = tabsRef.current?.querySelectorAll<HTMLElement>(".pagebar__tab");
    if (!tabs || tabs.length !== pages.length) return;
    const rects = Array.from(tabs, (tab) => tab.getBoundingClientRect());
    event.currentTarget.setPointerCapture(event.pointerId);
    grabbed.current = event.clientX;
    setDrag({
      id,
      from,
      to: from,
      dx: 0,
      lefts: rects.map((rect) => rect.left),
      widths: rects.map((rect) => rect.width),
      gap: rects[1].left - rects[0].right,
    });
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const dx = event.clientX - grabbed.current;
    if (Math.abs(dx) > DRAG_SLACK) moved.current = true;
    setDrag({ ...drag, dx, to: landing(drag, dx) });
  }

  /** Let go: the page takes the slot the bar has been showing it in. */
  function endDrag() {
    if (!drag) return;
    if (drag.to !== drag.from) onMovePage(drag.id, drag.to);
    setDrag(null);
  }

  /**
   * A click picks the page. A drag only reorders, so it leaves you on the page
   * you were on, whichever way along the bar the tab went.
   */
  function pickPage(id: string) {
    if (moved.current) return;
    onSelectPage(id);
  }

  const menuPage = menu ? pages.find((page) => page.id === menu.id) : undefined;

  return (
    <div className="pagebar">
      {/* With the tabs put away the bar keeps its count and nothing else, and
          pages are reached through Document Options or a Link button. */}
      <div className="pagebar__tabs" ref={tabsRef} hidden={!tabs}>
        {pages.map((page, index) =>
          editing === page.id ? (
            <input
              key={page.id}
              className="pagebar__rename"
              value={draft}
              // biome-ignore lint/a11y/noAutofocus: it replaces the tab that was just double clicked
              autoFocus
              aria-label="Page name"
              onChange={(event) => setDraft(event.target.value)}
              onFocus={(event) => event.target.select()}
              onBlur={commit}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <button
              type="button"
              key={page.id}
              className={`pagebar__tab${page.id === activeId ? " pagebar__tab--active" : ""}${
                menu?.id === page.id ? " pagebar__tab--menu" : ""
              }${drag?.id === page.id ? " pagebar__tab--dragging" : ""}${
                drag && drag.id !== page.id ? " pagebar__tab--sliding" : ""
              }`}
              style={drag ? { transform: `translateX(${shift(drag, index)}px)` } : undefined}
              onPointerDown={(event) => startDrag(event, index, page.id)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={() => setDrag(null)}
              onClick={() => pickPage(page.id)}
              onDoubleClick={() => startRename(page.id, page.name)}
              onContextMenu={(event) => openMenu(event, page.id)}
            >
              {page.name}
            </button>
          ),
        )}
        <button
          type="button"
          className="pagebar__add"
          aria-label="Add page"
          title="Add page"
          onClick={onAddPage}
        >
          +
        </button>
      </div>
      <div className="pagebar__spacer" />
      <div className="pagebar__readout">
        <span>{objectCount === 1 ? "1 object" : `${objectCount} objects`}</span>
      </div>

      {menu && menuPage && (
        <>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: dismiss layer, the entries stay reachable */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: the entries are buttons and take the keyboard themselves */}
          <div
            className="pagebar__dismiss"
            onClick={() => setMenu(null)}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenu(null);
            }}
          />
          {/* The bar sits at the bottom of the window, so the menu opens upward. */}
          <div
            className="pagebar__menu"
            style={{ left: `${menu.x}px`, bottom: `${window.innerHeight - menu.y}px` }}
          >
            <button
              type="button"
              className="pagebar__menu-item"
              onClick={() => startRename(menuPage.id, menuPage.name)}
            >
              Rename
            </button>
            <button
              type="button"
              className="pagebar__menu-item"
              onClick={() => {
                setMenu(null);
                onDuplicatePage(menuPage.id);
              }}
            >
              Duplicate
            </button>
            <button
              type="button"
              className="pagebar__menu-item"
              // A sketch always has a page, so the last one cannot go.
              disabled={pages.length < 2}
              onClick={() => {
                setMenu(null);
                onDeletePage(menuPage.id);
              }}
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
