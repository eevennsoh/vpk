/**
 * Workspace checkpoint and rollback management.
 *
 * Creates tar-based snapshots of a workspace directory for undo capability.
 * Checkpoints are stored in a `.checkpoints/` subdirectory with metadata
 * persisted in a JSON index file.
 *
 * Used by this repository's backend to provide workspace rollback via
 * /api/checkpoints endpoints.
 */

const { execFile } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

const CHECKPOINTS_DIR_NAME = ".checkpoints";
const INDEX_FILE_NAME = "index.json";
const DEFAULT_MAX_CHECKPOINTS = 10;

function createId() {
	return `cp-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

/**
 * @typedef {{ id: string, name: string, description: string | null, createdAt: string, archivePath: string }} CheckpointRecord
 */

/**
 * Create a checkpoint manager for a workspace directory.
 *
 * @param {{ baseDir: string, maxCheckpoints?: number }} options
 */
function createCheckpointManager({ baseDir, maxCheckpoints }) {
	const resolvedMax = typeof maxCheckpoints === "number" && maxCheckpoints > 0
		? maxCheckpoints
		: DEFAULT_MAX_CHECKPOINTS;
	const checkpointsDir = path.join(baseDir, CHECKPOINTS_DIR_NAME);
	const indexPath = path.join(checkpointsDir, INDEX_FILE_NAME);

	async function ensureDir() {
		await fs.mkdir(checkpointsDir, { recursive: true });
	}

	async function readIndex() {
		try {
			const raw = await fs.readFile(indexPath, "utf8");
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch (error) {
			if (error && error.code === "ENOENT") {
				return [];
			}
			throw error;
		}
	}

	async function writeIndex(records) {
		await ensureDir();
		await fs.writeFile(indexPath, JSON.stringify(records, null, 2), "utf8");
	}

	/**
	 * Collect files to archive, excluding the checkpoints directory itself.
	 */
	function getExcludePattern() {
		return CHECKPOINTS_DIR_NAME;
	}

	async function getWorkspaceGitMetadata() {
		try {
			const { stdout: insideGitWorkTree } = await execFileAsync("git", [
				"rev-parse",
				"--is-inside-work-tree",
			], {
				cwd: baseDir,
			});
			if (insideGitWorkTree.trim() !== "true") {
				return {
					dirty: null,
					headSha: null,
					isGitRepo: false,
				};
			}

			const [{ stdout: headSha }, { stdout: statusOutput }] = await Promise.all([
				execFileAsync("git", ["rev-parse", "HEAD"], {
					cwd: baseDir,
				}),
				execFileAsync("git", ["status", "--porcelain"], {
					cwd: baseDir,
				}),
			]);
			return {
				dirty: statusOutput.trim().length > 0,
				headSha: headSha.trim() || null,
				isGitRepo: true,
			};
		} catch {
			return {
				dirty: null,
				headSha: null,
				isGitRepo: false,
			};
		}
	}

	/**
	 * Create a new checkpoint snapshot.
	 *
	 * @param {{ name: string, description?: string }} options
	 * @returns {Promise<CheckpointRecord>}
	 */
	async function create({ name, description }) {
		await ensureDir();
		const id = createId();
		const archiveName = `${id}.tar.gz`;
		const archivePath = path.join(checkpointsDir, archiveName);
		const git = await getWorkspaceGitMetadata();

		await execFileAsync("tar", [
			"czf",
			archivePath,
			`--exclude=${getExcludePattern()}`,
			"-C",
			baseDir,
			".",
		]);

		const record = {
			id,
			name: typeof name === "string" && name.trim() ? name.trim() : id,
			description: typeof description === "string" && description.trim()
				? description.trim()
				: null,
			createdAt: new Date().toISOString(),
			archivePath: archiveName,
			git,
			kind: "tar-gzip",
		};

		const index = await readIndex();
		index.push(record);

		// Enforce max checkpoints (remove oldest first)
		while (index.length > resolvedMax) {
			const oldest = index.shift();
			if (oldest) {
				const oldArchive = path.join(checkpointsDir, oldest.archivePath);
				await fs.rm(oldArchive, { force: true }).catch(() => {});
			}
		}

		await writeIndex(index);
		return record;
	}

	/**
	 * List all checkpoints, newest first.
	 *
	 * @returns {Promise<CheckpointRecord[]>}
	 */
	async function list() {
		const index = await readIndex();
		return index.slice().reverse();
	}

	/**
	 * Rollback workspace to a checkpoint state.
	 *
	 * @param {string} checkpointId
	 */
	async function rollback(checkpointId) {
		const index = await readIndex();
		const record = index.find((r) => r.id === checkpointId);
		if (!record) {
			throw new Error(`Checkpoint not found: ${checkpointId}`);
		}

		const archivePath = path.join(checkpointsDir, record.archivePath);
		try {
			await fs.access(archivePath);
		} catch {
			throw new Error(`Checkpoint archive not found: ${record.archivePath}`);
		}

		const restoreDir = await fs.mkdtemp(path.join(checkpointsDir, ".restore-"));
		try {
			await execFileAsync("tar", [
				"xzf",
				archivePath,
				"-C",
				restoreDir,
			]);

			const currentEntries = await fs.readdir(baseDir, { withFileTypes: true });
			for (const entry of currentEntries) {
				if (entry.name === CHECKPOINTS_DIR_NAME) {
					continue;
				}
				await fs.rm(path.join(baseDir, entry.name), {
					force: true,
					recursive: true,
				});
			}

			const snapshotEntries = await fs.readdir(restoreDir, { withFileTypes: true });
			for (const entry of snapshotEntries) {
				await fs.cp(
					path.join(restoreDir, entry.name),
					path.join(baseDir, entry.name),
					{
						force: true,
						recursive: true,
					},
				);
			}
		} finally {
			await fs.rm(restoreDir, { force: true, recursive: true }).catch(() => {});
		}

		return record;
	}

	/**
	 * Delete a checkpoint.
	 *
	 * @param {string} checkpointId
	 */
	async function deleteCheckpoint(checkpointId) {
		const index = await readIndex();
		const recordIndex = index.findIndex((r) => r.id === checkpointId);
		if (recordIndex === -1) {
			return null;
		}

		const record = index[recordIndex];
		index.splice(recordIndex, 1);
		await writeIndex(index);

		const archivePath = path.join(checkpointsDir, record.archivePath);
		await fs.rm(archivePath, { force: true }).catch(() => {});

		return record;
	}

	return {
		create,
		list,
		rollback,
		delete: deleteCheckpoint,
	};
}

module.exports = {
	createCheckpointManager,
};
