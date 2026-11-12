#!/usr/bin/env node

"use strict";

// Reports whether the latest `main` CI run is red, and decides whether a fast-ship
// commit carries the CI skip marker. Read-only and non-blocking: a GitHub failure is
// reported as "unknown", never as a reason to stop shipping.

const { execFileSync } = require("node:child_process");
const { flattenPages, isBillingAnnotation, resolveRepository, runGhJson, splitRepository } = require("./review-gate-status");

const SKIP_CI_MARKER = "[skip ci]";
const WORKFLOW = "ci.yml";
// The aggregate job has no annotation of its own when billing stops its prerequisites.
const AGGREGATE_JOB = "PR checks";
const SUCCESS_CONCLUSIONS = new Set(["success", "skipped", "neutral"]);
// A billing block older than this is retried: one refused run costs nothing, and the
// marker would otherwise hide CI forever once billing is fixed.
const BILLING_STALE_MS = 24 * 60 * 60 * 1000;
const RUN_FIELDS = "databaseId,status,conclusion,headSha,url,updatedAt";

// Markdown that no repository guard reads. AGENTS.md and `.agents/**` are checked by
// validate:agents, validate:skills, verify:cursor-rules and verify:doc-scripts, so a
// change there is code for CI purposes.
function isInertPath(filePath) {
	if (filePath.startsWith("artifacts/")) return true;
	if (filePath === "AGENTS.md" || filePath.startsWith(".agents/")) return false;
	return /\.mdx?$/u.test(filePath);
}

function ciMarkerDecision({ paths, billing }) {
	if (billing?.blocked) {
		return { skipCi: true, reason: `GitHub Actions is billing-blocked (${billing.url}); CI would be refused` };
	}
	if (paths.length === 0) return { skipCi: false, reason: "no changed paths; CI runs after the push" };
	if (paths.every(isInertPath)) return { skipCi: true, reason: "docs- or artifacts-only change" };
	return { skipCi: false, reason: "code change; CI runs after the push" };
}

// The origin remote names the repository without a network round trip; gh is the fallback.
function originRepository(runGit) {
	try {
		const url = runGit(["remote", "get-url", "origin"]).trim();
		const match = /github\.com[:/]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/u.exec(url);
		return match ? match[1] : undefined;
	} catch {
		return undefined;
	}
}

function shortSha(sha) {
	return typeof sha === "string" ? sha.slice(0, 9) : "unknown";
}

function validateRuns(runs) {
	if (!Array.isArray(runs) || runs.some((run) => !Number.isInteger(run?.databaseId) || typeof run.status !== "string")) {
		throw new Error("gh run list returned an invalid run list");
	}
	return runs;
}

// Classifies a completed run from its jobs. `annotations` maps a job id to its check-run
// annotations, or to null when they could not be read (which never proves billing).
function classifyRun({ run, jobs, annotations }) {
	const base = { headSha: run.headSha ?? null, runId: run.databaseId, updatedAt: run.updatedAt ?? null, url: run.url ?? null };
	if (run.conclusion === "success") return { ...base, failedJobs: [], state: "green" };
	const nonpassing = jobs.filter((job) => !SUCCESS_CONCLUSIONS.has(String(job.conclusion ?? "").toLowerCase()));
	const billed = (job) => (annotations.get(job.databaseId) ?? []).some(isBillingAnnotation);
	const failedJobs = nonpassing.map((job) => job.name);
	if (nonpassing.some(billed) && nonpassing.every((job) => billed(job) || job.name === AGGREGATE_JOB)) {
		return { ...base, failedJobs, state: "billing-blocked" };
	}
	return { ...base, failedJobs: failedJobs.length > 0 ? failedJobs : [`run ${run.conclusion ?? "failed"}`], state: "red" };
}

async function readJobAnnotations({ jobs, repository, runGh }) {
	const entries = await Promise.all(jobs.map(async (job) => {
		if (String(job.conclusion ?? "").toLowerCase() !== "failure") return [job.databaseId, []];
		try {
			return [job.databaseId, flattenPages(await runGh(["api", `repos/${repository}/check-runs/${job.databaseId}/annotations`, "--paginate", "--slurp"]))];
		} catch {
			return [job.databaseId, null];
		}
	}));
	return new Map(entries);
}

// The newest settled verdict among `runs`. A cancelled run was superseded by a newer
// push (cancel-in-progress), so it says nothing about the code.
async function settledVerdict({ runs, repository, runGh }) {
	const run = runs.find((candidate) => candidate.status === "completed" && candidate.conclusion !== "cancelled");
	if (!run) return null;
	if (run.conclusion === "success") return classifyRun({ annotations: new Map(), jobs: [], run });
	const view = await runGh(["run", "view", String(run.databaseId), "--repo", repository, "--json", "jobs"]);
	if (!Array.isArray(view?.jobs)) throw new Error("gh run view returned no jobs");
	const annotations = await readJobAnnotations({ jobs: view.jobs, repository, runGh });
	return classifyRun({ annotations, jobs: view.jobs, run });
}

async function collectMainHealth({ repository, runGh = runGhJson } = {}) {
	try {
		const resolved = await resolveRepository(runGh, repository);
		splitRepository(resolved);
		const runs = validateRuns(await runGh(["run", "list", "--repo", resolved, "--workflow", WORKFLOW, "--branch", "main",
			"--event", "push", "--limit", "20", "--json", RUN_FIELDS]));
		const running = runs.find((run) => run.status !== "completed") ?? null;
		const verdict = await settledVerdict({ repository: resolved, runGh, runs });
		const inProgress = running ? { headSha: running.headSha ?? null, url: running.url ?? null } : null;
		if (!verdict) return { failedJobs: [], inProgress, reason: "no completed push run on main", repository: resolved, state: "unknown" };
		return { ...verdict, inProgress, repository: resolved };
	} catch (error) {
		return { failedJobs: [], inProgress: null, reason: error.message, repository: repository ?? null, state: "unknown" };
	}
}

// Billing applies to the whole account, so any event's latest settled CI run shows it.
async function collectBillingState({ repository, runGh = runGhJson, now = () => Date.now() } = {}) {
	try {
		const resolved = await resolveRepository(runGh, repository);
		const runs = validateRuns(await runGh(["run", "list", "--repo", resolved, "--workflow", WORKFLOW, "--status", "completed",
			"--limit", "20", "--json", RUN_FIELDS]));
		const verdict = await settledVerdict({ repository: resolved, runGh, runs });
		const age = now() - Date.parse(verdict?.updatedAt ?? "");
		const blocked = verdict?.state === "billing-blocked" && Number.isFinite(age) && age < BILLING_STALE_MS;
		return { blocked, url: verdict?.url ?? null };
	} catch (error) {
		// Unknown billing means CI is attempted; a refused run is harmless.
		return { blocked: false, reason: error.message, url: null };
	}
}

function formatHealth(health) {
	const running = health.inProgress ? `; newer run in progress for ${shortSha(health.inProgress.headSha)}: ${health.inProgress.url}` : "";
	if (health.state === "green") return `main health: green at ${shortSha(health.headSha)} (${health.url})${running}`;
	if (health.state === "red") {
		return `main health: RED at ${shortSha(health.headSha)}; failed: ${health.failedJobs.join(", ")} (${health.url}). ` +
			`This breakage predates your change; do not debug it as your own${running}`;
	}
	if (health.state === "billing-blocked") {
		return `main health: billing-blocked at ${shortSha(health.headSha)}; GitHub did not start the jobs (${health.url}). ` +
			`Local \`pnpm run ci:pr\` is the gate${running}`;
	}
	return `main health: unknown (${health.reason})${running}`;
}

function git(args) {
	return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

// Paths that the fast-ship push would land: staged work plus commits ahead of `base`.
function changedPaths({ base = "origin/main", runGit = git } = {}) {
	const mergeBase = runGit(["merge-base", base, "HEAD"]).trim();
	return runGit(["diff", "--cached", "--name-only", "--no-renames", mergeBase]).split("\n").map((line) => line.trim()).filter(Boolean);
}

async function runUrl({ sha, repository, runGh = runGhJson }) {
	if (!/^[a-f0-9]{40}$/u.test(sha ?? "")) throw new Error("--run-url needs a full commit SHA");
	const resolved = await resolveRepository(runGh, repository);
	try {
		const runs = validateRuns(await runGh(["run", "list", "--repo", resolved, "--workflow", WORKFLOW, "--commit", sha,
			"--limit", "1", "--json", RUN_FIELDS]));
		if (runs[0]?.url) return runs[0].url;
	} catch {
		// The run may not be queued yet; the commit's checks page always resolves.
	}
	return `https://github.com/${resolved}/commit/${sha}/checks`;
}

function parseArgs(argv) {
	const options = { base: "origin/main", json: false, mode: "health" };
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--json") options.json = true;
		else if (argument === "--ci-marker") options.mode = "ci-marker";
		else if (argument === "--help" || argument === "-h") options.mode = "help";
		else if (["--repo", "--base", "--run-url"].includes(argument)) {
			const value = argv[index + 1];
			if (!value) throw new Error(`${argument} requires a value`);
			index += 1;
			if (argument === "--repo") options.repository = value;
			if (argument === "--base") options.base = value;
			if (argument === "--run-url") {
				options.mode = "run-url";
				options.sha = value;
			}
		} else throw new Error(`Unknown argument: ${argument}`);
	}
	return options;
}

const HELP = [
	"Usage: main-health [--repo owner/name] [--json]",
	"       main-health --ci-marker [--base origin/main] [--json]",
	"       main-health --run-url <sha> [--repo owner/name]",
	"",
	"Default: one line saying whether the latest push run of CI on main is green, red (with the",
	"failed jobs), billing-blocked, or unknown. Always exits 0; it never blocks work.",
	`--ci-marker: whether a fast-ship commit adds ${SKIP_CI_MARKER}. Only docs/artifacts-only changes`,
	"or a current billing block add it; code changes let CI run after the push.",
	"--run-url: the CI run URL for a pushed commit, or its checks page if no run is queued yet.",
].join("\n");

async function main(argv = process.argv.slice(2), { runGh = runGhJson, runGit = git, write = (text) => process.stdout.write(text) } = {}) {
	const options = parseArgs(argv);
	if (options.mode === "help") return write(`${HELP}\n`);
	options.repository ??= originRepository(runGit);
	if (options.mode === "run-url") return write(`${await runUrl({ repository: options.repository, runGh, sha: options.sha })}\n`);
	if (options.mode === "ci-marker") {
		const paths = changedPaths({ base: options.base, runGit });
		// A docs-only change skips CI anyway, so it needs no GitHub round trip.
		const docsOnly = paths.length > 0 && paths.every(isInertPath);
		const billing = docsOnly ? null : await collectBillingState({ repository: options.repository, runGh });
		const decision = { ...ciMarkerDecision({ billing, paths }), marker: SKIP_CI_MARKER, pathCount: paths.length };
		return write(options.json ? `${JSON.stringify(decision)}\n`
			: `CI marker: ${decision.skipCi ? `add ${SKIP_CI_MARKER}` : "none"} (${decision.reason})\n`);
	}
	const health = await collectMainHealth({ repository: options.repository, runGh });
	return write(options.json ? `${JSON.stringify(health)}\n` : `${formatHealth(health)}\n`);
}

if (require.main === module) {
	main().catch((error) => {
		process.stderr.write(`${error.message}\n`);
		process.exitCode = 1;
	});
}

module.exports = {
	BILLING_STALE_MS,
	SKIP_CI_MARKER,
	changedPaths,
	ciMarkerDecision,
	classifyRun,
	collectBillingState,
	collectMainHealth,
	formatHealth,
	isInertPath,
	main,
	originRepository,
	runUrl,
};
