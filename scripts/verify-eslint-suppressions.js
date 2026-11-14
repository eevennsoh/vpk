#!/usr/bin/env node

"use strict";

const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");

const SUPPRESSIONS_FILE = "eslint-suppressions.json";
const ESLINT_CONFIG_FILE = "eslint.config.mjs";

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
// A rule the change itself introduces may baseline its existing violations once.
function findSuppressionGrowth(base, current, { introducedRules = new Set() } = {}) {
	const baseTotals = totalsByRule(base);
	const growth = [];
	for (const [ruleId, after] of totalsByRule(current)) {
		if (introducedRules.has(ruleId)) continue;
		const before = baseTotals.get(ruleId) ?? 0;
		if (after > before) {
			growth.push({ after, before, ruleId });
		}
	}
	return growth.sort((left, right) => left.ruleId.localeCompare(right.ruleId));
}

// Rules named in the current ESLint config but not in the base one. Rules that presets
// enable are named in neither, so they stay under the ratchet.
function findIntroducedRules(baseConfigSource, currentConfigSource, ruleIds) {
	const introduced = new Set();
	if (baseConfigSource === null || currentConfigSource === null) return introduced;
	for (const ruleId of ruleIds) {
		const quoted = `"${ruleId}"`;
		if (currentConfigSource.includes(quoted) && !baseConfigSource.includes(quoted)) introduced.add(ruleId);
	}
	return introduced;
}

function runGit(args) {
	const result = spawnSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
	return result.status === 0 ? result.stdout.trim() : null;
}

// The ratchet base is the commit the change is measured from, so only what the change itself does
// counts. Push builds pass the pre-push tip as VPK_SUPPRESSIONS_BASE (see ci.yml). A pull_request
// run checks out GitHub's merge of the PR into its base, so HEAD^1 is the base that merge was built
// on and HEAD^1..HEAD is exactly the PR's change. Comparing with the base tip instead counted every
// baseline drop that landed on the base after that merge as a raise by the PR. A checkout of the
// PR head itself, and local runs, compare with the merge-base.
function resolveBaseRef({ env = process.env, git = runGit } = {}) {
	if (env.VPK_SUPPRESSIONS_BASE) {
		return git(["rev-parse", "--verify", "--quiet", env.VPK_SUPPRESSIONS_BASE]);
	}
	if (env.GITHUB_BASE_REF) {
		if (git(["rev-parse", "--verify", "--quiet", "HEAD^2"])) {
			return git(["rev-parse", "--verify", "--quiet", "HEAD^1"]);
		}
		return git(["merge-base", "HEAD", `origin/${env.GITHUB_BASE_REF}`]);
	}
	return git(["merge-base", "HEAD", "origin/main"]);
}

// An explicitly named base must resolve: skipping would let the ledger grow unchecked.
function isBaseRequired(env = process.env) {
	return Boolean(env.GITHUB_BASE_REF || env.VPK_SUPPRESSIONS_BASE);
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
		const message = "ESLint suppression ratchet: base ref unavailable (fetch origin/main, check out with fetch-depth: 2 in CI, or set VPK_SUPPRESSIONS_BASE).";
		if (isBaseRequired()) {
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

	const introducedRules = findIntroducedRules(
		runGit(["show", `${baseRef}:${ESLINT_CONFIG_FILE}`]),
		existsSync(ESLINT_CONFIG_FILE) ? readFileSync(ESLINT_CONFIG_FILE, "utf8") : null,
		totalsByRule(current).keys(),
	);
	for (const ruleId of introducedRules) {
		console.log(`ESLint suppression ratchet: ${ruleId} is new in ${ESLINT_CONFIG_FILE}; its baseline of ${totalsByRule(current).get(ruleId)} may only shrink from here.`);
	}
	const growth = findSuppressionGrowth(base, current, { introducedRules });
	if (growth.length > 0) {
		console.error(`${SUPPRESSIONS_FILE} may only shrink, but these rules gained suppressed violations:`);
		for (const { after, before, ruleId } of growth) {
			console.error(`- ${ruleId}: ${before} → ${after}`);
		}
		console.error("Fix the new violations instead of suppressing them. After fixing old debt, run `pnpm run fix:generated --only eslint-suppressions`.");
		process.exitCode = 1;
		return;
	}

	const total = [...totalsByRule(current)].reduce((sum, [ruleId, count]) => (introducedRules.has(ruleId) ? sum : sum + count), 0);
	const baseTotal = [...totalsByRule(base).values()].reduce((sum, count) => sum + count, 0);
	console.log(`Verified ESLint suppressions only shrink (${total} remaining, ${baseTotal - total} fixed vs ${baseRef.slice(0, 9)}).`);
}

if (require.main === module) {
	main();
}

module.exports = {
	findIntroducedRules,
	findSuppressionGrowth,
	isBaseRequired,
	resolveBaseRef,
	totalsByRule,
};
