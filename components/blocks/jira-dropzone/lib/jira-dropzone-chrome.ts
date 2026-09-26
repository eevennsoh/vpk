// Match Button's paint box so the SVG stroke meets the fill at the padding edge.
export const JIRA_DROPZONE_WELL_CHROME_CLASS = "rounded-lg border border-dashed bg-clip-padding";

export function resolveJiraDropzoneWellColors(selected: boolean): string {
	return selected
		? "border-border-selected bg-bg-selected text-text-selected"
		: "border-border bg-surface text-text-subtlest";
}
