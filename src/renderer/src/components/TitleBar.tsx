import iconUrl from "@resources/icon.png";
import type { MouseEvent, ReactNode } from "react";
import { CloseIcon, MaximizeIcon, MinimizeIcon } from "./icons";
import "./TitleBar.css";

export function TitleBar({ title }: { title: string }) {
  const controls = window.api.window;
  return (
    <div className="titlebar">
      <div className="titlebar__brand">
        <img className="titlebar__icon" src={iconUrl} alt="" />
        <span className="titlebar__name">{title}</span>
      </div>
      <div className="titlebar__spacer" />
      <div className="titlebar__controls">
        <CaptionButton label="Minimise" onClick={controls.minimise}>
          <MinimizeIcon />
        </CaptionButton>
        <CaptionButton label="Maximise" onClick={controls.toggleMaximise}>
          <MaximizeIcon />
        </CaptionButton>
        <CaptionButton label="Close" close onClick={controls.close}>
          <CloseIcon />
        </CaptionButton>
      </div>
    </div>
  );
}

interface CaptionButtonProps {
  label: string;
  close?: boolean;
  onClick: () => void;
  children: ReactNode;
}

/**
 * Focus-exempt: window chrome, not app content. It is out of the tab order, and
 * preventing the mousedown default stops a click stealing focus from the app.
 */
function CaptionButton({ label, close, onClick, children }: CaptionButtonProps) {
  return (
    <button
      type="button"
      className={`titlebar__button${close ? " titlebar__button--close" : ""}`}
      aria-label={label}
      tabIndex={-1}
      onMouseDown={(event: MouseEvent) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
