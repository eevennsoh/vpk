import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
	evaluateEligibility,
	fetchPullRequest,
	formatDecision,
	globToRegExp,
	isPrunedSuppressions,
	normalizePath,
	parseArgs,
} from "./automation-merge-eligibility.mjs";

const REPO = "eevennsoh/vpk";
const SHA = "a".repeat(40);
const CONTEXT = { repository: REPO, defaultBranch: "main" };

function file(path, extra = {}) {
	return { path, status: "modified", additions: 4, deletions: 1, ...extra };
}

function pr(overrides = {}) {
	const files = overrides.files ?? [file("lib/foo.test.ts")];
	return {
		number: 42,
		state: "OPEN",
		author: "eevennsoh",
		labels: ["automation", "codex", "automerge:allowed"],
		isDraft: false,
		baseRefName: "main",
		headRefName: "automation/test-coverage-foo",
		headRepository: REPO,
		headRefOid: SHA,
		changedFiles: files.length,
		...overrides,
		files,
	};
}

function reasonsFor(overrides, context = CONTEXT) {
	return evaluateEligibility(pr(overrides), context).reasons;
}

function assertIneligible(files, label) {
	const decision = evaluateEligibility(pr({ files }), CONTEXT);
	assert.equal(decision.eligible, false, `${label} should be ineligible`);
	return decision.reasons;
}

describe("evaluateEligibility: PR identity", () => {
	test("a labelled owner PR editing one existing test is eligible", () => {
		const decision = evaluateEligibility(pr(), CONTEXT);
		assert.deepEqual(decision.reasons, []);
		assert.equal(decision.eligible, true);
		assert.equal(decision.mode, "merge");
		assert.equal(decision.changedLines, 5);
	});

	test("requires both automation and automerge:allowed", () => {
		assert.deepEqual(reasonsFor({ labels: ["codex"] }), ["missing label automation", "missing label automerge:allowed"]);
	});

	test("policy mode does not require automerge:allowed but still requires automation", () => {
		const policy = { ...CONTEXT, requireGrantLabel: false };
		assert.equal(evaluateEligibility(pr({ labels: ["automation"] }), policy).eligible, true);
		assert.deepEqual(reasonsFor({ labels: [] }, policy), ["missing label automation"]);
		assert.equal(evaluateEligibility(pr(), policy).mode, "policy");
	});

	for (const label of ["automerge:blocked", "risk:needs-human", "review:changes-requested"]) {
		test(`blocking label ${label} wins over automerge:allowed`, () => {
			assert.deepEqual(reasonsFor({ labels: ["automation", "automerge:allowed", label] }), [`blocking label ${label}`]);
		});
	}

	test("rejects drafts, closed PRs, foreign bases, forks, and other authors", () => {
		assert.deepEqual(reasonsFor({ isDraft: true }), ["PR is a draft"]);
		assert.deepEqual(reasonsFor({ state: "MERGED" }), ["PR is merged"]);
		assert.deepEqual(reasonsFor({ baseRefName: "release" }), ["base release is not the default branch main"]);
		assert.deepEqual(reasonsFor({ headRepository: "someone/vpk" }), ["head repository someone/vpk is not eevennsoh/vpk"]);
		assert.deepEqual(reasonsFor({ author: "dependabot[bot]" }), ["author dependabot[bot] is not the repo owner eevennsoh"]);
	});

	test("requires the producer branch prefix automation/", () => {
		assert.deepEqual(reasonsFor({ headRefName: "codex/foo" }), ["head branch codex/foo does not start with automation/"]);
		assert.deepEqual(reasonsFor({ headRefName: "Automation/foo" }), ["head branch Automation/foo does not start with automation/"]);
	});

	test("owner and repository comparisons ignore case", () => {
		assert.equal(evaluateEligibility(pr({ author: "EevennSoh", headRepository: "EEVENNSOH/VPK" }), CONTEXT).eligible, true);
	});

	test("pins to the expected head and rejects a head that moved while reading files", () => {
		assert.deepEqual(reasonsFor({}, { ...CONTEXT, expectedHead: "b".repeat(40) }), [`head ${SHA} is not the expected ${"b".repeat(40)}`]);
		assert.deepEqual(reasonsFor({ headAfterFiles: "c".repeat(40) }), [`head moved from ${SHA} to ${"c".repeat(40)} while reading files`]);
		assert.equal(evaluateEligibility(pr({ headAfterFiles: SHA }), { ...CONTEXT, expectedHead: SHA }).eligible, true);
	});
});

describe("evaluateEligibility: tests", () => {
	test("only modified files matching the strict test globs are allowed", () => {
		for (const path of ["lib/foo.test.ts", "scripts/foo.test.mjs", "app/x.test.tsx", "a.test.cjs", "a.test.js", "tests/smoke/home.spec.ts"]) {
			assert.deepEqual(reasonsFor({ files: [file(path)] }), [], path);
		}
	});

	test("probe: helpers and configs under tests/ are not tests", () => {
		assert.deepEqual(assertIneligible([file("tests/helpers/global-setup.ts")], "helper"), ["tests/helpers/global-setup.ts is outside the low-risk allowlist"]);
		assert.deepEqual(assertIneligible([file("tests/playwright.config.ts")], "config"), ["tests/playwright.config.ts is outside the low-risk allowlist"]);
		assertIneligible([file("foo.test.md")], ".test.md");
	});

	test("probe: new test files anywhere need a human", () => {
		assert.deepEqual(
			assertIneligible([file("backend/lib/rovo-client.exfil.test.js", { status: "added" })], "added backend test"),
			["backend/lib/rovo-client.exfil.test.js: a added test file needs a human"],
		);
		assertIneligible([file("app/api/x/route.test.ts", { status: "added" })], "added app test");
	});

	test("deleting a test needs a human", () => {
		assert.deepEqual(reasonsFor({ files: [file("lib/foo.test.ts", { status: "removed" })] }), ["lib/foo.test.ts: a removed test file needs a human"]);
	});
});

describe("evaluateEligibility: docs", () => {
	test("READMEs outside denied trees are the only allowed docs", () => {
		for (const path of ["README.md", "components/projects/rovo-core/README.md", "public/1p/rovo-stage-kit/readme.md"]) {
			assert.deepEqual(reasonsFor({ files: [file(path)] }), [], path);
		}
		assert.deepEqual(reasonsFor({ files: [file("notes/new.md")] }), ["notes/new.md is outside the low-risk allowlist"]);
	});

	test("probe: agent instruction files are denied in any case and folder", () => {
		for (const path of [
			"AGENTS.md",
			"components/agents.md",
			"claude.md",
			"design.md",
			"Design.md",
			"WORKFLOW.md",
			"AGENTS.override.md",
			"CLAUDE.local.md",
			"docs/notes.override.md",
			"components/foo/agents.md",
		]) {
			assert.deepEqual(assertIneligible([file(path)], path), [`${path} is on the denylist`], path);
		}
	});

	test("probe: agent and provider trees are denied whatever the case", () => {
		for (const path of [
			".claude/agents/claude.md",
			".claude/commands/ship.md",
			".codex/prompts/x.md",
			".cursor/rules/x.mdc",
			".rovo/config.md",
			".agents/skills/vpk-design/references/tokens.md",
			".agents/skills/vpk-design/skill.md",
			".agents/docs/playbooks/push-corrections-down-the-ladder.md",
			".agents/docs/hardening-record.md",
			".agents/Rules/x.md",
			".agents/rules/cursor/x.mdc",
			".agents/agents/vpk-agent-implementer.md",
			"docs/commands/README.md",
			"lib/prompts/README.md",
		]) {
			assert.deepEqual(assertIneligible([file(path)], path), [`${path} is on the denylist`], path);
		}
	});

	test("probe: other markdown-like files are not docs", () => {
		assertIneligible([file("app/docs/page.mdx")], "mdx");
	});
});

describe("evaluateEligibility: path normalisation", () => {
	test("normalizePath lowercases, strips ./ and rejects unsafe paths", () => {
		assert.equal(normalizePath("./README.md"), "readme.md");
		assert.equal(normalizePath("A/B.Test.TS"), "a/b.test.ts");
		for (const unsafe of ["../x.md", "a/../b.md", "a\\b.md", "/abs.md", "a//b.md", "café/README.md", "a/./b.md", "", undefined]) {
			assert.equal(normalizePath(unsafe), null, String(unsafe));
		}
	});

	test("probe: case variants of denied files are denied", () => {
		assert.deepEqual(assertIneligible([file("Package.json")], "Package.json"), ["Package.json is on the denylist"]);
		assertIneligible([file(".GITHUB/workflows/ci.yml")], ".GITHUB");
	});

	test("unsafe paths are rejected outright", () => {
		assert.deepEqual(assertIneligible([file("../README.md")], "dotdot"), ['"../README.md" is not a plain ASCII relative path']);
		assertIneligible([file("docs\\README.md")], "backslash");
		assertIneligible([file("RÉADME.md")], "non-ASCII");
	});
});

describe("evaluateEligibility: renames and copies", () => {
	const renamed = (path, previousPath, status = "renamed") => file(path, { status, previousPath });

	test("probe: renaming a denied or non-eligible file is ineligible", () => {
		assertIneligible([renamed("docs/x.md", ".agents/rules/testing.md")], "rule -> doc");
		assertIneligible([renamed("docs/AGENTS-old.md", "AGENTS.md")], "AGENTS.md -> doc");
		assertIneligible([renamed("notes/s.md", "eslint-suppressions.json")], "suppressions -> md");
		assert.deepEqual(
			assertIneligible([renamed("README.md", ".github/notes.md")], "deny -> README"),
			[".github/notes.md is on the denylist"],
		);
	});

	test("probe: renaming a test is a test deletion plus a test addition", () => {
		assert.deepEqual(assertIneligible([renamed("notes/old.md", "scripts/foo.test.js")], "test -> md"), [
			"scripts/foo.test.js: a removed test file needs a human",
			"notes/old.md is outside the low-risk allowlist",
		]);
		assertIneligible([renamed("lib/b.test.ts", "lib/a.test.ts")], "test -> test");
	});

	test("README renames and copies are allowed when both halves are READMEs", () => {
		assert.deepEqual(reasonsFor({ files: [renamed("components/x/README.md", "components/y/README.md")] }), []);
		assert.deepEqual(reasonsFor({ files: [renamed("components/x/README.md", "README.md", "copied")] }), []);
		assertIneligible([renamed("components/x/README.md", "lib/a.ts", "copied")], "copy from source");
	});
});

describe("evaluateEligibility: generated files and line counts", () => {
	test("generated files ride along only beside an eligible change", () => {
		const generated = [file(".agents/knowledge/repo-map.json"), file(".agents/skills/INDEX.md")];
		assert.deepEqual(reasonsFor({ files: [file("lib/foo.test.ts"), ...generated] }), []);
		assert.deepEqual(reasonsFor({ files: generated }), ["only generated files changed; they are eligible only beside a low-risk change"]);
		assertIneligible([file(".agents/knowledge/repo-map.json", { additions: 200 }), file("x.md")], "probe: generated beside non-README md");
		assertIneligible([file(".agents/knowledge/new.json", { status: "added" }), file("README.md")], "added generated file");
	});

	test("probe: missing line counts are ineligible", () => {
		assert.deepEqual(
			assertIneligible([file("README.md", { additions: undefined, deletions: undefined })], "missing counts"),
			["README.md has no line counts"],
		);
	});

	test("an empty or incomplete file list is ineligible", () => {
		assert.deepEqual(reasonsFor({ files: [] }), ["PR changes no files"]);
		assert.deepEqual(reasonsFor({ changedFiles: 2 }), ["file list incomplete (1 of 2)"]);
		assert.deepEqual(reasonsFor({ changedFiles: undefined }), ["file list incomplete (1 of unknown)"]);
	});

	test("total changed lines are capped at 300", () => {
		assert.deepEqual(reasonsFor({ files: [file("a.test.js", { additions: 200, deletions: 100 })] }), []);
		assert.deepEqual(
			reasonsFor({ files: [file("a.test.js", { additions: 200, deletions: 50 }), file("README.md", { additions: 51, deletions: 0 })] }),
			["301 changed lines exceed the 300-line limit"],
		);
	});

	test("probe: CI gate scripts and their tests are denied", () => {
		for (const path of ["scripts/verify-x.test.mjs", "scripts/run-js-unit-tests.test.js", "scripts/automation-merge.test.mjs", "scripts/automation-merge-eligibility.test.mjs", "playwright.config.ts"]) {
			assert.deepEqual(assertIneligible([file(path)], path), [`${path} is on the denylist`], path);
		}
	});

	test("decision lists every file category", () => {
		const decision = evaluateEligibility(pr({ files: [file("a.test.js"), file("README.md"), file(".agents/skills/INDEX.md")] }), CONTEXT);
		assert.deepEqual(decision.files.map((entry) => entry.category), ["test", "doc", "generated"]);
	});
});

describe("eslint-suppressions.json may only shrink", () => {
	const BASE = JSON.stringify({ "a.ts": { "no-x": { count: 1 } }, "b.ts": { "no-x": { count: 50 }, "no-y": { count: 2 } } });
	const suppressions = (headContent, extra = {}) => file("eslint-suppressions.json", { baseContent: BASE, headContent, ...extra });

	test("isPrunedSuppressions accepts dropped entries and lowered counts only", () => {
		assert.equal(isPrunedSuppressions(BASE, JSON.stringify({ "b.ts": { "no-x": { count: 49 } } })), true);
		assert.equal(isPrunedSuppressions(BASE, BASE), true);
		assert.equal(isPrunedSuppressions(BASE, JSON.stringify({ "a.ts": { "no-x": { count: 2 } } })), false, "raised count");
		assert.equal(isPrunedSuppressions(BASE, JSON.stringify({ "c.ts": { "no-x": { count: 1 } } })), false, "new file key");
		assert.equal(isPrunedSuppressions(BASE, JSON.stringify({ "a.ts": { "no-z": { count: 1 } } })), false, "new rule key");
		assert.equal(isPrunedSuppressions(BASE, JSON.stringify({ "a.ts": { "no-x": { count: 1, extra: 1 } } })), false, "extra field");
		assert.equal(isPrunedSuppressions(BASE, JSON.stringify({ "a.ts": { "no-x": { count: -1 } } })), false, "negative");
		assert.equal(isPrunedSuppressions(BASE, "{\"a.ts\": {\"no-x\": {\"count\": 1\n\"count\": 50}}}"), false, "probe: unparsable merge");
		assert.equal(isPrunedSuppressions(BASE, undefined), false);
		assert.equal(isPrunedSuppressions(undefined, BASE), false);
	});

	test("a pruning change is eligible on its own; a growing one is not", () => {
		assert.deepEqual(reasonsFor({ files: [suppressions(JSON.stringify({ "a.ts": { "no-x": { count: 1 } } }))] }), []);
		const reason = "eslint-suppressions.json may only drop entries or lower counts, or its contents were unavailable";
		assert.deepEqual(reasonsFor({ files: [suppressions(JSON.stringify({ "z.ts": { "no-x": { count: 1 } } }))] }), [reason]);
		assert.deepEqual(reasonsFor({ files: [file("eslint-suppressions.json")] }), [reason]);
	});

	test("probe: deleting the suppressions file is ineligible", () => {
		assert.deepEqual(
			assertIneligible([suppressions(undefined, { status: "removed", additions: 0, deletions: 3 })], "removed"),
			["eslint-suppressions.json may only be modified (removed)"],
		);
	});
});

describe("globToRegExp", () => {
	test("single star stays in a segment, double star crosses segments, braces alternate", () => {
		assert.equal(globToRegExp("scripts/verify-*").test("scripts/verify-x.js"), true);
		assert.equal(globToRegExp("scripts/verify-*").test("scripts/lib/verify-x.js"), false);
		assert.equal(globToRegExp("**/readme.md").test("readme.md"), true);
		assert.equal(globToRegExp("**/readme.md").test("a/b/readme.md"), true);
		assert.equal(globToRegExp("tests/**/*.spec.ts").test("tests/a/b.spec.ts"), true);
		assert.equal(globToRegExp("tests/**/*.spec.ts").test("tests/b.spec.ts"), true);
		assert.equal(globToRegExp("**/*.test.{js,ts}").test("lib/foo.test.ts"), true);
		assert.equal(globToRegExp("**/*.test.{js,ts}").test("lib/foo.test.md"), false);
	});
});

describe("CLI helpers", () => {
	test("parseArgs validates --pr, --repo and --head", () => {
		assert.deepEqual(parseArgs(["--pr", "12", "--repo", REPO, "--json", "--policy", "--head", SHA]), {
			prNumber: 12, repository: REPO, expectedHead: SHA, json: true, policy: true,
		});
		assert.throws(() => parseArgs(["--repo", REPO]), /--pr/u);
		assert.throws(() => parseArgs(["--pr", "1"]), /--repo/u);
		assert.throws(() => parseArgs(["--pr", "1", "--repo", REPO, "--head", "abc"]), /--head/u);
		assert.throws(() => parseArgs(["--pr", "1", "--repo", REPO, "--merge"]), /Unknown argument/u);
	});

	function fakeGh({ headAfter = SHA, contents = {} } = {}) {
		const calls = [];
		const runGh = async (args) => {
			calls.push(args);
			if (args[0] === "pr" && args.at(-1) === "headRefOid") return JSON.stringify({ headRefOid: headAfter });
			if (args[0] === "pr") {
				return JSON.stringify({
					number: 7,
					state: "OPEN",
					author: { login: "eevennsoh" },
					labels: [{ name: "automation" }, { name: "automerge:allowed" }],
					isDraft: false,
					baseRefName: "main",
					baseRefOid: "f".repeat(40),
					headRefName: "automation/x-y",
					headRefOid: SHA,
					headRepository: { name: "vpk" },
					headRepositoryOwner: { login: "eevennsoh" },
					changedFiles: 3,
				});
			}
			if (args[0] === "repo") return JSON.stringify({ defaultBranchRef: { name: "main" } });
			if (args.includes("--paginate")) {
				return [
					JSON.stringify({ filename: "a.test.js", previous_filename: null, status: "modified", additions: 3, deletions: 0 }),
					JSON.stringify({ filename: "b/README.md", status: "renamed", previous_filename: "c/README.md", additions: 0, deletions: 0 }),
					JSON.stringify({ filename: "eslint-suppressions.json", status: "modified", additions: 0, deletions: 5 }),
					"",
				].join("\n");
			}
			const ref = args.at(-1).split("ref=")[1];
			return contents[ref];
		};
		return { runGh, calls };
	}

	test("fetchPullRequest reads files from the compare API pinned to base and head SHAs", async () => {
		const base = JSON.stringify({ "a.ts": { r: { count: 2 } } });
		const head = JSON.stringify({ "a.ts": { r: { count: 1 } } });
		const fake = fakeGh({ contents: { ["f".repeat(40)]: base, [SHA]: head } });
		const { pr: fetched, defaultBranch } = await fetchPullRequest({ prNumber: 7, repository: REPO, runGh: fake.runGh });
		assert.equal(defaultBranch, "main");
		assert.equal(fetched.headRefName, "automation/x-y");
		assert.equal(fetched.headAfterFiles, SHA);
		assert.deepEqual(fetched.files.map((entry) => [entry.path, entry.previousPath ?? null]), [
			["a.test.js", null], ["b/README.md", "c/README.md"], ["eslint-suppressions.json", null],
		]);
		const compare = fake.calls.find((args) => args.includes("--paginate"));
		assert.ok(compare.some((part) => part.startsWith(`repos/${REPO}/compare/${"f".repeat(40)}...${SHA}`)));
		assert.equal(fetched.files[2].baseContent, base);
		assert.equal(fetched.files[2].headContent, head);
		assert.equal(evaluateEligibility(fetched, { repository: REPO, defaultBranch }).eligible, true);
	});

	test("a head that moves while files are read makes the PR ineligible", async () => {
		const fake = fakeGh({ headAfter: "e".repeat(40) });
		const { pr: fetched, defaultBranch } = await fetchPullRequest({ prNumber: 7, repository: REPO, runGh: fake.runGh });
		const decision = evaluateEligibility(fetched, { repository: REPO, defaultBranch });
		assert.equal(decision.eligible, false);
		assert.ok(decision.reasons.includes(`head moved from ${SHA} to ${"e".repeat(40)} while reading files`));
	});

	test("formatDecision prints a verdict line and reasons", () => {
		const text = formatDecision(evaluateEligibility(pr({ isDraft: true }), CONTEXT));
		assert.equal(text, `INELIGIBLE #42 @ ${SHA} (merge, 5 lines)\n- PR is a draft`);
	});
});
