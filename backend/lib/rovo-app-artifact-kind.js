const { getNonEmptyString } = require("./shared-utils");

const CODE_REQUEST_REGEX =
	/\b(code|component|tsx|jsx|react|javascript|typescript|python|sql|api|function|script|app|ui|page|web\s?page|website|site|landing\s?page|home\s?page|homepage|html|css|tailwind)\b/i;
const IMAGE_REQUEST_REGEX = /\b(image|photo|picture|illustration|graphic|logo)\b/i;
const SHEET_REQUEST_REGEX = /\b(spreadsheet|sheet|csv)\b/i;
const TABLE_REQUEST_REGEX = /\b(table|matrix|grid)\b/i;
// A request that names a document and mentions a table ("a one-page brief with
// a timeline table") wants a document that contains a table, not a sheet.
const DOCUMENT_REQUEST_REGEX =
	/\b(document|doc|brief|memo|report|plan|proposal|spec|write-?up|article|essay|summary|letter|email)\b/i;
// "one-page brief", "a 2 page memo": a length, not a web page.
const PAGE_LENGTH_REGEX = /\b(?:one|single|two|three|four|five|half|\d+)[-\s]pages?\b/giu;
const HTML_REPORT_REQUEST_REGEX =
	/\bhtml\s+report\b|\breport\s+html\b|\b(html|self-contained)\b.{0,60}\breport\b|\breport\b.{0,60}\bhtml\b/i;

function normalizeRovoAppArtifactKind(value) {
	const normalizedValue = getNonEmptyString(value)?.toLowerCase();
	if (normalizedValue === "code") {
		return "code";
	}

	if (normalizedValue === "html") {
		return "html";
	}

	if (normalizedValue === "sheet" || normalizedValue === "spreadsheet" || normalizedValue === "table") {
		return "sheet";
	}

	if (normalizedValue === "image") {
		return "image";
	}

	if (normalizedValue === "excalidraw") {
		return "excalidraw";
	}

	return "text";
}

function inferRovoAppArtifactKindFromRequest(latestUserMessage, fallbackKind = "text") {
	const normalizedMessage = getNonEmptyString(latestUserMessage)?.replace(PAGE_LENGTH_REGEX, "length");
	if (!normalizedMessage) {
		return normalizeRovoAppArtifactKind(fallbackKind);
	}

	if (IMAGE_REQUEST_REGEX.test(normalizedMessage)) {
		return "image";
	}

	if (
		SHEET_REQUEST_REGEX.test(normalizedMessage) ||
		(TABLE_REQUEST_REGEX.test(normalizedMessage) && !DOCUMENT_REQUEST_REGEX.test(normalizedMessage))
	) {
		return "sheet";
	}

	if (HTML_REPORT_REQUEST_REGEX.test(normalizedMessage)) {
		return "html";
	}

	if (CODE_REQUEST_REGEX.test(normalizedMessage)) {
		return "code";
	}

	return normalizeRovoAppArtifactKind(fallbackKind);
}

const MARKDOWN_FENCE_REGEX = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/u;
// GFM rows and separators: outer pipes are optional, so any line with a pipe
// counts as a row, and a separator is dashes (with optional colons) and pipes.
const MARKDOWN_TABLE_SEPARATOR_REGEX = /^\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)+\|?$|^\|\s*:?-+:?\s*\|$/u;
const MARKDOWN_HEADING_REGEX = /^#{1,6}\s/u;
const MARKDOWN_BOLD_CAPTION_REGEX = /^(\*\*|__)[^*_]+\1:?$/u;

function isMarkdownTableRow(line) {
	return line.includes("|");
}

function isMarkdownCaption(line) {
	return MARKDOWN_HEADING_REGEX.test(line) || MARKDOWN_BOLD_CAPTION_REGEX.test(line);
}

function getMarkdownContentLines(content) {
	const fenced = content.trim().match(MARKDOWN_FENCE_REGEX);
	return (fenced ? fenced[1] : content)
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

// A sheet is a table and nothing else (headings or a bold line allowed as
// captions). A text document that merely contains a table stays a document.
function isMarkdownTableOnlyContent(content) {
	let hasSeparator = false;
	for (const line of getMarkdownContentLines(content)) {
		if (MARKDOWN_TABLE_SEPARATOR_REGEX.test(line)) {
			hasSeparator = true;
			continue;
		}
		if (!isMarkdownTableRow(line) && !isMarkdownCaption(line)) {
			return false;
		}
	}
	return hasSeparator;
}

// A table plus at least two lines that are neither table rows nor captions (a
// paragraph, a list item): a document that contains a table.
function isMarkdownDocumentWithTable(content) {
	const lines = getMarkdownContentLines(content);
	const hasTable = lines.some((line) => MARKDOWN_TABLE_SEPARATOR_REGEX.test(line));
	const proseLineCount = lines.filter((line) => !isMarkdownTableRow(line) && !isMarkdownCaption(line)).length;
	return hasTable && proseLineCount >= 2;
}

function inferRovoAppArtifactKindFromContent(content, fallbackKind = "text") {
	const normalizedContent = getNonEmptyString(content);
	if (!normalizedContent) {
		return normalizeRovoAppArtifactKind(fallbackKind);
	}

	if (/^data:image\//iu.test(normalizedContent)) {
		return "image";
	}

	if (
		/^\s*\{\s*"type"\s*:\s*"excalidraw"/iu.test(normalizedContent) &&
		/"elements"\s*:\s*\[/iu.test(normalizedContent)
	) {
		return "excalidraw";
	}

	if (
		normalizeRovoAppArtifactKind(fallbackKind) === "html" &&
		(
			/<!doctype html>/iu.test(normalizedContent) ||
			/<html[\s>]/iu.test(normalizedContent)
		)
	) {
		return "html";
	}

	if (
		/<!doctype html>/iu.test(normalizedContent) ||
		/<html[\s>]/iu.test(normalizedContent) ||
		/<head[\s>]/iu.test(normalizedContent) ||
		/<body[\s>]/iu.test(normalizedContent) ||
		/<style[\s>]/iu.test(normalizedContent) ||
		/<script[\s>]/iu.test(normalizedContent) ||
		/^```(?:html|tsx|jsx|css|js|javascript|ts|typescript)/imu.test(normalizedContent) ||
		/^\s*(?:import|export|const|let|var|function|class|interface|type)\s+/imu.test(normalizedContent)
	) {
		return "code";
	}

	if (isMarkdownTableOnlyContent(normalizedContent)) {
		return "sheet";
	}

	// A "sheet" whose content reads as a document (a table with more than a
	// one-line intro around it) is a document. This also corrects artifacts that were
	// saved as sheets before tables inside documents stopped counting.
	if (normalizeRovoAppArtifactKind(fallbackKind) === "sheet" && isMarkdownDocumentWithTable(normalizedContent)) {
		return "text";
	}

	return normalizeRovoAppArtifactKind(fallbackKind);
}

module.exports = {
	inferRovoAppArtifactKindFromContent,
	inferRovoAppArtifactKindFromRequest,
	normalizeRovoAppArtifactKind,
};
