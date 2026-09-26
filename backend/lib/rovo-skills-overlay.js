const fs = require("node:fs/promises");
const path = require("node:path");

async function ensureRovoSkillsSymlink({
	repoRoot,
	sharedSkillsDir = path.join(repoRoot, ".agents", "skills"),
	targetSkillsDir = path.join(repoRoot, ".rovo", "skills"),
} = {}) {
	if (!repoRoot) {
		throw new Error("repoRoot is required.");
	}

	await fs.mkdir(sharedSkillsDir, { recursive: true });
	await fs.mkdir(path.dirname(targetSkillsDir), { recursive: true });
	await fs.rm(targetSkillsDir, { recursive: true, force: true });

	const linkTarget = path.relative(path.dirname(targetSkillsDir), sharedSkillsDir) || ".";
	await fs.symlink(linkTarget, targetSkillsDir, "dir");

	return {
		linkTarget,
		sharedSkillsDir,
		targetSkillsDir,
	};
}

module.exports = { ensureRovoSkillsSymlink };
