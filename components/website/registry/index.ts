import type { ComponentType } from "react";

import { ARTS_DEMOS } from "./arts";
import { BLOCK_DEMOS, BLOCK_VARIANT_DEMOS } from "./blocks";
import { PROJECT_DEMOS } from "./projects";
import { UI_CHARTS_DEMO, UI_CHARTS_VARIANT_DEMOS } from "./ui-charts";
import { UI_CUSTOM_DEMO, UI_CUSTOM_VARIANT_DEMOS } from "./ui-custom";
import { UI_DEMO, UI_VARIANT_DEMOS } from "./ui";
import { UTILITY_DEMOS, UTILITY_VARIANT_DEMOS } from "./utility";
import { VISUAL_DEMOS, VISUAL_VARIANT_DEMOS } from "./visual";

export { getChartDemoComponent } from "./charts";

type DemoCategory =
	| "ui-charts"
	| "ui-custom"
	| "ui"
	| "blocks"
	| "projects"
	| "arts"
	| "utility"
	| "visual";

type DemoRegistry = Record<string, ComponentType>;

const CATEGORY_REGISTRIES: Record<DemoCategory, DemoRegistry> = {
	visual: VISUAL_DEMOS,
	utility: UTILITY_DEMOS,
	projects: PROJECT_DEMOS,
	arts: ARTS_DEMOS,
	blocks: BLOCK_DEMOS,
	"ui-charts": UI_CHARTS_DEMO,
	"ui-custom": UI_CUSTOM_DEMO,
	ui: UI_DEMO,
};

export function getDemoComponent(slug: string, category: DemoCategory): ComponentType | null {
	const registry = CATEGORY_REGISTRIES[category];
	return registry?.[slug] ?? null;
}

const VARIANT_REGISTRIES: Partial<Record<DemoCategory, DemoRegistry>> = {
	utility: UTILITY_VARIANT_DEMOS,
	"ui-charts": UI_CHARTS_VARIANT_DEMOS,
	"ui-custom": UI_CUSTOM_VARIANT_DEMOS,
	blocks: BLOCK_VARIANT_DEMOS,
	ui: UI_VARIANT_DEMOS,
	visual: VISUAL_VARIANT_DEMOS,
};

export function getVariantDemoComponent(slug: string, category: DemoCategory): ComponentType | null {
	const registry = VARIANT_REGISTRIES[category];
	return registry?.[slug] ?? null;
}
