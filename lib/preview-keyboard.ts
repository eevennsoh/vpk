type ModifierKeyEvent = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey">;

/**
 * Remote-preview viewports forward keys to an embedded browser, but plain Tab and
 * Shift+Tab stay with the host page so keyboard users can always move focus out of
 * the viewport (WCAG 2.1.2 No Keyboard Trap). Modified Tab chords keep forwarding.
 */
export function isPreviewFocusNavigationKey(event: ModifierKeyEvent): boolean {
	return event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey;
}
