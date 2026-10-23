/*
 * repo-root: where a vpk-html checkout sits inside the VPK repository (ws6 C14).
 *
 * The skill lives at <repo>/.agents/skills/vpk-html. When that grandparent holds both
 * package.json and .git (a file in worktrees, a folder otherwise), it is the repo root;
 * a standalone install (~/.agents/skills/vpk-html) has none, and callers fall back.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function resolveRepoRoot({ skillRoot = SKILL_ROOT, fs: fileSystem = fs } = {}) {
	const candidate = path.resolve(skillRoot, "../../..");
	const isRepo = fileSystem.existsSync(path.join(candidate, "package.json")) && fileSystem.existsSync(path.join(candidate, ".git"));
	return isRepo ? candidate : null;
}
