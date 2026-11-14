import {
	collectActionItemsFromActionsValue,
	collectUrlCandidates,
	mapFallbackHrefForLabel,
	mergeActionItems,
	selectBestUrlForAction,
} from "@/components/projects/shared/lib/generative-widget-actions";
import { GENERATIVE_CONTENT_TYPE_HINT_KEYS } from "@/components/projects/shared/lib/generative-widget-content-type";
import {
	inferGeneratedVideoPreviewBody,
	parseAudioPreviewBody,
	parseExcalidrawPreviewScene,
	parseExplicitPreviewBody,
	parseImagePreviewBody,
	parseJsonRenderPreviewBody,
	parseVideoPreviewBody,
} from "@/components/projects/shared/lib/generative-widget-preview-body";
import {
	resolveGenuiDescriptionFromSpec,
	resolveGenuiTitleFromSpec,
} from "@/components/projects/shared/lib/generative-widget-spec-query";
import {
	getNonEmptyString,
	isObjectRecord,
	readFirstNonEmptyString,
} from "@/components/projects/shared/lib/generative-widget-text";
import type {
	ParsedGenerativeWidget,
	ParsedGenerativeWidgetBase,
	ParsedGenerativeWidgetSource,
	PreviewBody,
} from "@/components/projects/shared/lib/generative-widget-types";

function parseExplicitSource(payload: Record<string, unknown>): ParsedGenerativeWidgetSource | null {
	const rootName = readFirstNonEmptyString(payload, [
		"sourceAppName",
		"sourceName",
		"sourceProduct",
		"sourceLabel",
	]);
	const rootLogoSrc = readFirstNonEmptyString(payload, [
		"sourceLogoSrc",
		"sourceLogo",
		"sourceIconSrc",
	]);

	let nestedName: string | undefined;
	let nestedLogoSrc: string | undefined;
	const sourceValue = payload.source;
	if (isObjectRecord(sourceValue)) {
		nestedName = readFirstNonEmptyString(sourceValue, [
			"appName",
			"name",
			"product",
			"label",
		]);
		nestedLogoSrc = readFirstNonEmptyString(sourceValue, [
			"logoSrc",
			"logo",
			"iconSrc",
			"imageSrc",
		]);
	}

	const name = rootName ?? nestedName;
	const logoSrc = rootLogoSrc ?? nestedLogoSrc;
	if (!name && !logoSrc) {
		return null;
	}

	return {
		...(name ? { name } : {}),
		...(logoSrc ? { logoSrc } : {}),
	};
}

function parseGenerativeWidgetBase(payload: Record<string, unknown>): ParsedGenerativeWidgetBase {
	const title = readFirstNonEmptyString(payload, [
		"title",
		"cardTitle",
		"widgetTitle",
	]);
	const description = readFirstNonEmptyString(payload, [
		"description",
		"cardDescription",
		"widgetDescription",
	]);
	let primaryActionLabel = readFirstNonEmptyString(payload, [
		"primaryActionLabel",
		"primaryCtaLabel",
		"actionLabel",
		"submitLabel",
		"ctaLabel",
	]);
	const actionsValue = payload.actions;
	const parsedActions = mergeActionItems([
		...collectActionItemsFromActionsValue(actionsValue),
		...collectActionItemsFromActionsValue(payload),
	]);
	const payloadUrlCandidates = collectUrlCandidates(payload);
	if (!primaryActionLabel && isObjectRecord(actionsValue)) {
		const nestedPrimary = actionsValue.primary;
		if (isObjectRecord(nestedPrimary)) {
			primaryActionLabel = readFirstNonEmptyString(nestedPrimary, [
				"label",
				"text",
				"title",
			]);
		}

		if (!primaryActionLabel) {
			primaryActionLabel = readFirstNonEmptyString(actionsValue, [
				"primaryLabel",
				"submitLabel",
				"actionLabel",
			]);
		}
	}
	const actionsWithFallbackLinks = mergeActionItems(
		parsedActions.map((actionItem) => {
			if (actionItem.href) {
				return actionItem;
			}

			const href =
				mapFallbackHrefForLabel(actionItem.label, payload) ??
				(isObjectRecord(actionsValue)
					? mapFallbackHrefForLabel(actionItem.label, actionsValue)
					: undefined) ??
				selectBestUrlForAction(actionItem.label, payloadUrlCandidates);

			return { ...actionItem, ...(href ? { href } : {}) };
		})
	);
	const primaryActionHref = primaryActionLabel
		? mapFallbackHrefForLabel(primaryActionLabel, payload) ??
			selectBestUrlForAction(primaryActionLabel, payloadUrlCandidates)
		: undefined;
	const resolvedActions =
		actionsWithFallbackLinks.length > 0
			? actionsWithFallbackLinks
			: primaryActionLabel
				? [{
					label: primaryActionLabel,
					...(primaryActionHref
						? { href: primaryActionHref }
						: {}),
				}]
				: [];

	const contentTypeHint = readFirstNonEmptyString(payload, [
		...GENERATIVE_CONTENT_TYPE_HINT_KEYS,
	]);

	const rawIconHint = readFirstNonEmptyString(payload, [
		"iconHint",
		"icon",
		"iconName",
	]);
	const iconHint = rawIconHint
		? rawIconHint.trim().replace(/\s+/g, "-").toLowerCase()
		: undefined;

	return {
		...(title ? { title } : {}),
		...(description ? { description } : {}),
		...(primaryActionLabel ? { primaryActionLabel } : {}),
		...(resolvedActions.length > 0
			? { actions: resolvedActions }
			: {}),
		...(contentTypeHint ? { contentTypeHint } : {}),
		...(iconHint ? { iconHint } : {}),
		source: parseExplicitSource(payload),
	};
}

function parseGenerativeWidgetFromBody({
	body,
	summary,
	value,
}: Readonly<{
	body: PreviewBody;
	summary?: string;
	value: Record<string, unknown>;
}>): ParsedGenerativeWidget {
	return {
		type: "genui-preview",
		body,
		...(summary ? { summary } : {}),
		...parseGenerativeWidgetBase(value),
	};
}

function hydrateVideoWidgetMetadataFromSpec(
	widget: ParsedGenerativeWidget,
	baseValue: Record<string, unknown>,
): ParsedGenerativeWidget {
	const jsonRenderBody = parseJsonRenderPreviewBody(baseValue);
	if (!jsonRenderBody) {
		return widget;
	}

	const specWidget = parseGenerativeWidgetFromBody({
		body: jsonRenderBody,
		summary: widget.summary,
		value: baseValue,
	});
	const derivedTitle = resolveGenuiTitleFromSpec(specWidget);
	const derivedDescription = resolveGenuiDescriptionFromSpec(specWidget);

	return {
		...widget,
		...parseGenerativeWidgetBase({
			...baseValue,
			...(derivedTitle ? { title: derivedTitle } : {}),
			...(derivedDescription ? { description: derivedDescription } : {}),
		}),
	};
}

function parseGenuiPreviewWidgetData(value: unknown): ParsedGenerativeWidget | null {
	if (!isObjectRecord(value)) {
		return null;
	}

	const summary = getNonEmptyString(value.summary);
	const explicitBody = parseExplicitPreviewBody(value);
	if (explicitBody) {
		if (explicitBody.kind === "video") {
			return hydrateVideoWidgetMetadataFromSpec(
				parseGenerativeWidgetFromBody({
					body: explicitBody,
					summary: summary ?? undefined,
					value,
				}),
				value,
			);
		}

		if (explicitBody.kind === "json-render") {
			const inferredVideoBody = inferGeneratedVideoPreviewBody(value);
			if (inferredVideoBody) {
				return hydrateVideoWidgetMetadataFromSpec(
					parseGenerativeWidgetFromBody({
						body: inferredVideoBody,
						summary: summary ?? undefined,
						value,
					}),
					value,
				);
			}
		}

		return parseGenerativeWidgetFromBody({
			body: explicitBody,
			summary: summary ?? undefined,
			value,
		});
	}

	const jsonRenderBody = parseJsonRenderPreviewBody(value);
	if (jsonRenderBody) {
		const inferredVideoBody = inferGeneratedVideoPreviewBody(value);
		if (inferredVideoBody) {
			return hydrateVideoWidgetMetadataFromSpec(
				parseGenerativeWidgetFromBody({
					body: inferredVideoBody,
					summary: summary ?? undefined,
					value,
				}),
				value,
			);
		}

		return parseGenerativeWidgetFromBody({
			body: jsonRenderBody,
			summary: summary ?? undefined,
			value,
		});
	}

	const scene = parseExcalidrawPreviewScene(value.scene ?? value);
	if (scene) {
		return parseGenerativeWidgetFromBody({
			body: {
				kind: "excalidraw",
				scene,
			},
			summary: summary ?? undefined,
			value,
		});
	}

	return null;
}

function parseAudioPreviewWidgetData(value: unknown): ParsedGenerativeWidget | null {
	if (!isObjectRecord(value)) {
		return null;
	}

	const body = parseAudioPreviewBody(value);
	if (!body) {
		return null;
	}

	return parseGenerativeWidgetFromBody({ body, value });
}

function parseImagePreviewWidgetData(value: unknown): ParsedGenerativeWidget | null {
	if (!isObjectRecord(value)) {
		return null;
	}

	const body = parseImagePreviewBody(value);
	if (!body) {
		return null;
	}

	return parseGenerativeWidgetFromBody({ body, value });
}

function parseVideoPreviewWidgetData(value: unknown): ParsedGenerativeWidget | null {
	if (!isObjectRecord(value)) {
		return null;
	}

	const body = parseVideoPreviewBody(value);
	if (!body) {
		return null;
	}

	return parseGenerativeWidgetFromBody({ body, value });
}

export function parseGenerativeWidget(
	widgetType: string,
	widgetData: unknown
): ParsedGenerativeWidget | null {
	if (widgetType === "genui-preview") {
		return parseGenuiPreviewWidgetData(widgetData);
	}

	if (widgetType === "audio-preview") {
		return parseAudioPreviewWidgetData(widgetData);
	}

	if (widgetType === "image-preview") {
		return parseImagePreviewWidgetData(widgetData);
	}

	if (widgetType === "video-preview") {
		return parseVideoPreviewWidgetData(widgetData);
	}

	return null;
}
