import type { ComponentType } from "react";

export type DemoCategory =
	| "ui-charts"
	| "ui-custom"
	| "ui"
	| "blocks"
	| "projects"
	| "arts"
	| "utility"
	| "visual";

const demoComponentCache = new Map<string, Promise<ComponentType | null>>();
const variantDemoComponentCache = new Map<string, Promise<ComponentType | null>>();
const variantDemoListCache = new Map<string, Promise<Array<ComponentType | null>>>();

type DemoTable = Readonly<Record<string, ComponentType>>;
type CategoryRegistry = Readonly<{ demos: DemoTable; variants?: DemoTable }>;

// One dynamic import per category, so a route that renders one demo fetches only that category's
// table instead of every category's (about 1 MB). This map is also the one catalog tooling reads
// (scripts/lib/component-registry.js); demo-registry-loader.source.test.js checks both.
const CATEGORY_REGISTRY_LOADERS: Readonly<Record<DemoCategory, () => Promise<CategoryRegistry>>> = {
	arts: () => import("@/components/website/registry/arts").then((module) => ({ demos: module.ARTS_DEMOS })),
	blocks: () => import("@/components/website/registry/blocks").then((module) => ({ demos: module.BLOCK_DEMOS, variants: module.BLOCK_VARIANT_DEMOS })),
	projects: () => import("@/components/website/registry/projects").then((module) => ({ demos: module.PROJECT_DEMOS })),
	"ui-charts": () => import("@/components/website/registry/ui-charts").then((module) => ({ demos: module.UI_CHARTS_DEMO, variants: module.UI_CHARTS_VARIANT_DEMOS })),
	"ui-custom": () => import("@/components/website/registry/ui-custom").then((module) => ({ demos: module.UI_CUSTOM_DEMO, variants: module.UI_CUSTOM_VARIANT_DEMOS })),
	ui: () => import("@/components/website/registry/ui").then((module) => ({ demos: module.UI_DEMO, variants: module.UI_VARIANT_DEMOS })),
	utility: () => import("@/components/website/registry/utility").then((module) => ({ demos: module.UTILITY_DEMOS, variants: module.UTILITY_VARIANT_DEMOS })),
	visual: () => import("@/components/website/registry/visual").then((module) => ({ demos: module.VISUAL_DEMOS, variants: module.VISUAL_VARIANT_DEMOS })),
};

const categoryRegistryCache = new Map<DemoCategory, Promise<CategoryRegistry | null>>();

function getDemoCacheKey(slug: string, category: DemoCategory): string {
	return `${category}:${slug}`;
}

function loadCategoryRegistry(category: DemoCategory): Promise<CategoryRegistry | null> {
	const load = CATEGORY_REGISTRY_LOADERS[category];
	return loadCachedResult(categoryRegistryCache, category, () => (load ? load() : Promise.resolve(null)));
}

// Shares one in-flight or settled load per key. A rejected load is dropped from the cache, so a
// failed chunk request (a network blip, a deploy that swapped chunks) is retried by the next
// call instead of failing every later demo of that category until reload.
export function loadCachedResult<K, T>(
	cache: Map<K, Promise<T>>,
	cacheKey: K,
	load: () => Promise<T>,
): Promise<T> {
	const cached = cache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const result = load();
	cache.set(cacheKey, result);
	result.catch(() => {
		if (cache.get(cacheKey) === result) {
			cache.delete(cacheKey);
		}
	});
	return result;
}

export function loadDemoComponent(
	slug: string,
	category: DemoCategory,
): Promise<ComponentType | null> {
	return loadCachedResult(
		demoComponentCache,
		getDemoCacheKey(slug, category),
		() => loadCategoryRegistry(category).then((registry) => registry?.demos[slug] ?? null),
	);
}

export function loadVariantDemoComponent(
	slug: string,
	category: DemoCategory,
): Promise<ComponentType | null> {
	return loadCachedResult(
		variantDemoComponentCache,
		getDemoCacheKey(slug, category),
		() => loadCategoryRegistry(category).then((registry) => registry?.variants?.[slug] ?? null),
	);
}

export function loadVariantDemoComponents(
	slugs: ReadonlyArray<string>,
	category: DemoCategory,
): Promise<Array<ComponentType | null>> {
	const cacheKey = `${category}:${slugs.join("|")}`;
	return loadCachedResult(variantDemoListCache, cacheKey, () => {
		return Promise.all(slugs.map((slug) => loadVariantDemoComponent(slug, category)));
	});
}
