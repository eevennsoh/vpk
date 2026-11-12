#!/usr/bin/env node
"use strict";

const { execFile } = require("node:child_process");
const { collectReviewGateStatus, gateExitCode, runGhJson, splitRepository } = require("./review-gate-status");

const SHA = /^[a-f0-9]{40}$/u;

function pushDeletion(args) {
	return new Promise((resolve, reject) => {
		execFile("git", args, { encoding: "utf8", timeout: 60000 }, (error, stdout, stderr) => {
			if (error) reject(new Error(`Remote branch deletion not confirmed: ${stderr || error.message}`));
			else resolve(stdout);
		});
	});
}

function validatePullRequest(pr, repository, prNumber) {
	if (pr?.number !== prNumber || pr.base?.repo?.full_name?.toLowerCase() !== repository.toLowerCase() ||
		!SHA.test(pr.head?.sha ?? "") || typeof pr.head?.ref !== "string" || !pr.head.ref ||
		typeof pr.base?.ref !== "string" || typeof pr.draft !== "boolean" || typeof pr.merged !== "boolean" ||
		!["open", "closed"].includes(pr.state)) throw new Error("Invalid remote PR identity");
	return pr;
}

async function mergeRemote({ prNumber, repository, expectedHead, collectGate = collectReviewGateStatus,
	runGh = runGhJson, mutateGh = (args) => runGhJson(args, { readOnly: false }), deleteRef = pushDeletion } = {}) {
	splitRepository(repository ?? "");
	if (!Number.isInteger(prNumber) || prNumber < 1 || !SHA.test(expectedHead ?? "")) throw new Error("A PR number and full expected head SHA are required");
	const endpoint = `repos/${repository}/pulls/${prNumber}`;
	const readPr = async () => validatePullRequest(await runGh(["api", endpoint]), repository, prNumber);
	const [pr, repo] = await Promise.all([readPr(), runGh(["api", `repos/${repository}`])]);
	if ((typeof repo.default_branch !== "string" || !repo.default_branch) || repo.full_name?.toLowerCase() !== repository.toLowerCase()) throw new Error("Invalid repository identity");
	if (pr.state !== "open" || pr.merged || pr.draft || pr.head.sha !== expectedHead) throw new Error("PR is closed, draft, or its head changed");
	// This always performs a full fresh reconciliation; a previous waiting result is evidence,
	// not a permit to merge a later candidate. There is deliberately no billing bypass flag.
	const gate = await collectGate({ prNumber, repository });
	const exitCode = gateExitCode(gate, { requireClear: true });
	if (exitCode !== 0 || gate.headRefOid !== expectedHead || gate.repository !== repository || gate.number !== prNumber) {
		const error = new Error(`Remote merge refused: gate exit ${exitCode || 2}; expected current head ${expectedHead}`);
		error.exitCode = exitCode || 2;
		throw error;
	}
	let result;
	try {
		// Documented REST merge endpoint: sha rejects a concurrent head update (HTTP 409).
		result = await mutateGh(["api", endpoint + "/merge", "--method", "PUT", "-f", `sha=${expectedHead}`, "-f", "merge_method=merge"]);
	} catch (error) {
		// Do not retry a mutation with an unknown outcome. Reconcile once instead.
		const observed = await readPr();
		if (!observed.merged || observed.head.sha !== expectedHead || !SHA.test(observed.merge_commit_sha ?? "")) throw error;
		result = { merged: true, sha: observed.merge_commit_sha };
	}
	if (result?.merged !== true || !SHA.test(result.sha ?? "")) throw new Error("GitHub did not confirm a merge; remote branch preserved");
	const merged = await readPr();
	if (!merged.merged || merged.state !== "closed" || merged.merge_commit_sha !== result.sha) throw new Error("Merged PR could not be verified; remote branch preserved");
	const report = { repository, prNumber, head: expectedHead, mergeCommit: result.sha,
		branchDeletion: { state: "preserved", reason: "Head identity is ineligible for deletion" }, gate };
	if (pr.head.repo?.full_name?.toLowerCase() !== repository.toLowerCase() ||
		merged.head.repo?.full_name?.toLowerCase() !== repository.toLowerCase() ||
		merged.head.ref !== pr.head.ref || merged.head.sha !== expectedHead ||
		pr.head.ref === pr.base.ref || pr.head.ref === repo.default_branch) return report;
	const ref = `refs/heads/${pr.head.ref}`;
	const unconfirmed = (stage, error) => ({ ...report, branchDeletion: {
		state: "unconfirmed", ref, stage, error: error.message,
		warning: "Merge verified. Reconcile or defer remote branch cleanup; do not repeat the merge. A ref lookup 404 does not prove deletion.",
	} });
	let remoteRef;
	try {
		remoteRef = await runGh(["api", `repos/${repository}/git/ref/heads/${pr.head.ref.split("/").map(encodeURIComponent).join("/")}`]);
	} catch (error) { return unconfirmed("ref-read", error); }
	if (remoteRef?.ref !== ref || !SHA.test(remoteRef.object?.sha ?? "")) {
		return unconfirmed("ref-read", new Error("Invalid remote ref response"));
	}
	if (remoteRef.object.sha !== expectedHead) return { ...report, branchDeletion: { state: "preserved", ref, reason: "Remote ref advanced", observedHead: remoteRef.object.sha } };
	// REST DELETE has no documented expected-SHA condition. Git's lease makes deletion
	// atomic if someone pushes between the REST read and the delete. An explicit URL
	// avoids updating a local remote-tracking ref; no checkout or local branch changes.
	try {
		await deleteRef(["-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential", "-c", "core.hooksPath=/dev/null",
			"push", "--porcelain", "--no-follow-tags", `--force-with-lease=${ref}:${expectedHead}`, `https://github.com/${repository}.git`, `:${ref}`]);
	} catch (error) { return unconfirmed("lease-delete", error); }
	return { ...report, branchDeletion: { state: "deleted", ref } };
}

async function main(argv) {
	const options = {};
	for (let index = 0; index < argv.length; index += 2) {
		const key = { "--pr": "prNumber", "--repo": "repository", "--head": "expectedHead" }[argv[index]];
		if (!key || !argv[index + 1] || key in options) throw new Error("Usage: merge-remote.js --pr <number> --repo <owner/name> --head <full-sha>");
		options[key] = key === "prNumber" ? Number(argv[index + 1]) : argv[index + 1];
	}
	process.stdout.write(`${JSON.stringify(await mergeRemote(options), null, "\t")}\n`);
}

if (require.main === module) main(process.argv.slice(2)).catch((error) => {
	process.stderr.write(`${error.message}\n`);
	process.exitCode = error.exitCode ?? 1;
});

module.exports = { mergeRemote };
