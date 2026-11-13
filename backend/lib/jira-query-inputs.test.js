"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	DEFAULT_ATLASSIAN_SITE_HOSTS,
	isAllowedAtlassianSite,
	quoteJqlString,
	requireHoursAgo,
	requireJiraProjectKey,
	resolveAllowedAtlassianSites,
	standupRequestSchema,
	ticketClassifyRequestSchema,
} = require("./jira-query-inputs");

test("the server's token goes only to configured Atlassian sites", () => {
	assert.deepEqual(resolveAllowedAtlassianSites({}), [...DEFAULT_ATLASSIAN_SITE_HOSTS]);
	assert.deepEqual(resolveAllowedAtlassianSites({ ATLASSIAN_SITE_HOSTS: " Team.atlassian.net, evil.example ,," }), ["team.atlassian.net"]);
	assert.deepEqual(resolveAllowedAtlassianSites({ ATLASSIAN_SITE_HOSTS: "evil.example" }), [...DEFAULT_ATLASSIAN_SITE_HOSTS]);
	const cases = [
		["product-fabric.atlassian.net", {}, true],
		["hello.atlassian.net", {}, true],
		["another-tenant.atlassian.net", {}, false],
		["team.atlassian.net", { ATLASSIAN_SITE_HOSTS: "team.atlassian.net" }, true],
		["product-fabric.atlassian.net", { ATLASSIAN_SITE_HOSTS: "team.atlassian.net" }, false],
		["evil.example", {}, false],
		[undefined, {}, false],
	];
	for (const [host, env, expected] of cases) {
		assert.equal(isAllowedAtlassianSite(host, env), expected, `${host} ${JSON.stringify(env)}`);
	}
});

test("JQL values cannot change the query", () => {
	assert.equal(quoteJqlString("Done"), "\"Done\"");
	assert.equal(quoteJqlString("In \"Review\""), "\"In \\\"Review\\\"\"");
	assert.equal(quoteJqlString("a\\\" OR project = X"), "\"a\\\\\\\" OR project = X\"");
	assert.equal(quoteJqlString("line\nbreak"), "\"linebreak\"");
	assert.equal(requireJiraProjectKey("SUPPORT"), "SUPPORT");
	for (const key of ["support", "SUP PORT", "X\" OR 1=1", "1ABC", "", 7, "A".repeat(21)]) {
		assert.throws(() => requireJiraProjectKey(key), (error) => error.statusCode === 400, String(key));
	}
	assert.equal(requireHoursAgo(24), 24);
	for (const hours of [0, -1, 1.5, "24", 721, Number.NaN, "1h OR x"]) {
		assert.throws(() => requireHoursAgo(hours), (error) => error.statusCode === 400, String(hours));
	}
});

test("request schemas for the JQL inputs", () => {
	const ok = (schema, value) => schema.safeParse(value).success;
	assert.equal(ok(ticketClassifyRequestSchema, {}), true);
	assert.equal(ok(ticketClassifyRequestSchema, { project: "SUPPORT", excludeStatuses: ["Done", "In \"Review\""] }), true);
	assert.equal(ok(ticketClassifyRequestSchema, { project: "x\" OR project = SECRET" }), false);
	assert.equal(ok(ticketClassifyRequestSchema, { excludeStatuses: "Done" }), false);
	assert.equal(ok(ticketClassifyRequestSchema, { excludeStatuses: ["x".repeat(81)] }), false);
	assert.equal(ok(ticketClassifyRequestSchema, { excludeStatuses: Array(26).fill("Done") }), false);
	assert.equal(ok(standupRequestSchema, { hoursAgo: 12, projects: ["RFP"] }), true);
	assert.equal(ok(standupRequestSchema, { hoursAgo: "12h OR assignee is EMPTY" }), false);
	assert.equal(ok(standupRequestSchema, { hoursAgo: 99999 }), false);
	assert.equal(ok(standupRequestSchema, { projects: ["RFP\") OR (project = X"] }), false);
});
