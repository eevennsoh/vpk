const crypto = require("node:crypto");
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

// The project directories generated files are written to. A manifest entry outside them
// is never copied or deleted.
const GENERATED_FILE_ROOTS = Object.freeze(["app", "components", "lib", "hooks", "types", "public", "styles"]);
const EXCLUDED_SEGMENTS = new Set(["node_modules"]);

// Provisional bounds: a run records at most MAX_FILES_PER_RUN files and a thread's manifest
// holds at most MAX_MANIFEST_ENTRIES (the oldest drop out, logged). A recorded file is
// hashed only up to MAX_IDENTITY_BYTES. Each git call gets GIT_CALL_TIMEOUT_MS, and one
// cleanup (a thread delete, delete-all, a capture) stops after CLEANUP_DEADLINE_MS.
const MAX_FILES_PER_RUN = 200;
const MAX_MANIFEST_ENTRIES = 1000;
const MAX_IDENTITY_BYTES = 5 * 1024 * 1024;
const GIT_CALL_TIMEOUT_MS = 5_000;
const GIT_LIST_MAX_BUFFER = 64 * 1024 * 1024;
const CLEANUP_DEADLINE_MS = 15_000;

// Rovo Dev's file tools report in fixed sentences (checked against recorded Rovo Dev
// sessions): create_file says "Successfully created <path>." for a new file and
// "Successfully updated <path>." when it overwrote one; find_and_replace_code starts with
// "Successfully replaced code in <path>:" and then a diff. A failure is an error text, a
// readonly-mode notice or "Tool call interrupted.", and matches none of these. Only a
// create (or a move's destination) adds a file; an update or a replace only refreshes the
// identity of a file this thread already created.
const CREATED_RESULT = /^Successfully created (\S+?)\.?$/u;
const MOVED_RESULT = /^Successfully moved \S+? to (\S+?)\.?$/u;
const UPDATED_RESULT = /^Successfully updated (\S+?)\.?$/u;
const REPLACED_RESULT = /^Successfully replaced code in (\S+?):(?:\n|$)/u;

function safeJsonParse(rawValue) {
	try {
		return JSON.parse(rawValue);
	} catch {
		return null;
	}
}

function normalizeIdentity(rawIdentity) {
	if (!isPlainObject(rawIdentity)) return null;
	const { sha256, size } = rawIdentity;
	return typeof sha256 === "string" && /^[0-9a-f]{64}$/u.test(sha256) && Number.isInteger(size) && size >= 0
		? { sha256, size }
		: null;
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
		identity: normalizeIdentity(rawEntry.identity),
	};
}

// A repo-relative path, also from an absolute path inside the project.
function toProjectRelativePath(rawPath, projectRoot) {
	if (typeof rawPath !== "string") return null;
	if (projectRoot && path.isAbsolute(rawPath)) {
		const relativePath = path.relative(projectRoot, rawPath);
		if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) return null;
		return normalizeRepoRelativePath(relativePath.split(path.sep).join("/"));
	}
	return normalizeRepoRelativePath(rawPath);
}

// A tool call's input, as a start event carries it (an object, or its JSON text; the text
// is a cut preview, so a long call's input often does not parse).
function readToolInput(startObservation) {
	const input = startObservation?.input;
	if (isPlainObject(input)) return input;
	if (typeof input === "string") {
		const parsed = safeJsonParse(input);
		return isPlainObject(parsed) ? parsed : null;
	}
	return null;
}

function matchResultText(observation, pattern) {
	for (const text of [observation.output, observation.outputPreview]) {
		if (typeof text !== "string") continue;
		const match = text.trim().match(pattern);
		if (match) return match[1];
	}
	return null;
}

/**
 * What one write tool's result says it did to one file: `created` (a new file, or a move's
 * destination) or `refreshed` (an update or replace of an existing file). Nothing for a
 * failed result, a delete, a move's source or any text that is not the tool's own sentence.
 * @param {Record<string, unknown>} observation a `phase: "result"` thinking event
 * @param {Record<string, unknown> | null} [startObservation] the same call's start event
 * @param {{ projectRoot?: string }} [options]
 * @returns {Array<ReturnType<typeof normalizeGeneratedFileEntry> & { change: "created" | "refreshed" }>}
 */
function extractGeneratedFilesFromObservation(observation, startObservation = null, { projectRoot } = {}) {
	if (!observation || typeof observation !== "object" || getNonEmptyString(observation.phase) !== "result") {
		return [];
	}
	const toolName = getNonEmptyString(observation.toolName);
	let change = null;
	let rawPath = null;
	if (toolName === "create_file" || toolName === "write_to_file") {
		rawPath = matchResultText(observation, CREATED_RESULT);
		change = rawPath ? "created" : null;
		if (!rawPath) {
			rawPath = matchResultText(observation, UPDATED_RESULT);
			change = rawPath ? "refreshed" : null;
		}
	} else if (toolName === "move_file") {
		rawPath = matchResultText(observation, MOVED_RESULT);
		change = rawPath ? "created" : null;
	} else if (toolName === "find_and_replace_code") {
		rawPath = matchResultText(observation, REPLACED_RESULT);
		change = rawPath ? "refreshed" : null;
	}
	const requestedPath = toProjectRelativePath(rawPath, projectRoot);
	if (!change || !requestedPath) {
		return [];
	}
	// When the call's input is readable it must name the same file.
	const inputPath = readToolInput(startObservation)?.file_path;
	if (toolName !== "move_file" && typeof inputPath === "string" && toProjectRelativePath(inputPath, projectRoot) !== requestedPath) {
		return [];
	}

	const observedAt = getNonEmptyString(observation.timestamp) || new Date().toISOString();
	const entry = normalizeGeneratedFileEntry({
		requestedPath,
		ownershipSource: "tool_result",
		toolName,
		toolCallId: observation.toolCallId,
		firstObservedAt: observedAt,
		lastObservedAt: observedAt,
	});
	return entry ? [{ ...entry, change }] : [];
}

/**
 * File changes from the messages a run's response stream yielded (never a stored thread or
 * the request's history: a client can write both). At most MAX_FILES_PER_RUN.
 * @param {unknown} streamedMessages
 * @param {{ projectRoot?: string }} [options]
 */
function extractGeneratedFilesFromStreamedMessages(streamedMessages, options = {}) {
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
		entries.push(...extractGeneratedFilesFromObservation(event, callId ? startsByCallId.get(callId) : null, options));
		if (entries.length >= MAX_FILES_PER_RUN) {
			return entries.slice(0, MAX_FILES_PER_RUN);
		}
	}
	return entries;
}

// Git compares paths this way here: Unicode lowercase after NFC, so a tracked file renamed
// on disk to another case (ASCII or not) or another normalization still counts as tracked.
function foldPath(value) {
	return value.normalize("NFC").toLowerCase();
}

function createRovoAppGeneratedFilesManager({
	baseDir,
	projectRoot,
	logger = console,
	execFileImpl = execFile,
	nowImpl = Date.now,
	cleanupDeadlineMs = CLEANUP_DEADLINE_MS,
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

	const logSkipped = (action, threadId, requestedPath, reason) => {
		logger.warn?.(`[FUTURE-CHAT] Skipping generated file ${action} for thread ${threadId}: ${reason}`, {
			requestedPath: typeof requestedPath === "string" ? requestedPath.slice(0, 300) : null,
		});
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

	// The content a file had when its run finished: cleanup acts on it only while it still
	// has that content, so a file changed since (or one that was never this run's) is kept.
	const readIdentity = async (absolutePath) => {
		const stat = await fs.lstat(absolutePath).catch(() => null);
		if (!stat || !stat.isFile() || stat.size > MAX_IDENTITY_BYTES) return null;
		const content = await fs.readFile(absolutePath).catch(() => null);
		if (!content) return null;
		return { sha256: crypto.createHash("sha256").update(content).digest("hex"), size: content.length };
	};

	/**
	 * Records the files a run's own tool results created, with each file's identity when
	 * the run finished, and refreshes the identity of a file this thread created that the
	 * run then updated. `streamedMessages` are the messages the run's response stream
	 * yielded (collectUiMessagesFromResponseStream), never a stored thread or the request.
	 */
	const recordRunGeneratedFiles = async (threadId, streamedMessages) => {
		const normalizedThreadId = getNonEmptyString(threadId);
		if (!normalizedThreadId) {
			return [];
		}
		const changes = extractGeneratedFilesFromStreamedMessages(streamedMessages, { projectRoot: resolvedProjectRoot });
		if (changes.length === 0) {
			return readManifest(normalizedThreadId);
		}

		const entriesByPath = new Map((await readManifest(normalizedThreadId)).map((entry) => [entry.requestedPath, entry]));
		for (const { change, ...entry } of changes) {
			const existing = entriesByPath.get(entry.requestedPath);
			if (change === "refreshed" && !existing) {
				continue;
			}
			const target = await resolveGeneratedFile(entry.requestedPath);
			const identity = target.ok ? await readIdentity(target.absolutePath) : null;
			if (!identity) {
				logSkipped("record", normalizedThreadId, entry.requestedPath, target.ok ? "no identity (empty, too large or unreadable)" : target.reason);
				continue;
			}
			entriesByPath.set(entry.requestedPath, existing
				? { ...existing, identity, lastObservedAt: entry.lastObservedAt }
				: { ...entry, identity });
		}

		// Oldest first out when the manifest is full; a dropped entry is never cleaned up.
		const ordered = [...entriesByPath.values()]
			.sort((left, right) => String(left.lastObservedAt).localeCompare(String(right.lastObservedAt)));
		const dropped = ordered.length - MAX_MANIFEST_ENTRIES;
		if (dropped > 0) {
			logger.warn?.(`[FUTURE-CHAT] Generated-file manifest for thread ${normalizedThreadId} is full: forgetting the ${dropped} oldest entries; those files are no longer cleaned up with the thread.`);
		}
		const mergedEntries = ordered
			.slice(-MAX_MANIFEST_ENTRIES)
			.sort((left, right) => left.requestedPath.localeCompare(right.requestedPath));
		await writeManifest(normalizedThreadId, mergedEntries);
		return mergedEntries;
	};

	// Runs one git query; resolves with { code, stdout }, or null for any failure (git
	// missing, a timeout, an oversized answer), which callers treat as "do not touch".
	const runGitQuery = (args, { input } = {}) =>
		new Promise((resolve) => {
			let child;
			try {
				child = execFileImpl(
					"git",
					args,
					{ cwd: resolvedProjectRoot, encoding: "buffer", maxBuffer: GIT_LIST_MAX_BUFFER, timeout: GIT_CALL_TIMEOUT_MS },
					(error, stdout) => {
						const output = Buffer.isBuffer(stdout) ? stdout.toString("utf8") : String(stdout ?? "");
						if (!error) {
							resolve({ code: 0, stdout: output });
							return;
						}
						resolve(typeof error.code === "number" && !error.killed ? { code: error.code, stdout: output } : null);
					},
				);
			} catch {
				resolve(null);
				return;
			}
			if (input !== undefined) {
				child?.stdin?.on?.("error", () => {});
				child?.stdin?.end?.(input);
			}
		});

	/**
	 * One git view for one cleanup: the tracked files (one `ls-files -z`) and which of the
	 * candidates are ignored (one `check-ignore --stdin -z`). A candidate is safe to touch
	 * only when both answers came back and it is neither. Any failure makes nothing safe.
	 * @param {string[]} candidatePaths
	 * @returns {Promise<(requestedPath: string) => boolean>}
	 */
	const loadGitView = async (candidatePaths) => {
		if (candidatePaths.length === 0) return () => false;
		const listed = await runGitQuery(["ls-files", "-z"]);
		if (!listed || listed.code !== 0) return () => false;
		const tracked = new Set(listed.stdout.split("\0").filter(Boolean).map(foldPath));
		const checked = await runGitQuery(["check-ignore", "--stdin", "-z"], { input: `${candidatePaths.join("\0")}\0` });
		if (!checked || (checked.code !== 0 && checked.code !== 1)) return () => false;
		const ignored = new Set(checked.stdout.split("\0").filter(Boolean));
		return (requestedPath) => !tracked.has(foldPath(requestedPath)) && !ignored.has(requestedPath);
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

	/**
	 * One cleanup over some threads' manifests: each entry must resolve under the rules and
	 * still have its recorded identity; then one git view decides, and `act` runs for each
	 * safe file. Stops at the deadline (the rest is left and logged). Never throws.
	 * @param {string[]} threadIds
	 * @param {string} action
	 * @param {(threadId: string, target: { normalizedPath: string, absolutePath: string }) => Promise<boolean>} act
	 * @param {{ deadlineAt?: number }} [options]
	 */
	const runCleanup = async (threadIds, action, act, { deadlineAt = nowImpl() + cleanupDeadlineMs } = {}) => {
		let count = 0;
		const candidates = [];
		let stoppedAt = null;
		try {
			outer: for (const threadId of threadIds) {
				for (const entry of await readManifestForCleanup(threadId, action)) {
					if (nowImpl() > deadlineAt) {
						stoppedAt = "checking entries";
						break outer;
					}
					try {
						if (!entry.identity) {
							logSkipped(action, threadId, entry.requestedPath, "no recorded identity");
							continue;
						}
						const target = await resolveGeneratedFile(entry.requestedPath);
						if (!target.ok) {
							logSkipped(action, threadId, entry.requestedPath, target.reason);
							continue;
						}
						const identity = await readIdentity(target.absolutePath);
						if (!identity || identity.sha256 !== entry.identity.sha256 || identity.size !== entry.identity.size) {
							logSkipped(action, threadId, entry.requestedPath, "changed since its run recorded it");
							continue;
						}
						candidates.push({ threadId, target });
					} catch (error) {
						logSkipped(action, threadId, entry.requestedPath, error instanceof Error ? error.message : String(error));
					}
				}
			}
			const isSafe = await loadGitView([...new Set(candidates.map(({ target }) => target.normalizedPath))]);
			for (const { threadId, target } of candidates) {
				if (nowImpl() > deadlineAt) {
					stoppedAt = stoppedAt ?? "acting on entries";
					break;
				}
				if (!isSafe(target.normalizedPath)) {
					logSkipped(action, threadId, target.normalizedPath, "tracked, ignored, or git gave no answer");
					continue;
				}
				try {
					if (await act(threadId, target)) count += 1;
				} catch (error) {
					logSkipped(action, threadId, target.normalizedPath, error instanceof Error ? error.message : String(error));
				}
			}
		} catch (error) {
			logSkipped(action, threadIds.join(","), null, error instanceof Error ? error.message : String(error));
		}
		if (stoppedAt) {
			logger.warn?.(`[FUTURE-CHAT] Generated file ${action} stopped at its deadline while ${stoppedAt}; the remaining files were left in place.`);
		}
		return count;
	};

	// Snapshots this thread's recorded files into its workspace (the project copy stays).
	const captureRootFilesToWorkspace = async (threadId) => {
		const copiedCount = await runCleanup([threadId], "copy", async (ownerThreadId, { normalizedPath, absolutePath }) => {
			const destinationPath = buildRovoAppWorkspacePath(baseDir, ownerThreadId, normalizedPath);
			if (!destinationPath) return false;
			await fs.mkdir(path.dirname(destinationPath), { recursive: true });
			await fs.copyFile(absolutePath, destinationPath);
			return true;
		});
		return { copiedCount, entries: await readManifestForCleanup(threadId, "copy") };
	};

	const deleteFile = async (_threadId, { absolutePath }) => {
		await fs.rm(absolutePath, { force: true });
		await removeEmptyParentDirectories(path.dirname(absolutePath));
		return true;
	};

	// Removes the untracked root files this thread's runs created and nobody changed since.
	// Never throws. `deadlineAt` lets one caller (delete-all) share one deadline.
	const deleteLegacyRootFiles = async (threadId, options = {}) => runCleanup([threadId], "delete", deleteFile, options);

	// delete-all: every thread in one cleanup, with one git view and one deadline.
	const deleteGeneratedFilesForThreads = async (threadIds, options = {}) =>
		runCleanup(Array.isArray(threadIds) ? threadIds.filter((threadId) => getNonEmptyString(threadId)) : [], "delete", deleteFile, options);

	return {
		readManifest,
		recordRunGeneratedFiles,
		captureRootFilesToWorkspace,
		deleteLegacyRootFiles,
		deleteGeneratedFilesForThreads,
	};
}

module.exports = {
	CLEANUP_DEADLINE_MS,
	GENERATED_FILE_ROOTS,
	MAX_FILES_PER_RUN,
	MAX_IDENTITY_BYTES,
	MAX_MANIFEST_ENTRIES,
	WRITE_TOOL_NAMES,
	createRovoAppGeneratedFilesManager,
	extractGeneratedFilesFromObservation,
	extractGeneratedFilesFromStreamedMessages,
};
