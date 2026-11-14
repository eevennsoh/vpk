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

// One ATLASSIAN_SITE_HOSTS entry as a host: `mine.atlassian.net`, `https://mine.atlassian.net`
// or `mine.atlassian.net/` all name the same site; anything else is null.
function parseAtlassianSiteEntry(entry) {
	const trimmed = entry.trim();
	if (!trimmed) return null;
	let host;
	try {
		const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
		if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
			return null;
		}
		host = url.hostname.toLowerCase();
	} catch {
		return null;
	}
	return ATLASSIAN_SITE_HOST_PATTERN.test(host) ? host : null;
}

/**
 * The Atlassian sites the server's token may be sent to: the hosts in
 * `ATLASSIAN_SITE_HOSTS` (comma-separated) when it is set, otherwise
 * DEFAULT_ATLASSIAN_SITE_HOSTS. Set but with nothing usable in it, no site is allowed:
 * a typo never sends the token to the built-in sites.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string[]}
 */
function resolveAllowedAtlassianSites(env = process.env) {
	if (env.ATLASSIAN_SITE_HOSTS === undefined) {
		return [...DEFAULT_ATLASSIAN_SITE_HOSTS];
	}
	const hosts = String(env.ATLASSIAN_SITE_HOSTS).split(",").map(parseAtlassianSiteEntry).filter(Boolean);
	return [...new Set(hosts)];
}

/**
 * A startup warning when ATLASSIAN_SITE_HOSTS is set but some entry is not a site, or
 * none is; null when it is unset or every entry is usable.
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string | null}
 */
function describeAtlassianSiteHostsProblem(env = process.env) {
	if (env.ATLASSIAN_SITE_HOSTS === undefined) return null;
	const entries = String(env.ATLASSIAN_SITE_HOSTS).split(",").map((entry) => entry.trim()).filter(Boolean);
	const usable = entries.filter((entry) => parseAtlassianSiteEntry(entry));
	if (usable.length === 0) {
		return "ATLASSIAN_SITE_HOSTS is set but names no *.atlassian.net site, so the Atlassian API token is sent to no site (Jira demos and Atlassian images run without it).";
	}
	if (usable.length < entries.length) {
		return `ATLASSIAN_SITE_HOSTS has ${entries.length - usable.length} entry(ies) that are not *.atlassian.net sites; they are ignored.`;
	}
	return null;
}

/**
 * The site a Jira request without a siteUrl goes to: the first configured site, so that
 * setting ATLASSIAN_SITE_HOSTS also moves the default (unset, it stays the demos' site).
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string | null}
 */
function resolveDefaultAtlassianSite(env = process.env) {
	return resolveAllowedAtlassianSites(env)[0] ?? null;
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
	describeAtlassianSiteHostsProblem,
	isAllowedAtlassianSite,
	quoteJqlString,
	requireHoursAgo,
	requireJiraProjectKey,
	resolveAllowedAtlassianSites,
	resolveDefaultAtlassianSite,
	standupRequestSchema,
	ticketClassifyRequestSchema,
};
