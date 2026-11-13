const assert = require("node:assert/strict");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	collectDocumentationFiles,
	extractLocalSkillEntrypointReferences,
	extractPnpmRunScriptReferences,
	extractProviderCompositionFromDocs,
	extractProviderCompositionFromSource,
	formatFailure,
	parseArgs,
	verifyAgentsFreshnessSection,
	verifyDocumentedScripts,
} = require("./verify-doc-script-references");

test("extractPnpmRunScriptReferences finds pnpm and corepack pnpm run commands", () => {
	assert.deepEqual(
		extractPnpmRunScriptReferences([
			"Run `pnpm run lint` first.",
			"Then run `corepack pnpm run verify:catalog`.",
			"Use `pnpm ports` for route discovery.",
		].join("\n"), "AGENTS.md"),
		[
			{
				command: "pnpm run lint",
				filePath: "AGENTS.md",
				line: 1,
				scriptName: "lint",
			},
			{
				command: "corepack pnpm run verify:catalog",
				filePath: "AGENTS.md",
				line: 2,
				scriptName: "verify:catalog",
			},
		],
	);
});

test("extractLocalSkillEntrypointReferences finds repo-local skill entrypoints", () => {
	assert.deepEqual(
		extractLocalSkillEntrypointReferences([
			"Read `.agents/skills/vpk-tidy/SKILL.md` first.",
			"Global `~/.agents/skills/shadcn/SKILL.md` is outside this repo.",
			"Optional `.agents/skills/vpk-deploy/SKILL.local.md` is not required.",
		].join("\n"), "AGENTS.md"),
		[
			{
				filePath: "AGENTS.md",
				line: 1,
				referencePath: ".agents/skills/vpk-tidy/SKILL.md",
				skillName: "vpk-tidy",
			},
		],
	);
});

test("extractProviderCompositionFromSource reads the primary provider wrapper chain", () => {
	assert.deepEqual(
		extractProviderCompositionFromSource(`
			export function Providers({ children }) {
				return (
					<MotionConfig>
						<ThemeWrapper>
							<SidebarProvider>
								<RovoChatContext.RovoChatProvider>
									<UserInvalidSync />
									{children}
								</RovoChatContext.RovoChatProvider>
							</SidebarProvider>
						</ThemeWrapper>
					</MotionConfig>
				);
			}
		`),
		["MotionConfig", "ThemeWrapper", "SidebarProvider", "RovoChatProvider"],
	);
});

test("extractProviderCompositionFromDocs reads the architecture provider block", () => {
	assert.deepEqual(
		extractProviderCompositionFromDocs([
			"## Provider Composition",
			"",
			"```text",
			"MotionConfig",
			"  -> ThemeWrapper",
			"    -> SidebarProvider",
			"      -> RovoChatProvider",
			"```",
		].join("\n")).stack,
		["MotionConfig", "ThemeWrapper", "SidebarProvider", "RovoChatProvider"],
	);
});

test("verifyDocumentedScripts reports missing package scripts with file and line", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-doc-scripts-"));
	try {
		writeFileSync(path.join(cwd, "package.json"), JSON.stringify({
			scripts: {
				lint: "eslint .",
			},
		}));
		writeFileSync(path.join(cwd, "docs.md"), [
			"# Docs",
			"",
			"`pnpm run lint`",
			"`pnpm run missing:script`",
		].join("\n"));

		const result = verifyDocumentedScripts({ cwd, files: ["docs.md"] });
		assert.equal(result.referenceCount, 2);
		assert.equal(result.failures.length, 1);
		assert.equal(result.failures[0].filePath, "docs.md");
		assert.equal(result.failures[0].line, 4);
		assert.equal(result.failures[0].scriptName, "missing:script");
		assert.match(result.failures[0].message, /missing package\.json script/u);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("verifyDocumentedScripts reports missing local skill entrypoints", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-doc-skills-"));
	try {
		mkdirSync(path.join(cwd, ".agents", "skills", "present-skill"), { recursive: true });
		writeFileSync(path.join(cwd, ".agents", "skills", "present-skill", "SKILL.md"), "---\nname: present-skill\n---\n");
		writeFileSync(path.join(cwd, "package.json"), JSON.stringify({
			scripts: {},
		}));
		writeFileSync(path.join(cwd, "docs.md"), [
			"# Docs",
			"",
			"` .agents/skills/present-skill/SKILL.md `",
			"` .agents/skills/missing-skill/SKILL.md `",
		].join("\n"));

		const result = verifyDocumentedScripts({ cwd, files: ["docs.md"] });
		assert.equal(result.skillReferenceCount, 2);
		assert.equal(result.failures.length, 1);
		assert.equal(result.failures[0].filePath, "docs.md");
		assert.equal(result.failures[0].line, 4);
		assert.equal(result.failures[0].skillName, "missing-skill");
		assert.match(result.failures[0].message, /does not exist/u);
		assert.match(formatFailure(result.failures[0]), /docs\.md:4/u);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("verifyDocumentedScripts reports provider composition drift", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-doc-providers-"));
	try {
		mkdirSync(path.join(cwd, ".agents", "docs"), { recursive: true });
		mkdirSync(path.join(cwd, "app"), { recursive: true });
		writeFileSync(path.join(cwd, "package.json"), JSON.stringify({
			scripts: {},
		}));
		writeFileSync(path.join(cwd, ".agents", "docs", "architecture-overview.md"), [
			"## Provider Composition",
			"",
			"```text",
			"ThemeWrapper",
			"  -> SidebarProvider",
			"    -> CreationModeProvider",
			"      -> RovoChatProvider",
			"```",
		].join("\n"));
		writeFileSync(path.join(cwd, "app", "providers.tsx"), `
			export function Providers({ children }) {
				return (
					<MotionConfig>
						<ThemeWrapper>
							<SidebarProvider>
								<RovoChatContext.RovoChatProvider>{children}</RovoChatContext.RovoChatProvider>
							</SidebarProvider>
						</ThemeWrapper>
					</MotionConfig>
				);
			}
		`);

		const result = verifyDocumentedScripts({
			cwd,
			files: [".agents/docs/architecture-overview.md"],
		});
		assert.equal(result.failures.length, 1);
		assert.equal(result.failures[0].type, "provider-composition");
		assert.equal(result.failures[0].filePath, ".agents/docs/architecture-overview.md");
		assert.match(result.failures[0].message, /MotionConfig -> ThemeWrapper -> SidebarProvider -> RovoChatProvider/u);
		assert.match(formatFailure(result.failures[0]), /architecture-overview\.md:3/u);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("verifyAgentsFreshnessSection reports missing and incomplete freshness blocks", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-agents-freshness-missing-"));
	try {
		mkdirSync(path.join(cwd, ".agents", "rules"), { recursive: true });
		writeFileSync(path.join(cwd, ".agents", "rules", "testing.md"), "# Docs\n");

		const result = verifyAgentsFreshnessSection({ cwd, files: [".agents/rules/testing.md"] });
		assert.equal(result.failures.length, 1);
		assert.equal(result.failures[0].type, "agents-freshness");
		assert.match(result.failures[0].message, /validation-freshness:begin/u);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("verifyAgentsFreshnessSection accepts the required freshness command and reference set", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-agents-freshness-"));
	try {
		mkdirSync(path.join(cwd, ".agents", "rules"), { recursive: true });
		writeFileSync(path.join(cwd, ".agents", "rules", "testing.md"), [
			"# Docs",
			"",
			"<!-- validation-freshness:begin -->",
			"- `pnpm run validate:preflight`",
			"- `pnpm run verify:route-manifest`",
			"- `pnpm run verify:api-surfaces`",
			"- `pnpm run verify:repo-map`",
			"- `pnpm run verify:file-size`",
			"- `pnpm run verify:catalog`",
			"- `pnpm run verify:lazy-load`",
			"- `pnpm run verify:source-guardrails`",
			"- `pnpm run verify:doc-scripts`",
			"- `pnpm run lint`",
			"- `pnpm run typecheck`",
			"",
			"- `.agents/docs/architecture-overview.md`",
			"- `.agents/docs/workflows-extended.md`",
			"- `.agents/rules/api-surfaces.md`",
			"- `.agents/rules/token-priority.md`",
			"- `.agents/rules/component-architecture.md`",
			"- `.agents/rules/agent-operations.md`",
			"<!-- validation-freshness:end -->",
		].join("\n"));

		assert.deepEqual(verifyAgentsFreshnessSection({ cwd, files: [".agents/rules/testing.md"] }).failures, []);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("collectDocumentationFiles walks documented targets and ignores non-markdown files", () => {
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-doc-scripts-"));
	try {
		mkdirSync(path.join(cwd, ".agents", "docs"), { recursive: true });
		writeFileSync(path.join(cwd, "AGENTS.md"), "");
		writeFileSync(path.join(cwd, ".agents", "docs", "one.md"), "");
		writeFileSync(path.join(cwd, ".agents", "docs", "two.mdc"), "");
		writeFileSync(path.join(cwd, ".agents", "docs", "ignored.txt"), "");

		assert.deepEqual(collectDocumentationFiles({ cwd, targets: ["AGENTS.md", ".agents/docs"] }), [
			".agents/docs/one.md",
			".agents/docs/two.mdc",
			"AGENTS.md",
		]);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});

test("parseArgs accepts repeated targets and rejects incomplete options", () => {
	assert.deepEqual(parseArgs(["--json", "--target", "AGENTS.md", "--target=.agents/docs"]), {
		json: true,
		targets: ["AGENTS.md", ".agents/docs"],
	});
	assert.throws(() => parseArgs(["--target"]), /requires a value/u);
	assert.throws(() => parseArgs(["--unknown"]), /Unknown argument/u);
});

test("verifyDocumentedScripts fails on a backticked repo path that no longer exists", () => {
	const { spawnSync } = require("node:child_process");
	const cwd = mkdtempSync(path.join(os.tmpdir(), "vpk-doc-paths-"));
	try {
		writeFileSync(path.join(cwd, "package.json"), JSON.stringify({ scripts: {} }));
		writeFileSync(path.join(cwd, ".gitignore"), "output/\n.claude/launch.json\n");
		mkdirSync(path.join(cwd, "app"), { recursive: true });
		writeFileSync(path.join(cwd, "app", "providers.tsx"), "export {};\n");
		mkdirSync(path.join(cwd, "components", "ui"), { recursive: true });
		writeFileSync(path.join(cwd, "components", "ui", "button.tsx"), "export {};\n");
		mkdirSync(path.join(cwd, ".agents", "skills", "demo", "scripts"), { recursive: true });
		writeFileSync(path.join(cwd, ".agents", "skills", "demo", "scripts", "status.sh"), "#!/bin/sh\n");
		writeFileSync(path.join(cwd, ".agents", "skills", "demo", "SKILL.md"), "Run `scripts/status.sh`; see `app/providers.tsx:3`.\n");
		writeFileSync(path.join(cwd, "docs.md"), [
			"Providers live in `app/providers.tsx` and load through `@/app/providers`; buttons in `components/ui/`.",
			"Screens land in `output/agent-browser/` and previews read `.claude/launch.json`.",
			"Placeholders: `app/[slug]/page.tsx`, `components/<name>/`, `app/**/*.tsx`.",
			"Not paths: `origin/main`, `eevennsoh/vpk`, `@atlaskit/tokens`, `https://example.com/a/b`.",
			"Moved: `components/providers.tsx`.",
		].join("\n"));
		for (const args of [["init", "-q"], ["add", "-A"]]) {
			assert.equal(spawnSync("git", args, { cwd }).status, 0);
		}

		const result = verifyDocumentedScripts({ cwd, files: ["docs.md", ".agents/skills/demo/SKILL.md"] });
		assert.deepEqual(
			result.failures.map(({ filePath, line, message }) => `${filePath}:${line} ${message}`),
			["docs.md:5 Documented path `components/providers.tsx` does not exist."],
		);
	} finally {
		rmSync(cwd, { recursive: true, force: true });
	}
});
