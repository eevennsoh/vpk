"use strict";

// Where a branch is on its way to main, derived from git and gh facts as plain data.
// No I/O here: scripts/lib/branch-facts.js collects the facts, and ship-status and
// clean-candidates print the result.
//
// Statuses, in landing order (the furthest one the facts support wins):
//
//   dirty        uncommitted or untracked files in the branch's worktree
//   committed    clean, with commits that are not on the remote branch
//   pushed       every commit pushed, no open PR
//   pr-open      an open PR whose checks have not passed yet
//   checks       checks passed, review conversations not clear
//   review-clear checks passed and review clear: ready to merge
//   merged       proven landed on origin/<default>, but the local <default> lacks it
//   main-synced  landed and the local <default> has it; branch or worktree remain
//   cleaned      landed, synced, and no local branch or worktree is left
//
// and `unknown` when a fact the answer depends on could not be read. A failed read
// never proves anything.
//
// "Proven landed" is defined once, in provenLanded(), and nowhere else.

const BRANCH_LANDING_STATUSES = Object.freeze([
	"dirty",
	"committed",
	"pushed",
	"pr-open",
	"checks",
	"review-clear",
	"merged",
	"main-synced",
	"cleaned",
]);

// The most recently created PR speaks for the branch, whatever its state: an older
// merged PR must not hide newer work closed unmerged.
function pickPr(prs) {
	return [...prs].sort((a, b) => (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0) || b.number - a.number)[0] ?? null;
}

// A merged PR proves a branch landed when it merged into the default branch and the
// branch has no commit its head did not carry (commitsPastHead 0). That covers merge,
// squash and rebase merges alike. A tip behind the PR's head (the PR got more commits
// pushed from elsewhere) is still landed. A fact that is missing (no `baseRefName`
// on the PR record) or unobserved (`commitsPastHead` null) proves nothing: landed null,
// with what is missing.
function mergedPrLanding(pr, { defaultBranch, commitsPastHead }) {
	if (pr?.state !== "MERGED") return { landed: false };
	// A commit the PR's head did not carry disproves landing whatever the base.
	if (commitsPastHead > 0) return { landed: false };
	if (typeof pr.baseRefName !== "string" || !pr.baseRefName) return { landed: null, missing: `base branch of #${pr.number}` };
	if (pr.baseRefName !== defaultBranch) return { landed: false };
	if (commitsPastHead === null || commitsPastHead === undefined) return { landed: null, missing: `commits past #${pr.number}` };
	return { landed: commitsPastHead === 0 };
}

/**
 * The one definition of "proven landed": the branch's committed work is on
 * origin/<default>. Proofs, strongest first:
 *   ancestry          the head is an ancestor of origin/<default> (merge commits, fast-forwards)
 *   merged-pr         a PR merged into <default> carried every commit (squash, rebase)
 *   patch-equivalent  `git cherry` finds every commit's patch on origin/<default>
 * Returns { landed: true | false | null, proof, pr, exactHead, missing }.
 * `exactHead` (merged-pr only) says the local tip equals the PR's recorded head, which
 * vpk-git-clean requires before a `git branch -D`. Uncommitted files are not committed
 * work: deriveBranchLanding reports them as dirty first.
 */
function provenLanded(facts) {
	if (facts.inOriginDefault === true) return { landed: true, proof: "ancestry", pr: null, exactHead: null, missing: [] };

	const missing = [];
	if (facts.inOriginDefault !== false) missing.push("ancestry");
	if (facts.prs === null) missing.push("pull requests");
	const merged = (facts.prs ?? [])
		.filter((pr) => pr.state === "MERGED")
		.sort((a, b) => (Date.parse(b.mergedAt ?? "") || 0) - (Date.parse(a.mergedAt ?? "") || 0));
	for (const pr of merged) {
		const result = mergedPrLanding(pr, {
			defaultBranch: facts.defaultBranch,
			commitsPastHead: facts.commitsPastPrHead?.[pr.number],
		});
		if (result.landed === true) {
			return { landed: true, proof: "merged-pr", pr: pr.number, exactHead: pr.headRefOid === facts.head, missing: [] };
		}
		if (result.landed === null) missing.push(result.missing);
	}

	if (facts.patchEquivalent === true) return { landed: true, proof: "patch-equivalent", pr: null, exactHead: null, missing: [] };
	if (facts.patchEquivalent !== false) missing.push("patch equivalence");
	return missing.length > 0
		? { landed: null, proof: null, pr: null, exactHead: null, missing }
		: { landed: false, proof: null, pr: null, exactHead: null, missing: [] };
}

function result(status, nextAction, evidence) {
	return { status, nextAction, evidence };
}

function syncMainAction(defaultBranch) {
	return `sync ${defaultBranch}: git fetch origin ${defaultBranch}:${defaultBranch} (or git pull --ff-only in the worktree that has ${defaultBranch} checked out)`;
}

function openPrAction(pr, gate) {
	if (gate === null || gate === undefined) return { status: "pr-open", nextAction: `read the review gate: node .agents/skills/vpk-git-ship/scripts/review-gate-status.js --pr ${pr.number}` };
	if (gate.isDraft) return { status: "pr-open", nextAction: `mark #${pr.number} ready for review` };
	if (gate.checks === "failing") return { status: "pr-open", nextAction: `fix the failing checks on #${pr.number}${gate.failingChecks?.length ? `: ${gate.failingChecks.join(", ")}` : ""}` };
	if (gate.checks === "billing-blocked") return { status: "pr-open", nextAction: `Actions is billing-blocked: run pnpm run ci:pr locally (vpk-git-ship review-gate.md)` };
	if (gate.checks !== "passing") return { status: "pr-open", nextAction: `wait for the checks on #${pr.number} (${gate.checks})` };
	if (!gate.reviewGateClear) return { status: "checks", nextAction: `resolve the review conversations on #${pr.number}` };
	return { status: "review-clear", nextAction: `merge: node .agents/skills/vpk-git-ship/scripts/merge-remote.js --pr ${pr.number} --head ${pr.headRefOid}` };
}

/**
 * @param {{
 *   branch: string | null,            // null for a detached HEAD
 *   head: string | null,              // the branch tip, or the PR head for a deleted branch
 *   defaultBranch: string,
 *   localBranchExists: boolean | null,
 *   worktree: { path: string, dirty: boolean | null } | null,
 *   pushed: boolean | null,           // a remote branch exists
 *   unpushed: number | null,          // commits not on the remote branch
 *   inOriginDefault: boolean | null,  // head is an ancestor of origin/<default>
 *   patchEquivalent: boolean | null,  // git cherry origin/<default> head shows no '+' and no merge commit is ahead
 *   prs: Array<{ number, state, headRefOid, baseRefName, createdAt, mergedAt, mergeCommit? }> | null,
 *   commitsPastPrHead?: Record<number, number | null>,
 *   gate?: { isDraft: boolean, checks: string, failingChecks?: string[], reviewGateClear: boolean } | null,
 *   landingInLocalDefault?: boolean | null, // the local <default> contains the landing commit
 * }} facts
 * @returns {{ status: string, nextAction: string, evidence: object }}
 */
function deriveBranchLanding(facts) {
	const landing = provenLanded(facts);
	const pr = facts.prs ? pickPr(facts.prs) : null;
	const evidence = {
		branch: facts.branch,
		head: facts.head,
		worktree: facts.worktree?.path ?? null,
		landed: landing.landed,
		proof: landing.proof,
		pr: pr ? { number: pr.number, state: pr.state, url: pr.url ?? null } : null,
		// Every open PR on the branch, not only the latest; null when PRs could not be read.
		openPrs: facts.prs === null ? null : facts.prs.filter((candidate) => candidate.state === "OPEN").map((candidate) => candidate.number),
		...(landing.pr ? { landedBy: landing.pr, exactHead: landing.exactHead } : {}),
		...(landing.missing.length ? { missing: landing.missing } : {}),
	};

	if (facts.worktree) {
		if (facts.worktree.dirty === true) return result("dirty", `commit or stash the changes in ${facts.worktree.path}`, evidence);
		if (facts.worktree.dirty !== false) return result("unknown", "re-run: the worktree status could not be read", { ...evidence, missing: [...(evidence.missing ?? []), "worktree status"] });
	}

	if (landing.landed === true) {
		if (facts.landingInLocalDefault === false) return result("merged", syncMainAction(facts.defaultBranch), evidence);
		if (facts.landingInLocalDefault !== true) return result("unknown", `re-run: could not tell whether the local ${facts.defaultBranch} has it`, { ...evidence, missing: ["local default"] });
		if (facts.localBranchExists === false && !facts.worktree) return result("cleaned", "none", evidence);
		if (facts.localBranchExists === null) return result("unknown", "re-run: local branches could not be read", { ...evidence, missing: ["local branch"] });
		return result("main-synced", "clean up with vpk-git-clean (pnpm run clean-candidates)", evidence);
	}

	// Not landed. A failed read anywhere on the way leaves it unknown, never "not landed".
	if (landing.landed === null) return result("unknown", `re-run: ${landing.missing.join(", ")} could not be read`, evidence);
	if (facts.pushed === null || (facts.pushed && facts.unpushed === null)) return result("unknown", "re-run: the remote branch could not be read", { ...evidence, missing: ["remote branch"] });

	const mergedBefore = (facts.prs ?? []).find((candidate) => candidate.state === "MERGED" && candidate.baseRefName === facts.defaultBranch);
	const pastMerge = mergedBefore ? ` (#${mergedBefore.number} merged; these commits came after it)` : "";

	if (!facts.pushed || facts.unpushed > 0) {
		const count = facts.pushed ? `${facts.unpushed} unpushed commit(s)` : "a branch that is not on the remote";
		return result("committed", `push ${count}${pastMerge}`, evidence);
	}
	if (pr?.state === "OPEN") {
		const open = openPrAction(pr, facts.gate);
		return result(open.status, open.nextAction, evidence);
	}
	if (pr?.state === "CLOSED") return result("pushed", `#${pr.number} was closed unmerged: reopen it or open a new PR`, evidence);
	return result("pushed", `open a PR${pastMerge}`, evidence);
}

module.exports = {
	BRANCH_LANDING_STATUSES,
	deriveBranchLanding,
	mergedPrLanding,
	pickPr,
	provenLanded,
};
