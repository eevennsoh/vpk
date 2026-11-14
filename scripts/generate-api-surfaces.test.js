"use strict";

const assert = require("node:assert/strict");
const { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	DOC_PATH,
	GENERATED_BEGIN,
	GENERATED_END,
	buildGeneratedSection,
	replaceGeneratedSection,
	updateApiSurfacesDocument,
} = require("./generate-api-surfaces");

function createManifest() {
	return {
		version: 1,
		backendRoutes: [
			{
				method: "POST",
				path: "/api/jobs",
				runtimeAdmin: true,
				source: "backend/routes/jobs.js:10",
			},
			{
				method: "GET",
				path: "/api/health",
				runtimeAdmin: false,
				source: "backend/server.js:20",
			},
		],
		nextApiRoutes: [
			{
				method: "POST",
				nextPath: "/api/jobs",
				source: "app/api/jobs/route.ts:4",
				targets: [
					{
						method: "POST",
						path: "/api/jobs",
						source: "app/api/jobs/route.ts:5",
					},
				],
			},
		],
	};
}

test("buildGeneratedSection renders backend and Next API route tables", () => {
	const section = buildGeneratedSection(createManifest());

	assert.match(section, new RegExp(GENERATED_BEGIN, "u"));
	assert.match(section, new RegExp(GENERATED_END, "u"));
	// No counts in the header: two route-adding PRs would both change that line.
	assert.match(section, /Generated from `backend\/routes\/route-manifest\.json`\.\n/u);
	assert.doesNotMatch(section, /Backend routes: \d/u);
	assert.match(section, /\| `GET` \| `\/api\/health` \| no \| `backend\/server\.js:20` \|/u);
	assert.match(section, /\| `POST` \| `\/api\/jobs` \| yes \| `backend\/routes\/jobs\.js:10` \|/u);
	assert.match(section, /\| `POST` \| `\/api\/jobs` \| `POST \/api\/jobs` \| `app\/api\/jobs\/route\.ts:4` \|/u);
});

test("replaceGeneratedSection replaces a legacy backend section", () => {
	const documentText = [
		"# API Surfaces",
		"",
		"## Dev Proxy JSON Contracts",
		"",
		"- Keep this prose.",
		"",
		"## Backend (`backend/server.js`)",
		"",
		"- stale hand-written route",
		"",
	].join("\n");
	const generatedSection = buildGeneratedSection(createManifest());

	assert.equal(
		replaceGeneratedSection(documentText, generatedSection),
		[
			"# API Surfaces",
			"",
			"## Dev Proxy JSON Contracts",
			"",
			"- Keep this prose.",
			"",
			generatedSection,
		].join("\n"),
	);
});

test("DOC_PATH targets the non-eagerly-loaded knowledge directory", () => {
	assert.equal(DOC_PATH, ".agents/knowledge/api-surfaces.md");
});

test("updateApiSurfacesDocument writes generated output and detects staleness", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-api-surfaces-"));
	mkdirSync(path.join(cwd, ".agents/knowledge"), { recursive: true });
	mkdirSync(path.join(cwd, "backend/routes"), { recursive: true });
	writeFileSync(
		path.join(cwd, DOC_PATH),
		[
			"# API Surfaces",
			"",
			"## Backend (`backend/server.js`)",
			"",
			"- stale hand-written route",
			"",
		].join("\n"),
	);
	writeFileSync(
		path.join(cwd, "backend/routes/route-manifest.json"),
		`${JSON.stringify(createManifest(), null, "\t")}\n`,
	);

	const writeResult = updateApiSurfacesDocument({ cwd });
	assert.equal(writeResult.changed, true);
	assert.match(
		readFileSync(path.join(cwd, DOC_PATH), "utf8"),
		/\| `POST` \| `\/api\/jobs` \| yes \|/u,
	);

	const checkResult = updateApiSurfacesDocument({ cwd, write: false });
	assert.equal(checkResult.changed, false);
});

test("updateApiSurfacesDocument preserves hand-written prose above the generated section", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-api-surfaces-prose-"));
	mkdirSync(path.join(cwd, ".agents/knowledge"), { recursive: true });
	mkdirSync(path.join(cwd, "backend/routes"), { recursive: true });
	writeFileSync(
		path.join(cwd, "backend/routes/route-manifest.json"),
		`${JSON.stringify(createManifest(), null, "\t")}\n`,
	);

	// First run establishes the generated section from the preamble.
	updateApiSurfacesDocument({ cwd });

	// Hand-edit the prose above the generated markers, then regenerate.
	const edited = readFileSync(path.join(cwd, DOC_PATH), "utf8").replace(
		"# API Surfaces",
		"# API Surfaces\n\nHand-written note that must survive regeneration.",
	);
	writeFileSync(path.join(cwd, DOC_PATH), edited);

	updateApiSurfacesDocument({ cwd });

	const finalText = readFileSync(path.join(cwd, DOC_PATH), "utf8");
	assert.match(finalText, /Hand-written note that must survive regeneration\./u);
	assert.match(finalText, /\| `POST` \| `\/api\/jobs` \| yes \|/u);
});

test("updateApiSurfacesDocument creates the document when it is missing", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-api-surfaces-missing-"));
	mkdirSync(path.join(cwd, "backend/routes"), { recursive: true });
	writeFileSync(
		path.join(cwd, "backend/routes/route-manifest.json"),
		`${JSON.stringify(createManifest(), null, "\t")}\n`,
	);

	// --check must fail (changed === true) when the generated file is absent.
	assert.equal(updateApiSurfacesDocument({ cwd, write: false }).changed, true);
	assert.equal(existsSync(path.join(cwd, DOC_PATH)), false);

	assert.equal(updateApiSurfacesDocument({ cwd }).changed, true);
	const written = readFileSync(path.join(cwd, DOC_PATH), "utf8");
	assert.match(written, new RegExp(GENERATED_BEGIN, "u"));
	assert.match(written, /\| `POST` \| `\/api\/jobs` \| yes \|/u);

	// Regenerating an existing file is idempotent.
	assert.equal(updateApiSurfacesDocument({ cwd, write: false }).changed, false);
});

test("the eagerly-loaded rule file does not inline the generated tables", () => {
	const repoRoot = path.join(__dirname, "..");
	const ruleText = readFileSync(path.join(repoRoot, ".agents/rules/api-surfaces.md"), "utf8");

	assert.equal(ruleText.includes(GENERATED_BEGIN), false);
	assert.equal(ruleText.includes(GENERATED_END), false);
	assert.match(ruleText, /## Dev Proxy JSON Contracts/u);
	assert.match(ruleText, /\.agents\/knowledge\/api-surfaces\.md/u);
	assert.match(ruleText, /backend\/routes\/route-manifest\.json/u);
});
