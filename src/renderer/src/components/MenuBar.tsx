import { useState } from "react";
import { usePhone } from "../phone";
import { MenuCheckIcon, SubmenuArrowIcon } from "./icons";
import {
  customItems,
  isImplemented,
  type MenuAction,
  type MenuEntry,
  type MenuItem,
  recentItems,
  shownItems,
  shownMenus,
} from "./menus";
import "./MenuBar.css";

interface MenuBarProps {
  openMenu: string | null;
  onOpenMenu: (menu: string | null) => void;
  onAction: (action: MenuAction) => void;
  /** Whether the entry carries a tick right now. */
  isTicked: (action: MenuAction) => boolean;
  /** False greys the entry out: it has nothing to act on. */
  isEnabled: (action: MenuAction) => boolean;
  /** The entry under the pointer, so the sheet can show what it would build. */
  onHoverAction: (action: MenuAction | null) => void;
  /** The sketches opened or saved most recently, newest first. */
  recent: string[];
  /** The custom transforms, which the Transform menu grows an entry each for. */
  transforms: { id: string; name: string }[];
  /**
   * What to call an entry instead of its own label, for the ones that say what
   * they would do to the selection rather than naming a pair of things.
   */
  labels: Partial<Record<MenuAction, string>>;
  /** The sparkle button, which asks a language model for a figure. */
  onAsk: () => void;
  /** The button beside it, which takes a script straight. */
  onScript: () => void;
}

export function MenuBar({
  openMenu,
  onOpenMenu,
  onAction,
  isTicked,
  isEnabled,
  onHoverAction,
  recent,
  transforms,
  labels,
  onAsk,
  onScript,
}: MenuBarProps) {
  const phone = usePhone();
  return (
    <div className="menubar">
      {shownMenus(phone).map((menu) => (
        <div className="menubar__anchor" key={menu.label}>
          <button
            type="button"
            className={`menubar__item${openMenu === menu.label ? " menubar__item--open" : ""}`}
            aria-expanded={openMenu === menu.label}
            onClick={() => onOpenMenu(openMenu === menu.label ? null : menu.label)}
            onMouseEnter={() => openMenu && onOpenMenu(menu.label)}
          >
            {menu.label}
          </button>
          {openMenu === menu.label && (
            <Flyout
              items={shownItems(
                menu.label === "Transform"
                  ? [...menu.items, ...customItems(transforms)]
                  : menu.items,
                phone,
              )}
              recent={recent}
              isTicked={isTicked}
              isEnabled={isEnabled}
              labels={labels}
              onHoverAction={onHoverAction}
              onAction={(action) => {
                onOpenMenu(null);
                onAction(action);
              }}
            />
          )}
        </div>
      ))}
      <div className="menubar__spacer" />
      <button
        type="button"
        className="menubar__tool"
        title="Ask an AI for a figure"
        onClick={onAsk}
      >
        <SparkleIcon />
        AI
      </button>
      {!phone && (
        <button type="button" className="menubar__tool" title="Run a script" onClick={onScript}>
          <ScriptIcon />
          Script
        </button>
      )}
    </div>
  );
}

/** The sparkles the AI button is marked with. */
function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      <path d="M8 1.2 9.3 5 13 6.3 9.3 7.6 8 11.4 6.7 7.6 3 6.3 6.7 5Z" />
      <path d="M12.6 9.6 13.2 11.4 15 12l-1.8.6-.6 1.8-.6-1.8L10.2 12l1.8-.6Z" />
    </svg>
  );
}

/** Angle brackets, for the button that takes a script straight. */
function ScriptIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 4 2.5 8 6 12" />
      <path d="M10 4 13.5 8 10 12" />
    </svg>
  );
}

interface FlyoutProps {
  items: MenuEntry[];
  isTicked: (action: MenuAction) => boolean;
  onAction: (action: MenuAction) => void;
  isEnabled: (action: MenuAction) => boolean;
  onHoverAction: (action: MenuAction | null) => void;
  recent: string[];
  /** What to call an entry instead of its own label, keyed by what it does. */
  labels: Partial<Record<MenuAction, string>>;
  nested?: boolean;
}

function Flyout({
  items,
  isTicked,
  onAction,
  isEnabled,
  onHoverAction,
  recent,
  labels,
  nested,
}: FlyoutProps) {
  const [openSub, setOpenSub] = useState<string | null>(null);
  // The check column is reserved for the whole panel, so a tick appearing or
  // disappearing does not shift the labels.
  const checkable = items.some(
    (entry) => entry !== "separator" && (entry.checked || entry.checkable),
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: it only stops previewing, the entries inside are buttons
    <div
      className={`flyout${checkable ? " flyout--checkable" : ""}${nested ? " flyout--nested" : ""}`}
      onMouseLeave={() => onHoverAction(null)}
    >
      {items.map((raw, index) => {
        if (raw === "separator") {
          // biome-ignore lint/suspicious/noArrayIndexKey: separators have no identity
          return <div className="flyout__separator" key={index} />;
        }
        // The entry as it is written, which is its own label unless something
        // has been said about what it would do to the selection.
        const named = raw.action ? labels[raw.action] : undefined;
        const entry = built(named ? { ...raw, label: named } : raw, recent);
        return (
          <Row
            labels={labels}
            key={entry.label}
            entry={entry}
            recent={recent}
            open={openSub === entry.label}
            onHover={() => setOpenSub(entry.submenu?.length ? entry.label : null)}
            isTicked={isTicked}
            onAction={onAction}
            isEnabled={isEnabled}
            onHoverAction={onHoverAction}
          />
        );
      })}
    </div>
  );
}

interface RowProps {
  entry: MenuItem;
  open: boolean;
  onHover: () => void;
  isTicked: (action: MenuAction) => boolean;
  onAction: (action: MenuAction) => void;
  isEnabled: (action: MenuAction) => boolean;
  onHoverAction: (action: MenuAction | null) => void;
  recent: string[];
  labels: Partial<Record<MenuAction, string>>;
}

/**
 * The entry as it is drawn: one whose submenu is built as the menu opens gets
 * it here, and greys out where there is nothing in it.
 */
function built(entry: MenuItem, recent: string[]): MenuItem {
  if (entry.dynamic !== "recent") return entry;
  const items = recentItems(recent);
  return { ...entry, submenu: items, disabled: items.length === 0 };
}

function Row({
  entry,
  open,
  onHover,
  isTicked,
  onAction,
  isEnabled,
  onHoverAction,
  recent,
  labels,
}: RowProps) {
  const ticked = entry.checked || (entry.action !== undefined && isTicked(entry.action));
  const off = entry.disabled || (entry.action !== undefined && !isEnabled(entry.action));

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the row is a wrapper, the button inside it takes the focus
    <div
      className="flyout__row"
      onMouseEnter={() => {
        onHover();
        onHoverAction(off ? null : (entry.action ?? null));
      }}
    >
      <button
        type="button"
        className={`flyout__item${entry.indent ? " flyout__item--indent" : ""}${open ? " flyout__item--open" : ""}`}
        disabled={off}
        onClick={entry.action ? () => onAction(entry.action as MenuAction) : undefined}
      >
        {ticked && (
          <span className="flyout__check">
            <MenuCheckIcon />
          </span>
        )}
        <span className={`flyout__label${isImplemented(entry) ? "" : " flyout__label--todo"}`}>
          {entry.label}
        </span>
        {entry.note && <span className="flyout__note">{entry.note}</span>}
        {entry.shortcut && <span className="flyout__shortcut">{entry.shortcut}</span>}
        {entry.submenu && (
          <span className="flyout__submenu">
            <SubmenuArrowIcon />
          </span>
        )}
      </button>
      {open && entry.submenu && (
        <Flyout
          nested
          items={entry.submenu}
          recent={recent}
          labels={labels}
          isTicked={isTicked}
          onAction={onAction}
          isEnabled={isEnabled}
          onHoverAction={onHoverAction}
        />
      )}
    </div>
  );
}
