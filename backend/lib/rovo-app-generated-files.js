const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");

const {
	buildRovoAppThreadPaths,
	buildRovoAppWorkspacePath,
	buildRovoAppWorkspaceRelativePath,
	normalizeRepoRelativePath,
} = require("./rovo-app-storage-paths");
const { getNonEmptyString, isPlainObject } = require("./shared-utils");

const WRITE_TOOL_NAMES = new Set([
	"create_file",
	"write_to_file",
	"find_and_replace_code",
	"move_file",
	"delete_file",
]);

const PATH_KEYS = [
	"path",
	"file_path",
	"old_path",
	"new_path",
	"source_path",
	"destination_path",
	"target_path",
];

// The project directories generated files are written to (the same prefixes the text
// scan below accepts). A manifest entry outside them is never moved, copied or deleted.
const GENERATED_FILE_ROOTS = Object.freeze(["app", "components", "lib", "hooks", "types", "public", "styles"]);
const EXCLUDED_SEGMENTS = new Set(["node_modules"]);

const FILE_PATH_PATTERN =
	/(?:app|components|lib|hooks|types|public|styles)\/[^\s"'`]+?\.(?:tsx|ts|jsx|js|css|md|json|svg|png|jpg|jpeg|webp|txt|yaml|yml)/gu;

function safeJsonParse(rawValue) {
	try {
		return JSON.parse(rawValue);
	} catch {
		return null;
	}
}

function normalizeGeneratedFileEntry(rawEntry) {
	if (!rawEntry || typeof rawEntry !== "object") {
		return null;
	}

	const requestedPath = normalizeRepoRelativePath(rawEntry.requestedPath);
	if (!requestedPath) {
		return null;
	}

	const workspacePath =
		buildRovoAppWorkspaceRelativePath(requestedPath)
		|| getNonEmptyString(rawEntry.workspacePath);
	return {
		requestedPath,
		workspacePath,
		ownershipSource:
			getNonEmptyString(rawEntry.ownershipSource) || "tool_result",
		toolName: getNonEmptyString(rawEntry.toolName),
		toolCallId: getNonEmptyString(rawEntry.toolCallId),
		firstObservedAt:
			getNonEmptyString(rawEntry.firstObservedAt) || new Date().toISOString(),
		lastObservedAt:
			getNonEmptyString(rawEntry.lastObservedAt)
			|| getNonEmptyString(rawEntry.firstObservedAt)
			|| new Date().toISOString(),
	};
}

function collectPathsFromText(text, foundPaths) {
	if (typeof text !== "string" || !text.trim()) {
		return;
	}

	const matches = text.match(FILE_PATH_PATTERN) || [];
	for (const match of matches) {
		const normalizedPath = normalizeRepoRelativePath(match);
		if (normalizedPath) {
			foundPaths.add(normalizedPath);
		}
	}
}

function collectPathsFromUnknown(value, foundPaths, depth = 0) {
	if (value === null || value === undefined || depth > 3) {
		return;
	}

	if (typeof value === "string") {
		collectPathsFromText(value, foundPaths);
		return;
	}

	if (Array.isArray(value)) {
		for (const entry of value.slice(0, 20)) {
			collectPathsFromUnknown(entry, foundPaths, depth + 1);
		}
		return;
	}

	if (!isPlainObject(value)) {
		return;
	}

	for (const key of PATH_KEYS) {
		const normalizedPath = normalizeRepoRelativePath(value[key]);
		if (normalizedPath) {
			foundPaths.add(normalizedPath);
		}
	}

	for (const nestedValue of Object.values(value).slice(0, 20)) {
		collectPathsFromUnknown(nestedValue, foundPaths, depth + 1);
	}
}

function extractGeneratedFilesFromObservation(observation) {
	if (!observation || typeof observation !== "object") {
		return [];
	}

	const toolName = getNonEmptyString(observation.toolName);
	if (!toolName || !WRITE_TOOL_NAMES.has(toolName)) {
		return [];
	}

	const phase = getNonEmptyString(observation.phase);
	if (phase !== "result") {
		return [];
	}

	const foundPaths = new Set();
	collectPathsFromUnknown(observation.rawOutput, foundPaths);
	collectPathsFromUnknown(observation.output, foundPaths);
	collectPathsFromUnknown(observation.outputPreview, foundPaths);
	collectPathsFromText(observation.text, foundPaths);

	const observedAt = getNonEmptyString(observation.timestamp) || new Date().toISOString();
	return [...foundPaths].map((requestedPath) =>
		normalizeGeneratedFileEntry({
			requestedPath,
			workspacePath: buildRovoAppWorkspaceRelativePath(requestedPath),
			ownershipSource: observation.rawOutput && typeof observation.rawOutput === "object"
				? "tool_raw_output"
				: "tool_result",
			toolName,
			toolCallId: observation.toolCallId,
			firstObservedAt: observedAt,
			lastObservedAt: observedAt,
		})
	).filter(Boolean);
}

function extractGeneratedFilesFromThread(thread) {
	if (!thread || typeof thread !== "object" || !Array.isArray(thread.messages)) {
		return [];
	}

	return extractGeneratedFilesFromMessages(thread.messages);
}

function extractGeneratedFilesFromMessages(messages) {
	if (!Array.isArray(messages)) {
		return [];
	}

	const entries = [];
	for (const message of messages) {
		if (!message || typeof message !== "object" || !Array.isArray(message.parts)) {
			continue;
		}

		for (const part of message.parts) {
			if (!part || part.type !== "data-thinking-event" || !isPlainObject(part.data)) {
				continue;
			}

			entries.push(...extractGeneratedFilesFromObservation(part.data));
		}
	}

	return entries;
}

/**
 * The message parts this run produced: every part of a message the request did not carry,
 * and the parts appended to a message it did (a continued assistant message). History a
 * client sent with the request is never a source of generated-file records.
 * @param {unknown} initialMessages what the request carried
 * @param {unknown} finalMessages what the run ended with
 * @returns {Array<{ parts: unknown[] }>}
 */
function selectRunProducedMessages(initialMessages, finalMessages) {
	if (!Array.isArray(finalMessages)) {
		return [];
	}
	/** @type {Map<string, number>} */
	const initialPartCounts = new Map();
	for (const message of Array.isArray(initialMessages) ? initialMessages : []) {
		const id = getNonEmptyString(message?.id);
		if (id) {
			initialPartCounts.set(id, Array.isArray(message.parts) ? message.parts.length : 0);
		}
	}
	const produced = [];
	for (const message of finalMessages) {
		if (!message || typeof message !== "object" || !Array.isArray(message.parts)) {
			continue;
		}
		const id = getNonEmptyString(message.id);
		if (id && initialPartCounts.has(id)) {
			const parts = message.parts.slice(initialPartCounts.get(id));
			if (parts.length > 0) produced.push({ parts });
			continue;
		}
		if (!id && initialPartCounts.size > 0) {
			// Without an id the message cannot be told apart from the request's history.
			continue;
		}
		produced.push({ parts: message.parts });
	}
	return produced;
}

function createRovoAppGeneratedFilesManager({
	baseDir,
	projectRoot,
	logger = console,
	execFileImpl = execFile,
} = {}) {
	const resolvedProjectRoot = path.resolve(projectRoot);

	const readManifest = async (threadId) => {
		const { generatedFilesPath } = buildRovoAppThreadPaths(baseDir, threadId);

		try {
			const raw = await fs.readFile(generatedFilesPath, "utf8");
			const parsed = safeJsonParse(raw);
			if (!Array.isArray(parsed)) {
				return [];
			}

			return parsed.map(normalizeGeneratedFileEntry).filter(Boolean);
		} catch (error) {
			if (error && error.code === "ENOENT") {
				return [];
			}

			throw error;
		}
	};

	const writeManifest = async (threadId, entries) => {
		const { generatedFilesPath } = buildRovoAppThreadPaths(baseDir, threadId);
		await fs.mkdir(path.dirname(generatedFilesPath), { recursive: true });
		await fs.writeFile(
			generatedFilesPath,
			`${JSON.stringify(entries, null, 2)}\n`,
			"utf8",
		);
	};

	const upsertGeneratedFiles = async (threadId, entries) => {
		const normalizedEntries = Array.isArray(entries)
			? entries.map(normalizeGeneratedFileEntry).filter(Boolean)
			: [];
		if (normalizedEntries.length === 0) {
			return readManifest(threadId);
		}

		const existingEntries = await readManifest(threadId);
		const entriesByPath = new Map(
			existingEntries.map((entry) => [entry.requestedPath, entry]),
		);

		for (const nextEntry of normalizedEntries) {
			const existingEntry = entriesByPath.get(nextEntry.requestedPath);
			if (!existingEntry) {
				entriesByPath.set(nextEntry.requestedPath, nextEntry);
				continue;
			}

			entriesByPath.set(nextEntry.requestedPath, {
				...existingEntry,
				ownershipSource: existingEntry.ownershipSource || nextEntry.ownershipSource,
				toolName: existingEntry.toolName || nextEntry.toolName,
				toolCallId: existingEntry.toolCallId || nextEntry.toolCallId,
				workspacePath: existingEntry.workspacePath || nextEntry.workspacePath,
				firstObservedAt: existingEntry.firstObservedAt || nextEntry.firstObservedAt,
				lastObservedAt: nextEntry.lastObservedAt || existingEntry.lastObservedAt,
			});
		}

		const mergedEntries = [...entriesByPath.values()].sort((left, right) =>
			left.requestedPath.localeCompare(right.requestedPath),
		);
		await writeManifest(threadId, mergedEntries);
		return mergedEntries;
	};

	// Records the files a run's own tool results name. `producedMessages` must come from
	// the run's stream (selectRunProducedMessages), never from a stored thread, whose
	// messages a client can write.
	const recordRunGeneratedFiles = async (threadId, producedMessages) => {
		const normalizedThreadId = getNonEmptyString(threadId);
		if (!normalizedThreadId) {
			return [];
		}

		return upsertGeneratedFiles(normalizedThreadId, extractGeneratedFilesFromMessages(producedMessages));
	};

	const seedGeneratedFiles = async (
		threadId,
		requestedPaths,
		ownershipSource = "legacy_user_confirmed",
	) => {
		const seededEntries = Array.isArray(requestedPaths)
			? requestedPaths.map((requestedPath) =>
				normalizeGeneratedFileEntry({
					requestedPath,
					workspacePath: buildRovoAppWorkspaceRelativePath(requestedPath),
					ownershipSource,
				})
			).filter(Boolean)
			: [];

		return upsertGeneratedFiles(threadId, seededEntries);
	};

	// Only git's own "not tracked" answer (exit 1) counts as untracked. Any other result
	// (not a repository, git missing, a failure) is unknown and treated as tracked, so the
	// file is left alone.
	const isGitTracked = async (requestedPath) =>
		new Promise((resolve) => {
			execFileImpl(
				"git",
				["ls-files", "--error-unmatch", "--", requestedPath],
				{ cwd: resolvedProjectRoot, maxBuffer: 1024 * 1024 },
				(error) => {
					resolve(!(error && error.code === 1));
				},
			);
		});

	/**
	 * Where a manifest entry may be touched: a regular file under one of
	 * GENERATED_FILE_ROOTS, reached through real directories only (no symlink in any
	 * segment), with every segment matching the directory entry's exact case, and whose
	 * real path is that path. Anything else is skipped with its reason.
	 * @param {unknown} requestedPath
	 * @returns {Promise<{ ok: true, normalizedPath: string, absolutePath: string } | { ok: false, reason: string }>}
	 */
	const resolveGeneratedFile = async (requestedPath) => {
		const normalizedPath = normalizeRepoRelativePath(requestedPath);
		if (!normalizedPath) {
			return { ok: false, reason: "not a repo-relative path" };
		}
		const segments = normalizedPath.split("/");
		if (!GENERATED_FILE_ROOTS.includes(segments[0]) || segments.length < 2) {
			return { ok: false, reason: "outside the generated-file directories" };
		}
		if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment) || segment.startsWith("."))) {
			return { ok: false, reason: "in an excluded directory" };
		}
		let currentPath = resolvedProjectRoot;
		for (const [index, segment] of segments.entries()) {
			let entries;
			try {
				entries = await fs.readdir(currentPath);
			} catch {
				return { ok: false, reason: "a parent directory cannot be read" };
			}
			if (!entries.includes(segment)) {
				return { ok: false, reason: "no entry with this exact name" };
			}
			currentPath = path.join(currentPath, segment);
			const stat = await fs.lstat(currentPath).catch(() => null);
			if (!stat || stat.isSymbolicLink()) {
				return { ok: false, reason: "a symbolic link or a missing entry in the path" };
			}
			const isLast = index === segments.length - 1;
			if (isLast ? !stat.isFile() : !stat.isDirectory()) {
				return { ok: false, reason: isLast ? "not a regular file" : "a parent is not a directory" };
			}
		}
		const [realRoot, realFile] = await Promise.all([
			fs.realpath(resolvedProjectRoot).catch(() => null),
			fs.realpath(currentPath).catch(() => null),
		]);
		if (!realRoot || realFile !== path.join(realRoot, ...segments)) {
			return { ok: false, reason: "the real path leaves the project" };
		}
		return { ok: true, normalizedPath, absolutePath: currentPath };
	};

	const logSkipped = (action, threadId, requestedPath, reason) => {
		logger.warn?.(`[FUTURE-CHAT] Skipping generated file ${action} for thread ${threadId}: ${reason}`, {
			requestedPath: typeof requestedPath === "string" ? requestedPath.slice(0, 300) : null,
		});
	};

	const removeEmptyParentDirectories = async (startingDir) => {
		let currentDir = startingDir;

		while (
			currentDir.startsWith(`${resolvedProjectRoot}${path.sep}`)
			&& currentDir !== resolvedProjectRoot
		) {
			try {
				const entries = await fs.readdir(currentDir);
				if (entries.length > 0) {
					return;
				}
				await fs.rmdir(currentDir);
				currentDir = path.dirname(currentDir);
			} catch {
				return;
			}
		}
	};

	const moveRootFileToWorkspace = async (threadId, requestedPath) => {
		const target = await resolveGeneratedFile(requestedPath);
		if (!target.ok) {
			logSkipped("move", threadId, requestedPath, target.reason);
			return false;
		}
		const { normalizedPath, absolutePath: sourcePath } = target;
		const destinationPath = buildRovoAppWorkspacePath(baseDir, threadId, normalizedPath);
		if (!destinationPath) {
			return false;
		}

		if (await isGitTracked(normalizedPath)) {
			logger.info?.(`[FUTURE-CHAT] Skipping tracked generated file migration: ${normalizedPath}`);
			return false;
		}

		await fs.mkdir(path.dirname(destinationPath), { recursive: true });
		await fs.rm(destinationPath, { force: true });

		try {
			await fs.rename(sourcePath, destinationPath);
		} catch (error) {
			if (error && error.code !== "EXDEV") {
				throw error;
			}

			await fs.copyFile(sourcePath, destinationPath);
			await fs.rm(sourcePath, { force: true });
		}

		await removeEmptyParentDirectories(path.dirname(sourcePath));
		return true;
	};

	const copyRootFileToWorkspace = async (threadId, requestedPath) => {
		const target = await resolveGeneratedFile(requestedPath);
		if (!target.ok) {
			logSkipped("copy", threadId, requestedPath, target.reason);
			return false;
		}
		const { normalizedPath, absolutePath: sourcePath } = target;
		const destinationPath = buildRovoAppWorkspacePath(baseDir, threadId, normalizedPath);
		if (!destinationPath) {
			return false;
		}

		await fs.mkdir(path.dirname(destinationPath), { recursive: true });
		await fs.copyFile(sourcePath, destinationPath);
		return true;
	};

	// A manifest that cannot be read is treated as empty for cleanup, so one thread's
	// broken or planted manifest never makes its delete (or delete-all) fail.
	const readManifestForCleanup = async (threadId, action) => {
		try {
			return await readManifest(threadId);
		} catch (error) {
			logSkipped(action, threadId, null, `manifest unreadable (${error instanceof Error ? error.message : String(error)})`);
			return [];
		}
	};

	const forEachEntry = async (threadId, action, run) => {
		let count = 0;
		for (const entry of await readManifestForCleanup(threadId, action)) {
			try {
				if (await run(entry)) count += 1;
			} catch (error) {
				logSkipped(action, threadId, entry.requestedPath, error instanceof Error ? error.message : String(error));
			}
		}
		return count;
	};

	const syncThreadWorkspace = async (threadId) => {
		const movedCount = await forEachEntry(threadId, "move", (entry) => moveRootFileToWorkspace(threadId, entry.requestedPath));
		return { movedCount, entries: await readManifestForCleanup(threadId, "move") };
	};

	const captureRootFilesToWorkspace = async (threadId) => {
		const copiedCount = await forEachEntry(threadId, "copy", (entry) => copyRootFileToWorkspace(threadId, entry.requestedPath));
		return { copiedCount, entries: await readManifestForCleanup(threadId, "copy") };
	};

	// Removes the untracked root files this thread's runs recorded. Never throws.
	const deleteLegacyRootFiles = async (threadId) =>
		forEachEntry(threadId, "delete", async (entry) => {
			const target = await resolveGeneratedFile(entry.requestedPath);
			if (!target.ok) {
				logSkipped("delete", threadId, entry.requestedPath, target.reason);
				return false;
			}
			if (await isGitTracked(target.normalizedPath)) {
				return false;
			}
			await fs.rm(target.absolutePath, { force: true });
			await removeEmptyParentDirectories(path.dirname(target.absolutePath));
			return true;
		});

	return {
		readManifest,
		upsertGeneratedFiles,
		recordRunGeneratedFiles,
		seedGeneratedFiles,
		captureRootFilesToWorkspace,
		syncThreadWorkspace,
		deleteLegacyRootFiles,
	};
}

module.exports = {
	GENERATED_FILE_ROOTS,
	WRITE_TOOL_NAMES,
	createRovoAppGeneratedFilesManager,
	extractGeneratedFilesFromObservation,
	extractGeneratedFilesFromMessages,
	extractGeneratedFilesFromThread,
	selectRunProducedMessages,
};
