type ModifierKeyEvent = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey">;

/**
 * Remote-preview viewports forward keys to an embedded browser, but plain Tab and
 * Shift+Tab stay with the host page so keyboard users can always move focus out of
 * the viewport (WCAG 2.1.2 No Keyboard Trap). The trade-off: Tab cannot move between
 * fields inside the remote page; click a field to focus it instead. Ctrl/Alt/Meta+Tab
 * are still forwarded, but real browsers and the OS usually claim those chords, so they
 * are not a substitute. An explicit "capture keys" mode (Escape to release) would be the
 * way to restore in-page Tab if that is ever needed.
 */
export function isPreviewFocusNavigationKey(event: ModifierKeyEvent): boolean {
	return event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey;
}

/** Screen-reader hint for preview viewports, referenced through aria-describedby. */
export const PREVIEW_KEYBOARD_HINT = "Keys are sent to the page. Press Tab to leave the preview.";
