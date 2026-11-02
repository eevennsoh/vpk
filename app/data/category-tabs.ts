import {
	ART_COMPONENTS,
	UI_CHART_COMPONENTS,
	CUSTOM_COMPONENTS,
	BLOCK_COMPONENTS,
	PROJECT_COMPONENTS,
	UI_COMPONENTS,
	UTILITY_COMPONENTS,
	VISUAL_COMPONENTS,
} from "@/app/data/component-manifest";

export type WebsiteCategoryTab =
	| "ui"
	| "ui-charts"
	| "ui-custom"
	| "blocks"
	| "projects"
	| "arts"
	| "utility"
	| "visual";

export interface CategoryTabOption {
	key: WebsiteCategoryTab;
	title: string;
	count: number;
}

export const CATEGORY_TAB_OPTIONS: ReadonlyArray<CategoryTabOption> = [
	{ key: "projects", title: "Projects", count: PROJECT_COMPONENTS.length },
	{ key: "arts", title: "Arts", count: ART_COMPONENTS.length },
	{ key: "ui", title: "UI", count: UI_COMPONENTS.length },
	{ key: "ui-charts", title: "UI — Charts", count: UI_CHART_COMPONENTS.length },
	{ key: "ui-custom", title: "UI — Custom", count: CUSTOM_COMPONENTS.length },
	{ key: "blocks", title: "Blocks", count: BLOCK_COMPONENTS.length },
	{ key: "utility", title: "Utils", count: UTILITY_COMPONENTS.length },
	{ key: "visual", title: "Visual", count: VISUAL_COMPONENTS.length },
];
