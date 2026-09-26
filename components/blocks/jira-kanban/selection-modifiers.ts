/** Match Finder's Command modifier on Apple platforms and Ctrl elsewhere. */
export function hasJiraSelectionToggleModifier(
	event: Readonly<{ metaKey: boolean; ctrlKey: boolean }>,
	platform = typeof navigator === "undefined" ? "" : navigator.platform,
): boolean {
	return /Mac|iPhone|iPad|iPod/i.test(platform) ? event.metaKey : event.ctrlKey;
}
