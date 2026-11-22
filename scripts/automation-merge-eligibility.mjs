#!/usr/bin/env node

// Decides whether a Codex automation pull request is low-risk enough for the
// `automation-merge` job to merge it after the vpk-git-ship review gate (decision D11 in
// `.agents/docs/hardening-record.md`). It never merges anything itself. Producers run it
// with `--policy` on their own PR to choose `automerge:allowed` or `risk:needs-human`;
// `scripts/automation-merge.mjs` runs it pinned to the head it is about to merge.
//
//   node scripts/automation-merge-eligibility.mjs --pr <number> --repo <owner/name> [--head <sha>] [--policy] [--json]
//
// Exit 0 eligible, 2 ineligible, 1 error. Output uses a fixed vocabulary of reason codes;
// PR-controlled strings (paths, branch names) appear only when they match SAFE_TEXT,
// otherwise as `path#<sha256 prefix>`; branch names always as `branch#<sha256 prefix>`.
// Titles and bodies are never read.

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------------------
// Policy. Automatic merging covers only README docs, a shrinking ESLint suppressions
// baseline, and the two whole-file generated companions. Tests and all other code always
// need a human. README globs match the lowercased path; the exact files match the path as
// written. Deny always wins. A rename or copy is evaluated as removing the old path and
// adding the new one, and both halves must pass. Every path the head adds or modifies
// must be a regular file (not a symlink or submodule) at the head SHA.
// ---------------------------------------------------------------------------------------
export const MERGE_POLICY = {
	requiredLabels: ["automation", "automerge:allowed"],
	// `--policy` (producer self-check) drops this one label from the requirement, since the
	// producer applies it only after the check passes.
	labelGrantedByPolicy: "automerge:allowed",
	blockingLabels: ["automerge:blocked", "risk:needs-human", "review:changes-requested"],
	// Producer branches are `automation/<job-slug>-<summary>` (vpk-scheduled-automation §1).
	headBranch: /^automation\/[a-z0-9._/-]{1,110}$/u,
	maxChangedLines: 300,
	// The repo keeps no docs tree outside the agent folders, so READMEs are the only docs.
	// Only existing READMEs may change; adding or deleting one needs a human.
	doc: { globs: ["**/readme.md"], statuses: ["modified"] },
	// Baseline that may only shrink; checked on parsed base and head contents.
	pruneOnly: { paths: ["eslint-suppressions.json"], statuses: ["modified"] },
	// Regenerated whole by `pnpm run fix:generated` and drift-checked by CI; eligible only
	// beside another eligible file, and exempt from the `.agents/**` deny.
	generatedCompanions: { paths: [".agents/knowledge/repo-map.json", ".agents/skills/INDEX.md"], statuses: ["modified"] },
	// Agent instruction files by basename, in any folder and any case.
	denyBasenames: [/^(agents|claude|design|workflow)(\..*)?\.md$/u, /\.override\.md$/u, /\.local\.md$/u],
	deny: [
		// Agent and provider configuration, skills, rules, prompts and commands
		".agents/**",
		".claude/**",
		".codex/**",
		".cursor/**",
		".rovo/**",
		"**/commands/**",
		"**/prompts/**",
		// Served or exported trees, where even a README ships
		"public/**",
		"app/**",
		// Server boundary
		"backend/routes/**",
		"backend/middleware/**",
		// Auth, identity, and secrets
		"**/auth/**",
		"**/auth-*",
		"**/*-auth.*",
		"**/*-auth-*",
		"**/*slauth*",
		"**/*asap*",
		"**/*identity*",
		"**/*credential*",
		"**/*secret*",
		"**/*.env*",
		"**/.env*",
		// Dependencies and registry
		"**/package.json",
		"pnpm-lock.yaml",
		"pnpm-workspace.yaml",
		"**/.npmrc",
		// CI and the gates it runs
		".github/**",
		"eslint.config.mjs",
		"playwright.config.ts",
		"scripts/check.mjs",
		"scripts/run-parallel.mjs",
		"scripts/run-js-unit-tests*",
		"scripts/js-unit-test-*",
		"scripts/generated-artifacts*",
		"scripts/verify-*",
		"scripts/validate-*",
		"scripts/eslint-*",
		"scripts/perf-*",
		"scripts/collect-route-transfer*",
		"scripts/write-npmrc*",
		"scripts/lib/heavy-run-lock*",
		// This policy and the merger
		"scripts/automation-merge*",
		// Unattended automation must never modify durable deliverables
		"artifacts/**",
	],
};

// Reason codes. Every reason is `<code>` or `<code>: <detail>`, where a detail is a policy
// constant, a number, a SHA, or a PR-controlled string passed through displayText().
export const REASONS = {
	missingLabel: "missing-label",
	blockingLabel: "blocking-label",
	notOpen: "pr-not-open",
	draft: "pr-draft",
	foreignBase: "base-not-default-branch",
	foreignHead: "head-repo-not-this-repo",
	branch: "head-branch-not-automation",
	author: "author-not-repo-owner",
	headMismatch: "head-not-expected-sha",
	headMoved: "head-moved-while-reading",
	noFiles: "no-files",
	incomplete: "file-list-incomplete",
	unsafePath: "path-unsafe",
	denied: "path-denied",
	code: "needs-human-code",
	status: "status-not-allowed",
	notShrinking: "suppressions-not-shrinking",
	notRegularFile: "not-a-regular-file",
	noCounts: "no-line-counts",
	generatedOnly: "generated-only",
	tooLarge: "too-many-lines",
};

const SAFE_TEXT = /^[A-Za-z0-9._/-]{1,120}$/u;

const shortHash = (text) => createHash("sha256").update(text).digest("hex").slice(0, 8);

export function displayText(value) {
	const text = String(value ?? "");
	return SAFE_TEXT.test(text) ? text : `path#${shortHash(text)}`;
}

// Branch names are producer text, so they are only ever shown hashed.
export function displayBranch(value) {
	return `branch#${shortHash(String(value ?? ""))}`;
}

const reason = (code, detail) => (detail === undefined ? code : `${code}: ${detail}`);

// ---------------------------------------------------------------------------------------

const globCache = new Map();

export function globToRegExp(glob) {
	let cached = globCache.get(glob);
	if (cached) return cached;
	let source = "";
	for (let index = 0; index < glob.length; index += 1) {
		const char = glob[index];
		if (char === "*" && glob[index + 1] === "*") {
			if (glob[index + 2] === "/") {
				source += "(?:.*/)?";
				index += 2;
			} else {
				source += ".*";
				index += 1;
			}
		} else if (char === "*") {
			source += "[^/]*";
		} else if (char === "{") {
			const end = glob.indexOf("}", index);
			if (end === -1) throw new Error(`unclosed brace in glob ${glob}`);
			const options = glob.slice(index + 1, end).split(",").map((option) => option.replace(/[.+?^${}()|[\]\\]/gu, "\\$&"));
			source += `(?:${options.join("|")})`;
			index = end;
		} else {
			source += char.replace(/[.+?^${}()|[\]\\]/gu, "\\$&");
		}
	}
	cached = new RegExp(`^${source}$`, "u");
	globCache.set(glob, cached);
	return cached;
}

export function matchesAny(filePath, globs) {
	return globs.some((glob) => globToRegExp(glob).test(filePath));
}

// Returns the lowercase repo-relative path used for matching, or null unless the path is
// plain `[A-Za-z0-9._/-]` segments with no `.`/`..`/empty segment (a leading `./` is dropped).
export function normalizePath(rawPath) {
	if (typeof rawPath !== "string" || !/^[A-Za-z0-9._/-]+$/u.test(rawPath)) return null;
	let normalized = rawPath;
	while (normalized.startsWith("./")) normalized = normalized.slice(2);
	const segments = normalized.split("/");
	if (segments.some((segment) => segment === ".." || segment === "." || segment === "")) return null;
	return normalized.toLowerCase();
}

function isCount(value) {
	return Number.isInteger(value) && value >= 0;
}

// True when `headText` only drops entries from, or lowers counts in, `baseText`; this is
// what `eslint --prune-suppressions` produces. Both must parse as `{ file: { rule: { count } } }`.
export function isPrunedSuppressions(baseText, headText) {
	let base;
	let head;
	try {
		base = JSON.parse(baseText);
		head = JSON.parse(headText);
	} catch {
		return false;
	}
	const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
	if (!isObject(base) || !isObject(head)) return false;
	for (const [file, rules] of Object.entries(head)) {
		if (!isObject(rules) || !Object.hasOwn(base, file) || !isObject(base[file])) return false;
		for (const [rule, entry] of Object.entries(rules)) {
			if (!Object.hasOwn(base[file], rule)) return false;
			const baseEntry = base[file][rule];
			if (!isObject(entry) || !isObject(baseEntry) || Object.keys(entry).join() !== "count") return false;
			if (!isCount(entry.count) || !isCount(baseEntry.count) || entry.count > baseEntry.count) return false;
		}
	}
	return true;
}

// Splits a changed file into the path halves the policy evaluates.
export function fileHalves(file) {
	if (file.status === "renamed" || file.status === "copied") {
		return [
			{ path: file.previousPath, status: "removed" },
			{ path: file.path, status: "added" },
		];
	}
	return [{ path: file.path, status: file.status }];
}

// Paths whose head object must be a regular file.
export function headPaths(file) {
	return fileHalves(file).filter((half) => half.status !== "removed").map((half) => half.path);
}

const KNOWN_STATUSES = new Set(["added", "removed", "modified", "renamed", "copied", "changed", "unchanged"]);

function classifyHalf(half, file, policy) {
	const normalized = normalizePath(half.path);
	const shown = displayText(half.path);
	if (!normalized) return { category: "rejected", reason: reason(REASONS.unsafePath, shown) };
	const statusShown = KNOWN_STATUSES.has(half.status) ? half.status : "unknown";
	const statusReason = reason(REASONS.status, `${statusShown} ${shown}`);
	if (half.status !== "removed" && file.headModes?.[half.path] !== "file") {
		return { category: "rejected", reason: reason(REASONS.notRegularFile, shown) };
	}
	if (policy.pruneOnly.paths.includes(half.path)) {
		if (!policy.pruneOnly.statuses.includes(half.status)) return { category: "rejected", reason: statusReason };
		return isPrunedSuppressions(file.baseContent, file.headContent)
			? { category: "prune-only" }
			: { category: "rejected", reason: reason(REASONS.notShrinking, shown) };
	}
	if (policy.generatedCompanions.paths.includes(half.path)) {
		return policy.generatedCompanions.statuses.includes(half.status)
			? { category: "generated" }
			: { category: "rejected", reason: statusReason };
	}
	const basename = normalized.slice(normalized.lastIndexOf("/") + 1);
	if (matchesAny(normalized, policy.deny) || policy.denyBasenames.some((pattern) => pattern.test(basename))) {
		return { category: "denied", reason: reason(REASONS.denied, shown) };
	}
	if (matchesAny(normalized, policy.doc.globs)) {
		return policy.doc.statuses.includes(half.status)
			? { category: "doc" }
			: { category: "rejected", reason: statusReason };
	}
	return { category: "rejected", reason: reason(REASONS.code, shown) };
}

function classifyFile(file, policy) {
	if (!isCount(file.additions) || !isCount(file.deletions)) {
		return { category: "rejected", reasons: [reason(REASONS.noCounts, displayText(file.path))] };
	}
	const results = fileHalves(file).map((half) => classifyHalf(half, file, policy));
	const reasons = results.filter((result) => result.reason).map((result) => result.reason);
	return reasons.length > 0
		? { category: results.find((result) => result.reason).category, reasons }
		: { category: results.at(-1).category, reasons: [] };
}

/**
 * @param {object} pr normalized PR: { number, state, author, labels[], isDraft, baseRefName,
 *   headRefName, headRepository ("owner/name"), headRefOid, changedFiles, headAfterFiles?,
 *   files[{ path, previousPath?, status, additions, deletions, headModes?, baseContent?, headContent? }] }
 *   `headModes` maps each head path to "file", "symlink", "submodule", "dir" or "missing".
 * @param {object} context { repository ("owner/name"), defaultBranch, requireGrantLabel?, expectedHead? }
 */
export function evaluateEligibility(pr, { repository, defaultBranch, requireGrantLabel = true, expectedHead }, policy = MERGE_POLICY) {
	const reasons = [];
	const owner = repository.split("/")[0].toLowerCase();
	const labels = new Set(pr.labels ?? []);

	const requiredLabels = requireGrantLabel
		? policy.requiredLabels
		: policy.requiredLabels.filter((label) => label !== policy.labelGrantedByPolicy);
	for (const label of requiredLabels) {
		if (!labels.has(label)) reasons.push(reason(REASONS.missingLabel, label));
	}
	for (const label of policy.blockingLabels) {
		if (labels.has(label)) reasons.push(reason(REASONS.blockingLabel, label));
	}
	if (String(pr.state ?? "").toUpperCase() !== "OPEN") reasons.push(REASONS.notOpen);
	if (pr.isDraft !== false) reasons.push(REASONS.draft);
	if (pr.baseRefName !== defaultBranch) reasons.push(REASONS.foreignBase);
	if ((pr.headRepository ?? "").toLowerCase() !== repository.toLowerCase()) reasons.push(REASONS.foreignHead);
	const branchOk = policy.headBranch.test(String(pr.headRefName ?? ""));
	if (!branchOk) reasons.push(reason(REASONS.branch, displayBranch(pr.headRefName)));
	if ((pr.author ?? "").toLowerCase() !== owner) reasons.push(REASONS.author);
	if (expectedHead && pr.headRefOid !== expectedHead) reasons.push(reason(REASONS.headMismatch, expectedHead));
	if (pr.headAfterFiles !== undefined && pr.headAfterFiles !== pr.headRefOid) reasons.push(REASONS.headMoved);

	const files = pr.files ?? [];
	if (files.length === 0) reasons.push(REASONS.noFiles);
	if (!Number.isInteger(pr.changedFiles) || pr.changedFiles !== files.length) {
		reasons.push(reason(REASONS.incomplete, `${files.length}/${Number.isInteger(pr.changedFiles) ? pr.changedFiles : "unknown"}`));
	}

	const classified = files.map((file) => {
		const { category, reasons: fileReasons } = classifyFile(file, policy);
		reasons.push(...fileReasons);
		return { path: displayText(file.path), status: KNOWN_STATUSES.has(file.status) ? file.status : "unknown", category };
	});
	const hasPrimary = classified.some((file) => ["doc", "prune-only"].includes(file.category));
	if (files.length > 0 && !hasPrimary && classified.every((file) => file.category === "generated")) {
		reasons.push(REASONS.generatedOnly);
	}

	const changedLines = files.reduce((sum, file) => sum + (isCount(file.additions) ? file.additions : 0) + (isCount(file.deletions) ? file.deletions : 0), 0);
	if (changedLines > policy.maxChangedLines) reasons.push(reason(REASONS.tooLarge, `${changedLines}>${policy.maxChangedLines}`));

	return {
		eligible: reasons.length === 0,
		number: pr.number,
		headRefOid: pr.headRefOid,
		headRefName: displayBranch(pr.headRefName),
		mode: requireGrantLabel ? "merge" : "policy",
		changedLines,
		reasons,
		files: classified,
	};
}

// ---------------------------------------------------------------------------------------
// GitHub reads
// ---------------------------------------------------------------------------------------

export function gh(args) {
	return new Promise((resolve, reject) => {
		execFile("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 120000 }, (error, stdout, stderr) => {
			if (error) reject(new Error(`gh ${args.slice(0, 2).join(" ")} failed (exit ${error.code ?? "unknown"}${stderr.includes("HTTP 404") ? ", HTTP 404" : ""})`));
			else resolve(stdout);
		});
	});
}

const PR_VIEW_FIELDS = "number,state,author,labels,isDraft,baseRefName,baseRefOid,headRefName,headRefOid,headRepository,headRepositoryOwner,changedFiles";
const SHA = /^[0-9a-f]{40}$/u;
const TREE_MODES = { 100644: "file", 100755: "file", 120000: "symlink", 160000: "submodule", 40000: "dir", "040000": "dir" };

async function readContent(runGh, repository, filePath, ref) {
	try {
		return await runGh(["api", "-H", "Accept: application/vnd.github.raw+json", `repos/${repository}/contents/${filePath}?ref=${ref}`]);
	} catch {
		return undefined;
	}
}

// Maps each path to its object kind at `sha`, reading one git tree per parent directory.
// `sha:dir` resolves only through real directories, so a symlinked parent reads as missing.
export async function readHeadModes({ runGh, repository, sha, paths }) {
	const modes = {};
	const byDir = new Map();
	for (const filePath of paths) {
		if (normalizePath(filePath) === null) continue;
		const slash = filePath.lastIndexOf("/");
		const dir = slash === -1 ? "" : filePath.slice(0, slash);
		if (!byDir.has(dir)) byDir.set(dir, []);
		byDir.get(dir).push(filePath);
	}
	await Promise.all([...byDir].map(async ([dir, dirPaths]) => {
		let entries = [];
		try {
			const tree = JSON.parse(await runGh(["api", `repos/${repository}/git/trees/${dir ? `${sha}:${dir}` : sha}`]));
			entries = Array.isArray(tree.tree) && tree.truncated !== true ? tree.tree : [];
		} catch {
			entries = [];
		}
		for (const filePath of dirPaths) {
			const name = filePath.slice(filePath.lastIndexOf("/") + 1);
			const entry = entries.find((candidate) => candidate?.path === name);
			modes[filePath] = entry ? (TREE_MODES[entry.mode] ?? "unknown") : "missing";
			if (modes[filePath] === "file" && entry.type !== "blob") modes[filePath] = "unknown";
		}
	}));
	return modes;
}

// Reads the PR and its files pinned to one head: files come from the compare API between
// the base and head SHAs, object kinds from the head tree, and the head is read again last.
export async function fetchPullRequest({ prNumber, repository, runGh = gh, policy = MERGE_POLICY }) {
	const [viewText, repoText] = await Promise.all([
		runGh(["pr", "view", String(prNumber), "--repo", repository, "--json", PR_VIEW_FIELDS]),
		runGh(["repo", "view", repository, "--json", "defaultBranchRef"]),
	]);
	const view = JSON.parse(viewText);
	const defaultBranch = JSON.parse(repoText).defaultBranchRef?.name;
	if (!defaultBranch) throw new Error("could not read the default branch");
	if (!SHA.test(view.baseRefOid ?? "") || !SHA.test(view.headRefOid ?? "")) throw new Error("could not read the base and head SHAs");

	const filesText = await runGh([
		"api", "--paginate", `repos/${repository}/compare/${view.baseRefOid}...${view.headRefOid}?per_page=100`,
		"--jq", ".files[] | {filename, previous_filename, status, additions, deletions}",
	]);
	const files = filesText.split("\n").filter((line) => line.trim()).map((line) => {
		const file = JSON.parse(line);
		return {
			path: file.filename,
			previousPath: file.previous_filename ?? undefined,
			status: file.status,
			additions: file.additions,
			deletions: file.deletions,
		};
	});
	const headModes = await readHeadModes({ runGh, repository, sha: view.headRefOid, paths: files.flatMap(headPaths) });
	await Promise.all(files.map(async (file) => {
		file.headModes = Object.fromEntries(headPaths(file).map((filePath) => [filePath, headModes[filePath] ?? "missing"]));
		if (!policy.pruneOnly.paths.includes(file.path) || file.status !== "modified") return;
		[file.baseContent, file.headContent] = await Promise.all([
			readContent(runGh, repository, file.path, view.baseRefOid),
			readContent(runGh, repository, file.path, view.headRefOid),
		]);
	}));
	const after = JSON.parse(await runGh(["pr", "view", String(prNumber), "--repo", repository, "--json", "headRefOid"]));

	const headOwner = view.headRepositoryOwner?.login;
	const headName = view.headRepository?.name;
	return {
		pr: {
			number: view.number,
			state: view.state,
			author: view.author?.login,
			labels: (view.labels ?? []).map((label) => label.name),
			isDraft: view.isDraft,
			baseRefName: view.baseRefName,
			headRefName: view.headRefName,
			headRefOid: view.headRefOid,
			headAfterFiles: after.headRefOid,
			headRepository: headOwner && headName ? `${headOwner}/${headName}` : "",
			changedFiles: view.changedFiles,
			files,
		},
		defaultBranch,
	};
}

export async function checkEligibility({ prNumber, repository, expectedHead, requireGrantLabel = true, runGh = gh }) {
	const { pr, defaultBranch } = await fetchPullRequest({ prNumber, repository, runGh });
	return evaluateEligibility(pr, { repository, defaultBranch, requireGrantLabel, expectedHead });
}

// ---------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------

export function parseArgs(argv) {
	const options = { json: false, policy: false };
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv[index];
		if (argument === "--json") options.json = true;
		else if (argument === "--policy") options.policy = true;
		else if (["--pr", "--repo", "--head"].includes(argument)) {
			const value = argv[index + 1];
			if (!value) throw new Error(`${argument} requires a value`);
			options[argument.slice(2)] = value;
			index += 1;
		} else throw new Error(`Unknown argument: ${displayText(argument)}`);
	}
	const prNumber = Number(options.pr);
	if (!Number.isInteger(prNumber) || prNumber < 1) throw new Error("--pr <number> is required");
	if (!/^[\w.-]+\/[\w.-]+$/u.test(options.repo ?? "")) throw new Error("--repo <owner/name> is required");
	if (options.head !== undefined && !SHA.test(options.head)) throw new Error("--head must be a full 40-character SHA");
	return { prNumber, repository: options.repo, expectedHead: options.head, json: options.json, policy: options.policy };
}

export function formatDecision(decision) {
	const head = `${decision.eligible ? "ELIGIBLE" : "INELIGIBLE"} #${decision.number} @ ${decision.headRefOid ?? "unknown"} (${decision.mode}, ${decision.changedLines} lines)`;
	return [head, ...decision.reasons.map((entry) => `- ${entry}`)].join("\n");
}

async function main() {
	let options;
	try {
		options = parseArgs(process.argv.slice(2));
		const decision = await checkEligibility({ ...options, requireGrantLabel: !options.policy });
		console.log(options.json ? JSON.stringify(decision, null, 2) : formatDecision(decision));
		process.exitCode = decision.eligible ? 0 : 2;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (options?.json) console.log(JSON.stringify({ error: message }));
		else console.error(`ERROR automation-merge-eligibility: ${message}`);
		process.exitCode = 1;
	}
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	await main();
}
