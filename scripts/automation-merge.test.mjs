import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { CODEX_LOGIN, codexSignal, formatReport, parseArgs, processCandidate, runAutomationMerge, syncMain } from "./automation-merge.mjs";

const REPO = "eevennsoh/vpk";
const SHA = "a".repeat(40);
const OTHER = "b".repeat(40);
const PUSHED_AT = "2026-11-20T01:00:00Z";

// --- Codex signal ---------------------------------------------------------------------

function codexGh({ reviews = [], comments = [], reactions = [], suites = [{ created_at: PUSHED_AT }] } = {}) {
	return async (args) => {
		const endpoint = args.find((part) => part.startsWith("repos/"));
		if (endpoint.includes("/reviews")) return JSON.stringify([reviews]);
		if (endpoint.includes("/comments")) return JSON.stringify([comments]);
		if (endpoint.includes("/reactions")) return JSON.stringify([reactions]);
		if (endpoint.includes("/check-suites")) return JSON.stringify([{ check_suites: suites }]);
		throw new Error(`unexpected ${endpoint}`);
	};
}

const signal = (fixture) => codexSignal({ prNumber: 5, repository: REPO, sha: SHA, runGh: codexGh(fixture) });
const review = (extra = {}) => ({ id: 11, user: { login: CODEX_LOGIN }, commit_id: SHA, state: "COMMENTED", body: "", ...extra });
const plusOne = (createdAt, extra = {}) => ({ user: { login: CODEX_LOGIN }, content: "+1", created_at: createdAt, ...extra });

describe("codexSignal", () => {
	test("a +1 created after GitHub first saw the head is clean", async () => {
		const result = await signal({ reactions: [plusOne("2026-11-20T01:05:00Z")] });
		assert.equal(result.state, "clean");
	});

	test("probe: a +1 from before the head was pushed does not count, whatever the commit date", async () => {
		const result = await signal({
			reactions: [plusOne("2026-11-20T00:59:00Z")],
			suites: [{ created_at: "2026-11-20T01:30:00Z" }, { created_at: PUSHED_AT }],
		});
		assert.deepEqual(result, { state: "missing", reason: `no Codex review or +1 for ${SHA} yet` });
	});

	test("a +1 from another user, or an eyes reaction, is not a signal", async () => {
		assert.equal((await signal({ reactions: [plusOne("2026-11-20T02:00:00Z", { user: { login: "eevennsoh" } })] })).state, "missing");
		assert.equal((await signal({ reactions: [plusOne("2026-11-20T02:00:00Z", { content: "eyes" })] })).state, "missing");
	});

	test("without a check suite for the head, a +1 cannot be dated and is ignored", async () => {
		const result = await signal({ reactions: [plusOne("2026-11-20T02:00:00Z")], suites: [] });
		assert.equal(result.state, "missing");
	});

	test("a Codex review on the head with no findings is clean", async () => {
		assert.equal((await signal({ reviews: [review()] })).state, "clean");
	});

	test("probe: a Codex review on the head with inline findings blocks even beside a +1", async () => {
		const result = await signal({
			reviews: [review()],
			comments: [{ pull_request_review_id: 11 }],
			reactions: [plusOne("2026-11-20T02:00:00Z")],
		});
		assert.equal(result.state, "findings");
	});

	test("a findings body or CHANGES_REQUESTED blocks", async () => {
		assert.equal((await signal({ reviews: [review({ body: "Here are some automated review suggestions for this pull request." })] })).state, "findings");
		assert.equal((await signal({ reviews: [review({ state: "CHANGES_REQUESTED" })] })).state, "findings");
	});

	test("a Codex review on an older head is neither clean nor blocking", async () => {
		assert.equal((await signal({ reviews: [review({ commit_id: OTHER })], comments: [{ pull_request_review_id: 11 }] })).state, "missing");
	});
});

// --- Merge chain ----------------------------------------------------------------------

function deps(overrides = {}) {
	const log = [];
	const eligible = { eligible: true, headRefOid: SHA, reasons: [] };
	const base = {
		log,
		runGh: async (args) => {
			log.push(["gh", ...args]);
			if (args[0] === "pr" && args[1] === "list") return JSON.stringify([{ number: 9 }, { number: 3 }]);
			return "{}";
		},
		checkEligibility: async (options) => {
			log.push(["eligibility", options.prNumber, options.expectedHead ?? null]);
			return eligible;
		},
		codexSignal: async () => ({ state: "clean", reason: "Codex +1" }),
		collectGate: async (options) => {
			log.push(["gate", options.prNumber]);
			return { headRefOid: SHA, checks: { state: "passing", failing: [] }, nonApprovingReviews: [], readyToMerge: true, unresolvedThreads: [] };
		},
		mergeRemote: async (options) => {
			log.push(["merge", options.prNumber, options.expectedHead]);
			return { mergeCommit: "c".repeat(40), branchDeletion: { state: "deleted" } };
		},
		runGit: async (args) => {
			log.push(["git", ...args]);
			if (args[0] === "worktree") return "worktree /repo\nHEAD x\nbranch refs/heads/main\n\nworktree /repo/wt\nHEAD y\nbranch refs/heads/feature\n";
			if (args.includes("branch")) return "main\n";
			return "";
		},
	};
	return { ...base, ...overrides, log };
}

const run = (d, prNumber = 3) => processCandidate({ prNumber, repository: REPO, deps: d });

describe("processCandidate", () => {
	test("merges with the pinned SHA after a second eligibility check pinned to it", async () => {
		const d = deps();
		const result = await run(d);
		assert.equal(result.outcome, "merged");
		assert.equal(result.mergeCommit, "c".repeat(40));
		assert.deepEqual(d.log, [["eligibility", 3, null], ["gate", 3], ["eligibility", 3, SHA], ["merge", 3, SHA]]);
	});

	test("ineligible PRs stop before any other read", async () => {
		const d = deps({ checkEligibility: async () => ({ eligible: false, headRefOid: SHA, reasons: ["PR is a draft"] }) });
		assert.deepEqual(await run(d), { number: 3, head: SHA, outcome: "skipped", reasons: ["PR is a draft"] });
		assert.deepEqual(d.log, []);
	});

	test("a missing or findings Codex signal skips without merging", async () => {
		for (const state of ["missing", "findings"]) {
			const d = deps({ codexSignal: async () => ({ state, reason: state }) });
			assert.equal((await run(d)).outcome, "skipped");
			assert.ok(!d.log.some((entry) => entry[0] === "merge" || entry[0] === "gate"));
		}
	});

	test("the Codex signal is checked for the SHA eligibility saw", async () => {
		let seen;
		await run(deps({ codexSignal: async (options) => { seen = options.sha; return { state: "missing", reason: "x" }; } }));
		assert.equal(seen, SHA);
	});

	test("pending, interrupted and billing-blocked checks skip without labelling", async () => {
		for (const state of ["pending", "interrupted", "billing-blocked"]) {
			const d = deps({ collectGate: async () => ({ headRefOid: SHA, checks: { state }, readyToMerge: false }) });
			assert.deepEqual((await run(d)).reasons, [`checks are ${state}`]);
			assert.ok(!d.log.some((entry) => entry[0] === "gh" || entry[0] === "merge"));
		}
	});

	test("a failing check labels automerge:blocked and comments only check names and URLs", async () => {
		const failing = [{ name: "PR checks", url: "https://github.com/x/actions/runs/1" }];
		const d = deps({ collectGate: async () => ({ headRefOid: SHA, checks: { state: "failing", failing }, readyToMerge: false }) });
		const result = await run(d);
		assert.equal(result.outcome, "blocked");
		const ghCalls = d.log.filter((entry) => entry[0] === "gh");
		assert.ok(ghCalls[0].includes("labels[]=automerge:blocked"));
		const body = ghCalls[1].find((part) => part.startsWith("body="));
		assert.ok(body.includes("- PR checks: https://github.com/x/actions/runs/1"));
		assert.ok(body.includes(SHA));
		assert.ok(!d.log.some((entry) => entry[0] === "merge"));
	});

	test("a head that moved during the gate skips", async () => {
		const d = deps({ collectGate: async () => ({ headRefOid: OTHER, checks: { state: "passing" }, readyToMerge: true }) });
		assert.deepEqual((await run(d)).reasons, [`head moved to ${OTHER} during the review gate`]);
	});

	test("non-approving reviews from anyone but Codex need a human; Codex reviews defer to the gate", async () => {
		const gate = (reviews) => async () => ({ headRefOid: SHA, checks: { state: "passing" }, nonApprovingReviews: reviews, readyToMerge: true });
		assert.equal((await run(deps({ collectGate: gate([{ user: "someone" }] ) }))).outcome, "skipped");
		assert.equal((await run(deps({ collectGate: gate([{ user: CODEX_LOGIN }]) }))).outcome, "merged");
	});

	test("an unclear review gate skips", async () => {
		const d = deps({ collectGate: async () => ({ headRefOid: SHA, checks: { state: "passing" }, readyToMerge: false, unresolvedThreads: [1], mergeStateStatus: "CLEAN" }) });
		assert.equal((await run(d)).outcome, "skipped");
	});

	test("probe: a label or head change between the gate and merge stops the merge", async () => {
		let calls = 0;
		const d = deps({
			checkEligibility: async () => {
				calls += 1;
				return calls === 1 ? { eligible: true, headRefOid: SHA, reasons: [] } : { eligible: false, headRefOid: SHA, reasons: ["blocking label risk:needs-human"] };
			},
		});
		const result = await run(d);
		assert.deepEqual(result.reasons, ["before merge: blocking label risk:needs-human"]);
		assert.ok(!d.log.some((entry) => entry[0] === "merge"));
	});
});

describe("runAutomationMerge", () => {
	test("lists candidates by label without reading titles or bodies, in ascending order", async () => {
		const d = deps();
		const report = await runAutomationMerge({ repository: REPO, deps: d });
		assert.deepEqual(report.candidates, [3, 9]);
		const list = d.log.find((entry) => entry[1] === "pr" && entry[2] === "list");
		assert.equal(list.at(-1), "number");
		assert.deepEqual(report.results.map((result) => result.outcome), ["merged", "merged"]);
		assert.equal(report.sync.state, "synced");
		assert.ok(d.log.some((entry) => entry.join(" ") === "git -C /repo pull --ff-only origin main"));
	});

	test("an error on one PR is recorded and the run continues", async () => {
		let first = true;
		const d = deps({
			checkEligibility: async () => {
				if (first) { first = false; throw new Error("gh failed"); }
				return { eligible: false, headRefOid: SHA, reasons: ["x"] };
			},
		});
		const report = await runAutomationMerge({ repository: REPO, deps: d });
		assert.deepEqual(report.results.map((result) => result.outcome), ["error", "skipped"]);
		assert.deepEqual(report.sync, { state: "skipped", reason: "nothing merged" });
		assert.ok(formatReport(report).includes("#3 error"));
	});
});

describe("syncMain", () => {
	const git = (branch, status) => async (args) => {
		if (args[0] === "worktree") return "worktree /repo\nHEAD x\nbranch refs/heads/main\n";
		if (args.includes("branch")) return `${branch}\n`;
		if (args.includes("status")) return status;
		if (args.includes("pull")) return "";
		throw new Error(args.join(" "));
	};

	test("skips a dirty checkout or one not on main, and when no worktree has main", async () => {
		assert.equal((await syncMain({ runGit: git("main", " M file\n") })).state, "skipped");
		assert.equal((await syncMain({ runGit: git("feature", "") })).state, "skipped");
		assert.equal((await syncMain({ runGit: async () => "worktree /repo\nbranch refs/heads/feature\n" })).state, "skipped");
		assert.deepEqual(await syncMain({ runGit: git("main", "") }), { state: "synced", worktree: "/repo" });
	});
});

describe("parseArgs", () => {
	test("requires --repo", () => {
		assert.deepEqual(parseArgs(["--repo", REPO, "--json"]), { json: true, repository: REPO });
		assert.throws(() => parseArgs([]), /--repo/u);
		assert.throws(() => parseArgs(["--repo", REPO, "--admin"]), /Unknown argument/u);
	});
});
