import {
	ACTION_LABEL_OBJECT_KEYS,
	PRIMARY_ACTION_DEPRIORITIZED_LABEL_PATTERN,
	PRIMARY_ACTION_EXCLUDED_LABEL_PATTERN,
	PRIMARY_ACTION_PREFERRED_LABEL_PATTERN,
	collectUrlCandidates,
	mergeActionItems,
	readActionHref,
	selectBestUrlForAction,
} from "@/components/projects/shared/lib/generative-widget-actions";
import { resolveContentType } from "@/components/projects/shared/lib/generative-widget-content-type";
import { resolveDescription } from "@/components/projects/shared/lib/generative-widget-description";
import {
	getElementProps,
	getSpecTraversalKeys,
	resolveGenuiDescriptionFromSpec,
	resolveGenuiTitleFromSpec,
} from "@/components/projects/shared/lib/generative-widget-spec-query";
import {
	clipText,
	getNonEmptyString,
	isObjectRecord,
	readFirstNonEmptyString,
} from "@/components/projects/shared/lib/generative-widget-text";
import type {
	GenerativeContentType,
	GenerativeWidgetActionItem,
	GenerativeWidgetMetadata,
	ParsedGenerativeWidget,
} from "@/components/projects/shared/lib/generative-widget-types";
import { isJsonRenderBody } from "@/components/projects/shared/lib/generative-widget-types";

function scorePrimaryActionLabel(
	label: string,
	variant: string | undefined
): number {
	if (PRIMARY_ACTION_EXCLUDED_LABEL_PATTERN.test(label)) {
		return -1000;
	}

	let score = 0;
	if (PRIMARY_ACTION_PREFERRED_LABEL_PATTERN.test(label)) {
		score += 100;
	}

	if (PRIMARY_ACTION_DEPRIORITIZED_LABEL_PATTERN.test(label)) {
		score -= 120;
	}

	if (variant === "default") {
		score += 25;
	}

	if (variant === "outline" || variant === "ghost" || variant === "link") {
		score -= 20;
	}

	if (label.length > 40) {
		score -= 10;
	}

	return score;
}

function resolveGenuiPrimaryActionLabelFromSpec(
	widget: ParsedGenerativeWidget
): string | undefined {
	if (!isJsonRenderBody(widget.body)) {
		return undefined;
	}

	const traversalKeys = getSpecTraversalKeys(widget.body.spec);
	let fallbackLabel: string | undefined;
	let bestLabel: { text: string; score: number } | null = null;

	for (const key of traversalKeys) {
		const element = widget.body.spec.elements[key];
		if (!isObjectRecord(element)) {
			continue;
		}

		if (getNonEmptyString(element.type) !== "Button") {
			continue;
		}

		const props = getElementProps(element);
		if (!props) {
			continue;
		}

		const label = readFirstNonEmptyString(props, [...ACTION_LABEL_OBJECT_KEYS]);
		if (!label) {
			continue;
		}

		if (!fallbackLabel) {
			fallbackLabel = label;
		}

		const variant = getNonEmptyString(props.variant);
		const score = scorePrimaryActionLabel(label, variant);
		if (!bestLabel || score > bestLabel.score) {
			bestLabel = { text: label, score };
		}
	}

	if (bestLabel && bestLabel.score >= 0) {
		return bestLabel.text;
	}

	if (
		fallbackLabel &&
		!PRIMARY_ACTION_DEPRIORITIZED_LABEL_PATTERN.test(fallbackLabel) &&
		!PRIMARY_ACTION_EXCLUDED_LABEL_PATTERN.test(fallbackLabel)
	) {
		return fallbackLabel;
	}

	return undefined;
}

function resolveActionHrefFromPress(pressValue: unknown): string | undefined {
	if (!isObjectRecord(pressValue)) {
		return undefined;
	}

	const directHref = readActionHref(pressValue);
	if (directHref) {
		return directHref;
	}

	const paramsValue = pressValue.params;
	if (!isObjectRecord(paramsValue)) {
		return undefined;
	}

	return readActionHref(paramsValue);
}

function resolveGenuiActionsFromSpec(
	widget: ParsedGenerativeWidget
): GenerativeWidgetActionItem[] {
	if (!isJsonRenderBody(widget.body)) {
		return [];
	}

	const traversalKeys = getSpecTraversalKeys(widget.body.spec);
	const actions: GenerativeWidgetActionItem[] = [];

	for (const key of traversalKeys) {
		const element = widget.body.spec.elements[key];
		if (!isObjectRecord(element)) {
			continue;
		}

		if (getNonEmptyString(element.type) !== "Button") {
			continue;
		}

		const props = getElementProps(element);
		if (!props) {
			continue;
		}

		const label = readFirstNonEmptyString(props, [...ACTION_LABEL_OBJECT_KEYS]);
		if (!label) {
			continue;
		}

		const href =
			readActionHref(props) ??
			(isObjectRecord(element.on)
				? resolveActionHrefFromPress(element.on.press)
				: undefined);

		actions.push({ label, ...(href ? { href } : {}) });
	}

	return mergeActionItems(actions);
}

const CONTENT_TYPE_FALLBACK_TITLES: Partial<Record<GenerativeContentType, string>> = {
	"image": "Generated image",
	"memory": "Memory context",
	"skill": "Skill context",
	"sound": "Generated audio",
	"translation": "Generated translation",
	"message": "Generated message draft",
	"calendar": "Generated calendar preview",
	"chart": "Generated chart preview",
	"chart-bar": "Generated chart preview",
	"chart-line": "Generated chart preview",
	"chart-area": "Generated chart preview",
	"chart-pie": "Generated chart preview",
	"chart-radar": "Generated chart preview",
	"chart-scatter": "Generated chart preview",
	"text": "Generated text draft",
	"work-item": "Generated work item",
	"page": "Generated page draft",
	"board": "Generated board preview",
	"table": "Generated table preview",
	"code": "Generated code snippet",
	"video": "Generated video draft",
	"ui": "Generated UI preview",
};

function resolveTitle(
	widget: ParsedGenerativeWidget,
	contentType: GenerativeContentType,
	derivedGenuiTitle?: string
): string {
	if (widget.title) {
		return clipText(widget.title, 72);
	}

	if (derivedGenuiTitle) {
		return clipText(derivedGenuiTitle, 72);
	}

	if (widget.body.kind === "image" && widget.body.prompt) {
		return clipText(widget.body.prompt, 72);
	}

	if (widget.body.kind === "audio" && widget.body.transcript) {
		return clipText(widget.body.transcript, 72);
	}

	if (widget.body.kind === "video" && widget.body.fileName) {
		return clipText(widget.body.fileName, 72);
	}

	if (widget.body.kind === "app-url" && widget.body.summary) {
		return clipText(widget.body.summary, 72);
	}

	if (widget.body.kind === "html" && widget.body.summary) {
		return clipText(widget.body.summary, 72);
	}

	return CONTENT_TYPE_FALLBACK_TITLES[contentType] ?? "Generated content";
}

function resolvePrimaryActionLabel(
	widget: ParsedGenerativeWidget,
	derivedGenuiPrimaryActionLabel?: string
): string | undefined {
	if (widget.primaryActionLabel) {
		return clipText(widget.primaryActionLabel, 40);
	}

	if (derivedGenuiPrimaryActionLabel) {
		return clipText(derivedGenuiPrimaryActionLabel, 40);
	}

	return undefined;
}

function resolveActions(
	widget: ParsedGenerativeWidget,
	primaryActionLabel: string | undefined,
	derivedGenuiActions: GenerativeWidgetActionItem[] = []
): GenerativeWidgetActionItem[] | undefined {
	const mergedActions = mergeActionItems([
		...(primaryActionLabel ? [{ label: primaryActionLabel }] : []),
		...(widget.actions ?? []),
		...derivedGenuiActions,
	]);
	const knownHrefs = Array.from(new Set(
		mergedActions
			.map((actionItem) => getNonEmptyString(actionItem.href))
			.filter((href): href is string => Boolean(href))
	));
	const additionalCandidates = isJsonRenderBody(widget.body)
		? collectUrlCandidates(widget.body.spec)
		: [];
	const allCandidates = Array.from(new Set([...knownHrefs, ...additionalCandidates]));
	const hydratedActions = mergedActions.map((actionItem) => {
		if (actionItem.href) {
			return actionItem;
		}

		const shouldInheritHref = /\b(view|edit|open|page)\b/i.test(actionItem.label);
		if (!shouldInheritHref || allCandidates.length === 0) {
			return actionItem;
		}

		if (knownHrefs.length === 1) {
			return { ...actionItem, href: knownHrefs[0] };
		}

		return {
			...actionItem,
			href: selectBestUrlForAction(actionItem.label, allCandidates),
		};
	});
	const resolvedActions = hydratedActions.map((actionItem) => ({
		...actionItem,
		label: clipText(actionItem.label, 40),
	}));

	if (resolvedActions.length === 0) {
		return undefined;
	}

	return resolvedActions;
}

export function resolveGenerativeWidgetMetadata(
	widget: ParsedGenerativeWidget
): GenerativeWidgetMetadata {
	const contentType = resolveContentType(widget);
	const derivedGenuiTitle = resolveGenuiTitleFromSpec(widget);
	const derivedGenuiDescription = resolveGenuiDescriptionFromSpec(widget);
	const derivedGenuiPrimaryActionLabel = resolveGenuiPrimaryActionLabelFromSpec(widget);
	const derivedGenuiActions = resolveGenuiActionsFromSpec(widget);
	const primaryActionLabel = resolvePrimaryActionLabel(
		widget,
		derivedGenuiPrimaryActionLabel
	);
	const actions = resolveActions(
		widget,
		primaryActionLabel,
		derivedGenuiActions
	);
	const actionLabels = actions?.map((actionItem) => actionItem.label);
	const iconHintText = [
		widget.title,
		widget.description,
		widget.summary,
		derivedGenuiTitle,
		derivedGenuiDescription,
		widget.source?.name,
	]
		.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
		.join(" ")
		.trim();

	return {
		contentType,
		title: resolveTitle(widget, contentType, derivedGenuiTitle),
		description: resolveDescription(widget, derivedGenuiDescription),
		source: widget.source,
		...(widget.iconHint ? { iconHint: widget.iconHint } : {}),
		...(iconHintText ? { iconHintText } : {}),
		...(primaryActionLabel ? { primaryActionLabel } : {}),
		...(actions ? { actions } : {}),
		...(actionLabels ? { actionLabels } : {}),
	};
}
