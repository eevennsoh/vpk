import type { TwgToolSource } from "@/components/ui-custom/twg-appstack";

export interface SourcePreviewPage {
	id: string;
	title: string;
	href: string;
	updatedAt: Date;
	owner: string;
	snippet: string;
	/** When set, the row uses this stack icon instead of guessing from the href. */
	source?: TwgToolSource;
}

/** Long enough that "Owned by …" ellipsizes in the 26rem preview popover. */
export const SOURCE_PREVIEW_LONG_OWNER = "Mike Cannon-Brookes";

export const SOURCE_PREVIEW_PAGES: readonly SourcePreviewPage[] = [
	{
		id: "about-ust",
		title: "About UST",
		href: "https://hello.atlassian.net/wiki/spaces/UST/pages/5483563868",
		updatedAt: new Date(2025, 5, 26),
		owner: "Amy Glancey",
		snippet:
			"Owner: @Amy Glancey | Last refresh June 2025 | Part of https://hello.atlassian.net/wiki/spaces/UST/pages/5483563868…",
	},
	{
		id: "unified-string-theory",
		title: "Unified String Theory (UST)",
		href: "https://hello.atlassian.net/wiki/spaces/UST/pages/5483563869",
		updatedAt: new Date(2025, 9, 31),
		owner: SOURCE_PREVIEW_LONG_OWNER,
		snippet:
			"“We will open the book. Its pages are blank. We are going to put words on them ourselves. The book is called Opportunity and its…",
	},
	{
		id: "fy23-archive",
		title: "FY23 Archive | About UST",
		href: "https://hello.atlassian.net/wiki/spaces/UST/pages/5483563870",
		updatedAt: new Date(2024, 5, 27),
		owner: "Amy Glancey",
		snippet:
			"This is an archived version of the UST. For the most up to date version visit go/ust Unified String Theory (UST) is a simple…",
	},
	{
		id: "fy24-archive",
		title: "FY24 Archive | About UST",
		href: "https://hello.atlassian.net/wiki/x/k4sV6",
		updatedAt: new Date(2025, 5, 26),
		owner: "Amy Glancey",
		snippet:
			"Owner @Amy Glancey | Last refresh JULY 2022 | Part of https://hello.atlassian.net/wiki/x/k4sV6 Unified String Theory (US…",
	},
];

const SOURCE_DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
});

export function formatSourcePreviewDate(date: Date): string {
	return SOURCE_DATE_FORMAT.format(date);
}

export type SourcePreviewProduct = "jira" | "confluence" | "github" | "slack" | "other";

function parseHref(href: string): URL | null {
	try {
		return new URL(href);
	} catch {
		return null;
	}
}

export function isConfluenceWikiHref(href: string): boolean {
	const url = parseHref(href);
	if (url) {
		return url.hostname.endsWith("atlassian.net") && url.pathname.includes("/wiki");
	}
	return href.includes("/wiki/");
}

export function getSourcePreviewProduct(href: string): SourcePreviewProduct {
	const url = parseHref(href);
	const hostname = url?.hostname ?? "";
	const pathname = url?.pathname ?? href;

	if (hostname === "github.com" || hostname.endsWith(".github.com")) {
		return "github";
	}
	if (hostname === "slack.com" || hostname.endsWith(".slack.com")) {
		return "slack";
	}
	if (hostname.endsWith("atlassian.net") && pathname.includes("/wiki")) {
		return "confluence";
	}
	if (hostname.endsWith("atlassian.net") || pathname.includes("/browse/")) {
		return "jira";
	}
	if (href.includes("/wiki/")) {
		return "confluence";
	}
	return "other";
}

/** Matches Smart Link Confluence pages: IconTile `blue` (information tone). */
export function getSourcePreviewIconTileVariant(
	href: string,
): "blue" | "gray" {
	return getSourcePreviewProduct(href) === "confluence" ? "blue" : "gray";
}
