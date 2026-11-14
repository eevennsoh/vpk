import type { ComponentDetail } from "./component-detail-types";
import {
	ART_COMPONENTS as ART_MANIFEST,
	BLOCK_COMPONENTS as BLOCK_MANIFEST,
	CUSTOM_COMPONENTS as CUSTOM_MANIFEST,
	PROJECT_COMPONENTS as PROJECT_MANIFEST,
	UI_CHART_COMPONENTS as UI_CHART_MANIFEST,
	UI_COMPONENTS as UI_MANIFEST,
	UTILITY_COMPONENTS as UTILITY_MANIFEST,
	VISUAL_COMPONENTS as VISUAL_MANIFEST,
	type ComponentCategory,
	type ComponentManifestEntry,
} from "./component-manifest";
import { ART_DETAILS } from "./details/arts";
import { BLOCK_DETAILS } from "./details/blocks";
import { PROJECT_DETAILS } from "./details/projects";
import { UI_DETAILS } from "./details/ui";
import { UI_CHART_DETAILS } from "./details/ui-charts";
import { UI_CUSTOM_DETAILS } from "./details/ui-custom";
import { UTILITY_DETAILS } from "./details/utility";
import { VISUAL_DETAILS } from "./details/visual";

// The catalog entries the component pages render: each manifest entry with its detail record.
// Derived from app/data/component-manifest.ts, so a new entry is registered once, there.

export interface ComponentEntry {
	name: string;
	slug: string;
	importPath: string;
	category: ComponentCategory;
	detail?: ComponentDetail;
}

// Lifecycle fields (status, basedOn, note) stay in the manifest; the pages never read them.
function withDetails(entries: readonly ComponentManifestEntry[], details: Readonly<Record<string, ComponentDetail>>): ComponentEntry[] {
	return entries.map(({ category, importPath, name, slug }) => ({ name, slug, importPath, category, detail: details[slug] }));
}

export const CUSTOM_COMPONENTS: ComponentEntry[] = withDetails(CUSTOM_MANIFEST, UI_CUSTOM_DETAILS);
export const UI_CHART_COMPONENTS: ComponentEntry[] = withDetails(UI_CHART_MANIFEST, UI_CHART_DETAILS);
export const UI_COMPONENTS: ComponentEntry[] = withDetails(UI_MANIFEST, UI_DETAILS);
export const BLOCK_COMPONENTS: ComponentEntry[] = withDetails(BLOCK_MANIFEST, BLOCK_DETAILS);
export const PROJECT_COMPONENTS: ComponentEntry[] = withDetails(PROJECT_MANIFEST, PROJECT_DETAILS);
export const ART_COMPONENTS: ComponentEntry[] = withDetails(ART_MANIFEST, ART_DETAILS);
export const UTILITY_COMPONENTS: ComponentEntry[] = withDetails(UTILITY_MANIFEST, UTILITY_DETAILS);
export const VISUAL_COMPONENTS: ComponentEntry[] = withDetails(VISUAL_MANIFEST, VISUAL_DETAILS);

const ALL_COMPONENTS = [...UI_CHART_COMPONENTS, ...CUSTOM_COMPONENTS, ...UI_COMPONENTS, ...BLOCK_COMPONENTS, ...PROJECT_COMPONENTS, ...ART_COMPONENTS, ...UTILITY_COMPONENTS, ...VISUAL_COMPONENTS];

export function findComponent(category: string, slug: string): ComponentEntry | undefined {
	return ALL_COMPONENTS.find((c) => c.category === category && c.slug === slug);
}

export function getAllComponents(): ComponentEntry[] {
	return ALL_COMPONENTS;
}
