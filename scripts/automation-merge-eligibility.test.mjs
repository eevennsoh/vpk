import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
	evaluateEligibility,
	fetchPullRequest,
	formatDecision,
	globToRegExp,
	isPruneOnlyPatch,
	parseArgs,
} from "./automation-merge-eligibility.mjs";

const REPO = "eevennsoh/vpk";
const CONTEXT = { repository: REPO, defaultBranch: "main" };

function file(path, extra = {}) {
	return { path, status: "modified", additions: 4, deletions: 1, ...extra };
}

function pr(overrides = {}) {
	return {
		number: 42,
		state: "OPEN",
		author: "eevennsoh",
		labels: ["automation", "codex", "automerge:allowed"],
		isDraft: false,
		baseRefName: "main",
		headRepository: REPO,
		headRefOid: "a".repeat(40),
		files: [file("lib/foo.test.ts")],
		...overrides,
	};
}

function reasonsFor(overrides, context = CONTEXT) {
	return evaluateEligibility(pr(overrides), context).reasons;
}

describe("evaluateEligibility: PR identity", () => {
	test("a labelled owner test-only PR is eligible", () => {
		const decision = evaluateEligibility(pr(), CONTEXT);
		assert.equal(decision.eligible, true);
		assert.deepEqual(decision.reasons, []);
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

	test("owner and repository comparisons ignore case", () => {
		assert.equal(evaluateEligibility(pr({ author: "EevennSoh", headRepository: "EEVENNSOH/VPK" }), CONTEXT).eligible, true);
	});
});

describe("evaluateEligibility: changed files", () => {
	test("tests and ordinary docs are allowed", () => {
		const files = [file("tests/smoke/home.spec.ts"), file("scripts/foo.test.mjs"), file(".agents/docs/herdr.md"), file("README.md")];
		assert.deepEqual(reasonsFor({ files }), []);
	});

	test("agent and product policy markdown is not a low-risk doc", () => {
		for (const path of ["AGENTS.md", "DESIGN.md", "WORKFLOW.md", "app/AGENTS.md", ".agents/rules/testing.md", ".agents/skills/vpk-tidy/SKILL.md"]) {
			assert.deepEqual(reasonsFor({ files: [file(path)] }), [`${path} is agent or product policy markdown`], path);
		}
		assert.deepEqual(reasonsFor({ files: [file(".agents/skills/vpk-tidy/references/patterns.md")] }), []);
	});

	test("source outside the allowlist is rejected", () => {
		assert.deepEqual(reasonsFor({ files: [file("lib/foo.test.ts"), file("lib/foo.ts")] }), ["lib/foo.ts is outside the low-risk allowlist"]);
	});

	test("denylist wins over the allowlist", () => {
		for (const path of [
			"backend/routes/chat.test.js",
			"backend/middleware/caller-identity.test.js",
			"lib/slauth-session.test.js",
			"package.json",
			"backend/package.json",
			"pnpm-lock.yaml",
			"pnpm-workspace.yaml",
			".npmrc",
			".env.local",
			"config/staging.env.md",
			".github/workflows/ci.yml",
			".github/PULL_REQUEST_TEMPLATE.md",
			"scripts/verify-url-credentials.test.js",
			"scripts/run-js-unit-tests.test.js",
			"scripts/js-unit-test-legacy-drift.mjs",
			"scripts/automation-merge-eligibility.test.mjs",
			".agents/skills/vpk-git-ship/references/review-gate.md",
			".agents/skills/vpk-scheduled-automation/references/dependency-hygiene.md",
			".agents/automations/README.md",
			"artifacts/vpk-html/notes.md",
		]) {
			assert.deepEqual(reasonsFor({ files: [file(path)] }), [`${path} is on the denylist`], path);
		}
	});

	test("a rename checks its previous path against the denylist", () => {
		assert.deepEqual(
			reasonsFor({ files: [file("docs/moved.md", { status: "renamed", previousPath: ".github/notes.md" })] }),
			[".github/notes.md is on the denylist"],
		);
	});

	test("deleting a test needs a human; deleting a doc does not", () => {
		assert.deepEqual(reasonsFor({ files: [file("lib/foo.test.ts", { status: "removed" })] }), ["lib/foo.test.ts deletes a test"]);
		assert.deepEqual(reasonsFor({ files: [file("docs/old.md", { status: "removed" })] }), []);
	});

	test("generated files ride along only beside an eligible change", () => {
		const generated = [file(".agents/knowledge/repo-map.json"), file(".agents/skills/INDEX.md")];
		assert.deepEqual(reasonsFor({ files: [file("lib/foo.test.ts"), ...generated] }), []);
		assert.deepEqual(reasonsFor({ files: generated }), ["only generated files changed; they are eligible only beside a low-risk change"]);
	});

	test("an empty or incomplete file list is ineligible", () => {
		assert.deepEqual(reasonsFor({ files: [] }), ["PR changes no files"]);
		assert.deepEqual(reasonsFor({ changedFiles: 2 }), ["file list incomplete (1 of 2)"]);
	});

	test("total changed lines are capped at 300", () => {
		assert.deepEqual(reasonsFor({ files: [file("a.test.js", { additions: 200, deletions: 100 })] }), []);
		assert.deepEqual(
			reasonsFor({ files: [file("a.test.js", { additions: 200, deletions: 50 }), file("b.md", { additions: 51, deletions: 0 })] }),
			["301 changed lines exceed the 300-line limit"],
		);
	});

	test("decision lists every file category", () => {
		const decision = evaluateEligibility(pr({ files: [file("a.test.js"), file("b.md"), file(".agents/skills/INDEX.md")] }), CONTEXT);
		assert.deepEqual(decision.files.map((entry) => entry.category), ["test", "doc", "generated"]);
	});
});

describe("eslint-suppressions.json may only shrink", () => {
	const DELETE_ENTRY = [
		"@@ -10,11 +10,6 @@",
		"   \"app/a.test.js\": {",
		"     \"no-restricted-syntax\": {",
		"       \"count\": 4",
		"     }",
		"   },",
		"-  \"app/b.test.js\": {",
		"-    \"no-restricted-syntax\": {",
		"-      \"count\": 1",
		"-    }",
		"-  },",
	].join("\n");
	const LOWER_COUNT = ["@@ -3,3 +3,3 @@", "     \"rule\": {", "-      \"count\": 95", "+      \"count\": 94", "     }"].join("\n");
	const RAISE_COUNT = ["@@ -3,3 +3,3 @@", "     \"rule\": {", "-      \"count\": 94", "+      \"count\": 95", "     }"].join("\n");
	const ADD_ENTRY = ["@@ -1,2 +1,7 @@", " {", "+  \"app/new.ts\": {", "+    \"rule\": {", "+      \"count\": 1", "+    }", "+  },"].join("\n");
	const RENAME_KEY = ["@@ -1,3 +1,3 @@", " {", "-  \"app/old.test.js\": {", "+  \"app/new.test.js\": {"].join("\n");

	test("isPruneOnlyPatch accepts deletions and lowered counts only", () => {
		assert.equal(isPruneOnlyPatch(DELETE_ENTRY), true);
		assert.equal(isPruneOnlyPatch(LOWER_COUNT), true);
		assert.equal(isPruneOnlyPatch(RAISE_COUNT), false);
		assert.equal(isPruneOnlyPatch(ADD_ENTRY), false);
		assert.equal(isPruneOnlyPatch(RENAME_KEY), false);
		assert.equal(isPruneOnlyPatch(""), false);
		assert.equal(isPruneOnlyPatch(undefined), false);
	});

	test("a pruning diff is eligible on its own; a growing one is not", () => {
		assert.deepEqual(reasonsFor({ files: [file("eslint-suppressions.json", { patch: DELETE_ENTRY })] }), []);
		const reason = "eslint-suppressions.json may only shrink (deleted lines or lowered counts), or its patch was unavailable";
		assert.deepEqual(reasonsFor({ files: [file("eslint-suppressions.json", { patch: ADD_ENTRY })] }), [reason]);
		assert.deepEqual(reasonsFor({ files: [file("eslint-suppressions.json")] }), [reason]);
	});
});

describe("globToRegExp", () => {
	test("single star stays in a segment, double star crosses segments", () => {
		assert.equal(globToRegExp("scripts/verify-*").test("scripts/verify-x.js"), true);
		assert.equal(globToRegExp("scripts/verify-*").test("scripts/lib/verify-x.js"), false);
		assert.equal(globToRegExp("**/*.md").test("README.md"), true);
		assert.equal(globToRegExp("**/*.md").test("a/b/c.md"), true);
		assert.equal(globToRegExp("tests/**").test("tests/a/b.ts"), true);
		assert.equal(globToRegExp("**/*.test.*").test("lib/foo.test.ts"), true);
		assert.equal(globToRegExp("**/*.test.*").test("lib/footest.ts"), false);
	});
});

describe("CLI helpers", () => {
	test("parseArgs validates --pr and --repo", () => {
		assert.deepEqual(parseArgs(["--pr", "12", "--repo", REPO, "--json", "--policy"]), { prNumber: 12, repository: REPO, json: true, policy: true });
		assert.throws(() => parseArgs(["--repo", REPO]), /--pr/u);
		assert.throws(() => parseArgs(["--pr", "1"]), /--repo/u);
		assert.throws(() => parseArgs(["--pr", "1", "--repo", REPO, "--merge"]), /Unknown argument/u);
	});

	test("fetchPullRequest normalizes injected gh output", async () => {
		const calls = [];
		const responses = {
			pr: JSON.stringify({
				number: 7,
				state: "OPEN",
				author: { login: "eevennsoh" },
				labels: [{ name: "automation" }, { name: "automerge:allowed" }],
				isDraft: false,
				baseRefName: "main",
				headRefOid: "b".repeat(40),
				headRepository: { name: "vpk" },
				headRepositoryOwner: { login: "eevennsoh" },
				changedFiles: 2,
			}),
			repo: JSON.stringify({ defaultBranchRef: { name: "main" } }),
			api: [
				JSON.stringify({ filename: "a.test.js", previous_filename: null, status: "modified", additions: 3, deletions: 0, patch: "+x" }),
				JSON.stringify({ filename: "b.md", status: "renamed", previous_filename: "c.md", additions: 0, deletions: 0 }),
				"",
			].join("\n"),
		};
		const runGh = async (args) => {
			calls.push(args);
			return responses[args[0]];
		};
		const { pr: fetched, defaultBranch } = await fetchPullRequest({ prNumber: 7, repository: REPO, runGh });
		assert.equal(defaultBranch, "main");
		assert.equal(fetched.author, "eevennsoh");
		assert.equal(fetched.headRepository, REPO);
		assert.deepEqual(fetched.labels, ["automation", "automerge:allowed"]);
		assert.deepEqual(fetched.files.map((entry) => [entry.path, entry.previousPath ?? null]), [["a.test.js", null], ["b.md", "c.md"]]);
		assert.ok(calls.find((args) => args[0] === "api").includes("--paginate"));
		assert.equal(evaluateEligibility(fetched, { repository: REPO, defaultBranch }).eligible, true);
	});

	test("formatDecision prints a verdict line and reasons", () => {
		const text = formatDecision(evaluateEligibility(pr({ isDraft: true }), CONTEXT));
		assert.equal(text, `INELIGIBLE #42 @ ${"a".repeat(40)} (merge, 5 lines)\n- PR is a draft`);
	});
});
