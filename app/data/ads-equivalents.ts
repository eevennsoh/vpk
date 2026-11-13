/**
 * Maps UI component slugs to their @atlaskit package equivalents.
 * Only components with a direct ADS counterpart are included.
 *
 * Simple cases use a plain string (default export from its own package).
 * Named exports from shared packages use the object form.
 */

type AdsEquivalent = string | { package: string; importPath: string; namedExport: string };

export const ADS_EQUIVALENTS: Record<string, AdsEquivalent> = {
	alert: "@atlaskit/section-message",
	avatar: "@atlaskit/avatar",
	badge: "@atlaskit/badge",
	banner: "@atlaskit/banner",
	blanket: "@atlaskit/blanket",
	breadcrumb: "@atlaskit/breadcrumbs",
	button: { package: "@atlaskit/button", importPath: "@atlaskit/button/new", namedExport: "Button" },
	"button-group": { package: "@atlaskit/button", importPath: "@atlaskit/button/new", namedExport: "ButtonGroup" },
	calendar: "@atlaskit/calendar",
	checkbox: "@atlaskit/checkbox",
	code: "@atlaskit/code",
	"code-block": { package: "@atlaskit/code", importPath: "@atlaskit/code", namedExport: "CodeBlock" },
	comment: "@atlaskit/comment",
	"date-label": "@atlaskit/date-label",
	"date-picker": { package: "@atlaskit/datetime-picker", importPath: "@atlaskit/datetime-picker", namedExport: "DatePicker" },
	"date-time-picker": { package: "@atlaskit/datetime-picker", importPath: "@atlaskit/datetime-picker", namedExport: "DateTimePicker" },
	dialog: "@atlaskit/modal-dialog",
	"dropdown-menu": "@atlaskit/dropdown-menu",
	empty: "@atlaskit/empty-state",
	field: "@atlaskit/textfield",
	footer: "Atlassian Design System",
	forms: "@atlaskit/form",

	icon: "@atlaskit/icon",
	image: "@atlaskit/image",
	"hover-card": "@atlaskit/inline-dialog",
	"inline-edit": "@atlaskit/inline-edit",
	"input-group": "@atlaskit/textfield",
	link: "@atlaskit/link",
	logo: "@atlaskit/logo",
	lozenge: "@atlaskit/lozenge",
	"page-header": "@atlaskit/page-header",
	pagination: "@atlaskit/pagination",
	popover: "@atlaskit/popup",
	progress: "@atlaskit/progress-bar",
	"progress-indicator": "@atlaskit/progress-indicator",
	"progress-tracker": "@atlaskit/progress-tracker",
	radio: "@atlaskit/radio",
	"radio-group": "@atlaskit/radio",
	select: "@atlaskit/select",
	separator: "@atlaskit/primitives",
	slider: "@atlaskit/range",
	sonner: "@atlaskit/flag",
	spinner: "@atlaskit/spinner",
	switch: "@atlaskit/toggle",
	table: "@atlaskit/dynamic-table",
	tabs: "@atlaskit/tabs",
	"skill-tag": "@atlaskit/tag",
	tag: "@atlaskit/tag",
	"time-picker": { package: "@atlaskit/datetime-picker", importPath: "@atlaskit/datetime-picker", namedExport: "TimePicker" },
	tile: "@atlaskit/tile",
	"icon-tile": "@atlaskit/icon",
	"object-tile": "@atlaskit/logo",
	tooltip: "@atlaskit/tooltip",
} as const;

/**
 * Returns display text and package name for a given component slug.
 * - Simple entries: displayText = package name (e.g. "@atlaskit/badge")
 * - Named exports: displayText = import path (e.g. "@atlaskit/button/new")
 */
export function getAdsDisplayInfo(slug: string): { displayText: string; package: string } | undefined {
	const entry = ADS_EQUIVALENTS[slug];
	if (!entry) return undefined;
	if (typeof entry === "string") return { displayText: entry, package: entry };
	return {
		displayText: entry.importPath,
		package: entry.package,
	};
}
