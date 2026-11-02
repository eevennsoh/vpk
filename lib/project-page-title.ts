function toTitleCase(slug: string): string {
	return slug
		.split("-")
		.filter(Boolean)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

const CATEGORY_DISPLAY_NAMES: Record<string, string> = {
	ui: "UI",
	"ui-charts": "UI — Charts",
	"ui-custom": "UI-Custom",
	blocks: "Blocks",
	projects: "Projects",
	arts: "Arts",
	utility: "Utility",
	visual: "Visual",
};

export function getCategoryDisplayName(category: string): string {
	return CATEGORY_DISPLAY_NAMES[category] ?? toTitleCase(category);
}

export function getProjectPageTitle(templateSlug: string): string {
	return `${toTitleCase(templateSlug)} — Projects`;
}

export function getArtPageTitle(artSlug: string): string {
	return `${toTitleCase(artSlug)} — ${getCategoryDisplayName("arts")}`;
}

export function getComponentPageTitle(name: string, category: string): string {
	return `${name} — ${getCategoryDisplayName(category)}`;
}

export function getPreviewPageTitle(slug: string, category: string): string {
	return `${toTitleCase(slug)} — ${getCategoryDisplayName(category)} Preview`;
}
