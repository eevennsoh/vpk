const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

let titlePrefix;

test.before(async () => {
	const result = await esbuild.build({
		entryPoints: [path.join(process.cwd(), "lib/document-title-prefix.ts")],
		bundle: true,
		format: "cjs",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	titlePrefix = loadCjsModuleFromText(result.outputFiles[0].text, "document-title-prefix.cjs");
});

test("getDocumentTitlePrefix derives readable local host labels", () => {
	assert.equal(
		titlePrefix.getDocumentTitlePrefix({
			host: "project.localhost",
			hostname: "project.localhost",
		}),
		"project",
	);
	assert.equal(
		titlePrefix.getDocumentTitlePrefix({
			host: "branch.project.localhost",
			hostname: "branch.project.localhost",
		}),
		"branch.project",
	);
	assert.equal(
		titlePrefix.getDocumentTitlePrefix({
			host: "branch.project.localhost:3440",
			hostname: "branch.project.localhost",
		}),
		"branch.project:3440",
	);
});

test("getDocumentTitlePrefix preserves host labels where the port disambiguates the tab", () => {
	assert.equal(
		titlePrefix.getDocumentTitlePrefix({
			host: "127.0.0.1:3000",
			hostname: "127.0.0.1",
		}),
		"127.0.0.1:3000",
	);
	assert.equal(
		titlePrefix.getDocumentTitlePrefix({
			host: "localhost:3000",
			hostname: "localhost",
		}),
		"localhost:3000",
	);
	assert.equal(
		titlePrefix.getDocumentTitlePrefix({
			host: "",
			hostname: "",
		}),
		null,
	);
});

test("formatDocumentTitleWithPrefix prefixes page-specific and root titles", () => {
	assert.equal(
		titlePrefix.formatDocumentTitleWithPrefix("Alert Dialog — UI — VPK", "project"),
		"project : Alert Dialog — UI — VPK",
	);
	assert.equal(
		titlePrefix.formatDocumentTitleWithPrefix("V—P—K: Venn Prototype Kit", "project"),
		"project : V—P—K: Venn Prototype Kit",
	);
});

test("formatDocumentTitleForPath derives canonical titles for top-level project routes", () => {
	const projectNamesBySlug = {
		"jira-golden-journey-v0": "Jira Golden Journey v0",
		"jira-golden-journey-v4": "Jira Golden Journey v4",
		studio: "Studio",
	};

	assert.equal(
		titlePrefix.formatDocumentTitleForPath(
			"V—P—K: Venn Prototype Kit",
			"project",
			"/jira-golden-journey-v0",
			projectNamesBySlug,
		),
		"project : Jira Golden Journey v0 — Projects — VPK",
	);
	assert.equal(
		titlePrefix.formatDocumentTitleForPath(
			"Studio — Projects — VPK",
			"project",
			"/jira-golden-journey-v4/",
			projectNamesBySlug,
		),
		"project : Jira Golden Journey v4 — Projects — VPK",
	);
});

test("formatDocumentTitleForPath preserves route-specific titles outside top-level projects", () => {
	const projectNamesBySlug = {
		studio: "Studio",
	};

	assert.equal(
		titlePrefix.formatDocumentTitleForPath(
			"Jobs — VPK",
			"project",
			"/studio/jobs",
			projectNamesBySlug,
		),
		"project : Jobs — VPK",
	);
	assert.equal(
		titlePrefix.formatDocumentTitleForPath(
			"V—P—K: Venn Prototype Kit",
			"project",
			"/weather",
			projectNamesBySlug,
		),
		"project : V—P—K: Venn Prototype Kit",
	);
});

test("formatDocumentTitleWithPrefix is idempotent for already-prefixed titles", () => {
	assert.equal(
		titlePrefix.formatDocumentTitleWithPrefix("project : Alert Dialog — UI — VPK", "project"),
		"project : Alert Dialog — UI — VPK",
	);
	assert.equal(
		titlePrefix.stripDocumentTitlePrefix("project : Alert Dialog — UI — VPK", "project"),
		"Alert Dialog — UI — VPK",
	);
	assert.equal(
		titlePrefix.formatDocumentTitleWithPrefix("", "project"),
		"project",
	);
});

test("formatDocumentTitleWithPrefix normalizes the previous dash-prefixed title form", () => {
	assert.equal(
		titlePrefix.formatDocumentTitleWithPrefix("project — Alert Dialog — UI — VPK", "project"),
		"project : Alert Dialog — UI — VPK",
	);
	assert.equal(
		titlePrefix.stripDocumentTitlePrefix("project — Alert Dialog — UI — VPK", "project"),
		"Alert Dialog — UI — VPK",
	);
});

test("formatDocumentTitleWithPrefix normalizes the previous compact colon title form", () => {
	assert.equal(
		titlePrefix.formatDocumentTitleWithPrefix("project:Alert Dialog — UI — VPK", "project"),
		"project : Alert Dialog — UI — VPK",
	);
	assert.equal(
		titlePrefix.stripDocumentTitlePrefix("project:Alert Dialog — UI — VPK", "project"),
		"Alert Dialog — UI — VPK",
	);
});

test("formatDocumentTitleWithPrefix preserves transient wake-lock warning titles", () => {
	assert.equal(
		titlePrefix.formatDocumentTitleWithPrefix("⚠ Keep this page active", "project"),
		"⚠ Keep this page active",
	);
	assert.equal(
		titlePrefix.formatDocumentTitleWithPrefix("project:⚠ Keep this page active", "project"),
		"⚠ Keep this page active",
	);
	assert.equal(
		titlePrefix.formatDocumentTitleForPath(
			"⚠ Keep this page active",
			"project",
			"/studio",
			{ studio: "Studio" },
		),
		"⚠ Keep this page active",
	);
});
