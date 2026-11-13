// ---------------------------------------------------------------------------
// Standup Summary — Backend endpoint handler
// ---------------------------------------------------------------------------
// Fetches Jira issues updated within a configurable time window for the
// current user, classifies them into Done / Doing / Blockers buckets,
// and returns a structured summary for the chat UI to render.
// ---------------------------------------------------------------------------

const {
	DEFAULT_ATLASSIAN_SITE_HOST,
	isAllowedAtlassianSite,
	quoteJqlString,
	requireHoursAgo,
	requireJiraProjectKey,
} = require("./jira-query-inputs");

const DEFAULT_SITE_URL = DEFAULT_ATLASSIAN_SITE_HOST;
const DEFAULT_HOURS_AGO = 24;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// ── Status classification ───────────────────────────────────────────────────
// Mirrors lib/standup-types.ts for use in the CommonJS backend.

const STATUS_TO_BUCKET = {
	// Done
	done: "done",
	"🎉 done": "done",
	closed: "done",
	resolved: "done",
	released: "done",
	shipped: "done",
	merged: "done",
	completed: "done",
	"internal prod access granted": "done",

	// Doing
	"in progress": "doing",
	"in review": "doing",
	"in development": "doing",
	"code review": "doing",
	"in testing": "doing",
	"🎨 ready for ux": "doing",
	"ready for review": "doing",
	"ready for dev": "doing",
	"ready for qa": "doing",
	"in flight": "doing",
	active: "doing",
	open: "doing",

	// Blockers
	blocked: "blockers",
	"needs refinement": "blockers",
	"on hold": "blockers",
	impediment: "blockers",
	waiting: "blockers",
	"waiting for support": "blockers",
	"waiting for customer": "blockers",
	escalated: "blockers",
};

function classifyStatusFallback(status) {
	const lower = status.toLowerCase();
	if (
		lower.includes("done") ||
		lower.includes("closed") ||
		lower.includes("resolved") ||
		lower.includes("complete") ||
		lower.includes("merged") ||
		lower.includes("released") ||
		lower.includes("shipped")
	) {
		return "done";
	}
	if (
		lower.includes("block") ||
		lower.includes("hold") ||
		lower.includes("impediment") ||
		lower.includes("wait") ||
		lower.includes("escalat")
	) {
		return "blockers";
	}
	return "doing";
}

function classifyStatus(status) {
	const normalized = status.toLowerCase().trim();
	return STATUS_TO_BUCKET[normalized] ?? classifyStatusFallback(normalized);
}

// ── JQL builder ─────────────────────────────────────────────────────────────

// Values are never interpolated raw: projects must be project keys and hoursAgo a whole
// number in range.
function buildStandupJql({ hoursAgo = DEFAULT_HOURS_AGO, projects = [] } = {}) {
	const clauses = ["assignee = currentUser()"];

	if (projects.length > 0) {
		const projectList = projects.map((p) => quoteJqlString(requireJiraProjectKey(p))).join(", ");
		clauses.push(`project IN (${projectList})`);
	}

	clauses.push(`updated >= -${requireHoursAgo(hoursAgo)}h`);

	return `${clauses.join(" AND ")} ORDER BY updated DESC`;
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

function createHttpError(status, message) {
	const error = new Error(message);
	error.statusCode = status;
	return error;
}

function resolveLimit(rawLimit) {
	if (typeof rawLimit !== "number" || !Number.isFinite(rawLimit)) {
		return DEFAULT_LIMIT;
	}
	return Math.min(Math.max(Math.floor(rawLimit), 1), MAX_LIMIT);
}

// ── Jira API fetch ──────────────────────────────────────────────────────────

async function fetchJiraIssues({ siteUrl, jql, limit, signal } = {}) {
	if (!isAllowedAtlassianSite(siteUrl)) {
		throw createHttpError(400, "siteUrl is not a configured Atlassian site.");
	}
	const apiToken = process.env.ATLASSIAN_API_TOKEN;
	if (!apiToken) {
		throw createHttpError(
			500,
			"Server configuration error: ATLASSIAN_API_TOKEN is not set"
		);
	}

	const encodedJql = encodeURIComponent(jql);
	const fields =
		"summary,status,assignee,updated,created,priority,issuetype,project";
	const url = `https://${siteUrl}/rest/api/3/search?jql=${encodedJql}&maxResults=${limit}&fields=${fields}`;

	const response = await fetch(url, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${apiToken}`,
			Accept: "application/json",
		},
		signal,
	});

	if (!response.ok) {
		const errorText = await response.text().catch(() => "");
		let detail = "";
		try {
			const parsed = JSON.parse(errorText);
			detail =
				parsed?.errorMessages?.join("; ") ||
				parsed?.message ||
				errorText;
		} catch {
			detail = errorText;
		}
		throw createHttpError(
			response.status,
			`Jira API error (${response.status}): ${detail || "Unknown error"}`
		);
	}

	const data = await response.json();
	return data.issues || [];
}

// ── Issue → StandupItem mapper ──────────────────────────────────────────────

function mapIssueToStandupItem(issue, siteUrl) {
	const fields = issue.fields || {};
	const status = fields.status?.name || "Unknown";
	return {
		key: issue.key || "",
		summary: fields.summary || "",
		status,
		bucket: classifyStatus(status),
		priority: fields.priority?.name || "Medium",
		type: fields.issuetype?.name || "Task",
		assignee: fields.assignee?.displayName || "Unassigned",
		project: fields.project?.name || "",
		projectKey: fields.project?.key || "",
		url: `https://${siteUrl}/browse/${issue.key}`,
		updatedAt: fields.updated || new Date().toISOString(),
		createdAt: fields.created || new Date().toISOString(),
	};
}

// ── Summary builder ─────────────────────────────────────────────────────────

function buildStandupSummary(items, siteUrl, timeWindowHours) {
	const buckets = { done: [], doing: [], blockers: [] };

	for (const item of items) {
		buckets[item.bucket].push(item);
	}

	return {
		siteUrl,
		generatedAt: new Date().toISOString(),
		timeWindowHours,
		metrics: {
			total: items.length,
			done: buckets.done.length,
			doing: buckets.doing.length,
			blockers: buckets.blockers.length,
		},
		items,
		buckets,
	};
}

// ── Main handler ────────────────────────────────────────────────────────────

/**
 * Generate a standup summary from Jira activity.
 *
 * @param {object} options
 * @param {string}   [options.siteUrl]    - Jira site (default: product-fabric.atlassian.net)
 * @param {number}   [options.hoursAgo]   - Time window in hours (default: 24)
 * @param {string[]} [options.projects]   - Filter by Jira project keys
 * @param {number}   [options.limit]      - Max results (default: 50, max: 100)
 * @param {AbortSignal} [options.signal]  - Optional abort signal
 * @returns {Promise<object>} StandupSummary
 */
async function generateStandupSummary({
	siteUrl = DEFAULT_SITE_URL,
	hoursAgo = DEFAULT_HOURS_AGO,
	projects = [],
	limit,
	signal,
} = {}) {
	const resolvedLimit = resolveLimit(limit);
	const jql = buildStandupJql({ hoursAgo, projects });

	const rawIssues = await fetchJiraIssues({
		siteUrl,
		jql,
		limit: resolvedLimit,
		signal,
	});

	const items = rawIssues.map((issue) =>
		mapIssueToStandupItem(issue, siteUrl)
	);

	return buildStandupSummary(items, siteUrl, hoursAgo);
}

module.exports = {
	// Main entry point
	generateStandupSummary,

	// Exported for testing
	classifyStatus,
	buildStandupJql,
	mapIssueToStandupItem,
	buildStandupSummary,
	resolveLimit,
	createHttpError,
};
