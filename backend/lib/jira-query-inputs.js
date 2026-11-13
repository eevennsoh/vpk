"use strict";

// Inputs that go into a Jira request made with the server's Atlassian API token (BE-F6):
// the site that receives the token and the JQL values. Shared by ticket-classifier.js,
// standup-summary.js, the demo routes and the image proxy.

const { z } = require("zod");

const DEFAULT_ATLASSIAN_SITE_HOST = "product-fabric.atlassian.net";
// The sites the code was built against: the Jira demos' default site and the Confluence
// site whose images the chat renders. Provisional until the owner configures their own.
const DEFAULT_ATLASSIAN_SITE_HOSTS = Object.freeze([DEFAULT_ATLASSIAN_SITE_HOST, "hello.atlassian.net"]);
const ATLASSIAN_SITE_HOST_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.atlassian\.net$/u;

/**
 * The Atlassian sites the server's token may be sent to: `ATLASSIAN_SITE_HOSTS`
 * (comma-separated hosts) when set, otherwise DEFAULT_ATLASSIAN_SITE_HOSTS.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string[]}
 */
function resolveAllowedAtlassianSites(env = process.env) {
	const configured = String(env.ATLASSIAN_SITE_HOSTS ?? "")
		.split(",")
		.map((host) => host.trim().toLowerCase())
		.filter((host) => ATLASSIAN_SITE_HOST_PATTERN.test(host));
	return configured.length > 0 ? configured : [...DEFAULT_ATLASSIAN_SITE_HOSTS];
}

/**
 * @param {unknown} host
 * @param {NodeJS.ProcessEnv} [env]
 */
function isAllowedAtlassianSite(host, env = process.env) {
	return typeof host === "string" && resolveAllowedAtlassianSites(env).includes(host.toLowerCase());
}

// A Jira project key: a letter, then letters, digits or underscores.
const JIRA_PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9_]{0,19}$/u;
const MAX_STATUS_LENGTH = 80;
const MAX_LIST_LENGTH = 25;
const MAX_HOURS_AGO = 24 * 30;

/**
 * A JQL string literal: backslashes and double quotes escaped, control characters dropped.
 * @param {string} value
 */
function quoteJqlString(value) {
	const cleaned = String(value).replace(/[\u0000-\u001f\u007f]/gu, "");
	return `"${cleaned.replace(/\\/gu, "\\\\").replace(/"/gu, "\\\"")}"`;
}

/**
 * @param {unknown} key
 * @returns {string}
 */
function requireJiraProjectKey(key) {
	if (typeof key !== "string" || !JIRA_PROJECT_KEY_PATTERN.test(key)) {
		throw Object.assign(new Error("A Jira project key like SUPPORT is required."), { statusCode: 400 });
	}
	return key;
}

/**
 * @param {unknown} hoursAgo
 * @returns {number}
 */
function requireHoursAgo(hoursAgo) {
	if (!Number.isInteger(hoursAgo) || /** @type {number} */ (hoursAgo) < 1 || /** @type {number} */ (hoursAgo) > MAX_HOURS_AGO) {
		throw Object.assign(new Error(`hoursAgo must be a whole number from 1 to ${MAX_HOURS_AGO}.`), { statusCode: 400 });
	}
	return /** @type {number} */ (hoursAgo);
}

const jiraProjectKeySchema = z.string().regex(JIRA_PROJECT_KEY_PATTERN);
const jiraStatusSchema = z.string().min(1).max(MAX_STATUS_LENGTH);

const ticketClassifyRequestSchema = z.object({
	project: jiraProjectKeySchema.optional(),
	excludeStatuses: z.array(jiraStatusSchema).max(MAX_LIST_LENGTH).optional(),
});

const standupRequestSchema = z.object({
	hoursAgo: z.number().int().min(1).max(MAX_HOURS_AGO).optional(),
	projects: z.array(jiraProjectKeySchema).max(MAX_LIST_LENGTH).optional(),
});

module.exports = {
	ATLASSIAN_SITE_HOST_PATTERN,
	DEFAULT_ATLASSIAN_SITE_HOST,
	DEFAULT_ATLASSIAN_SITE_HOSTS,
	MAX_HOURS_AGO,
	isAllowedAtlassianSite,
	quoteJqlString,
	requireHoursAgo,
	requireJiraProjectKey,
	resolveAllowedAtlassianSites,
	standupRequestSchema,
	ticketClassifyRequestSchema,
};
