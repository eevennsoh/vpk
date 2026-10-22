// Pure helpers for the vpk.worktree herdr plugin. No I/O lives here so the
// decisions (which checkout, does it belong to VPK, which env files to copy)
// stay unit-testable; warmup.js owns git, filesystem, and herdr calls.

const path = require("node:path");

const PROVIDER_WORKTREE_PREFIXES = [".claude/worktrees/", ".rovo/worktrees/", ".codex/worktrees/", ".cursor/worktrees/"];

function parseJson(raw) {
	if (typeof raw !== "string" || raw.trim() === "") return null;
	try {
		const value = JSON.parse(raw);
		return value && typeof value === "object" ? value : null;
	} catch {
		return null;
	}
}

function nonEmptyString(value) {
	return typeof value === "string" && value.trim() !== "" ? value : null;
}

// HERDR_PLUGIN_EVENT_JSON for worktree.created (herdr 0.9.5):
// { event: "worktree_created", data: { type, workspace: { workspace_id, worktree: { repo_key, repo_root, checkout_path, ... } },
//   worktree: { path, branch, open_workspace_id, ... } } }
function parseWorktreeCreatedEvent(raw) {
	const payload = parseJson(raw);
	const data = payload && payload.data && typeof payload.data === "object" ? payload.data : null;
	if (!data) return null;
	const workspace = data.workspace && typeof data.workspace === "object" ? data.workspace : {};
	const provenance = workspace.worktree && typeof workspace.worktree === "object" ? workspace.worktree : {};
	const worktree = data.worktree && typeof data.worktree === "object" ? data.worktree : {};
	const checkoutPath = nonEmptyString(worktree.path) || nonEmptyString(provenance.checkout_path);
	if (!checkoutPath) return null;
	return {
		checkoutPath,
		workspaceId: nonEmptyString(workspace.workspace_id) || nonEmptyString(worktree.open_workspace_id),
		repoRoot: nonEmptyString(provenance.repo_root),
		branch: nonEmptyString(worktree.branch),
	};
}

// HERDR_PLUGIN_CONTEXT_JSON for a workspace action: workspace_id, workspace_cwd,
// optional worktree provenance, focused_pane_cwd.
function parseActionContext(raw) {
	const context = parseJson(raw);
	if (!context) return null;
	const provenance = context.worktree && typeof context.worktree === "object" ? context.worktree : {};
	const checkoutPath =
		nonEmptyString(provenance.checkout_path) || nonEmptyString(context.workspace_cwd) || nonEmptyString(context.focused_pane_cwd);
	if (!checkoutPath) return null;
	return {
		checkoutPath,
		workspaceId: nonEmptyString(context.workspace_id),
		repoRoot: nonEmptyString(provenance.repo_root),
		branch: null,
	};
}

// Both arguments are realpath-resolved absolute git common dirs (or null).
function isSameRepo(pluginCommonDir, targetCommonDir) {
	if (!pluginCommonDir || !targetCommonDir) return false;
	return path.resolve(pluginCommonDir) === path.resolve(targetCommonDir);
}

function isEnvBasename(base) {
	if (base.endsWith(".example")) return false;
	return base === ".env" || base.startsWith(".env.");
}

// ignoredPaths: repo-relative paths from `git ls-files --others --ignored`.
// Returns the env files to copy into the target, skipping ones that already exist.
function selectEnvFiles(ignoredPaths, targetHas = () => false) {
	const selected = [];
	for (const rel of ignoredPaths) {
		if (!rel || rel.endsWith("/")) continue;
		const normalized = rel.split(path.sep).join("/");
		if (PROVIDER_WORKTREE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) continue;
		if (!isEnvBasename(path.posix.basename(normalized))) continue;
		if (targetHas(normalized)) continue;
		selected.push(normalized);
	}
	return selected;
}

// `git worktree list --porcelain` output -> checkout paths, main checkout first.
function parseWorktreeList(porcelain) {
	return String(porcelain || "")
		.split("\n")
		.filter((line) => line.startsWith("worktree "))
		.map((line) => line.slice("worktree ".length));
}

// Prefer the repo root herdr reported, then the main checkout, never the target itself.
function pickSourceCheckout({ targetPath, repoRoot, worktreePaths }) {
	const target = path.resolve(targetPath);
	const candidates = [repoRoot, ...(worktreePaths || [])].filter(Boolean).map((p) => path.resolve(p));
	return candidates.find((candidate) => candidate !== target) || null;
}

function shellQuote(value) {
	return `'${String(value).replace(/'/g, "'\\''")}'`;
}

// Shell line typed into the visible warmup pane (works in zsh and bash).
function buildInstallCommand() {
	return [
		"echo '[vpk-worktree] CI=true pnpm install --prefer-offline'",
		"CI=true pnpm install --prefer-offline",
		"s=$?",
		`if [ "$s" = 0 ]; then echo '[vpk-worktree] warmup done'; else echo "[vpk-worktree] warmup FAILED (exit $s)"; fi`,
	].join("; ");
}

module.exports = {
	parseWorktreeCreatedEvent,
	parseActionContext,
	isSameRepo,
	selectEnvFiles,
	parseWorktreeList,
	pickSourceCheckout,
	buildInstallCommand,
	shellQuote,
};
