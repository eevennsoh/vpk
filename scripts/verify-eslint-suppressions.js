#!/usr/bin/env node

"use strict";

const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");

const SUPPRESSIONS_FILE = "eslint-suppressions.json";

function totalsByRule(suppressions) {
	const totals = new Map();
	for (const rules of Object.values(suppressions)) {
		for (const [ruleId, { count }] of Object.entries(rules)) {
			totals.set(ruleId, (totals.get(ruleId) ?? 0) + count);
		}
	}
	return totals;
}

// Per-rule totals rather than per-file counts, so moving or renaming a file keeps its debt.
function findSuppressionGrowth(base, current) {
	const baseTotals = totalsByRule(base);
	const growth = [];
	for (const [ruleId, after] of totalsByRule(current)) {
		const before = baseTotals.get(ruleId) ?? 0;
		if (after > before) {
			growth.push({ after, before, ruleId });
		}
	}
	return growth.sort((left, right) => left.ruleId.localeCompare(right.ruleId));
}

function runGit(args) {
	const result = spawnSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
	return result.status === 0 ? result.stdout.trim() : null;
}

// CI checks out the PR merged into its base, so compare with the base tip there;
// locally compare with the merge-base so commits that landed on main later don't count.
function resolveBaseRef({ env = process.env, git = runGit } = {}) {
	if (env.VPK_SUPPRESSIONS_BASE) {
		return git(["rev-parse", "--verify", "--quiet", env.VPK_SUPPRESSIONS_BASE]);
	}
	if (env.GITHUB_BASE_REF) {
		return git(["rev-parse", "--verify", "--quiet", `origin/${env.GITHUB_BASE_REF}`]);
	}
	return git(["merge-base", "HEAD", "origin/main"]);
}

function readBaseSuppressions(baseRef, git = runGit) {
	const source = git(["show", `${baseRef}:${SUPPRESSIONS_FILE}`]);
	return source === null ? null : JSON.parse(source);
}

function main() {
	if (!existsSync(SUPPRESSIONS_FILE)) {
		console.log(`No ${SUPPRESSIONS_FILE}; nothing to verify.`);
		return;
	}

	const current = JSON.parse(readFileSync(SUPPRESSIONS_FILE, "utf8"));
	const baseRef = resolveBaseRef();
	if (!baseRef) {
		const message = "ESLint suppression ratchet: base ref unavailable (fetch origin/main or set VPK_SUPPRESSIONS_BASE).";
		if (process.env.GITHUB_BASE_REF) {
			console.error(message);
			process.exitCode = 1;
			return;
		}
		console.warn(`${message} Skipping.`);
		return;
	}

	const base = readBaseSuppressions(baseRef);
	if (!base) {
		console.log(`ESLint suppression ratchet: ${baseRef.slice(0, 9)} has no ${SUPPRESSIONS_FILE}; this change introduces the baseline.`);
		return;
	}

	const growth = findSuppressionGrowth(base, current);
	if (growth.length > 0) {
		console.error(`${SUPPRESSIONS_FILE} may only shrink, but these rules gained suppressed violations:`);
		for (const { after, before, ruleId } of growth) {
			console.error(`- ${ruleId}: ${before} → ${after}`);
		}
		console.error("Fix the new violations instead of suppressing them. After fixing old debt, run `pnpm run lint -- --prune-suppressions`.");
		process.exitCode = 1;
		return;
	}

	const total = [...totalsByRule(current).values()].reduce((sum, count) => sum + count, 0);
	const baseTotal = [...totalsByRule(base).values()].reduce((sum, count) => sum + count, 0);
	console.log(`Verified ESLint suppressions only shrink (${total} remaining, ${baseTotal - total} fixed vs ${baseRef.slice(0, 9)}).`);
}

if (require.main === module) {
	main();
}

module.exports = {
	findSuppressionGrowth,
	resolveBaseRef,
	totalsByRule,
};
