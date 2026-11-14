// @ts-check
const fs = require("node:fs/promises");

const {
	buildRovoAppThreadPaths,
	getRovoAppLegacyVotesDir,
	getRovoAppThreadsRootDir,
	normalizeThreadId,
} = require("./rovo-app-storage-paths");
const { isStorageId } = require("./input-schemas");

function safeJsonParse(rawValue) {
	try {
		return JSON.parse(rawValue);
	} catch {
		return null;
	}
}

function createRovoAppVoteManager({ baseDir }) {
	const threadsRootDir = getRovoAppThreadsRootDir(baseDir);
	const legacyVotesRootDir = getRovoAppLegacyVotesDir(baseDir);
	/** @type {Promise<void> | null} */
	let initializationPromise = null;

	const getThreadVotePath = (threadId) =>
		buildRovoAppThreadPaths(baseDir, threadId).votesFilePath;

	const ensureInitialized = async () => {
		if (initializationPromise) {
			return initializationPromise;
		}

		initializationPromise = (async () => {
			let legacyEntries;
			try {
				legacyEntries = await fs.readdir(legacyVotesRootDir, { withFileTypes: true });
			} catch (error) {
				if (error && error.code === "ENOENT") {
					return;
				}
				throw error;
			}

			for (const entry of legacyEntries) {
				if (!entry.isFile() || !entry.name.endsWith(".json")) {
					continue;
				}

				const threadId = normalizeThreadId(
					decodeURIComponent(entry.name.replace(/\.json$/u, "")),
				);
				if (!threadId) {
					continue;
				}

				const legacyPath = `${legacyVotesRootDir}/${entry.name}`;
				try {
					const legacyRaw = await fs.readFile(legacyPath, "utf8");
					const legacyVoteMap = safeJsonParse(legacyRaw);
					const currentVoteMap = await readVoteMap(threadId);
					const nextVoteMap = {
						...(legacyVoteMap && typeof legacyVoteMap === "object" ? legacyVoteMap : {}),
						...currentVoteMap,
					};
					if (Object.keys(nextVoteMap).length > 0) {
						await writeVoteMap(threadId, nextVoteMap);
					}
					await fs.rm(legacyPath, { force: true });
				} catch (error) {
					if (error?.code !== "ENOENT") {
						throw error;
					}
				}
			}

			await fs.rm(legacyVotesRootDir, { recursive: true, force: true });
		})();

		return initializationPromise;
	};

	const readVoteMap = async (threadId) => {
		const normalizedThreadId = normalizeThreadId(threadId);
		if (!normalizedThreadId) {
			return {};
		}

		const filePath = getThreadVotePath(threadId);
		try {
			const raw = await fs.readFile(filePath, "utf8");
			const parsed = safeJsonParse(raw);
			return parsed && typeof parsed === "object" ? parsed : {};
		} catch (error) {
			if (error && error.code === "ENOENT") {
				return {};
			}

			throw error;
		}
	};

	const writeVoteMap = async (threadId, voteMap) => {
		const normalizedThreadId = normalizeThreadId(threadId);
		if (!normalizedThreadId) {
			throw new Error("threadId is required");
		}

		await fs.mkdir(buildRovoAppThreadPaths(baseDir, normalizedThreadId).threadDir, {
			recursive: true,
		});
		await fs.writeFile(
			getThreadVotePath(normalizedThreadId),
			`${JSON.stringify(voteMap, null, 2)}\n`,
			"utf8",
		);
	};

	const listVotes = async (threadId) => {
		await ensureInitialized();
		const voteMap = await readVoteMap(threadId);
		return Object.entries(voteMap).flatMap(([messageId, direction]) => {
			if (direction !== "up" && direction !== "down") {
				return [];
			}

			return [{
				threadId,
				messageId,
				value: direction,
				isUpvoted: direction === "up",
			}];
		});
	};

	const setVote = async ({ threadId, messageId, value }) => {
		await ensureInitialized();
		const normalizedThreadId = normalizeThreadId(threadId);
		if (!normalizedThreadId) {
			throw new Error("threadId is required");
		}

		const voteMap = await readVoteMap(normalizedThreadId);

		if (value !== "up" && value !== "down") {
			delete voteMap[messageId];
		} else {
			voteMap[messageId] = value;
		}

		const hasVotes = Object.keys(voteMap).length > 0;
		if (!hasVotes) {
			await fs.rm(getThreadVotePath(normalizedThreadId), { force: true });
			return { threadId: normalizedThreadId, messageId, value: null, isUpvoted: null };
		}

		await writeVoteMap(normalizedThreadId, voteMap);
		return {
			threadId: normalizedThreadId,
			messageId,
			value: value === "up" || value === "down" ? value : null,
			isUpvoted: value === "up" ? true : value === "down" ? false : null,
		};
	};

	const deleteVotesForThread = async (threadId) => {
		await ensureInitialized();
		const normalizedThreadId = normalizeThreadId(threadId);
		if (!normalizedThreadId) {
			return;
		}

		await fs.rm(getThreadVotePath(normalizedThreadId), { force: true });
	};

	const deleteAllVotes = async () => {
		await ensureInitialized();
		let threadEntries;
		try {
			threadEntries = await fs.readdir(threadsRootDir, { withFileTypes: true });
		} catch (error) {
			if (error?.code !== "ENOENT") {
				throw error;
			}
			threadEntries = [];
		}

		await Promise.all(
			threadEntries
				.filter((entry) => entry.isDirectory() && isStorageId(entry.name))
				.map((entry) => fs.rm(getThreadVotePath(entry.name), { force: true })),
		);
		await fs.rm(legacyVotesRootDir, { recursive: true, force: true });
	};

	return {
		listVotes,
		setVote,
		deleteVotesForThread,
		deleteAllVotes,
	};
}

module.exports = {
	createRovoAppVoteManager,
};
