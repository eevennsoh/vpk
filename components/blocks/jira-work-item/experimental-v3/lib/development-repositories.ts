/**
 * Connected-repository fixtures for the experimental-v3 Repositories section.
 * Kept out of the picker component module so Fast Refresh can treat that file
 * as components-only.
 */

export interface DevelopmentRepositoryOption {
	id: string;
	name: string;
	provider: "bitbucket" | "github";
	url: string;
}

export const DEVELOPMENT_REPOSITORIES: readonly DevelopmentRepositoryOption[] = [
	{ id: "symphony-explainer", name: "symphony-explainer", provider: "github", url: "https://github.com/eevensoh/symphony-explainer" },
	{ id: "proximity", name: "proximity", provider: "github", url: "https://github.com/eevensoh/proximity" },
	{ id: "storefront", name: "storefront", provider: "bitbucket", url: "https://bitbucket.org/acme/storefront" },
	{ id: "vpk", name: "vpk", provider: "bitbucket", url: "https://bitbucket.org/atlassian/vpk" },
];

/** Connected-repo tally for the Repositories disclosure header (`· N`). */
export const CONNECTED_REPOSITORY_COUNT = DEVELOPMENT_REPOSITORIES.length;

/** Display-only: drop a leading http(s):// so bylines read as host/path. */
export function stripUrlScheme(url: string): string {
	return url.replace(/^https?:\/\//i, "");
}
