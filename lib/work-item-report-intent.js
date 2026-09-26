const ACTIVE_WORK_ITEM_CONTEXT_START = "[Active Jira Work Item Context]";
const ACTIVE_WORK_ITEM_CONTEXT_END = "[End Active Jira Work Item Context]";
const WORK_ITEM_REPORT_REQUEST_START = "[Work Item HTML Report Request]";
const WORK_ITEM_REPORT_REQUEST_END = "[End Work Item HTML Report Request]";
const VPK_HTML_SKILL_ID = "vpk-html";

function normalizeText(value) {
	return typeof value === "string"
		? value.trim().toLowerCase().replace(/\s+/gu, " ")
		: "";
}

function getNonEmptyString(value) {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: null;
}

function isVpkHtmlArtifactIntent(promptText) {
	const prompt = normalizeText(promptText);
	if (!prompt) {
		return false;
	}

	if (/^(how|what|why|where|when|who)\b/u.test(prompt)) {
		return false;
	}

	const hasWorkItemTarget =
		/\b(this|current|open)\s+(jira\s+)?(work\s*item|ticket|issue)\b/u.test(prompt) ||
		/\b(jira\s+)?(work\s*item|ticket|issue)\b/u.test(prompt);
	const hasHtmlQualifier = /\b(html|offline|single-?file|self-contained)\b/u.test(prompt);
	const hasReportNoun = /\b(html\s+report|report|write-?up|status\s+report)\b/u.test(prompt);
	const hasSkillDocumentNoun =
		hasReportNoun ||
		/\b(html\s+)?(artifact|document|doc|file|one[-\s]?pager|brief|memo|letter|portfolio|resume|cv|slides?|deck|white\s+paper|changelog)\b/u.test(prompt) ||
		/\bengineering\s+workflow\s+surface\b/u.test(prompt);
	const hasArtifactCreationVerb = /\b(generate|create|write|make|build|draft|prepare|compose|render|produce|export)\b/u.test(prompt);
	const hasCreationNearSkillDocument =
		/\b(generate|create|write|make|build|draft|prepare|compose|render|produce|export)\b.{0,100}\b(html\s+)?(artifact|document|doc|file|one[-\s]?pager|brief|memo|letter|portfolio|resume|cv|slides?|deck|white\s+paper|changelog|report|write-?up|status\s+report)\b/u.test(prompt) ||
		/\b(html\s+)?(artifact|document|doc|file|one[-\s]?pager|brief|memo|letter|portfolio|resume|cv|slides?|deck|white\s+paper|changelog|report|write-?up|status\s+report)\b.{0,100}\b(generate|create|write|make|build|draft|prepare|compose|render|produce|export)\b/u.test(prompt);
	const hasTransformAsSkillDocument =
		/\b(summari[sz]e|turn|convert)\b.{0,120}\b(ticket|issue|work\s*item|this|current|open)\b.{0,120}\b(as|into|to|in)\s+(an?\s+)?(html\s+)?(artifact|document|doc|file|one[-\s]?pager|brief|memo|report|write-?up|status\s+report)\b/u.test(prompt) ||
		/\bsummari[sz]e\b.{0,120}\b(as|into|to|in)\s+(an?\s+)?(html\s+)?(artifact|document|doc|file|one[-\s]?pager|brief|memo|report|write-?up|status\s+report)\b/u.test(prompt);

	if (hasTransformAsSkillDocument) {
		return true;
	}

	if (hasCreationNearSkillDocument && (hasReportNoun || hasHtmlQualifier || hasWorkItemTarget)) {
		return true;
	}

	if (hasArtifactCreationVerb && hasHtmlQualifier && (hasSkillDocumentNoun || hasWorkItemTarget)) {
		return true;
	}

	if (
		hasHtmlQualifier &&
		hasSkillDocumentNoun &&
		/\b(for|from|about)\s+(this|the|current|open)\b/u.test(prompt)
	) {
		return true;
	}

	return false;
}

function isWorkItemReportIntent(promptText) {
	return isVpkHtmlArtifactIntent(promptText);
}

function extractActiveWorkItemContext(contextDescription) {
	const context = getNonEmptyString(contextDescription);
	if (!context) {
		return null;
	}

	const startIndex = context.indexOf(ACTIVE_WORK_ITEM_CONTEXT_START);
	if (startIndex === -1) {
		return null;
	}

	const endIndex = context.indexOf(ACTIVE_WORK_ITEM_CONTEXT_END, startIndex);
	if (endIndex === -1) {
		return null;
	}

	return context
		.slice(startIndex, endIndex + ACTIVE_WORK_ITEM_CONTEXT_END.length)
		.trim();
}

function hasActiveWorkItemContext(contextDescription) {
	return extractActiveWorkItemContext(contextDescription) !== null;
}

function extractContextField(activeWorkItemContext, label) {
	const context = getNonEmptyString(activeWorkItemContext);
	if (!context) {
		return null;
	}

	const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
	const match = context.match(new RegExp(`^${escapedLabel}:\\s*(.+)$`, "imu"));
	return getNonEmptyString(match?.[1]);
}

function extractWorkItemReportTitle(contextDescription) {
	const activeContext = extractActiveWorkItemContext(contextDescription);
	const title = extractContextField(activeContext, "Title");
	const key = extractContextField(activeContext, "Key");

	if (title && key) {
		return `${title}`;
	}

	return title || (key ? `${key} Work Item Report` : "Work Item Report");
}

function contextAlreadyHasReportRequest(contextDescription) {
	const context = getNonEmptyString(contextDescription);
	return Boolean(context && context.includes(WORK_ITEM_REPORT_REQUEST_START));
}

function buildWorkItemReportRequestContext({
	contextDescription,
	promptText,
	skillId = VPK_HTML_SKILL_ID,
} = {}) {
	if (!isWorkItemReportIntent(promptText) || contextAlreadyHasReportRequest(contextDescription)) {
		return null;
	}

	const hasContext = hasActiveWorkItemContext(contextDescription);
	const title = extractWorkItemReportTitle(contextDescription);

	if (!hasContext) {
		return [
			WORK_ITEM_REPORT_REQUEST_START,
			"The user is asking for an offline HTML artifact from the currently open Jira Work Item, but no active Work Item context was supplied in this turn.",
			"Do not fabricate an artifact. Ask the user to open the Work Item or add the Work Item context, then offer to generate it again.",
			WORK_ITEM_REPORT_REQUEST_END,
		].join("\n");
	}

	return [
		WORK_ITEM_REPORT_REQUEST_START,
		"The user is asking for an offline HTML artifact from the currently open Jira Work Item.",
		`Internal skill route: execute the repo-local /vpk-html Agent Skill bundle (${skillId}) for this turn only, even though the user did not type /vpk-html.`,
		`Artifact title: ${title}`,
		"Create a new first-class html artifact from the [Active Jira Work Item Context] block. Use AI Gateway only to distill structured report fields, then fill the actual vpk-html template deterministically. Do not ask the LLM to freeform-write the final HTML/CSS.",
		"Respect the vpk-html contract: one offline self-contained HTML file, inline CSS only, no remote dependencies, no unfilled placeholders, no invented facts, and a compact information-gaps section for missing facts.",
		"The chat response should briefly confirm creation and link to the generated report artifact.",
		WORK_ITEM_REPORT_REQUEST_END,
	].join("\n");
}

function findVpkHtmlSkillId(skills) {
	if (!Array.isArray(skills)) {
		return VPK_HTML_SKILL_ID;
	}

	const match = skills.find((skill) => {
		const fields = [
			skill?.id,
			skill?.name,
			skill?.title,
		]
			.filter((value) => typeof value === "string")
			.map((value) => value.trim().toLowerCase());

		return fields.some((value) => value === VPK_HTML_SKILL_ID || value.endsWith(`/${VPK_HTML_SKILL_ID}`));
	});

	return getNonEmptyString(match?.id) || VPK_HTML_SKILL_ID;
}

function resolveWorkItemReportRequest({
	contextDescription,
	promptText,
	skills,
} = {}) {
	const isIntent = isWorkItemReportIntent(promptText);
	const hasContext = hasActiveWorkItemContext(contextDescription);
	const shouldCreateArtifact = isIntent && hasContext;
	const skillId = findVpkHtmlSkillId(skills);

	return {
		artifactBackendPreference: shouldCreateArtifact ? "ai-gateway" : null,
		hasContext,
		isIntent,
		shouldCreateArtifact,
		shouldLoadSkill: isIntent && hasContext,
		skillId,
		title: extractWorkItemReportTitle(contextDescription),
		contextBlock: buildWorkItemReportRequestContext({
			contextDescription,
			promptText,
			skillId,
		}),
	};
}

module.exports = {
	ACTIVE_WORK_ITEM_CONTEXT_END,
	ACTIVE_WORK_ITEM_CONTEXT_START,
	VPK_HTML_SKILL_ID,
	WORK_ITEM_REPORT_REQUEST_END,
	WORK_ITEM_REPORT_REQUEST_START,
	buildWorkItemReportRequestContext,
	extractActiveWorkItemContext,
	extractWorkItemReportTitle,
	findVpkHtmlSkillId,
	hasActiveWorkItemContext,
	isWorkItemReportIntent,
	isVpkHtmlArtifactIntent,
	resolveWorkItemReportRequest,
};
