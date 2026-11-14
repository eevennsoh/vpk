import type { Spec } from "@json-render/react";
import { getNonEmptyString, isObjectRecord } from "@/components/projects/shared/lib/generative-widget-text";
import type { ParsedGenerativeWidget } from "@/components/projects/shared/lib/generative-widget-types";
import { isJsonRenderBody } from "@/components/projects/shared/lib/generative-widget-types";

export function getSpecTraversalKeys(spec: Spec): string[] {
	const keys: string[] = [];
	const visited = new Set<string>();
	const elements = spec.elements ?? {};

	const visit = (key: string) => {
		if (!key || visited.has(key)) {
			return;
		}

		visited.add(key);
		keys.push(key);

		const element = elements[key];
		if (!isObjectRecord(element) || !Array.isArray(element.children)) {
			return;
		}

		for (const childKey of element.children) {
			if (typeof childKey === "string" && childKey.trim().length > 0) {
				visit(childKey);
			}
		}
	};

	visit(spec.root);
	for (const key of Object.keys(elements)) {
		visit(key);
	}

	return keys;
}

export function getElementProps(element: Record<string, unknown>): Record<string, unknown> | null {
	return isObjectRecord(element.props) ? element.props : null;
}

interface SpecTitleCandidate {
	text: string;
	propName: string;
	key: string;
	score: number;
	index: number;
}

export function findBestTitleInSpec(widget: ParsedGenerativeWidget): SpecTitleCandidate | null {
	if (!isJsonRenderBody(widget.body)) {
		return null;
	}

	const traversalKeys = getSpecTraversalKeys(widget.body.spec);
	let best: SpecTitleCandidate | null = null;

	for (const [index, key] of traversalKeys.entries()) {
		const element = widget.body.spec.elements[key];
		if (!isObjectRecord(element)) {
			continue;
		}

		const elementType = getNonEmptyString(element.type);
		const props = getElementProps(element);
		if (!elementType || !props) {
			continue;
		}

		let candidateText: string | undefined;
		let propName = "title";
		let score = 0;
		if (elementType === "PageHeader") {
			candidateText = getNonEmptyString(props.title);
			score = 140;
		} else if (elementType === "Heading") {
			candidateText = getNonEmptyString(props.text);
			propName = "text";
			const headingLevel = getNonEmptyString(props.level);
			score = headingLevel === "h1" ? 130 : headingLevel === "h2" ? 125 : 120;
		} else if (elementType === "Card") {
			candidateText = getNonEmptyString(props.title);
			score = 110;
		} else {
			candidateText = getNonEmptyString(props.title);
			if (!candidateText) {
				candidateText = getNonEmptyString(props.text);
				propName = "text";
			}
			score = 80;
		}

		if (!candidateText) {
			continue;
		}

		if (!best || score > best.score || (score === best.score && index < best.index)) {
			best = { text: candidateText, propName, key, score, index };
		}
	}

	return best;
}

export function resolveGenuiTitleFromSpec(widget: ParsedGenerativeWidget): string | undefined {
	return findBestTitleInSpec(widget)?.text;
}

interface SpecDescriptionCandidate {
	text: string;
	propName: string;
	key: string;
	score: number;
	index: number;
}

export function findBestDescriptionInSpec(widget: ParsedGenerativeWidget): SpecDescriptionCandidate | null {
	if (!isJsonRenderBody(widget.body)) {
		return null;
	}

	const traversalKeys = getSpecTraversalKeys(widget.body.spec);
	let best: SpecDescriptionCandidate | null = null;

	for (const [index, key] of traversalKeys.entries()) {
		const element = widget.body.spec.elements[key];
		if (!isObjectRecord(element)) {
			continue;
		}

		const elementType = getNonEmptyString(element.type);
		const props = getElementProps(element);
		if (!elementType || !props) {
			continue;
		}

		let candidateText: string | undefined;
		let propName = "description";
		let score = 0;
		if (elementType === "PageHeader") {
			candidateText = getNonEmptyString(props.description);
			score = 140;
		} else if (elementType === "Card") {
			candidateText = getNonEmptyString(props.description);
			score = 120;
		} else if (elementType === "Text") {
			candidateText = getNonEmptyString(props.content);
			propName = "content";
			score = 100;
		} else {
			candidateText = getNonEmptyString(props.description);
			score = 80;
		}

		if (!candidateText || candidateText.length < 12) {
			continue;
		}

		if (!best || score > best.score || (score === best.score && index < best.index)) {
			best = { text: candidateText, propName, key, score, index };
		}
	}

	return best;
}

export function resolveGenuiDescriptionFromSpec(widget: ParsedGenerativeWidget): string | undefined {
	return findBestDescriptionInSpec(widget)?.text;
}
