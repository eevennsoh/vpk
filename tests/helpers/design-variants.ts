import { DESIGN_VARIANTS_QUERY_PARAM, type DesignVariantOverrides } from "@/components/utils/design-variants";

/**
 * Add a non-persisting `?variants=` override to an app route:
 * `withDesignVariants("/jira-team-eu26", { autoArrange: true, sessionPeel: false })`
 * → `/jira-team-eu26?variants=autoArrange,-sessionPeel`.
 *
 * Prefer this to seeding `localStorage["ui-design-variants"]`: the override is
 * read once per document load, never written to storage, and survives
 * `page.reload()` because it lives in the URL. Keep storage seeding only for
 * specs that exercise persistence itself.
 */
export function withDesignVariants(route: string, overrides: DesignVariantOverrides): string {
	const tokens = Object.entries(overrides).flatMap(([id, enabled]) => (
		enabled === undefined ? [] : [enabled ? id : `-${id}`]
	));
	if (tokens.length === 0) return route;
	const hashIndex = route.indexOf("#");
	const beforeHash = hashIndex === -1 ? route : route.slice(0, hashIndex);
	const hash = hashIndex === -1 ? "" : route.slice(hashIndex);
	const separator = beforeHash.includes("?") ? "&" : "?";
	return `${beforeHash}${separator}${DESIGN_VARIANTS_QUERY_PARAM}=${tokens.join(",")}${hash}`;
}
