import {
	getNonEmptyString,
	isObjectRecord,
	readFirstNonEmptyString,
} from "@/components/projects/shared/lib/generative-widget-text";
import type { GenerativeWidgetActionItem } from "@/components/projects/shared/lib/generative-widget-types";

export const PRIMARY_ACTION_PREFERRED_LABEL_PATTERN =
	/\b(send|submit|save|create|post|publish|run|confirm|continue|apply|start)\b/i;
export const PRIMARY_ACTION_DEPRIORITIZED_LABEL_PATTERN =
	/\b(cancel|close|back|dismiss|reset|clear)\b/i;
export const PRIMARY_ACTION_EXCLUDED_LABEL_PATTERN = /\bopen\s+preview\b/i;
export const ACTION_LABEL_OBJECT_KEYS = [
	"label",
	"text",
	"title",
] as const;
const ACTION_LABEL_ROOT_KEYS = [
	"primaryLabel",
	"secondaryLabel",
	"tertiaryLabel",
	"actionLabel",
	"submitLabel",
	"ctaLabel",
	"viewLabel",
] as const;
const ACTION_LABEL_NESTED_KEYS = [
	"primary",
	"secondary",
	"tertiary",
	"actions",
	"buttons",
	"items",
] as const;
const ACTION_HREF_KEYS = [
	"href",
	"url",
	"link",
	"externalUrl",
	"webUrl",
	"pageUrl",
	"viewUrl",
	"editUrl",
] as const;
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;

export function readActionHref(
	record: Record<string, unknown>,
	keys: readonly string[] = [...ACTION_HREF_KEYS]
): string | undefined {
	const href = readFirstNonEmptyString(record, keys);
	if (!href) {
		return undefined;
	}

	const normalized = href.trim();
	if (!normalized || normalized.toLowerCase().startsWith("javascript:")) {
		return undefined;
	}

	return normalized;
}

export function mergeActionItems(items: readonly GenerativeWidgetActionItem[]): GenerativeWidgetActionItem[] {
	const mergedItems: GenerativeWidgetActionItem[] = [];
	const itemIndexByLabel = new Map<string, number>();

	for (const item of items) {
		const label = getNonEmptyString(item.label);
		if (!label || PRIMARY_ACTION_EXCLUDED_LABEL_PATTERN.test(label)) {
			continue;
		}

		const href = getNonEmptyString(item.href);
		const normalizedLabel = label.toLowerCase();
		const existingIndex = itemIndexByLabel.get(normalizedLabel);
		if (existingIndex === undefined) {
			mergedItems.push({ label, ...(href ? { href } : {}) });
			itemIndexByLabel.set(normalizedLabel, mergedItems.length - 1);
			continue;
		}

		const existingItem = mergedItems[existingIndex];
		if (!existingItem.href && href) {
			mergedItems[existingIndex] = { ...existingItem, href };
		}
	}

	return mergedItems;
}

function extractActionItemFromRecord(record: Record<string, unknown>): GenerativeWidgetActionItem | null {
	const label = readFirstNonEmptyString(record, [...ACTION_LABEL_OBJECT_KEYS]);
	if (!label) {
		return null;
	}

	const href = readActionHref(record);
	return { label, ...(href ? { href } : {}) };
}

export function collectActionItemsFromActionsValue(value: unknown): GenerativeWidgetActionItem[] {
	if (!isObjectRecord(value)) {
		return [];
	}

	const items: GenerativeWidgetActionItem[] = [];

	for (const labelKey of ACTION_LABEL_ROOT_KEYS) {
		const label = getNonEmptyString(value[labelKey]);
		if (!label) {
			continue;
		}

		const actionHint = labelKey
			.replace(/Label$/i, "")
			.toLowerCase();
		const href = readActionHref(value, [
			`${actionHint}Href`,
			`${actionHint}Url`,
			...ACTION_HREF_KEYS,
		]);

		items.push({ label, ...(href ? { href } : {}) });
	}

	for (const nestedKey of ACTION_LABEL_NESTED_KEYS) {
		const nestedValue = value[nestedKey];
		if (Array.isArray(nestedValue)) {
			for (const entry of nestedValue) {
				if (!isObjectRecord(entry)) {
					continue;
				}
				const item = extractActionItemFromRecord(entry);
				if (item) {
					items.push(item);
				}
			}
			continue;
		}

		if (!isObjectRecord(nestedValue)) {
			continue;
		}

		const item = extractActionItemFromRecord(nestedValue);
		if (item) {
			items.push(item);
		}
	}

	return mergeActionItems(items);
}

export function mapFallbackHrefForLabel(label: string, source: Record<string, unknown>): string | undefined {
	const isEditAction = /\bedit\b/i.test(label);
	const isViewAction = /\bview\b|\bopen\b/i.test(label);

	if (isEditAction) {
		return readActionHref(source, [
			"editUrl",
			"editHref",
			"pageEditUrl",
			...ACTION_HREF_KEYS,
		]);
	}

	if (isViewAction) {
		return readActionHref(source, [
			"viewUrl",
			"viewHref",
			"pageUrl",
			"externalUrl",
			...ACTION_HREF_KEYS,
		]);
	}

	return undefined;
}

function extractUrlsFromString(value: string): string[] {
	const matches = value.match(URL_PATTERN);
	if (!matches) {
		return [];
	}

	return matches
		.map((url) => url.replace(/[),.;]+$/g, "").trim())
		.filter((url) => url.length > 0);
}

export function collectUrlCandidates(value: unknown): string[] {
	const queue: unknown[] = [value];
	const visited = new Set<unknown>();
	const collectedUrls: string[] = [];
	let processedNodes = 0;

	while (queue.length > 0 && processedNodes < 500) {
		const current = queue.shift();
		processedNodes += 1;

		if (typeof current === "string") {
			collectedUrls.push(...extractUrlsFromString(current));
			continue;
		}

		if (Array.isArray(current)) {
			for (const item of current) {
				queue.push(item);
			}
			continue;
		}

		if (!isObjectRecord(current)) {
			continue;
		}

		if (visited.has(current)) {
			continue;
		}

		visited.add(current);
		for (const entry of Object.values(current)) {
			queue.push(entry);
		}
	}

	return Array.from(new Set(collectedUrls));
}

export function selectBestUrlForAction(label: string, candidates: readonly string[]): string | undefined {
	if (candidates.length === 0) {
		return undefined;
	}

	const wantsEdit = /\bedit\b/i.test(label);
	const wantsView = /\bview\b|\bopen\b|\bpage\b/i.test(label);
	let bestCandidate: { url: string; score: number; index: number } | null = null;

	for (const [index, url] of candidates.entries()) {
		const normalizedUrl = url.toLowerCase();
		const looksLikeEditUrl = /\/edit\b|[?&]mode=edit\b|\/edit\//.test(normalizedUrl);
		let score = 0;

		if (/confluence|\/wiki\//.test(normalizedUrl)) {
			score += 20;
		}

		if (wantsEdit && looksLikeEditUrl) {
			score += 50;
		}

		if (wantsView && !looksLikeEditUrl) {
			score += 35;
		}

		if (wantsView && looksLikeEditUrl) {
			score -= 15;
		}

		if (!bestCandidate || score > bestCandidate.score) {
			bestCandidate = { url, score, index };
		}
	}

	return bestCandidate?.url ?? candidates[0];
}
