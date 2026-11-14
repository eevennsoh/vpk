import { getElementProps, getSpecTraversalKeys } from "@/components/projects/shared/lib/generative-widget-spec-query";
import {
	DEFAULT_DESCRIPTION,
	clipText,
	getNonEmptyString,
	isObjectRecord,
} from "@/components/projects/shared/lib/generative-widget-text";
import type { ParsedGenerativeWidget } from "@/components/projects/shared/lib/generative-widget-types";
import { isJsonRenderBody } from "@/components/projects/shared/lib/generative-widget-types";

const LOW_SIGNAL_WIDGET_DESCRIPTION_PATTERNS: ReadonlyArray<RegExp> = [
	/^generated from\b/i,
	/^upcoming events from google calendar\b/i,
	/^calendar information from google calendar\b/i,
	/^files from google drive\b/i,
	/^drive account information from google drive\b/i,
	/^design context extracted from figma\b/i,
	/^tool results\b/i,
];

function normalizeSentence(value: string): string {
	return value
		.toLowerCase()
		.replace(/[.!?]+$/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function isLowSignalWidgetDescription(value: string): boolean {
	const normalized = normalizeSentence(value);
	if (!normalized) {
		return true;
	}

	if (normalizeSentence(DEFAULT_DESCRIPTION) === normalized) {
		return true;
	}

	return LOW_SIGNAL_WIDGET_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function countCollectionItems(value: unknown): number {
	if (!Array.isArray(value)) {
		return 0;
	}

	return value.filter((entry) => entry !== null && entry !== undefined).length;
}

interface CalendarOverviewDetails {
	displayCount?: number;
	totalCount?: number;
	calendarName?: string;
	timeZone?: string;
}

function extractCalendarOverviewDetails(widget: ParsedGenerativeWidget): CalendarOverviewDetails {
	if (!isJsonRenderBody(widget.body)) {
		return {};
	}

	const traversalKeys = getSpecTraversalKeys(widget.body.spec);
	const details: CalendarOverviewDetails = {};

	for (const key of traversalKeys) {
		const element = widget.body.spec.elements[key];
		if (!isObjectRecord(element) || getNonEmptyString(element.type) !== "Text") {
			continue;
		}

		const props = getElementProps(element);
		if (!props) {
			continue;
		}

		const content = getNonEmptyString(props.content);
		if (!content) {
			continue;
		}

		if (!details.totalCount) {
			const showingMatch = content.match(/\bshowing\s+(\d+)\s+of\s+(\d+)\s+events?\b/i);
			if (showingMatch) {
				details.displayCount = Number.parseInt(showingMatch[1], 10);
				details.totalCount = Number.parseInt(showingMatch[2], 10);
			}
		}

		if (!details.calendarName) {
			const calendarMatch = content.match(/\bcalendar:\s*([^.\n]+)/i);
			if (calendarMatch?.[1]) {
				details.calendarName = calendarMatch[1].trim();
			}
		}

		if (!details.timeZone) {
			const timeZoneMatch = content.match(/\btime\s*zone:\s*([^.\n]+)/i);
			if (timeZoneMatch?.[1]) {
				details.timeZone = timeZoneMatch[1].trim();
			}
		}
	}

	return details;
}

function resolveGenuiContextDescription(
	widget: ParsedGenerativeWidget
): string | undefined {
	if (!isJsonRenderBody(widget.body)) {
		return undefined;
	}

	const traversalKeys = getSpecTraversalKeys(widget.body.spec);
	const calendarOverview = extractCalendarOverviewDetails(widget);

	for (const key of traversalKeys) {
		const element = widget.body.spec.elements[key];
		if (!isObjectRecord(element)) {
			continue;
		}

		const elementType = getNonEmptyString(element.type);
		const props = getElementProps(element);
		if (!elementType || !props) {
			continue;
		}

		if (elementType === "WorkSummary") {
			const jiraCount = countCollectionItems(props.jiraItems);
			const confluenceCount = countCollectionItems(props.confluencePages);
			if (jiraCount > 0 || confluenceCount > 0) {
				const parts = [
					jiraCount > 0 ? `${jiraCount} Jira work item${jiraCount === 1 ? "" : "s"}` : null,
					confluenceCount > 0
						? `${confluenceCount} Confluence page${confluenceCount === 1 ? "" : "s"}`
						: null,
				].filter((part): part is string => Boolean(part));
				if (parts.length === 2) {
					return `${parts[0]} and ${parts[1]} found.`;
				}
				return `${parts[0]} found.`;
			}
		}

		if (elementType === "CalendarTimeline") {
			const eventCount = countCollectionItems(props.events);
			if (eventCount > 0) {
				const resolvedCount =
					(calendarOverview.totalCount && calendarOverview.totalCount > 0)
						? calendarOverview.totalCount
						: eventCount;
				const countLabel = `${resolvedCount} calendar event${resolvedCount === 1 ? "" : "s"}`;
				if (calendarOverview.calendarName) {
					return `${countLabel} in ${calendarOverview.calendarName} calendar.`;
				}
				if (calendarOverview.timeZone) {
					return `${countLabel} (${calendarOverview.timeZone}).`;
				}
				return `${countLabel} in this timeline.`;
			}
		}

		if (elementType === "Timeline") {
			const itemCount = countCollectionItems(props.items);
			if (itemCount > 0) {
				return `${itemCount} timeline item${itemCount === 1 ? "" : "s"} in this view.`;
			}
		}

		if (elementType === "Metric") {
			const metricTitle =
				getNonEmptyString(props.title) ??
				getNonEmptyString(props.label) ??
				getNonEmptyString(props.name);
			const metricValue = getNonEmptyString(props.value);
			if (metricTitle && metricValue) {
				return `${metricTitle}: ${metricValue}`;
			}
			if (metricTitle) {
				return `${metricTitle} metric available.`;
			}
		}
	}

	for (const key of traversalKeys) {
		const element = widget.body.spec.elements[key];
		if (!isObjectRecord(element)) {
			continue;
		}

		if (getNonEmptyString(element.type) !== "Text") {
			continue;
		}

		const props = getElementProps(element);
		if (!props) {
			continue;
		}

		const content = getNonEmptyString(props.content);
		if (!content || content.length < 16) {
			continue;
		}

		if (content.toLowerCase() === DEFAULT_DESCRIPTION.toLowerCase()) {
			continue;
		}

		return content;
	}

	return undefined;
}

function resolvePreferredGenuiDescription({
	explicitDescription,
	derivedDescription,
	summary,
	contextDescription,
}: {
	explicitDescription?: string;
	derivedDescription?: string;
	summary?: string;
	contextDescription?: string;
}): string | undefined {
	const prioritizedCandidates = [
		explicitDescription && !isLowSignalWidgetDescription(explicitDescription)
			? explicitDescription
			: undefined,
		contextDescription,
		derivedDescription && !isLowSignalWidgetDescription(derivedDescription)
			? derivedDescription
			: undefined,
		summary && !isLowSignalWidgetDescription(summary)
			? summary
			: undefined,
		explicitDescription,
		derivedDescription,
		summary,
	];

	return prioritizedCandidates.find(
		(candidate): candidate is string =>
			typeof candidate === "string" && candidate.trim().length > 0
	);
}

export function resolveDescription(
	widget: ParsedGenerativeWidget,
	derivedGenuiDescription?: string
): string {
	const explicitDescription = widget.description
		? clipText(widget.description, 140)
		: undefined;

	const contextDescription = resolveGenuiContextDescription(widget);
	const preferredDescription = resolvePreferredGenuiDescription({
		explicitDescription,
		derivedDescription: derivedGenuiDescription
			? clipText(derivedGenuiDescription, 140)
			: undefined,
		summary: widget.summary
			? clipText(widget.summary, 140)
			: undefined,
		contextDescription,
	});
	if (preferredDescription) {
		return clipText(preferredDescription, 140);
	}

	if (explicitDescription) {
		return explicitDescription;
	}

	if (widget.body.kind === "image") {
		if (widget.title && widget.body.prompt) {
			return clipText(widget.body.prompt, 140);
		}
		return "AI-generated image";
	}

	if (widget.body.kind === "audio") {
		if (widget.title && widget.body.transcript) {
			return clipText(widget.body.transcript, 140);
		}
		return "AI-generated audio";
	}

	if (widget.body.kind === "video") {
		if (widget.title && widget.body.fileName) {
			return clipText(widget.body.fileName, 140);
		}
		return "AI-generated video";
	}

	if (widget.body.kind === "app-url" && widget.body.summary) {
		return clipText(widget.body.summary, 140);
	}

	if (widget.body.kind === "html" && widget.body.summary) {
		return clipText(widget.body.summary, 140);
	}

	return DEFAULT_DESCRIPTION;
}
