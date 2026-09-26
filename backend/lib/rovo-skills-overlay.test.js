const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { ensureRovoSkillsSymlink } = require("./rovo-skills-overlay");

async function withTempDir(fn) {
	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "rovo-skills-"));
	try {
		await fn(tempDir);
	} finally {
		await fs.rm(tempDir, { recursive: true, force: true });
	}
}

test("ensureRovoSkillsSymlink replaces existing skill directory with relative symlink", async () => {
	await withTempDir(async (tempDir) => {
		const repoRoot = path.join(tempDir, "repo");
		const sharedSkillsDir = path.join(repoRoot, ".agents", "skills");
		const rovoSkillsDir = path.join(repoRoot, ".rovo", "skills");

		await fs.mkdir(path.join(sharedSkillsDir, "vpk-tidy"), { recursive: true });
		await fs.mkdir(path.join(rovoSkillsDir, "old-custom-skill"), { recursive: true });

		const result = await ensureRovoSkillsSymlink({ repoRoot });

		assert.equal(result.targetSkillsDir, rovoSkillsDir);
		assert.equal(result.sharedSkillsDir, sharedSkillsDir);
		assert.equal(result.linkTarget, "../.agents/skills");
		assert.equal(await fs.readlink(rovoSkillsDir), "../.agents/skills");
		assert.deepEqual(
			(await fs.readdir(rovoSkillsDir)).filter((entry) => entry !== ".DS_Store"),
			["vpk-tidy"],
		);
	});
});
