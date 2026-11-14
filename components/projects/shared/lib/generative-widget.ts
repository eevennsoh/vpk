import type { Spec } from "@json-render/react";
import {
	findBestDescriptionInSpec,
	findBestTitleInSpec,
	getElementProps,
} from "@/components/projects/shared/lib/generative-widget-spec-query";
import {
	DEFAULT_DESCRIPTION,
	clipText,
	getNonEmptyString,
	isObjectRecord,
} from "@/components/projects/shared/lib/generative-widget-text";
import type {
	GenerativeWidgetPrimaryActionPayload,
	ParsedGenerativeWidget,
} from "@/components/projects/shared/lib/generative-widget-types";
import { isJsonRenderBody } from "@/components/projects/shared/lib/generative-widget-types";

export type {
	ParsedGenerativeWidgetSource,
	GenerativeWidgetActionItem,
	PreviewImageSource,
	PreviewVideoTrack,
	PreviewVideoClip,
	PreviewVideoComposition,
	PreviewVideoFile,
	PreviewExcalidrawScene,
	PreviewBody,
	ParsedGenerativeWidget,
	PreviewAudioBody,
	PreviewImageBody,
	PreviewVideoBody,
	GenerativeWidgetMetadata,
	GenerativeWidgetPrimaryActionPayload,
	GenerativeContentType,
} from "@/components/projects/shared/lib/generative-widget-types";
export {
	parseExcalidrawPreviewScene,
} from "@/components/projects/shared/lib/generative-widget-preview-body";
export {
	parseGenerativeWidget,
} from "@/components/projects/shared/lib/generative-widget-parse";
export {
	resolveGenerativeWidgetMetadata,
} from "@/components/projects/shared/lib/generative-widget-metadata";

export function buildGenerativeWidgetSubmitPrompt(
	payload: GenerativeWidgetPrimaryActionPayload
): string {
	const serializedState = JSON.stringify(payload.formState ?? {}, null, 2);

	return [
		`Please execute "${payload.actionLabel}" for "${payload.title}".`,
		`Context: ${payload.description}`,
		"Use these form values:",
		"```json",
		serializedState,
		"```",
	].join("\n");
}

interface SpecTextSource {
	key: string;
	propName: string;
}

function findTitleSourceInSpec(widget: ParsedGenerativeWidget): SpecTextSource | null {
	const best = findBestTitleInSpec(widget);
	return best ? { key: best.key, propName: best.propName } : null;
}

function findDescriptionSourceInSpec(widget: ParsedGenerativeWidget): SpecTextSource | null {
	const best = findBestDescriptionInSpec(widget);
	return best ? { key: best.key, propName: best.propName } : null;
}

const REMOVABLE_HEADER_TYPES = new Set(["PageHeader", "Heading", "Text"]);
const COLLAPSIBLE_EMPTY_CONTAINER_TYPES = new Set(["Stack"]);
const TRANSLATED_HEADING_PATTERN = /^translated\s*\(/i;
const USAGE_NOTES_CARD_TITLE_PATTERN = /^usage\s+notes\b/i;
const BODY_ONLY_SPEC_CACHE = new WeakMap<
	Spec,
	Map<string, Spec>
>();
function getLiveChildKeys(
	children: unknown[],
	elements: Record<string, unknown>,
	keysToRemove: ReadonlySet<string>
): string[] {
	return children.filter((childKey): childKey is string => {
		if (typeof childKey !== "string" || childKey.trim().length === 0) {
			return false;
		}

		if (keysToRemove.has(childKey)) {
			return false;
		}

		return Object.prototype.hasOwnProperty.call(elements, childKey);
	});
}

function isSeparatorElement(element: unknown): boolean {
	return isObjectRecord(element) && getNonEmptyString(element.type) === "Separator";
}

function normalizeChildKeySequence(
	childKeys: readonly string[],
	elements: Record<string, unknown>
): string[] {
	const normalized: string[] = [];

	for (const childKey of childKeys) {
		const childIsSeparator = isSeparatorElement(elements[childKey]);
		if (normalized.length === 0 && childIsSeparator) {
			continue;
		}

		const previousKey = normalized[normalized.length - 1];
		const previousIsSeparator = previousKey
			? isSeparatorElement(elements[previousKey])
			: false;

		if (childIsSeparator && previousIsSeparator) {
			continue;
		}

		normalized.push(childKey);
	}

	while (
		normalized.length > 0 &&
		isSeparatorElement(elements[normalized[normalized.length - 1]])
	) {
		normalized.pop();
	}

	return normalized;
}

function arraysMatch(left: readonly string[], right: readonly string[]): boolean {
	if (left.length !== right.length) {
		return false;
	}

	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) {
			return false;
		}
	}

	return true;
}

function normalizeTranslationTypography(
	elements: Record<string, unknown>
): Record<string, unknown> {
	const normalizedElements: Record<string, unknown> = { ...elements };

	for (const element of Object.values(normalizedElements)) {
		if (!isObjectRecord(element) || getNonEmptyString(element.type) !== "Stack") {
			continue;
		}

		if (!Array.isArray(element.children)) {
			continue;
		}

		const childKeys = element.children.filter(
			(childKey): childKey is string =>
				typeof childKey === "string" && childKey.trim().length > 0
		);
		if (childKeys.length < 2) {
			continue;
		}

		const translatedHeadingKey = childKeys[0];
		const translatedValueKey = childKeys[1];
		const translatedHeading = normalizedElements[translatedHeadingKey];
		if (
			!isObjectRecord(translatedHeading) ||
			getNonEmptyString(translatedHeading.type) !== "Heading"
		) {
			continue;
		}

		const translatedHeadingProps = getElementProps(translatedHeading);
		const translatedHeadingText = translatedHeadingProps
			? getNonEmptyString(translatedHeadingProps.text)
			: undefined;
		if (!translatedHeadingText || !TRANSLATED_HEADING_PATTERN.test(translatedHeadingText)) {
			continue;
		}

		normalizedElements[translatedHeadingKey] = {
			...translatedHeading,
			props: {
				...(translatedHeadingProps ?? {}),
				level: "h4",
				className: "text-sm font-semibold",
			},
		};

		const translatedValue = normalizedElements[translatedValueKey];
		if (!isObjectRecord(translatedValue)) {
			continue;
		}

		const translatedValueType = getNonEmptyString(translatedValue.type);
		const translatedValueProps = getElementProps(translatedValue);
		if (!translatedValueType || !translatedValueProps) {
			continue;
		}

		if (translatedValueType === "Heading") {
			normalizedElements[translatedValueKey] = {
				...translatedValue,
				props: {
					...translatedValueProps,
					level: "h4",
					className: "text-lg font-medium",
				},
			};
			continue;
		}

		if (translatedValueType === "Text") {
			const translatedBodyText = getNonEmptyString(translatedValueProps.content);
			if (translatedBodyText) {
				normalizedElements[translatedValueKey] = {
					...translatedValue,
					type: "Heading",
					props: {
						text: translatedBodyText,
						level: "h4",
						className: "text-lg font-medium",
					},
				};
				continue;
			}

			normalizedElements[translatedValueKey] = {
				...translatedValue,
				props: {
					...translatedValueProps,
					size: "base",
					muted: null,
				},
			};
		}
	}

	return normalizedElements;
}

function normalizeUsageNotesGap(
	elements: Record<string, unknown>
): Record<string, unknown> {
	const normalizedElements: Record<string, unknown> = { ...elements };

	for (const [key, element] of Object.entries(normalizedElements)) {
		if (!isObjectRecord(element) || getNonEmptyString(element.type) !== "Stack") {
			continue;
		}

		if (!Array.isArray(element.children)) {
			continue;
		}

		const childKeys = element.children.filter(
			(childKey): childKey is string =>
				typeof childKey === "string" && childKey.trim().length > 0
		);
		if (childKeys.length < 2) {
			continue;
		}

		const hasUsageNotesCard = childKeys.some((childKey) => {
			const childElement = normalizedElements[childKey];
			if (!isObjectRecord(childElement) || getNonEmptyString(childElement.type) !== "Card") {
				return false;
			}

			const childProps = getElementProps(childElement);
			const childTitle = childProps ? getNonEmptyString(childProps.title) : undefined;
			return Boolean(
				childTitle && USAGE_NOTES_CARD_TITLE_PATTERN.test(childTitle)
			);
		});
		if (!hasUsageNotesCard) {
			continue;
		}

		normalizedElements[key] = {
			...element,
			props: {
				...(getElementProps(element) ?? {}),
				gap: "md",
			},
		};
	}

	return normalizedElements;
}

function pruneUnreachableElements(
	rootKey: string,
	elements: Record<string, unknown>
): Record<string, unknown> {
	const reachableKeys = new Set<string>();
	const stack = [rootKey];

	while (stack.length > 0) {
		const currentKey = stack.pop();
		if (!currentKey || reachableKeys.has(currentKey)) {
			continue;
		}

		if (!Object.prototype.hasOwnProperty.call(elements, currentKey)) {
			continue;
		}

		reachableKeys.add(currentKey);
		const element = elements[currentKey];
		if (!isObjectRecord(element) || !Array.isArray(element.children)) {
			continue;
		}

		for (const childKey of element.children) {
			if (typeof childKey === "string" && childKey.trim().length > 0) {
				stack.push(childKey);
			}
		}
	}

	const pruned: Record<string, unknown> = {};
	for (const key of reachableKeys) {
		pruned[key] = elements[key];
	}

	return pruned;
}

function collectActionButtonKeysFromSpec(spec: Spec): Set<string> {
	const buttonKeys = new Set<string>();

	for (const [key, element] of Object.entries(spec.elements ?? {})) {
		if (!isObjectRecord(element)) {
			continue;
		}

		if (getNonEmptyString(element.type) !== "Button") {
			continue;
		}

		buttonKeys.add(key);
	}

	return buttonKeys;
}

function getBodyOnlySpecCacheKey(
	widget: ParsedGenerativeWidget | { spec: Spec }
): string {
	if (!("body" in widget)) {
		return "";
	}

	return `${widget.title ?? ""}\u0000${widget.description ?? ""}`;
}

export function createBodyOnlySpec(
	widget: ParsedGenerativeWidget | { spec: Spec }
): Spec {
	const normalizedWidget = "body" in widget
		? widget
		: ({
			type: "genui-preview",
			body: {
				kind: "json-render",
				spec: widget.spec,
			},
			source: null,
		} satisfies ParsedGenerativeWidget);
	const spec = "body" in widget
		? isJsonRenderBody(widget.body)
			? widget.body.spec
			: null
		: widget.spec;
	if (!spec) {
		return { root: "", elements: {} };
	}

	const cacheKey = getBodyOnlySpecCacheKey(widget);
	const cachedSpecs = BODY_ONLY_SPEC_CACHE.get(spec);
	const cachedSpec = cachedSpecs?.get(cacheKey);
	if (cachedSpec) {
		return cachedSpec;
	}

	const specElements = isObjectRecord(spec.elements)
		? spec.elements
		: null;
	if (!specElements) {
		return spec;
	}

	const titleSource = findTitleSourceInSpec(normalizedWidget);
	const descSource = findDescriptionSourceInSpec(normalizedWidget);
	const actionButtonKeys = collectActionButtonKeysFromSpec(spec);

	if (!titleSource && !descSource && actionButtonKeys.size === 0) {
		return spec;
	}

	const propsToStrip = new Map<string, Set<string>>();
	for (const source of [titleSource, descSource]) {
		if (!source) continue;
		const strippedProps = propsToStrip.get(source.key) ?? new Set<string>();
		strippedProps.add(source.propName);
		propsToStrip.set(source.key, strippedProps);
	}

	const newElements: Record<string, unknown> = {};
	const keysToRemove = new Set<string>();

	for (const [key, element] of Object.entries(specElements)) {
		if (actionButtonKeys.has(key)) {
			keysToRemove.add(key);
			continue;
		}

		if (!propsToStrip.has(key)) {
			newElements[key] = element;
			continue;
		}

		if (!isObjectRecord(element)) {
			newElements[key] = element;
			continue;
		}

		const props = getElementProps(element);
		if (!props) {
			newElements[key] = element;
			continue;
		}

		const stripSet = propsToStrip.get(key)!;
		const newProps: Record<string, unknown> = {};
		for (const [propKey, propVal] of Object.entries(props)) {
			if (!stripSet.has(propKey)) {
				newProps[propKey] = propVal;
			}
		}

		const elementType = getNonEmptyString(element.type);
		const hasChildren = Array.isArray(element.children) && element.children.length > 0;

		if (!hasChildren && elementType && REMOVABLE_HEADER_TYPES.has(elementType)) {
			keysToRemove.add(key);
		} else {
			newElements[key] = { ...element, props: newProps };
		}
	}

	if (keysToRemove.has(spec.root)) {
		return spec;
	}

	let changed = true;
	while (changed) {
		changed = false;

		for (const [key, element] of Object.entries(newElements)) {
			if (key === spec.root || keysToRemove.has(key)) {
				continue;
			}
			if (!isObjectRecord(element) || !Array.isArray(element.children)) {
				continue;
			}

			const elementType = getNonEmptyString(element.type);
			if (!elementType || !COLLAPSIBLE_EMPTY_CONTAINER_TYPES.has(elementType)) {
				continue;
			}

			const originalChildren = element.children.filter(
				(childKey): childKey is string =>
					typeof childKey === "string" && childKey.trim().length > 0
			);
			if (originalChildren.length === 0) {
				continue;
			}

			const liveChildren = getLiveChildKeys(
				element.children,
				newElements,
				keysToRemove
			);
			if (liveChildren.length > 0) {
				continue;
			}

			keysToRemove.add(key);
			changed = true;
		}
	}

	if (keysToRemove.has(spec.root)) {
		return spec;
	}

	const elementsAfterRemoval: Record<string, unknown> = {};
	for (const [key, element] of Object.entries(newElements)) {
		if (!keysToRemove.has(key)) {
			elementsAfterRemoval[key] = element;
		}
	}

	if (!Object.prototype.hasOwnProperty.call(elementsAfterRemoval, spec.root)) {
		return spec;
	}

	const normalizedElements: Record<string, unknown> = {};
	for (const [key, element] of Object.entries(elementsAfterRemoval)) {
		if (!isObjectRecord(element) || !Array.isArray(element.children)) {
			normalizedElements[key] = element;
			continue;
		}

		const liveChildren = getLiveChildKeys(
			element.children,
			elementsAfterRemoval,
			new Set<string>()
		);
		const normalizedChildren = normalizeChildKeySequence(
			liveChildren,
			elementsAfterRemoval
		);

		if (arraysMatch(liveChildren, normalizedChildren)) {
			normalizedElements[key] = { ...element, children: liveChildren };
			continue;
		}

		normalizedElements[key] = { ...element, children: normalizedChildren };
	}

	const prunedElements = pruneUnreachableElements(
		spec.root,
		normalizedElements
	);

	if (!Object.prototype.hasOwnProperty.call(prunedElements, spec.root)) {
		return spec;
	}

	const bodyOnlySpec = {
		...spec,
		elements: normalizeUsageNotesGap(
			normalizeTranslationTypography(prunedElements)
		),
	} as Spec;

	if (cachedSpecs) {
		cachedSpecs.set(cacheKey, bodyOnlySpec);
	} else {
		BODY_ONLY_SPEC_CACHE.set(spec, new Map([[cacheKey, bodyOnlySpec]]));
	}

	return bodyOnlySpec;
}

/* -------------------------------------------------------------------------- */
/*  Card description formatting                                               */
/* -------------------------------------------------------------------------- */

const CARD_DESCRIPTION_MAX_LENGTH = 96;
const ASSISTANT_PROCESS_LEAD_PATTERN =
	/^(?:let me|i(?:'ll|’ll| will| am going to| can| need to))\s+(?:now\s+)?(?:(?:go\s+)?(?:fetch|get|look up|retrieve|find|gather|pull|check|load|inspect|analy[sz]e|summari[sz]e|generate|create|build|make)\s+)/i;
const ASSISTANT_PROCESS_FOLLOWUP_PATTERN =
	/\s+and\s+(?:then\s+)?(?:summari[sz]e|show|display|render|present)\b.*$/i;
const ASSISTANT_PROCESS_PURPOSE_PATTERN =
	/\s+(?:to|so i can)\s+(?:get|summari[sz]e|show|display|understand|find|identify|review)\b.*$/i;

function capitalizeFirstCharacter(value: string): string {
	return value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

function stripAssistantProcessLanguage(value: string): string {
	const compact = value.replace(/\s+/g, " ").trim();
	const withoutLead = compact.replace(ASSISTANT_PROCESS_LEAD_PATTERN, "").trim();
	if (withoutLead === compact || !withoutLead) {
		return compact;
	}

	const withoutFollowup = withoutLead
		.replace(ASSISTANT_PROCESS_FOLLOWUP_PATTERN, "")
		.replace(ASSISTANT_PROCESS_PURPOSE_PATTERN, "")
		.replace(/^(?:the|a|an)\s+/i, "")
		.trim();

	return withoutFollowup
		? capitalizeFirstCharacter(withoutFollowup)
		: compact;
}

export function formatGenerativeWidgetCardDescription(description: string): string {
	const compact = (getNonEmptyString(description) ?? DEFAULT_DESCRIPTION)
		.replace(/\s+/g, " ")
		.trim();
	const displayDescription = stripAssistantProcessLanguage(compact);
	const firstSentence = displayDescription.match(/^(.+?[.!?])(?:\s|$)/u)?.[1]?.trim();
	const sentenceCandidate =
		firstSentence &&
		firstSentence.length >= 24 &&
		firstSentence.length <= CARD_DESCRIPTION_MAX_LENGTH
			? firstSentence
			: displayDescription;

	return clipText(sentenceCandidate, CARD_DESCRIPTION_MAX_LENGTH);
}
