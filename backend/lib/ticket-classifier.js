// ---------------------------------------------------------------------------
// Ticket Classifier — Backend classification engine
// ---------------------------------------------------------------------------
// Fetches support tickets from Jira, classifies them into product area
// categories using keyword-based heuristics, infers priority, computes
// confidence scores, and suggests team routing.
// ---------------------------------------------------------------------------

const {
	DEFAULT_ATLASSIAN_SITE_HOST,
	isAllowedAtlassianSite,
	quoteJqlString,
	requireJiraProjectKey,
} = require("./jira-query-inputs");

const DEFAULT_SITE_URL = DEFAULT_ATLASSIAN_SITE_HOST;
const DEFAULT_PROJECT = "SUPPORT";
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const CONFIDENCE_LOW = 0.5;

// ── Category definitions ────────────────────────────────────────────────────
// Mirrors lib/ticket-classifier-types.ts for CommonJS usage.

const TICKET_CATEGORIES = [
	"billing",
	"account",
	"technical",
	"onboarding",
	"api-integration",
	"documentation",
];

const CATEGORY_KEYWORDS = {
	billing: [
		"invoice", "payment", "charge", "subscription", "refund", "pricing",
		"billing", "credit card", "plan upgrade", "plan downgrade", "renewal",
		"discount", "coupon", "receipt", "cost", "fee", "overcharge", "prorate",
		"trial", "cancellation",
	],
	account: [
		"login", "password", "sso", "permissions", "access", "profile", "mfa",
		"two-factor", "2fa", "authentication", "sign in", "sign up", "register",
		"account", "locked out", "reset password", "email change", "username",
		"deactivate", "role", "admin access",
	],
	technical: [
		"bug", "error", "crash", "performance", "timeout", "500", "404",
		"stack trace", "exception", "broken", "not working", "slow", "latency",
		"outage", "downtime", "failure", "regression", "fix", "issue",
		"memory leak", "cpu", "load", "unresponsive", "hang", "freeze",
	],
	onboarding: [
		"setup", "getting started", "tutorial", "first time", "configuration",
		"onboarding", "new user", "quickstart", "walkthrough", "initial setup",
		"install", "installation", "getting going", "beginner", "welcome",
		"trial setup", "provision",
	],
	"api-integration": [
		"api", "webhook", "rest", "endpoint", "sdk", "integration", "oauth",
		"token", "rate limit", "api key", "graphql", "swagger", "openapi",
		"callback", "payload", "request", "response code", "curl", "postman",
		"third-party", "connect", "plugin",
	],
	documentation: [
		"docs", "documentation", "guide", "how to", "instructions", "faq",
		"knowledge base", "article", "help page", "readme", "changelog",
		"release notes", "manual", "reference", "example", "sample code",
		"tutorial doc", "wiki",
	],
};

const CATEGORY_TEAM_ROUTES = {
	billing: { team: "Finance Ops", emoji: "💰", description: "Handles billing inquiries, refunds, and subscription changes" },
	account: { team: "Identity Team", emoji: "🛡️", description: "Manages authentication, access control, and user profiles" },
	technical: { team: "Engineering", emoji: "⚙️", description: "Investigates bugs, performance issues, and technical failures" },
	onboarding: { team: "Customer Success", emoji: "🎯", description: "Guides new users through setup and initial configuration" },
	"api-integration": { team: "Platform Team", emoji: "🔧", description: "Supports API usage, webhooks, and third-party integrations" },
	documentation: { team: "Content Team", emoji: "✍️", description: "Maintains docs, guides, and knowledge base articles" },
};

// ── Urgency keywords ────────────────────────────────────────────────────────

const URGENCY_KEYWORDS = {
	critical: [
		"urgent", "critical", "emergency", "production down", "p1", "sev1",
		"outage", "data loss", "security breach", "blocker", "showstopper",
	],
	high: [
		"important", "high priority", "asap", "p2", "sev2", "major",
		"impacting", "affecting multiple", "widespread",
	],
	low: [
		"low priority", "minor", "cosmetic", "nice to have",
		"when you get a chance", "no rush", "p4", "trivial",
	],
};

// ── Jira priority mapping ───────────────────────────────────────────────────

const JIRA_PRIORITY_MAP = {
	blocker: "P1",
	critical: "P1",
	highest: "P1",
	high: "P2",
	medium: "P3",
	low: "P4",
	lowest: "P4",
	minor: "P4",
	trivial: "P4",
};

function mapJiraPriority(priority) {
	if (!priority || typeof priority !== "string") return "P3";
	return JIRA_PRIORITY_MAP[priority.toLowerCase().trim()] ?? "P3";
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

// ── JQL builder ─────────────────────────────────────────────────────────────

// Values are never interpolated raw: the project must be a project key and each status
// is quoted as a JQL string literal.
function buildClassifyJql({ project = DEFAULT_PROJECT, excludeStatuses } = {}) {
	const statuses = excludeStatuses ?? ["Done", "Closed", "Resolved"];
	const clauses = [`project = ${quoteJqlString(requireJiraProjectKey(project))}`];

	if (statuses.length > 0) {
		const statusList = statuses.map((s) => quoteJqlString(s)).join(", ");
		clauses.push(`status NOT IN (${statusList})`);
	}

	return `${clauses.join(" AND ")} ORDER BY created DESC`;
}

// ── Jira API fetch ──────────────────────────────────────────────────────────

async function fetchJiraTickets({ siteUrl, jql, limit, signal } = {}) {
	if (!isAllowedAtlassianSite(siteUrl)) {
		throw createHttpError(400, "siteUrl is not a configured Atlassian site.");
	}
	const apiToken = process.env.ATLASSIAN_API_TOKEN;
	if (!apiToken) {
		throw createHttpError(
			500,
			"Server configuration error: ATLASSIAN_API_TOKEN is not set",
		);
	}

	const encodedJql = encodeURIComponent(jql);
	const fields =
		"summary,description,status,assignee,reporter,updated,created,priority,issuetype,project,labels,components";
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
			`Jira API error (${response.status}): ${detail || "Unknown error"}`,
		);
	}

	const data = await response.json();
	return data.issues || [];
}

// ── Issue → RawTicket mapper ────────────────────────────────────────────────

/**
 * Extract plain-text content from Atlassian Document Format (ADF).
 * Walks the node tree and concatenates all text nodes.
 */
function extractTextFromAdf(adfNode) {
	if (!adfNode || typeof adfNode !== "object") return "";
	if (adfNode.type === "text") return adfNode.text || "";
	if (!Array.isArray(adfNode.content)) return "";
	return adfNode.content.map(extractTextFromAdf).join(" ");
}

function mapIssueToRawTicket(issue, siteUrl) {
	const fields = issue.fields || {};
	const description = fields.description
		? extractTextFromAdf(fields.description)
		: "";

	return {
		key: issue.key || "",
		summary: fields.summary || "",
		description,
		status: fields.status?.name || "Unknown",
		priority: fields.priority?.name || "Medium",
		type: fields.issuetype?.name || "Task",
		assignee: fields.assignee?.displayName || "Unassigned",
		reporter: fields.reporter?.displayName || "Unknown",
		project: fields.project?.name || "",
		projectKey: fields.project?.key || "",
		url: `https://${siteUrl}/browse/${issue.key}`,
		createdAt: fields.created || new Date().toISOString(),
		updatedAt: fields.updated || new Date().toISOString(),
		labels: fields.labels || [],
		components: (fields.components || []).map((c) => c.name || ""),
	};
}

// ── Classification engine ───────────────────────────────────────────────────

/**
 * Count keyword matches for a given text against a keyword list.
 * Returns the number of unique keywords matched.
 */
function countKeywordMatches(text, keywords) {
	if (!text) return 0;
	const lower = text.toLowerCase();
	let count = 0;
	for (const keyword of keywords) {
		if (lower.includes(keyword)) {
			count++;
		}
	}
	return count;
}

/**
 * Classify a ticket into a category based on keyword matching.
 *
 * The algorithm:
 * 1. Combine summary (weighted 2x) and description text
 * 2. Count keyword matches per category
 * 3. Compute scores as weighted match counts
 * 4. Normalize scores into confidence (0.0–1.0)
 * 5. Pick the highest-scoring category
 *
 * Returns { category, confidence, allScores }
 */
function classifyTicketCategory(ticket) {
	const summaryText = ticket.summary || "";
	const descriptionText = ticket.description || "";
	const labelText = (ticket.labels || []).join(" ");
	const componentText = (ticket.components || []).join(" ");

	const scores = {};
	let maxScore = 0;
	let bestCategory = "technical"; // default fallback

	for (const category of TICKET_CATEGORIES) {
		const keywords = CATEGORY_KEYWORDS[category];

		// Summary matches weighted 2x (title is more informative)
		const summaryMatches = countKeywordMatches(summaryText, keywords) * 2;
		const descriptionMatches = countKeywordMatches(descriptionText, keywords);
		const labelMatches = countKeywordMatches(labelText, keywords);
		const componentMatches = countKeywordMatches(componentText, keywords);

		const score = summaryMatches + descriptionMatches + labelMatches + componentMatches;
		scores[category] = score;

		if (score > maxScore) {
			maxScore = score;
			bestCategory = category;
		}
	}

	// Compute confidence: ratio of best score to total, scaled
	const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);
	let confidence = 0;

	if (totalScore > 0) {
		// Base confidence from score dominance
		const dominance = maxScore / totalScore;
		// Boost by absolute match count (more matches = more confident)
		const matchBoost = Math.min(maxScore / 5, 1); // cap at 5 matches
		confidence = Math.min(dominance * 0.7 + matchBoost * 0.3, 1.0);
	}

	// Round to 2 decimal places
	confidence = Math.round(confidence * 100) / 100;

	return {
		category: bestCategory,
		confidence,
		allScores: scores,
	};
}

/**
 * Infer priority from Jira priority + urgency keyword analysis.
 *
 * 1. Start with the mapped Jira priority
 * 2. Check for urgency keywords that might override
 * 3. Critical keywords upgrade to P1, high to at least P2, low downgrades to P4
 */
function inferPriority(ticket) {
	const basePriority = mapJiraPriority(ticket.priority);
	const text = `${ticket.summary} ${ticket.description}`.toLowerCase();

	// Check for critical urgency keywords
	for (const keyword of URGENCY_KEYWORDS.critical) {
		if (text.includes(keyword)) {
			return "P1";
		}
	}

	// Check for high urgency keywords — upgrade to at least P2
	for (const keyword of URGENCY_KEYWORDS.high) {
		if (text.includes(keyword)) {
			return basePriority === "P1" ? "P1" : "P2";
		}
	}

	// Check for low urgency keywords — downgrade to P4
	for (const keyword of URGENCY_KEYWORDS.low) {
		if (text.includes(keyword)) {
			return "P4";
		}
	}

	return basePriority;
}

/**
 * Classify a single raw ticket into a ClassifiedTicket.
 */
function classifyTicket(ticket) {
	const { category, confidence, allScores } = classifyTicketCategory(ticket);
	const priority = inferPriority(ticket);
	const suggestedTeam = CATEGORY_TEAM_ROUTES[category];

	return {
		ticket,
		category,
		priority,
		confidence,
		suggestedTeam,
		allScores,
	};
}

// ── Result builder ──────────────────────────────────────────────────────────

function buildClassificationResult(classified, siteUrl, project) {
	const distribution = {
		billing: 0,
		account: 0,
		technical: 0,
		onboarding: 0,
		"api-integration": 0,
		documentation: 0,
	};

	const priorityDistribution = { P1: 0, P2: 0, P3: 0, P4: 0 };
	let lowConfidenceCount = 0;

	for (const item of classified) {
		distribution[item.category]++;
		priorityDistribution[item.priority]++;
		if (item.confidence < CONFIDENCE_LOW) {
			lowConfidenceCount++;
		}
	}

	return {
		siteUrl,
		project,
		generatedAt: new Date().toISOString(),
		totalTickets: classified.length,
		classified,
		distribution,
		priorityDistribution,
		lowConfidenceCount,
	};
}

// ── Main handler ────────────────────────────────────────────────────────────

/**
 * Classify support tickets from Jira.
 *
 * @param {object} options
 * @param {string}   [options.siteUrl]          - Jira site (default: product-fabric.atlassian.net)
 * @param {string}   [options.project]          - Jira project key (default: SUPPORT)
 * @param {string[]} [options.excludeStatuses]  - Statuses to exclude (default: Done, Closed, Resolved)
 * @param {number}   [options.limit]            - Max tickets to fetch (default: 25, max: 100)
 * @param {AbortSignal} [options.signal]        - Optional abort signal
 * @returns {Promise<object>} ClassificationResult
 */
async function classifyTickets({
	siteUrl = DEFAULT_SITE_URL,
	project = DEFAULT_PROJECT,
	excludeStatuses,
	limit,
	signal,
} = {}) {
	const resolvedLimit = resolveLimit(limit);
	const jql = buildClassifyJql({ project, excludeStatuses });

	const rawIssues = await fetchJiraTickets({
		siteUrl,
		jql,
		limit: resolvedLimit,
		signal,
	});

	const rawTickets = rawIssues.map((issue) =>
		mapIssueToRawTicket(issue, siteUrl),
	);

	const classified = rawTickets.map(classifyTicket);

	return buildClassificationResult(classified, siteUrl, project);
}

module.exports = {
	// Main entry point
	classifyTickets,

	// Exported for testing
	classifyTicket,
	classifyTicketCategory,
	inferPriority,
	countKeywordMatches,
	mapIssueToRawTicket,
	buildClassificationResult,
	buildClassifyJql,
	mapJiraPriority,
	resolveLimit,
	createHttpError,
	extractTextFromAdf,

	// Constants for testing
	TICKET_CATEGORIES,
	CATEGORY_KEYWORDS,
	CATEGORY_TEAM_ROUTES,
};
