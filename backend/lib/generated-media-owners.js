"use strict";

const { AsyncLocalStorage } = require("node:async_hooks");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const { resolveGeneratedMediaAbsolutePath } = require("./generated-media");
const { normalizeRepoRelativePath } = require("./rovo-app-storage-paths");

// A claim is made while a chat turn builds the video's preview, right after the tool wrote
// the file. A file older than this was not just generated, so nobody can claim it later
// (a video from before owners, or one whose path a caller only typed).
const CLAIM_MAX_FILE_AGE_MS = 15 * 60 * 1000;

/**
 * Who each generated video (a repo-relative path under media/videos) belongs to: the
 * caller whose chat turn produced it. Recorded on the server when the turn builds the
 * video's preview (`recordGeneratedMediaForCurrentScope`), so it never depends on text a
 * caller wrote into a thread, and is in place before the browser first requests the file.
 * The first claim wins. Stored as one JSON file under the backend data dir.
 * @param {{ baseDir: string, projectRoot: string, logger?: Pick<Console, "error">, now?: () => number }} options
 */
function createGeneratedMediaOwnerStore({ baseDir, projectRoot, logger = console, now = Date.now }) {
	const filePath = path.join(baseDir, "rovo-app", "generated-media-owners.json");
	/** @type {Map<string, string> | null} */
	let ownerByPath = null;
	let writeTail = Promise.resolve();

	function load() {
		if (ownerByPath) return ownerByPath;
		ownerByPath = new Map();
		try {
			const stored = JSON.parse(fs.readFileSync(filePath, "utf8"));
			for (const [mediaPath, owner] of Object.entries(stored?.owners ?? {})) {
				if (typeof owner === "string" && owner) ownerByPath.set(mediaPath, owner);
			}
		} catch (error) {
			if (error?.code !== "ENOENT") {
				logger.error?.("[FUTURE-CHAT] Failed to read generated media owners:", error);
			}
		}
		return ownerByPath;
	}

	function persist() {
		const owners = Object.fromEntries(load());
		writeTail = writeTail.then(async () => {
			const tempFilePath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
			try {
				await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
				await fs.promises.writeFile(tempFilePath, `${JSON.stringify({ owners }, null, 2)}\n`, "utf8");
				await fs.promises.rename(tempFilePath, filePath);
			} catch (error) {
				await fs.promises.rm(tempFilePath, { force: true }).catch(() => {});
				logger.error?.("[FUTURE-CHAT] Failed to store generated media owners:", error);
			}
		});
		return writeTail;
	}

	function isFreshFile(mediaPath) {
		const absolutePath = resolveGeneratedMediaAbsolutePath(projectRoot, mediaPath);
		if (!absolutePath) return false;
		try {
			return now() - fs.statSync(absolutePath).mtimeMs <= CLAIM_MAX_FILE_AGE_MS;
		} catch {
			return false;
		}
	}

	/**
	 * Records `owner` for a video that was just generated. Synchronous, so the record is in
	 * place before the preview reaches the browser. True when the video is the owner's.
	 */
	function claim(requestedPath, owner) {
		const mediaPath = normalizeRepoRelativePath(requestedPath);
		if (!mediaPath || typeof owner !== "string" || !owner) return false;
		const owners = load();
		const current = owners.get(mediaPath);
		if (current) return current === owner;
		if (!isFreshFile(mediaPath)) return false;
		owners.set(mediaPath, owner);
		void persist();
		return true;
	}

	/** The owner recorded for a video, or null. */
	function ownerOf(requestedPath) {
		const mediaPath = normalizeRepoRelativePath(requestedPath);
		return mediaPath ? load().get(mediaPath) ?? null : null;
	}

	return { claim, filePath, flush: () => writeTail, ownerOf };
}

/**
 * The caller a chat turn runs for, so code deep in the stream (the video preview builder)
 * can record who a generated video belongs to without every layer passing it along.
 * @type {AsyncLocalStorage<{ owner: string, store: { claim: Function } } | null>}
 */
const generatedMediaScope = new AsyncLocalStorage();

/**
 * Runs `fn` as a turn for `scope` (null: a turn that records no owners, which also clears
 * a scope inherited from whatever started it).
 * @template T
 * @param {{ owner: string, store: { claim: Function } } | null} scope
 * @param {() => T} fn
 * @returns {T}
 */
function runWithGeneratedMediaScope(scope, fn) {
	return generatedMediaScope.run(scope ?? null, fn);
}

/** The scope of the turn running now, to carry into work that runs later (a queued run). */
function currentGeneratedMediaScope() {
	return generatedMediaScope.getStore() ?? null;
}

/** Records the running turn's caller as the owner of a video it just produced. */
function recordGeneratedMediaForCurrentScope(mediaPath) {
	const scope = currentGeneratedMediaScope();
	return scope ? scope.store.claim(mediaPath, scope.owner) : false;
}

module.exports = {
	CLAIM_MAX_FILE_AGE_MS,
	createGeneratedMediaOwnerStore,
	currentGeneratedMediaScope,
	recordGeneratedMediaForCurrentScope,
	runWithGeneratedMediaScope,
};
