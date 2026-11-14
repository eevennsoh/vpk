import { getElementProps } from "@/components/projects/shared/lib/generative-widget-spec-query";
import { getNonEmptyString, isObjectRecord } from "@/components/projects/shared/lib/generative-widget-text";
import type {
	GenerativeContentType,
	ParsedGenerativeWidget,
} from "@/components/projects/shared/lib/generative-widget-types";
import { isJsonRenderBody } from "@/components/projects/shared/lib/generative-widget-types";

export const GENERATIVE_CONTENT_TYPE_HINT_KEYS = [
	"contentType",
	"generatedContentType",
	"artifactType",
	"outputType",
	"widgetContentType",
] as const;

const CONTENT_TYPE_HINT_MATCHERS: ReadonlyArray<{
	pattern: RegExp;
	contentType: GenerativeContentType;
}> = [
	{
		pattern: /\b(bar(?:\s|-)?chart|column(?:\s|-)?chart|histogram)\b/i,
		contentType: "chart-bar",
	},
	{
		pattern: /\b(line(?:\s|-)?chart|trend\s*chart|time\s*series)\b/i,
		contentType: "chart-line",
	},
	{
		pattern: /\b(area(?:\s|-)?chart)\b/i,
		contentType: "chart-area",
	},
	{
		pattern: /\b(pie(?:\s|-)?chart|donut(?:\s|-)?chart|doughnut(?:\s|-)?chart)\b/i,
		contentType: "chart-pie",
	},
	{
		pattern: /\b(radar(?:\s|-)?chart|spider(?:\s|-)?chart)\b/i,
		contentType: "chart-radar",
	},
	{
		pattern: /\b(scatter(?:\s|-)?plot|scatter(?:\s|-)?chart|bubble(?:\s|-)?chart|bubble\s*plot)\b/i,
		contentType: "chart-scatter",
	},
	{
		pattern: /\b(stock\s*(?:price|quote|ticker|data)|share\s*price|market\s*cap(?:italization)?|current\s*price|previous\s*close|day\s*range|52[\s-]*week|trading\s*(?:volume|data)|avg\s*volume)\b/i,
		contentType: "chart",
	},
	{
		pattern: /\b(news|headlines?|breaking\s*news|key\s*events?|market\s*(?:analysis|report|news)|analyst\s*sentiment)\b/i,
		contentType: "feed",
	},
	{
		pattern: /\b(chart|graph|plot|visuali[sz]ation)\b/i,
		contentType: "chart",
	},
	{
		pattern: /\bgoogle\s+calendar\b|\bcalendar\b/i,
		contentType: "calendar",
	},
	{
		pattern: /\b(translate|translation|source\s+language|target\s+language|translated\s+text)\b/i,
		contentType: "translation",
	},
	{
		pattern: /\b(send|post|reply|write)\b[\s\S]{0,30}\b(message|slack|dm|direct\s+message)\b|\b(slack|channel|dm|direct\s+message)\b/i,
		contentType: "message",
	},
	{
		pattern: /\b(work\s*item|work-item|work\s*summary|task|tasks|issue|issues|ticket|tickets|bug|bugs|story|epic|backlog)\b/i,
		contentType: "work-item",
	},
	{
		pattern: /\b(board|kanban|sprint\s*board)\b/i,
		contentType: "board",
	},
	{
		pattern: /\b(page|document|doc|docs|wiki|article)\b/i,
		contentType: "page",
	},
	{
		pattern: /\b(table|grid|spreadsheet|dataset)\b/i,
		contentType: "table",
	},
	{
		pattern: /\b(code|snippet|script|sql|query|json|markdown)\b/i,
		contentType: "code",
	},
	{
		pattern: /\b(audio|sound|voice(?:over)?|narration|podcast|speech)\b/i,
		contentType: "sound",
	},
	{
		pattern: /\b(video|clip|reel|movie)\b/i,
		contentType: "video",
	},
	{
		pattern: /\b(image|images|picture|photo|illustration|mockup|banner)\b/i,
		contentType: "image",
	},
	{
		pattern: /\b(text|summary|draft|copy|transcript|notes?)\b/i,
		contentType: "text",
	},
	{
		pattern: /\b(ui|interface|layout|form|dashboard)\b/i,
		contentType: "ui",
	},
];

const EXACT_CONTENT_TYPE_HINT_MAP: ReadonlyMap<string, GenerativeContentType> = new Map([
	["image", "image"],
	["text", "text"],
	["translation", "translation"],
	["translate", "translation"],
	["message", "message"],
	["calendar", "calendar"],
	["bar chart", "chart-bar"],
	["line chart", "chart-line"],
	["area chart", "chart-area"],
	["pie chart", "chart-pie"],
	["radar chart", "chart-radar"],
	["scatter chart", "chart-scatter"],
	["chart", "chart"],
	["feed", "feed"],
	["news", "feed"],
	["sound", "sound"],
	["audio", "sound"],
	["video", "video"],
	["work item", "work-item"],
	["work summary", "work-item"],
	["page", "page"],
	["board", "board"],
	["table", "table"],
	["code", "code"],
	["ui", "ui"],
]);

const ELEMENT_TYPE_CONTENT_MATCHERS: ReadonlyArray<{
	pattern: RegExp;
	contentType: GenerativeContentType;
}> = [
	{ pattern: /\bcalendar\b/i, contentType: "calendar" },
	{ pattern: /\bbar\s*chart\b/i, contentType: "chart-bar" },
	{ pattern: /\bline\s*chart\b/i, contentType: "chart-line" },
	{ pattern: /\barea\s*chart\b/i, contentType: "chart-area" },
	{ pattern: /\bpie\s*chart\b/i, contentType: "chart-pie" },
	{ pattern: /\bradar\s*chart\b/i, contentType: "chart-radar" },
	{ pattern: /\bscatter\s*chart\b/i, contentType: "chart-scatter" },
	{ pattern: /\bbubble\s*chart\b/i, contentType: "chart-scatter" },
	{ pattern: /\btable\b/i, contentType: "table" },
	{ pattern: /\bpage\s*header\b/i, contentType: "page" },
	{ pattern: /\bwork\s*item\b/i, contentType: "work-item" },
	{ pattern: /\bboard\b/i, contentType: "board" },
	{ pattern: /\bcode\s*block\b/i, contentType: "code" },
	{ pattern: /\bimage\b/i, contentType: "image" },
	{ pattern: /\baudio\b/i, contentType: "sound" },
	{ pattern: /\bvideo\b/i, contentType: "video" },
	{ pattern: /\bchart\b/i, contentType: "chart" },
];

function normalizeHintText(value: string): string {
	return value
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function resolveContentTypeFromHint(value?: string): GenerativeContentType | null {
	if (!value) {
		return null;
	}

	const normalized = normalizeHintText(value);
	if (!normalized) {
		return null;
	}

	const exactContentType = EXACT_CONTENT_TYPE_HINT_MAP.get(normalized);
	if (exactContentType) {
		return exactContentType;
	}

	for (const matcher of CONTENT_TYPE_HINT_MATCHERS) {
		if (matcher.pattern.test(normalized)) {
			return matcher.contentType;
		}
	}

	return null;
}

function resolveContentTypeFromElementType(value: string): GenerativeContentType | null {
	const normalized = normalizeHintText(value);
	if (!normalized) {
		return null;
	}

	for (const matcher of ELEMENT_TYPE_CONTENT_MATCHERS) {
		if (matcher.pattern.test(normalized)) {
			return matcher.contentType;
		}
	}

	return null;
}

function resolveContentTypeFromElementProps(
	element: Record<string, unknown>
): GenerativeContentType | null {
	const props = getElementProps(element);
	if (!props) {
		return null;
	}

	const hintText = [
		getNonEmptyString(props.title),
		getNonEmptyString(props.description),
		getNonEmptyString(props.content),
		getNonEmptyString(props.text),
		getNonEmptyString(props.label),
	]
		.filter((value): value is string => Boolean(value))
		.join(" ");
	if (!hintText) {
		return null;
	}

	return resolveContentTypeFromHint(hintText);
}

function resolveGenuiContentType(widget: ParsedGenerativeWidget): GenerativeContentType {
	if (!isJsonRenderBody(widget.body)) {
		if (widget.body.kind === "text") {
			return "text";
		}

		if (widget.body.kind === "code" || widget.body.kind === "json") {
			return "code";
		}

		if (widget.body.kind === "image") {
			return "image";
		}

		if (widget.body.kind === "audio") {
			return "sound";
		}

		if (widget.body.kind === "video") {
			return "video";
		}

		if (widget.body.kind === "app-url") {
			return "ui";
		}

		if (widget.body.kind === "html") {
			return "text";
		}

		return "other";
	}

	if (widget.contentTypeHint === "memory") {
		return "memory";
	}

	if (widget.contentTypeHint === "skill") {
		return "skill";
	}

	const textHints = [
		widget.title,
		widget.description,
		widget.summary,
		widget.primaryActionLabel,
		widget.source?.name,
	]
		.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
		.join(" ");

	const hintedContentType = resolveContentTypeFromHint(textHints);
	if (hintedContentType) {
		return hintedContentType;
	}

	for (const value of Object.values(widget.body.spec.elements ?? {})) {
		if (!isObjectRecord(value)) {
			continue;
		}

		const inferredFromProps = resolveContentTypeFromElementProps(value);
		if (inferredFromProps) {
			return inferredFromProps;
		}

		const typeName = getNonEmptyString(value.type);
		if (!typeName) {
			continue;
		}

		const inferredElementType = resolveContentTypeFromElementType(typeName);
		if (inferredElementType) {
			return inferredElementType;
		}
	}

	return "other";
}

export function resolveContentType(widget: ParsedGenerativeWidget): GenerativeContentType {
	const explicitHint = resolveContentTypeFromHint(widget.contentTypeHint);
	const inferredContentType = resolveGenuiContentType(widget);

	if (
		explicitHint &&
		!(
			explicitHint === "text" &&
			inferredContentType !== "other" &&
			inferredContentType !== "text"
		)
	) {
		return explicitHint;
	}

	if (inferredContentType !== "other") {
		return inferredContentType;
	}

	return explicitHint ?? inferredContentType;
}
