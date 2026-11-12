const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	createRepoAgentSkillHarness,
	parseSkillFrontmatter,
} = require("./agent-skill-harness");

test("parseSkillFrontmatter returns metadata and body", () => {
	const parsed = parseSkillFrontmatter([
		"---",
		"name: example-skill",
		"description: 'Example skill.'",
		"metadata:",
		"  owner: platform",
		"---",
		"# Example",
	].join("\n"));

	assert.equal(parsed.metadata.name, "example-skill");
	assert.equal(parsed.metadata.description, "Example skill.");
	assert.deepEqual(parsed.metadata.metadata, { owner: "platform" });
	assert.match(parsed.body, /^# Example/u);
});

test("discovers vpk-html metadata from the repo-local skills root", async () => {
	const harness = createRepoAgentSkillHarness();
	const skill = await harness.loadSkillMetadata("vpk-html");

	assert.equal(skill.name, "vpk-html");
	assert.match(skill.description, /one offline file/u);
	assert.equal(
		path.relative(process.cwd(), skill.skillRoot).split(path.sep).join("/"),
		".agents/skills/vpk-html",
	);
});

test("resolves and loads vpk-html files relative to the skill root", async () => {
	const harness = createRepoAgentSkillHarness();
	const template = await harness.readSkillFile(
		"vpk-html",
		"assets/templates/status-report.html",
	);

	assert.match(template, /TEMPLATE · Status Report/);
	assert.match(template, /<meta name="generator" content="vpk-html">/);
});

test("rejects path traversal outside the skill root", async () => {
	const harness = createRepoAgentSkillHarness();

	await assert.rejects(
		harness.readSkillFile("vpk-html", "../vpk-tidy/SKILL.md"),
		/escapes the skill root/u,
	);
	assert.throws(
		() => harness.resolveSkillPath("../vpk-html", "SKILL.md"),
		/escapes the skills root/u,
	);
});

test("runs only allowlisted skill validation scripts", async () => {
	const harness = createRepoAgentSkillHarness();
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "agent-skill-harness-"));
	const htmlPath = path.join(tempDir, "report.html");

	try {
		await fs.writeFile(
			htmlPath,
			"<!doctype html><html><head><title>Report</title></head><body><main>Report</main></body></html>",
			"utf8",
		);
		const result = await harness.runSkillScript(
			"vpk-html",
			"scripts/build.mjs",
			["--check-placeholders", htmlPath],
		);

		assert.equal(result.ok, true);
		assert.match(result.stdout, /no unfilled placeholders/u);
		await assert.rejects(
			harness.runSkillScript("vpk-html", "scripts/build.mjs", ["--sync"]),
			/not allowlisted/u,
		);
	} finally {
		await fs.rm(tempDir, { recursive: true, force: true });
	}
});
