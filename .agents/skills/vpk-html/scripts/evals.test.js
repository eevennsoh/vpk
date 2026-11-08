#!/usr/bin/env node

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const SKILL_ROOT = path.join(__dirname, "..");

async function loadEvals() {
	return import("./evals.mjs");
}

test("committed vpk-html evaluation corpus is complete and catalog claims are current", async () => {
	const { checkEvaluationSystem } = await loadEvals();
	const result = checkEvaluationSystem();

	assert.equal(result.ok, true, result.issues.join("\n"));
	assert.equal(result.evalCount, 14);
	assert.equal(result.playbookCount, 4);
	assert.deepEqual(result.catalogCounts, {
		demos: 133,
		diagrams: 61,
		templates: 35,
	});
});

test("evaluation corpus rejects duplicate ids and incomplete reader jobs", async () => {
	const { validateEvalCorpus } = await loadEvals();
	const fixture = {
		version: 1,
		skill_name: "vpk-html",
		evals: [
			{
				id: 1,
				name: "first",
				category: "brief",
				template: "one-pager.html",
				prompt: "/vpk-html one-pager Create the supplied brief.",
				expected_output: "A single offline HTML brief.",
				files: [],
				viewport: { width: 1280, height: 800 },
				reader_job: { quick_read: "Decide whether to proceed." },
				expectations: ["The output is a single HTML file."],
				human_rubric: ["The decision is obvious."],
			},
			{
				id: 1,
				name: "second",
				category: "brief",
				template: "one-pager.html",
				prompt: "/vpk-html one-pager Create another supplied brief.",
				expected_output: "A single offline HTML brief.",
				files: [],
				viewport: { width: 1280, height: 800 },
				reader_job: {
					quick_read: "Decide whether to proceed.",
					deep_audit: "Verify the evidence.",
				},
				expectations: ["The output is a single HTML file."],
				human_rubric: ["The decision is obvious."],
			},
		],
	};

	const issues = validateEvalCorpus(fixture, { minimumEvalCount: 2, skillRoot: SKILL_ROOT });
	assert.match(issues.join("\n"), /duplicate id 1/);
	assert.match(issues.join("\n"), /reader_job\.deep_audit/);
});

test("catalog documentation check reports stale generated counts", async () => {
	const { validateCatalogSnapshot } = await loadEvals();
	const documents = {
		"README.md": "<!-- vpk-html-catalog-counts: templates=28 diagrams=39 demos=77 -->",
		"llms.txt": "# vpk-html-catalog-counts: templates=28 diagrams=39 demos=77",
	};
	const counts = { templates: 35, diagrams: 61, demos: 111 };

	const issues = validateCatalogSnapshot(documents, counts);
	assert.equal(issues.length, 2);
	assert.match(issues[0], /README\.md/);
	assert.match(issues.join("\n"), /expected templates=35 diagrams=61 demos=111/);
});

test("catalog documentation check catches stale prose even when its snapshot is current", async () => {
	const { validateCatalogClaims } = await loadEvals();
	const documents = {
		"README.md": [
			"<!-- vpk-html-catalog-counts: templates=35 diagrams=61 demos=111 -->",
			"- **28 document templates**",
			"- **61 SVG diagram/chart primitives**",
			"- **111 HTML demos**",
		].join("\n"),
	};

	const issues = validateCatalogClaims(documents, { templates: 35, diagrams: 61, demos: 111 });
	assert.equal(issues.length, 1);
	assert.match(issues[0], /README\.md: documented template count is 28; expected 35/);
});

test("catalog check reports routing drift, stale playbook baselines and unknown eval names", async () => {
	const { checkEvaluationSystem } = await loadEvals();
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "vpk-evals-routing-"));
	const write = (relativePath, text) => {
		fs.mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
		fs.writeFileSync(path.join(root, relativePath), text);
	};
	try {
		write("assets/templates/letter.html", "<!doctype html>");
		write("assets/templates/resume.html", "<!doctype html>");
		write("assets/demos/demo-letter.html", "<!doctype html>");
		write("index.html", `<a class="demo-row" href="assets/demos/demo-letter.html">Letter</a>`);
		write("CHEATSHEET.md", "| Memo | `assets/templates/letter.html` |\n");
		write("references/authoring-detail.md", "| Memo | `letter.html` |\n| Resume | `resume.html` |\n");
		write("references/playbooks/letter.md", [
			"---", "template: letter.html", "demo: demo-letter.html", "evals: [no-such-scenario]", "figure_engines: [none]", "---", "",
			"## Use when", "- a memo", "## Choose", "- one-pager.html for a decision", "## Structure", "- salutation, body", "## Pitfalls", "- no ask", "",
		].join("\n"));
		write("evals/evals.json", JSON.stringify({ version: 1, skill_name: "vpk-html", evals: [] }));
		const result = checkEvaluationSystem({ corpusPath: path.join(root, "evals", "evals.json"), skillRoot: root });
		const issues = result.issues.join("\n");
		assert.equal(result.ok, false);
		assert.equal(result.playbookCount, 1);
		assert.match(issues, /CHEATSHEET\.md does not route assets\/templates\/resume\.html/);
		assert.match(issues, /LEGACY_TEMPLATES_WITHOUT_PLAYBOOK lists letter\.html, which now has a playbook: remove it; the baseline may only shrink/);
		assert.match(issues, /evals entry "no-such-scenario" names no scenario in evals\/evals\.json/);
	} finally {
		fs.rmSync(root, { recursive: true, force: true });
	}
});

test("build command exposes the vpk-html evaluation health check", () => {
	const buildSource = fs.readFileSync(path.join(__dirname, "build.mjs"), "utf8");
	const skillSource = fs.readFileSync(path.join(SKILL_ROOT, "SKILL.md"), "utf8");
	const evaluationSource = fs.readFileSync(path.join(SKILL_ROOT, "references", "evaluation.md"), "utf8");

	assert.match(buildSource, /--check-evals/);
	assert.match(skillSource, /references\/evaluation\.md/);
	assert.match(skillSource, /reader[’']s job/i);
	assert.match(evaluationSource, /If no compatible viewer is installed/);
	assert.match(evaluationSource, /review\.md/);
});

test("evaluation.md's run-every-suite glob reaches every test file under scripts/", () => {
	const evaluation = fs.readFileSync(path.join(SKILL_ROOT, "references", "evaluation.md"), "utf8");
	const command = evaluation.match(/^node --test "(\.agents\/skills\/vpk-html\/scripts\/[^"]+)"$/m);
	assert.ok(command, "evaluation.md gives a quoted node --test glob");
	const repoRoot = path.join(SKILL_ROOT, "..", "..", "..");
	const matched = new Set(fs.globSync(command[1], { cwd: repoRoot }).map(file => path.resolve(repoRoot, file)));
	const onDisk = [];
	const walk = dir => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (entry.name === "node_modules") continue;
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (/\.test\.m?js$/.test(entry.name)) onDisk.push(full);
		}
	};
	walk(path.join(SKILL_ROOT, "scripts"));
	assert.ok(onDisk.length > 20, `found the nested suites (${onDisk.length})`);
	const missed = onDisk.filter(file => !matched.has(file)).map(file => path.relative(SKILL_ROOT, file));
	assert.deepEqual(missed, [], `the glob misses ${missed.length} suites`);
});

test("design-system demo derives catalog metrics instead of hard-coding them", () => {
	const source = fs.readFileSync(path.join(__dirname, "generate-design-pages.mjs"), "utf8");

	assert.match(source, /collectCatalogCounts/);
	assert.doesNotMatch(source, /<strong>111<\/strong>/);
	assert.doesNotMatch(source, /<strong>110<\/strong>/);
	assert.doesNotMatch(source, /<strong>35<\/strong>/);
	assert.doesNotMatch(source, /<strong>105<\/strong>/);
	assert.doesNotMatch(source, /<strong>33<\/strong>/);
});
