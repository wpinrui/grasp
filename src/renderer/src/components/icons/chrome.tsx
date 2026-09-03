/** The window buttons and the marks a menu draws beside what it offers. */

export function MinimizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0 5h10" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function MaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <rect
        x="0.5"
        y="0.5"
        width="9"
        height="9"
        rx="1"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M0.4 0.4l9.2 9.2M9.6 0.4l-9.2 9.2" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function SubmenuArrowIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path
        d="M3.4 1.6 L6.8 5 L3.4 8.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MenuCheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2 6.3 L4.6 9 L10 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FlyoutMarker() {
  return (
    <svg className="tool__flyout" width="4.5" height="4.5" viewBox="0 0 5 5" aria-hidden="true">
      <path d="M5 0 L5 5 L0 5 Z" fill="currentColor" />
    </svg>
  );
}

/** Share: something leaving an open box. */
export function ShareIcon() {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 20 20"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 2.8 V12 M6.6 6.2 L10 2.8 L13.4 6.2 M4.6 11 V16.2 A1 1 0 0 0 5.6 17.2 H14.4 A1 1 0 0 0 15.4 16.2 V11" />
    </svg>
  );
}
