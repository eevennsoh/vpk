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

type RegistryModule = typeof import("@/components/website/registry");

function getDemoCacheKey(slug: string, category: DemoCategory): string {
	return `${category}:${slug}`;
}

function loadRegistryModule(): Promise<RegistryModule> {
	return import("@/components/website/registry");
}

function loadCachedResult<T>(
	cache: Map<string, Promise<T>>,
	cacheKey: string,
	load: () => Promise<T>,
): Promise<T> {
	const cached = cache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const result = load();
	cache.set(cacheKey, result);
	return result;
}

export function loadDemoComponent(
	slug: string,
	category: DemoCategory,
): Promise<ComponentType | null> {
	return loadCachedResult(
		demoComponentCache,
		getDemoCacheKey(slug, category),
		() => loadRegistryModule().then((module) => module.getDemoComponent(slug, category)),
	);
}

export function loadVariantDemoComponent(
	slug: string,
	category: DemoCategory,
): Promise<ComponentType | null> {
	return loadCachedResult(
		variantDemoComponentCache,
		getDemoCacheKey(slug, category),
		() => loadRegistryModule().then((module) => module.getVariantDemoComponent(slug, category)),
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
