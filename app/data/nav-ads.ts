import { getAdsDisplayInfo } from "@/app/data/ads-equivalents";

const ADS_UI_DISCOVERY_SLUGS = new Set(["entity-card", "sidebar-nav-item"]);

const ADS_CUSTOM_SLUGS = new Set([
	"animated-dots",
	"animated-rovo",
	"chain-of-thought",
	"code-block",
	"conversation",
	"message",
	"morphing-rovo",
	"plan",
	"prompt-input",
	"queue",
	"reasoning",
	"shimmer",
	"sources",
	"speech-input",
	"suggestion",
	"task",
	"tool",
]);

const ADS_BLOCK_SLUGS = new Set([
	"agent-progress",
	"artifact",
	"task-progress",
	"answer-card",
	"top-navigation",
	"prompt-gallery",
	"generative-card",
	"jira-list",
	"jira-kanban",
	"product-sidebar",
	"rovo-canvas",
	"sidebar-rail",
	"smart-link",
	"pull-request",
	"development-panel",
	"pull-request-header",
	"pull-request-review",
	"pull-request-fix",
	"question-card",
	"approval-card",
	"terminal-switch",
]);

export function resolveUiAdsPackage(slug: string) {
	if (ADS_UI_DISCOVERY_SLUGS.has(slug)) {
		return "Atlassian Design System";
	}
	return getAdsDisplayInfo(slug)?.displayText ?? (slug === "switch" ? "Atlassian Design System" : undefined);
}

export function resolveUiAdsTagVariant(slug: string): "discovery" | undefined {
	return ADS_UI_DISCOVERY_SLUGS.has(slug) ? "discovery" : undefined;
}

export function resolveCustomAdsPackage(slug: string) {
	return ADS_CUSTOM_SLUGS.has(slug) ? "Atlassian Design System" : undefined;
}

export function resolveBlockAdsPackage(slug: string) {
	return ADS_BLOCK_SLUGS.has(slug) ? "Atlassian Design System" : undefined;
}
