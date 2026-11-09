const assert = require("node:assert/strict");
const test = require("node:test");

const { mergeRemote } = require("./merge-remote");
const HEAD = "a".repeat(40);
const MERGE = "b".repeat(40);

function mergeFixture() {
	const calls = [];
	let merged = false;
	const identity = () => ({ number: 42, state: merged ? "closed" : "open", draft: false, merged, merge_commit_sha: merged ? MERGE : null,
		base: { ref: "main", repo: { full_name: "owner/repo" } }, head: { sha: HEAD, ref: "feature/test", repo: { full_name: "owner/repo" } } });
	return {
		calls,
		options: { prNumber: 42, repository: "owner/repo", expectedHead: HEAD,
			collectGate: async () => { calls.push(["gate"]); return { readyToMerge: true, headRefOid: HEAD, repository: "owner/repo", number: 42 }; },
			runGh: async (args) => {
				calls.push(args);
				if (args[1] === "repos/owner/repo") return { default_branch: "main", full_name: "owner/repo" };
				if (args[1].includes("/git/ref/")) return { ref: "refs/heads/feature/test", object: { sha: HEAD } };
				return identity();
			},
			mutateGh: async (args) => { calls.push(args); merged = true; return { merged: true, sha: MERGE }; },
			deleteRef: async (args) => calls.push(args),
		},
	};
}

test("remote merge uses a fresh gate, expected SHA and atomic branch lease without local cleanup", async () => {
	const fixture = mergeFixture();
	const report = await mergeRemote(fixture.options);
	assert.equal(report.mergeCommit, MERGE);
	assert.deepEqual(report.branchDeletion, { state: "deleted", ref: "refs/heads/feature/test" });
	const mutation = fixture.calls.find((call) => call.includes("PUT"));
	assert.ok(mutation.includes(`sha=${HEAD}`));
	assert.ok(mutation.includes("merge_method=merge"));
	assert.ok(fixture.calls.findIndex((call) => call[0] === "gate") < fixture.calls.indexOf(mutation));
	const deletion = fixture.calls.find((call) => call.includes("push"));
	assert.ok(deletion.includes(`--force-with-lease=refs/heads/feature/test:${HEAD}`));
	assert.ok(deletion.includes("https://github.com/owner/repo.git"));
	assert.ok(deletion.includes(":refs/heads/feature/test"));
	assert.ok(deletion.includes("core.hooksPath=/dev/null"));
	assert.ok(fixture.calls.every((call) => !call.includes("checkout") && !call.includes("branch") && !call.includes("--delete-branch")));
});

test("remote merge refuses stale heads, review/check blockers and billing without mutations", async () => {
	for (const gate of [{ readyToMerge: false }, { readyToMerge: true, headRefOid: "c".repeat(40) }, { readyToMerge: false, clearExceptBillingBlockedChecks: true }]) {
		const fixture = mergeFixture();
		await assert.rejects(mergeRemote({ ...fixture.options, collectGate: async () => ({ headRefOid: HEAD, repository: "owner/repo", number: 42, ...gate }) }), (error) => error.exitCode === (gate.clearExceptBillingBlockedChecks ? 3 : 2));
		assert.ok(!fixture.calls.some((call) => call.includes("PUT") || call.includes("push")));
	}
});

test("fork, default/base branches and changed remote refs are preserved after merging", async () => {
	for (const change of ["fork", "default", "base", "advanced", "identity"]) {
		const fixture = mergeFixture();
		const runGh = async (args) => {
			const result = await fixture.options.runGh(args);
			if (args[1].endsWith("/pulls/42")) {
				if (change === "fork") result.head.repo.full_name = "fork/repo";
				if (change === "default") result.head.ref = "main";
				if (change === "base") result.head.ref = result.base.ref = "release";
				if (change === "identity" && result.merged) result.head.ref = "replacement";
			}
			if (change === "advanced" && args[1].includes("/git/ref/")) result.object.sha = "c".repeat(40);
			return result;
		};
		assert.equal((await mergeRemote({ ...fixture.options, runGh })).branchDeletion.state, "preserved");
		assert.ok(!fixture.calls.some((call) => call.includes("push")));
	}
});

test("unknown merge outcomes are reconciled once without retrying the merge", async () => {
	const fixture = mergeFixture();
	let mutations = 0;
	const report = await mergeRemote({ ...fixture.options, mutateGh: async (args) => { mutations += 1; await fixture.options.mutateGh(args); throw new Error("HTTP 502"); } });
	assert.equal(report.mergeCommit, MERGE);
	assert.equal(mutations, 1);
});

test("verified merges retain their evidence when branch cleanup cannot be confirmed", async () => {
	for (const [stage, message] of [
		["ref-read", "HTTP 404: Not Found (automatic branch deletion or hidden permission failure)"],
		["ref-read", "HTTP 503: ref transport unavailable"],
		["lease-delete", "stale info: lease rejected"],
	]) {
		const fixture = mergeFixture();
		const deletions = [];
		const report = await mergeRemote({ ...fixture.options,
			runGh: async (args) => {
				if (stage === "ref-read" && args[1].includes("/git/ref/")) throw new Error(message);
				return fixture.options.runGh(args);
			},
			deleteRef: async (args) => { deletions.push(args); throw new Error(message); },
		});
		assert.equal(report.mergeCommit, MERGE);
		assert.equal(report.gate.readyToMerge, true);
		assert.equal(report.head, HEAD);
		assert.deepEqual(report.branchDeletion, {
			state: "unconfirmed", ref: "refs/heads/feature/test", stage, error: message,
			warning: "Merge verified. Reconcile or defer remote branch cleanup; do not repeat the merge. A ref lookup 404 does not prove deletion.",
		});
		assert.equal(fixture.calls.filter((call) => call.includes("PUT")).length, 1);
		assert.equal(deletions.length, stage === "ref-read" ? 0 : 1);
		assert.ok(deletions.every((args) => args.includes(`--force-with-lease=refs/heads/feature/test:${HEAD}`)));
		assert.ok(!fixture.calls.some((call) => call.includes("DELETE")));
	}
});

test("unconfirmed merge outcomes still fail closed and never attempt cleanup", async () => {
	const fixture = mergeFixture();
	let mutations = 0;
	await assert.rejects(mergeRemote({ ...fixture.options, mutateGh: async () => {
		mutations += 1;
		throw new Error("HTTP 502: merge outcome unknown");
	} }), /merge outcome unknown/u);
	assert.equal(mutations, 1);
	assert.ok(!fixture.calls.some((call) => call.includes("push") || call[1]?.includes("/git/ref/")));
});

test("remote metadata blockers and refused merge responses preserve all refs", async () => {
	for (const changes of [{ draft: true }, { state: "closed" }, { head: { sha: "c".repeat(40), ref: "feature/test" } }]) {
		const fixture = mergeFixture();
		await assert.rejects(mergeRemote({ ...fixture.options, runGh: async (args) => {
			const result = await fixture.options.runGh(args);
			return args[1].endsWith("/pulls/42") ? { ...result, ...changes } : result;
		} }));
		assert.ok(!fixture.calls.some((call) => call[0] === "gate" || call.includes("PUT") || call.includes("push")));
	}
	const fixture = mergeFixture();
	await assert.rejects(mergeRemote({ ...fixture.options, mutateGh: async () => ({ merged: false }) }), /did not confirm/u);
	assert.ok(!fixture.calls.some((call) => call.includes("push")));
});
