const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	DEFAULT_TARGET,
	MAX_BODY_LINES,
	buildSkillIndexText,
	collectMarkdownLinks,
	collectReferenceDocs,
	collectSkillDirectories,
	countBodyLines,
	createSkillValidationReport,
	formatRelatedDocsCell,
	normalizeMarkdownLinkTarget,
	parseArgs,
	parseFrontmatter,
	validateSkills,
	writeSkillIndex,
} = require("./validate-skills");

const COMPLETE_SKILL_BODY = [
	"# Example",
	"",
	"Use this skill.",
	"",
	"## Purpose",
	"",
	"Show an example skill.",
	"",
	"## Owner",
	"",
	"VPK.",
	"",
	"## Category",
	"",
	"maintenance.",
	"",
	"## Inputs",
	"",
	"User request.",
	"",
	"## Outputs",
	"",
	"Updated files.",
	"",
	"## Required Tools",
	"",
	"`node`.",
	"",
	"## Validation",
	"",
	"`node scripts/validate-skills.js --target .agents/skills/vpk-example-skill`.",
	"",
	"## Generated Artifacts",
	"",
	"None.",
	"",
	"## Common Failure Modes",
	"",
	"None.",
	"",
].join("\n");

function writeSkill(root, name, body = COMPLETE_SKILL_BODY) {
	const skillDir = path.join(root, DEFAULT_TARGET, name);
	mkdirSync(skillDir, { recursive: true });
	writeFileSync(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\ndescription: Example skill.\n---\n\n${body}`);
	return skillDir;
}

test("parseArgs supports custom target and json output", () => {
	assert.deepEqual(parseArgs(["--target", ".agents/skills/example", "--json"]), {
		json: true,
		target: ".agents/skills/example",
		updateIndex: false,
	});
	assert.deepEqual(parseArgs(["--target=.agents/skills/example"]), {
		json: false,
		target: ".agents/skills/example",
		updateIndex: false,
	});
	assert.deepEqual(parseArgs(["--update-index"]), {
		json: false,
		target: ".agents/skills",
		updateIndex: true,
	});
	assert.throws(() => parseArgs(["--target"]), /requires a value/u);
	assert.throws(() => parseArgs(["--unknown"]), /Unknown argument/u);
});

test("parseFrontmatter accepts block descriptions", () => {
	const parsed = parseFrontmatter("---\nname: example\ndescription: >-\n  Example skill.\n---\n\n# Example\n");
	assert.equal(parsed.failures.length, 0);
	assert.equal(parsed.fields.has("name"), true);
	assert.equal(parsed.fields.has("description"), true);
});

test("collectSkillDirectories treats an individual skill folder as a target", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-single-"));
	try {
		const skillDir = writeSkill(cwd, "vpk-example-skill");
		assert.deepEqual(collectSkillDirectories(skillDir), {
			failures: [],
			skillDirs: [skillDir],
			warnings: [],
		});
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("collectSkillDirectories ignores generated skill index at the root", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-index-root-"));
	try {
		writeSkill(cwd, "vpk-example-skill");
		writeFileSync(path.join(cwd, DEFAULT_TARGET, "INDEX.md"), "# Generated\n");
		const report = createSkillValidationReport({ checkIndex: false, cwd });
		assert.deepEqual(report.warnings, []);
		assert.deepEqual(report.skills.map((skill) => skill.name), ["vpk-example-skill"]);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("createSkillValidationReport validates repo-local skill shape", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-good-"));
	try {
		writeSkill(cwd, "vpk-example-skill");
		const report = createSkillValidationReport({ checkIndex: false, cwd });
		assert.deepEqual(report.failures, []);
		assert.deepEqual(report.warnings, []);
		assert.deepEqual(report.skills, [{
			description: "Example skill.",
			name: "vpk-example-skill",
			path: ".agents/skills/vpk-example-skill",
			relatedDocs: [],
		}]);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("createSkillValidationReport passes a minimal name+description skill with no metadata warnings", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-minimal-"));
	const originalLog = console.log;
	try {
		writeSkill(cwd, "vpk-example-skill", "# Example\n\nUse this skill.\n");
		const report = createSkillValidationReport({ checkIndex: false, cwd });
		assert.deepEqual(report.failures, []);
		assert.deepEqual(report.warnings, []);
		console.log = () => {};
		assert.equal(validateSkills({ checkIndex: false, cwd, json: true }), 0);
	} finally {
		console.log = originalLog;
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("collectReferenceDocs and index rows expose local reference docs", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-related-docs-"));
	try {
		const skillDir = writeSkill(cwd, "vpk-example-skill");
		const referencesDir = path.join(skillDir, "references");
		mkdirSync(referencesDir, { recursive: true });
		writeFileSync(path.join(referencesDir, "guide.md"), "# Guide\n");
		writeFileSync(path.join(referencesDir, "patterns.md"), "# Patterns\n");
		writeFileSync(path.join(referencesDir, "notes.txt"), "Not indexed.\n");

		assert.deepEqual(collectReferenceDocs(skillDir), [
			path.join(referencesDir, "guide.md"),
			path.join(referencesDir, "patterns.md"),
		]);

		const report = createSkillValidationReport({ checkIndex: false, cwd });
		assert.deepEqual(report.skills[0].relatedDocs, [
			".agents/skills/vpk-example-skill/references/guide.md",
			".agents/skills/vpk-example-skill/references/patterns.md",
		]);
		assert.equal(formatRelatedDocsCell({
			path: skillDir,
			relatedDocs: collectReferenceDocs(skillDir),
		}, path.join(cwd, DEFAULT_TARGET)), "[`guide`](vpk-example-skill/references/guide.md), [`patterns`](vpk-example-skill/references/patterns.md)");
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("validateSkills checks local Markdown links in skill entrypoints", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-links-"));
	try {
		const skillDir = writeSkill(cwd, "vpk-example-skill", [
			"# Example",
			"",
			"Read [Guide](references/guide.md), [Scripts](scripts/), [Anchor](#example), and [External](https://example.com).",
			"",
		].join("\n"));
		mkdirSync(path.join(skillDir, "references"), { recursive: true });
		mkdirSync(path.join(skillDir, "scripts"), { recursive: true });
		writeFileSync(path.join(skillDir, "references", "guide.md"), "# Guide\n");

		assert.equal(normalizeMarkdownLinkTarget("#example"), null);
		assert.equal(normalizeMarkdownLinkTarget("https://example.com"), null);
		assert.equal(normalizeMarkdownLinkTarget("references/guide.md#section"), "references/guide.md");
		assert.deepEqual(collectMarkdownLinks("See [Guide](references/guide.md) and ![Image](missing.png)."), [{
			index: 4,
			target: "references/guide.md",
		}]);
		assert.equal(createSkillValidationReport({ checkIndex: false, cwd }).failures.length, 0);

		writeFileSync(path.join(skillDir, "SKILL.md"), [
			"---",
			"name: vpk-example-skill",
			"description: Example skill.",
			"---",
			"",
			"# Example",
			"",
			"Read [Missing](references/missing.md).",
			"",
		].join("\n"));

		const report = createSkillValidationReport({ checkIndex: false, cwd });
		assert.deepEqual(report.failures.map((failure) => failure.type), ["skill-link-target-missing"]);
		assert.match(report.failures[0].message, /references\/missing\.md/u);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("formatRelatedDocsCell summarizes larger reference folders", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-related-docs-many-"));
	try {
		const skillDir = writeSkill(cwd, "vpk-example-skill");
		const referencesDir = path.join(skillDir, "references");
		mkdirSync(referencesDir, { recursive: true });
		const docs = ["a.md", "b.md", "c.md", "d.md"].map((fileName) => path.join(referencesDir, fileName));
		for (const docPath of docs) {
			writeFileSync(docPath, "# Doc\n");
		}

		assert.equal(formatRelatedDocsCell({
			path: skillDir,
			relatedDocs: docs,
		}, path.join(cwd, DEFAULT_TARGET)), "[`references/`](vpk-example-skill/references/) (4 docs)");
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("createSkillValidationReport catches missing entrypoints", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-missing-"));
	try {
		mkdirSync(path.join(cwd, DEFAULT_TARGET, "empty-skill"), { recursive: true });
		const report = createSkillValidationReport({ checkIndex: false, cwd });
		assert.equal(report.failures.length, 1);
		assert.equal(report.failures[0].type, "skill-entrypoint-missing");
		assert.match(report.failures[0].message, /Missing SKILL\.md/u);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("createSkillValidationReport catches malformed frontmatter", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-bad-"));
	try {
		const skillDir = path.join(cwd, DEFAULT_TARGET, "vpk-example-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: vpk-other-skill\n---\n\n# Example\n");
		const report = createSkillValidationReport({ checkIndex: false, cwd });
		assert.deepEqual(report.failures.map((failure) => failure.type), [
			"skill-name-folder-mismatch",
			"skill-description-missing",
		]);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("createSkillValidationReport catches descriptions over the 1024-character limit", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-description-length-"));
	try {
		const skillDir = path.join(cwd, DEFAULT_TARGET, "vpk-example-skill");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(path.join(skillDir, "SKILL.md"), `---\nname: vpk-example-skill\ndescription: ${"a".repeat(1025)}\n---\n\n# Example\n\nUse this skill.\n`);
		const report = createSkillValidationReport({ checkIndex: false, cwd });
		assert.deepEqual(report.failures.map((failure) => failure.type), [
			"skill-description-too-long",
		]);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("countBodyLines ignores trailing blank lines", () => {
	assert.equal(countBodyLines(""), 0);
	assert.equal(countBodyLines("\n# Example\n\nText.\n\n\n"), 4);
});

test("createSkillValidationReport caps SKILL.md bodies at the line limit", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-body-lines-"));
	try {
		const filler = (count) => Array.from({ length: count }, (_, index) => `Line ${index}.`).join("\n");
		// writeSkill prefixes the body with one blank line after the frontmatter.
		writeSkill(cwd, "vpk-at-limit", `# At limit\n${filler(MAX_BODY_LINES - 2)}\n`);
		writeSkill(cwd, "vpk-over-limit", `# Over limit\n${filler(MAX_BODY_LINES - 1)}\n`);
		const report = createSkillValidationReport({ checkIndex: false, cwd });
		assert.equal(MAX_BODY_LINES, 300);
		assert.deepEqual(report.failures.map((failure) => [path.basename(path.dirname(failure.path)), failure.type]), [
			["vpk-over-limit", "skill-body-too-long"],
		]);
		assert.match(report.failures[0].message, /body is 301 lines; the limit is 300/u);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("the repo's own skills stay under the SKILL.md body line cap", () => {
	const report = createSkillValidationReport({ checkIndex: false });
	assert.deepEqual(report.failures.filter((failure) => failure.type === "skill-body-too-long"), []);
});

test("createSkillValidationReport catches names that omit the vpk- prefix", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-prefix-"));
	try {
		const skillDir = path.join(cwd, DEFAULT_TARGET, "verify-app");
		mkdirSync(skillDir, { recursive: true });
		writeFileSync(path.join(skillDir, "SKILL.md"), "---\nname: verify-app\ndescription: Example skill.\n---\n\n# Example\n\nUse this skill.\n");
		const report = createSkillValidationReport({ checkIndex: false, cwd });
		assert.deepEqual(report.failures.map((failure) => failure.type), [
			"skill-name-prefix",
		]);
		assert.match(report.failures[0].message, /must start with "vpk-"/u);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("createSkillValidationReport allows legacy root files with warnings", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-warning-"));
	try {
		writeSkill(cwd, "vpk-example-skill");
		writeFileSync(path.join(cwd, DEFAULT_TARGET, "README.md"), "Legacy note.\n");
		const report = createSkillValidationReport({ checkIndex: false, cwd });
		assert.equal(report.failures.length, 0);
		assert.equal(report.warnings.length, 1);
		assert.equal(report.warnings[0].type, "skills-root-file");
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("writeSkillIndex generates the expected local skills index", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-index-"));
	try {
		const skillDir = writeSkill(cwd, "vpk-example-skill");
		const result = writeSkillIndex({ cwd });
		const expected = buildSkillIndexText([{
			description: "Example skill.",
			name: "vpk-example-skill",
			path: skillDir,
			relatedDocs: [],
		}], { cwd });
		assert.equal(result.indexText, expected);
		const report = createSkillValidationReport({ cwd });
		assert.equal(report.failures.length, 0);
		assert.deepEqual(report.index, {
			isCurrent: true,
			path: ".agents/skills/INDEX.md",
		});
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("createSkillValidationReport reports stale generated skill index", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-stale-index-"));
	try {
		writeSkill(cwd, "vpk-example-skill");
		writeFileSync(path.join(cwd, DEFAULT_TARGET, "INDEX.md"), "# Stale\n");
		const report = createSkillValidationReport({ cwd });
		assert.equal(report.failures.length, 1);
		assert.equal(report.failures[0].type, "skill-index-stale");
		assert.match(report.failures[0].message, /validate-skills\.js --update-index/u);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("validateSkills returns non-zero when validation fails", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-validate-skills-status-"));
	const originalError = console.error;
	const errors = [];
	try {
		mkdirSync(path.join(cwd, DEFAULT_TARGET, "empty-skill"), { recursive: true });
		console.error = (message) => {
			errors.push(String(message));
		};
		assert.equal(validateSkills({ checkIndex: false, cwd }), 1);
		assert.equal(errors[0], "Skill validation failed:");
		assert.match(errors[1], /Missing SKILL\.md/u);
	} finally {
		console.error = originalError;
		rmSync(cwd, { recursive: true, force: true });
	}
});
