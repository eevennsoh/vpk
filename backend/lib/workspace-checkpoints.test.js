const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
	createCheckpointManager,
} = require("./workspace-checkpoints");

async function withTempDir(fn) {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vpk-checkpoint-"));
	try {
		await fn(tmpDir);
	} finally {
		await fs.rm(tmpDir, { recursive: true, force: true });
	}
}

test("createCheckpoint creates a snapshot file", async () => {
	await withTempDir(async (dir) => {
		const mgr = createCheckpointManager({ baseDir: dir });
		// Create a file to checkpoint
		await fs.writeFile(path.join(dir, "test.txt"), "hello", "utf8");
		const cp = await mgr.create({ name: "initial", description: "first snapshot" });
		assert.ok(cp.id);
		assert.equal(cp.name, "initial");
		assert.equal(cp.description, "first snapshot");
		assert.ok(cp.createdAt);
	});
});

test("listCheckpoints returns created checkpoints", async () => {
	await withTempDir(async (dir) => {
		const mgr = createCheckpointManager({ baseDir: dir });
		await fs.writeFile(path.join(dir, "test.txt"), "v1", "utf8");
		await mgr.create({ name: "cp1" });
		await mgr.create({ name: "cp2" });
		const list = await mgr.list();
		assert.equal(list.length, 2);
		assert.ok(list.some((c) => c.name === "cp1"));
		assert.ok(list.some((c) => c.name === "cp2"));
	});
});

test("listCheckpoints returns newest first", async () => {
	await withTempDir(async (dir) => {
		const mgr = createCheckpointManager({ baseDir: dir });
		await fs.writeFile(path.join(dir, "test.txt"), "v1", "utf8");
		await mgr.create({ name: "older" });
		await mgr.create({ name: "newer" });
		const list = await mgr.list();
		assert.equal(list[0].name, "newer");
		assert.equal(list[1].name, "older");
	});
});

test("rollback restores checkpoint state", async () => {
	await withTempDir(async (dir) => {
		const mgr = createCheckpointManager({ baseDir: dir });
		const filePath = path.join(dir, "test.txt");
		await fs.writeFile(filePath, "original", "utf8");
		const cp = await mgr.create({ name: "before-change" });
		await fs.writeFile(filePath, "modified", "utf8");
		const beforeRollback = await fs.readFile(filePath, "utf8");
		assert.equal(beforeRollback, "modified");
		await mgr.rollback(cp.id);
		const afterRollback = await fs.readFile(filePath, "utf8");
		assert.equal(afterRollback, "original");
	});
});

test("rollback removes files created after the checkpoint", async () => {
	await withTempDir(async (dir) => {
		const mgr = createCheckpointManager({ baseDir: dir });
		await fs.writeFile(path.join(dir, "original.txt"), "present", "utf8");
		const checkpoint = await mgr.create({ name: "before-extra-file" });
		await fs.writeFile(path.join(dir, "new-after-checkpoint.txt"), "remove me", "utf8");

		await mgr.rollback(checkpoint.id);

		await assert.rejects(
			fs.readFile(path.join(dir, "new-after-checkpoint.txt"), "utf8"),
			(error) => error?.code === "ENOENT",
		);
	});
});

test("deleteCheckpoint removes checkpoint", async () => {
	await withTempDir(async (dir) => {
		const mgr = createCheckpointManager({ baseDir: dir });
		await fs.writeFile(path.join(dir, "test.txt"), "v1", "utf8");
		const cp = await mgr.create({ name: "to-delete" });
		await mgr.delete(cp.id);
		const list = await mgr.list();
		assert.equal(list.length, 0);
	});
});

test("enforces max checkpoint limit", async () => {
	await withTempDir(async (dir) => {
		const mgr = createCheckpointManager({ baseDir: dir, maxCheckpoints: 3 });
		await fs.writeFile(path.join(dir, "test.txt"), "v1", "utf8");
		await mgr.create({ name: "cp1" });
		await mgr.create({ name: "cp2" });
		await mgr.create({ name: "cp3" });
		await mgr.create({ name: "cp4" });
		const list = await mgr.list();
		assert.ok(list.length <= 3);
		// Oldest should be pruned
		assert.ok(!list.some((c) => c.name === "cp1"));
		assert.ok(list.some((c) => c.name === "cp4"));
	});
});

test("rollback with invalid id throws", async () => {
	await withTempDir(async (dir) => {
		const mgr = createCheckpointManager({ baseDir: dir });
		try {
			await mgr.rollback("nonexistent-id");
			assert.fail("Should have thrown");
		} catch (error) {
			assert.ok(error.message.includes("not found"));
		}
	});
});

test("create with no files still creates checkpoint", async () => {
	await withTempDir(async (dir) => {
		const mgr = createCheckpointManager({ baseDir: dir });
		const cp = await mgr.create({ name: "empty" });
		assert.ok(cp.id);
		const list = await mgr.list();
		assert.equal(list.length, 1);
	});
});

test("checkpoint preserves directory structure", async () => {
	await withTempDir(async (dir) => {
		const mgr = createCheckpointManager({ baseDir: dir });
		const subDir = path.join(dir, "sub");
		await fs.mkdir(subDir, { recursive: true });
		await fs.writeFile(path.join(subDir, "nested.txt"), "nested-content", "utf8");
		const cp = await mgr.create({ name: "with-subdir" });
		await fs.rm(subDir, { recursive: true, force: true });
		await mgr.rollback(cp.id);
		const content = await fs.readFile(path.join(subDir, "nested.txt"), "utf8");
		assert.equal(content, "nested-content");
	});
});
