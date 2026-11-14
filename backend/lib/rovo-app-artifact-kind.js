const { getNonEmptyString } = require("./shared-utils");

const CODE_REQUEST_REGEX =
	/\b(code|component|tsx|jsx|react|javascript|typescript|python|sql|api|function|script|app|ui|page|web\s?page|website|site|landing\s?page|home\s?page|homepage|html|css|tailwind)\b/i;
const IMAGE_REQUEST_REGEX = /\b(image|photo|picture|illustration|graphic|logo)\b/i;
const SHEET_REQUEST_REGEX = /\b(table|spreadsheet|sheet|csv|matrix|grid)\b/i;
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
	const normalizedMessage = getNonEmptyString(latestUserMessage);
	if (!normalizedMessage) {
		return normalizeRovoAppArtifactKind(fallbackKind);
	}

	if (IMAGE_REQUEST_REGEX.test(normalizedMessage)) {
		return "image";
	}

	if (SHEET_REQUEST_REGEX.test(normalizedMessage)) {
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

const MARKDOWN_TABLE_ROW_REGEX = /^\|.*\|$/u;
const MARKDOWN_TABLE_SEPARATOR_REGEX = /^\|(?:\s*:?-+:?\s*\|)+$/u;
const MARKDOWN_HEADING_REGEX = /^#{1,6}\s/u;

// A sheet is a table and nothing else (headings allowed as captions). A text
// document that merely contains a table stays a document.
function isMarkdownTableOnlyContent(content) {
	const lines = content
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
	let hasSeparator = false;
	for (const line of lines) {
		if (MARKDOWN_TABLE_SEPARATOR_REGEX.test(line)) {
			hasSeparator = true;
			continue;
		}
		if (!MARKDOWN_TABLE_ROW_REGEX.test(line) && !MARKDOWN_HEADING_REGEX.test(line)) {
			return false;
		}
	}
	return hasSeparator;
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

	return normalizeRovoAppArtifactKind(fallbackKind);
}

module.exports = {
	inferRovoAppArtifactKindFromContent,
	inferRovoAppArtifactKindFromRequest,
	normalizeRovoAppArtifactKind,
};
