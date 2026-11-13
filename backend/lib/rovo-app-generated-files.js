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

// The project directories generated files are written to. A manifest entry outside them
// is never moved, copied or deleted.
const GENERATED_FILE_ROOTS = Object.freeze(["app", "components", "lib", "hooks", "types", "public", "styles"]);
const EXCLUDED_SEGMENTS = new Set(["node_modules"]);

// Provisional caps: a run records at most this many files, a thread's manifest holds at
// most this many, and git gets this long per call before the file counts as tracked.
const MAX_FILES_PER_RUN = 200;
const MAX_MANIFEST_ENTRIES = 1000;
const GIT_CALL_TIMEOUT_MS = 5_000;

// A write tool's text result that names exactly one file and nothing else, as Rovo's
// file tools report it ("Successfully created app/chat/page.tsx."). Text that echoes file
// content or a diff never matches as a whole, so no path is taken from it.
const WRITE_RESULT_SENTENCE =
	/^(?:Successfully\s+)?(?:created|wrote|written|updated|edited|modified|saved|moved\s+\S+\s+to)\s+(?:file\s+)?[`'"]?((?:app|components|lib|hooks|types|public|styles)\/[^\s`'"]+?)[`'"]?\.?$/iu;

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

// Path fields of one object, top level only.
function collectStructuredPaths(value, foundPaths) {
	if (!isPlainObject(value)) {
		return;
	}
	for (const key of PATH_KEYS) {
		const normalizedPath = normalizeRepoRelativePath(value[key]);
		if (normalizedPath) {
			foundPaths.add(normalizedPath);
		}
	}
}

function collectResultSentencePath(text, foundPaths) {
	if (typeof text !== "string") {
		return;
	}
	const match = text.trim().match(WRITE_RESULT_SENTENCE);
	const normalizedPath = match ? normalizeRepoRelativePath(match[1]) : null;
	if (normalizedPath) {
		foundPaths.add(normalizedPath);
	}
}

// A tool call's input, as a start event carries it (an object, or its JSON text).
function readToolInput(startObservation) {
	const input = startObservation?.input;
	if (isPlainObject(input)) return input;
	if (typeof input === "string") {
		const parsed = safeJsonParse(input);
		return isPlainObject(parsed) ? parsed : null;
	}
	return null;
}

/**
 * The files one write tool's result names: the path fields of its call's input and of its
 * structured output, or a result sentence that names exactly one file.
 * @param {Record<string, unknown>} observation a `phase: "result"` thinking event
 * @param {Record<string, unknown> | null} [startObservation] the same call's start event
 */
function extractGeneratedFilesFromObservation(observation, startObservation = null) {
	if (!observation || typeof observation !== "object") {
		return [];
	}

	const toolName = getNonEmptyString(observation.toolName);
	if (!toolName || !WRITE_TOOL_NAMES.has(toolName) || toolName === "delete_file") {
		return [];
	}
	if (getNonEmptyString(observation.phase) !== "result") {
		return [];
	}

	const foundPaths = new Set();
	collectStructuredPaths(readToolInput(startObservation), foundPaths);
	collectStructuredPaths(observation.rawOutput, foundPaths);
	collectStructuredPaths(observation.output, foundPaths);
	collectResultSentencePath(observation.output, foundPaths);
	collectResultSentencePath(observation.outputPreview, foundPaths);

	const observedAt = getNonEmptyString(observation.timestamp) || new Date().toISOString();
	return [...foundPaths].map((requestedPath) =>
		normalizeGeneratedFileEntry({
			requestedPath,
			workspacePath: buildRovoAppWorkspaceRelativePath(requestedPath),
			ownershipSource: "tool_result",
			toolName,
			toolCallId: observation.toolCallId,
			firstObservedAt: observedAt,
			lastObservedAt: observedAt,
		})
	).filter(Boolean);
}

/**
 * Generated-file entries from the messages a run's response stream yielded (never a
 * stored thread or the request's history: a client can write both). At most
 * MAX_FILES_PER_RUN entries.
 * @param {unknown} streamedMessages
 */
function extractGeneratedFilesFromStreamedMessages(streamedMessages) {
	if (!Array.isArray(streamedMessages)) {
		return [];
	}
	const events = [];
	for (const message of streamedMessages) {
		if (!message || typeof message !== "object" || !Array.isArray(message.parts)) continue;
		for (const part of message.parts) {
			if (part && part.type === "data-thinking-event" && isPlainObject(part.data)) {
				events.push(part.data);
			}
		}
	}
	const startsByCallId = new Map();
	for (const event of events) {
		const callId = getNonEmptyString(event.toolCallId);
		if (callId && getNonEmptyString(event.phase) === "start") startsByCallId.set(callId, event);
	}
	const entries = [];
	for (const event of events) {
		const callId = getNonEmptyString(event.toolCallId);
		entries.push(...extractGeneratedFilesFromObservation(event, callId ? startsByCallId.get(callId) : null));
		if (entries.length >= MAX_FILES_PER_RUN) {
			return entries.slice(0, MAX_FILES_PER_RUN);
		}
	}
	return entries;
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

			return parsed.slice(0, MAX_MANIFEST_ENTRIES).map(normalizeGeneratedFileEntry).filter(Boolean);
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

		// Oldest first out when the manifest is full.
		const mergedEntries = [...entriesByPath.values()]
			.sort((left, right) => String(left.lastObservedAt).localeCompare(String(right.lastObservedAt)))
			.slice(-MAX_MANIFEST_ENTRIES)
			.sort((left, right) => left.requestedPath.localeCompare(right.requestedPath));
		await writeManifest(threadId, mergedEntries);
		return mergedEntries;
	};

	// Records the files a run's own tool results name. `streamedMessages` are the messages
	// the run's response stream yielded (collectUiMessagesFromResponseStream), never a
	// stored thread or the request's history, which a client can write.
	const recordRunGeneratedFiles = async (threadId, streamedMessages) => {
		const normalizedThreadId = getNonEmptyString(threadId);
		if (!normalizedThreadId) {
			return [];
		}

		return upsertGeneratedFiles(normalizedThreadId, extractGeneratedFilesFromStreamedMessages(streamedMessages));
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

	// Runs one git query; resolves with its exit code, or null for any failure (git missing,
	// a timeout, not a repository's error), which callers treat as "do not touch".
	const runGitQuery = (args) =>
		new Promise((resolve) => {
			execFileImpl(
				"git",
				args,
				{ cwd: resolvedProjectRoot, maxBuffer: 1024 * 1024, timeout: GIT_CALL_TIMEOUT_MS },
				(error) => {
					if (!error) {
						resolve(0);
						return;
					}
					resolve(typeof error.code === "number" ? error.code : null);
				},
			);
		});

	// Safe to touch only when git says the file is neither tracked (compared without case,
	// so a file renamed to another case on disk still counts) nor ignored. Any other answer
	// leaves it alone.
	const isUntrackedAndNotIgnored = async (requestedPath) => {
		const tracked = await runGitQuery(["ls-files", "--error-unmatch", "--", `:(icase,literal)${requestedPath}`]);
		if (tracked !== 1) {
			return false;
		}
		const ignored = await runGitQuery(["check-ignore", "-q", "--", requestedPath]);
		return ignored === 1;
	};

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
		// A missing file needs no walk.
		if (!(await fs.lstat(path.join(resolvedProjectRoot, ...segments)).catch(() => null))) {
			return { ok: false, reason: "missing" };
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

		if (!(await isUntrackedAndNotIgnored(normalizedPath))) {
			logger.info?.(`[FUTURE-CHAT] Skipping tracked or ignored generated file migration: ${normalizedPath}`);
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
		// The same rule as delete: no tracked or ignored file is copied out of the project.
		if (!(await isUntrackedAndNotIgnored(normalizedPath))) {
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
			if (!(await isUntrackedAndNotIgnored(target.normalizedPath))) {
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
	MAX_FILES_PER_RUN,
	MAX_MANIFEST_ENTRIES,
	WRITE_TOOL_NAMES,
	createRovoAppGeneratedFilesManager,
	extractGeneratedFilesFromObservation,
	extractGeneratedFilesFromStreamedMessages,
};
