"use strict";

const { isOwnedByCaller } = require("./caller-identity");
const { normalizeRepoRelativePath } = require("./rovo-app-storage-paths");
const { getRequestCaller } = require("../middleware/caller-identity");

const THREAD_NOT_FOUND = Object.freeze({ error: "Thread not found" });

function firstValue(value) {
	const first = Array.isArray(value) ? value[0] : value;
	return typeof first === "string" && first.trim() ? first.trim() : null;
}

/**
 * Per-caller visibility for the Rovo app's stored threads and the records under them.
 * A thread belongs to the caller who created it (`thread.owner`); a thread with no owner
 * predates owners and only a local caller sees it (lib/caller-identity.js).
 *
 * Another caller's thread answers exactly like a thread that does not exist, so the
 * routes keep their existing not-found shapes; a thread id that is not stored at all
 * passes through untouched, so each route's own handling of a missing thread stays.
 * @param {{ rovoAppThreadManager: object, rovoAppDocumentManager: object, rovoAppUploadManager: object }} managers
 */
function createRovoAppThreadOwnership({
	rovoAppDocumentManager,
	rovoAppThreadManager,
	rovoAppUploadManager,
}) {
	/** @returns {{ owner: string, local: boolean }} */
	const callerOf = (res) => res.locals.vpkCaller;

	function requireCaller(req, res, next) {
		const caller = getRequestCaller(req);
		if (!caller) {
			return res.status(401).json({ error: "Authentication required", code: "CALLER_IDENTITY_REQUIRED" });
		}
		res.locals.vpkCaller = caller;
		return next();
	}

	const ownsThread = (caller, thread) => Boolean(thread) && isOwnedByCaller(thread.owner, caller);

	/** True when the thread is stored and is not the caller's. */
	async function isForeignThread(caller, threadId) {
		if (!threadId) return false;
		const thread = await rovoAppThreadManager.getThread(threadId);
		return Boolean(thread) && !ownsThread(caller, thread);
	}

	/** A `listThreads` filter that keeps the caller's threads (applied before its limit). */
	const ownedBy = (caller) => (thread) => ownsThread(caller, thread);

	/**
	 * Middleware: 404 "Thread not found" when the thread the request names (read by
	 * `pickThreadId`) is someone else's.
	 * @param {(req: import("express").Request) => unknown} pickThreadId
	 */
	function rejectForeignThread(pickThreadId) {
		return async (req, res, next) => {
			try {
				if (await isForeignThread(callerOf(res), firstValue(pickThreadId(req)))) {
					return res.status(404).json(THREAD_NOT_FOUND);
				}
				return next();
			} catch (error) {
				return next(error);
			}
		};
	}

	/**
	 * Whether the caller may see a record that belongs under `threadId`. A record whose
	 * thread is not stored (yet, or any more) is only a local caller's, matching
	 * `filterOwnedDocuments`.
	 */
	async function ownsThreadRecord(caller, threadId) {
		const thread = threadId ? await rovoAppThreadManager.getThread(threadId) : null;
		return thread ? ownsThread(caller, thread) : Boolean(caller?.local);
	}

	/** Middleware: a document the caller cannot see is "Document not found". */
	function rejectForeignDocument(pickDocumentId) {
		return async (req, res, next) => {
			try {
				const documentId = firstValue(pickDocumentId(req));
				if (documentId) {
					const document = await rovoAppDocumentManager.getDocument(documentId);
					if (document && !(await ownsThreadRecord(callerOf(res), document.threadId))) {
						return res.status(404).json({ error: "Document not found" });
					}
				}
				return next();
			} catch (error) {
				return next(error);
			}
		};
	}

	/**
	 * Middleware: an upload the caller cannot see is "File not found". The uploader, when
	 * recorded, decides; otherwise the upload's thread does.
	 */
	async function rejectForeignUpload(req, res, next) {
		try {
			const upload = await rovoAppUploadManager.getUpload(req.params.fileId);
			const caller = callerOf(res);
			const visible = !upload || (upload.owner
				? isOwnedByCaller(upload.owner, caller)
				: await ownsThreadRecord(caller, upload.threadId));
			if (!visible) {
				return res.status(404).json({ error: "File not found" });
			}
			return next();
		} catch (error) {
			return next(error);
		}
	}

	/** The documents the caller can see (see `ownsThreadRecord`). */
	async function filterOwnedDocuments(caller, documents) {
		const list = Array.isArray(documents) ? documents : [];
		const threadIds = [...new Set(list.map((document) => document?.threadId ?? null))];
		const visible = new Set();
		await Promise.all(threadIds.map(async (threadId) => {
			if (await ownsThreadRecord(caller, threadId)) visible.add(threadId);
		}));
		return list.filter((document) => visible.has(document?.threadId ?? null));
	}

	/**
	 * Whether the caller may reach a record that names no thread of its own, only one
	 * found by scanning the stored threads (a Rovo session, a generated media path). A
	 * local caller is the only caller there is, so it reaches them as before, with no
	 * scan; an SLAuth caller needs a thread of theirs that matches.
	 * @param {(thread: Record<string, unknown>) => boolean} matches
	 */
	async function ownsMatchingThread(caller, matches) {
		if (!caller) return false;
		if (caller.local) return true;
		const threads = await rovoAppThreadManager.listThreads({
			filter: (thread) => ownsThread(caller, thread) && matches(thread),
			limit: 1,
		});
		return threads.length > 0;
	}

	/**
	 * Whether a Rovo Serve session is the caller's: a thread of theirs stores it. A session
	 * id restores that whole conversation, so an unbound id is nobody's but a local caller's.
	 */
	function ownsSession(caller, sessionId) {
		return ownsMatchingThread(caller, (thread) => (
			thread.sessionId === sessionId || thread.activeRun?.sessionId === sessionId
		));
	}

	/**
	 * Middleware: 404 "Session not found" when the Rovo session the request names (read by
	 * `pickSessionId`) is not the caller's. A request that names no session passes.
	 * @param {(req: import("express").Request) => unknown} pickSessionId
	 */
	function rejectForeignSession(pickSessionId) {
		return async (req, res, next) => {
			try {
				const sessionId = firstValue(pickSessionId(req));
				if (sessionId && !(await ownsSession(callerOf(res), sessionId))) {
					return res.status(404).json({ error: "Session not found" });
				}
				return next();
			} catch (error) {
				return next(error);
			}
		};
	}

	/**
	 * Whether a generated media file (a repo-relative path under media/videos) is the
	 * caller's: a thread of theirs mentions the path, which is how the file reached a chat.
	 */
	function ownsGeneratedMedia(caller, requestedPath) {
		const mediaPath = normalizeRepoRelativePath(requestedPath);
		if (!mediaPath) return Promise.resolve(false);
		return ownsMatchingThread(caller, (thread) => JSON.stringify(thread).includes(mediaPath));
	}

	/** The runs whose thread the caller owns. */
	async function filterOwnedRuns(caller, runs) {
		const list = Array.isArray(runs) ? runs : [];
		const owned = await Promise.all(list.map(async (run) => (
			ownsThread(caller, run?.threadId ? await rovoAppThreadManager.getThread(run.threadId) : null)
		)));
		return list.filter((_run, index) => owned[index]);
	}

	return {
		callerOf,
		filterOwnedDocuments,
		filterOwnedRuns,
		isForeignThread,
		ownedBy,
		ownsGeneratedMedia,
		ownsSession,
		ownsThread,
		rejectForeignDocument,
		rejectForeignSession,
		rejectForeignThread,
		rejectForeignUpload,
		requireCaller,
	};
}

// The chat routes outside the Rovo app router that name a stored thread. Each one
// resumes, writes to, or cancels that thread, so another caller's id answers 404.
const CHAT_THREAD_ROUTES = Object.freeze([
	["/api/chat-sdk", (req) => req.body?.id],
	["/api/rovo/chat", (req) => req.body?.id],
	["/api/chat-cancel", (req) => req.query?.threadId],
]);

// The chat routes that name a Rovo Serve session instead of a thread. Each one restores
// that session, so a session no thread of the caller's stores answers 404.
const CHAT_SESSION_ROUTES = Object.freeze([
	["/api/chat-sdk/skip-question", (req) => req.body?.sessionId],
]);

/**
 * Guards the chat routes in CHAT_THREAD_ROUTES and CHAT_SESSION_ROUTES with the same
 * per-caller thread check the Rovo app routes use. Register before those routes.
 * @param {import("express").Express} app
 * @param {{ rovoAppThreadManager: object }} managers
 */
function registerChatThreadOwnershipGuards(app, { rovoAppThreadManager }) {
	for (const method of ["getThread", "listThreads"]) {
		if (typeof rovoAppThreadManager?.[method] !== "function") {
			throw new Error(`registerChatThreadOwnershipGuards requires rovoAppThreadManager.${method}`);
		}
	}
	const ownership = createRovoAppThreadOwnership({ rovoAppThreadManager });
	for (const [routePath, pickThreadId] of CHAT_THREAD_ROUTES) {
		app.post(routePath, ownership.requireCaller, ownership.rejectForeignThread(pickThreadId));
	}
	for (const [routePath, pickSessionId] of CHAT_SESSION_ROUTES) {
		app.post(routePath, ownership.requireCaller, ownership.rejectForeignSession(pickSessionId));
	}
}

module.exports = {
	CHAT_SESSION_ROUTES,
	CHAT_THREAD_ROUTES,
	createRovoAppThreadOwnership,
	registerChatThreadOwnershipGuards,
};
