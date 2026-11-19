"use strict";

const { isOwnedByCaller } = require("./caller-identity");
const { resolveChatSdkThreadId } = require("./chat-sdk-thread-id");
const { runWithGeneratedMediaScope } = require("./generated-media-owners");
const { getRovoSessionOwnerIndex } = require("./rovo-session-owners");
const { getRequestCaller } = require("../middleware/caller-identity");

const THREAD_NOT_FOUND = Object.freeze({ error: "Thread not found" });

function firstValue(value) {
	const first = Array.isArray(value) ? value[0] : value;
	return typeof first === "string" && first.trim() ? first.trim() : null;
}

/** The distinct non-empty ids a picker returns (one id, or a list of them). */
function pickedIds(picked) {
	const values = Array.isArray(picked) ? picked : [picked];
	return [...new Set(values.map(firstValue).filter(Boolean))];
}

/**
 * Per-caller visibility for the Rovo app's stored threads and the records under them.
 * A thread belongs to the caller who created it (`thread.owner`); a thread with no owner
 * predates owners and only a local caller sees it (lib/caller-identity.js).
 *
 * Another caller's thread answers exactly like a thread that does not exist, so the
 * routes keep their existing not-found shapes; a thread id that is not stored at all
 * passes through untouched, so each route's own handling of a missing thread stays.
 * @param {{ rovoAppThreadManager: object, rovoAppDocumentManager?: object, rovoAppUploadManager?: object,
 *   generatedMediaOwnerStore?: { ownerOf: (path: string) => string | null } }} managers
 */
function createRovoAppThreadOwnership({
	generatedMediaOwnerStore,
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

	/**
	 * Whether the caller may cancel a paused or active deferred tool call (a clarification
	 * or plan-approval card). The record's thread decides, like the chat routes that name
	 * a thread: another caller's stored thread refuses, and a thread that is not stored
	 * passes. A record with no thread has no owner, so only a local caller may cancel it.
	 * @param {{ owner: string, local: boolean } | null | undefined} caller
	 * @param {{ threadId?: string | null } | null | undefined} record
	 */
	async function ownsDeferredToolCall(caller, record) {
		if (!caller) return false;
		if (!record?.threadId) return Boolean(caller.local);
		return !(await isForeignThread(caller, record.threadId));
	}

	/** A `listThreads` filter that keeps the caller's threads (applied before its limit). */
	const ownedBy = (caller) => (thread) => ownsThread(caller, thread);

	/**
	 * Middleware: 404 "Thread not found" when a thread the request names (read by
	 * `pickThreadId`, one id or a list of every field a handler may use) is someone else's.
	 * @param {(req: import("express").Request) => unknown} pickThreadId
	 */
	function rejectForeignThread(pickThreadId) {
		return async (req, res, next) => {
			try {
				const caller = callerOf(res);
				const foreign = await Promise.all(pickedIds(pickThreadId(req)).map((threadId) => isForeignThread(caller, threadId)));
				if (foreign.some(Boolean)) {
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

	const sessionOwners = getRovoSessionOwnerIndex(rovoAppThreadManager);

	/**
	 * Whether a Rovo Serve session is the caller's (lib/rovo-session-owners.js). A session
	 * id restores that whole conversation, so only the caller whose thread first stored it
	 * may use it; a local caller is the only caller there is.
	 */
	function ownsSession(caller, sessionId) {
		return sessionOwners.owns(caller, sessionId);
	}

	/**
	 * Middleware: 404 "Session not found" when the Rovo session the request names (read by
	 * `pickSessionId`; null when the request restores no session) is not the caller's.
	 * With `required`, an SLAuth request that names no session is refused too: the route
	 * would otherwise talk to whichever session the Rovo Serve port has loaded.
	 * @param {(req: import("express").Request) => unknown} pickSessionId
	 * @param {{ required?: boolean }} [options]
	 */
	function rejectForeignSession(pickSessionId, { required = false } = {}) {
		return async (req, res, next) => {
			try {
				const caller = callerOf(res);
				const sessionId = firstValue(pickSessionId(req));
				const allowed = sessionId
					? await ownsSession(caller, sessionId)
					: !required || Boolean(caller?.local);
				if (!allowed) {
					return res.status(404).json({ error: "Session not found" });
				}
				return next();
			} catch (error) {
				return next(error);
			}
		};
	}

	/**
	 * Middleware for the routes that store a session id on a thread: 409 when the session is
	 * someone else's, otherwise the session becomes the caller's before the thread stores it.
	 * @param {(req: import("express").Request) => unknown} pickSessionId
	 */
	function claimSession(pickSessionId) {
		return async (req, res, next) => {
			try {
				const sessionId = firstValue(pickSessionId(req));
				if (sessionId && !(await sessionOwners.claim(callerOf(res), sessionId))) {
					return res.status(409).json({ error: "Session belongs to another thread", code: "SESSION_OWNED" });
				}
				return next();
			} catch (error) {
				return next(error);
			}
		};
	}

	/**
	 * Whether a generated media file (a repo-relative path under media/videos) is the
	 * caller's: the turn that produced it recorded them as its owner
	 * (lib/generated-media-owners.js). A local caller reaches every file, as before.
	 */
	function ownsGeneratedMedia(caller, requestedPath) {
		if (!caller) return false;
		if (caller.local) return true;
		const owner = generatedMediaOwnerStore?.ownerOf(requestedPath) ?? null;
		return Boolean(owner) && owner === caller.owner;
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
		claimSession,
		filterOwnedDocuments,
		filterOwnedRuns,
		isForeignThread,
		ownedBy,
		ownsDeferredToolCall,
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
// resumes, writes to, or cancels that thread, so another caller's id answers 404. Each
// picker returns every field its handler may take the thread from: /api/chat-sdk reads
// `threadId` before `id` (lib/chat-sdk-thread-id.js), so both are checked.
const CHAT_THREAD_ROUTES = Object.freeze([
	["/api/chat-sdk", (req) => [
		resolveChatSdkThreadId({
			chatSdkSource: req.body?.chatSdkSource,
			threadId: req.body?.threadId,
			id: req.body?.id,
		}),
		req.body?.threadId,
		req.body?.id,
	]],
	["/api/rovo/chat", (req) => req.body?.id],
	["/api/chat-cancel", (req) => req.query?.threadId],
]);

// A persistent (non-ephemeral) chat request restores the Rovo session it names.
const persistentSessionId = (req) => (req.body?.sessionMode === "ephemeral" ? null : req.body?.sessionId);

// The chat routes that restore a Rovo Serve session. Another caller's session answers 404.
// skip-question always talks to a Rovo session, so an SLAuth request must name one of its own.
const CHAT_SESSION_ROUTES = Object.freeze([
	["/api/chat-sdk", persistentSessionId, { required: false }],
	["/api/rovo/chat", persistentSessionId, { required: false }],
	["/api/chat-sdk/skip-question", (req) => req.body?.sessionId, { required: true }],
]);

// The chat routes whose turns can generate a video: the caller becomes its owner. These
// are the only routes whose streams build the previews that play a generated video
// (backend/lib/widget-preview-payload.js): realtime voice delegates its tasks through
// /api/rovo/chat, and /api/genui-chat and skip-question stream text and specs only.
const CHAT_MEDIA_ROUTES = Object.freeze(["/api/chat-sdk", "/api/rovo/chat"]);

/**
 * Guards the chat routes in CHAT_THREAD_ROUTES and CHAT_SESSION_ROUTES with the same
 * per-caller checks the Rovo app routes use, and runs each CHAT_MEDIA_ROUTES turn as its
 * SLAuth caller's, so a video it generates is recorded as theirs. Register before those routes.
 * @param {import("express").Express} app
 * @param {{ rovoAppThreadManager: object, generatedMediaOwnerStore: { claim: Function } }} managers
 */
function registerChatThreadOwnershipGuards(app, { generatedMediaOwnerStore, rovoAppThreadManager }) {
	for (const method of ["getThread", "listThreads"]) {
		if (typeof rovoAppThreadManager?.[method] !== "function") {
			throw new Error(`registerChatThreadOwnershipGuards requires rovoAppThreadManager.${method}`);
		}
	}
	if (typeof generatedMediaOwnerStore?.claim !== "function") {
		throw new Error("registerChatThreadOwnershipGuards requires generatedMediaOwnerStore.claim");
	}
	const ownership = createRovoAppThreadOwnership({ rovoAppThreadManager });
	for (const [routePath, pickThreadId] of CHAT_THREAD_ROUTES) {
		app.post(routePath, ownership.requireCaller, ownership.rejectForeignThread(pickThreadId));
	}
	for (const [routePath, pickSessionId, options] of CHAT_SESSION_ROUTES) {
		app.post(routePath, ownership.requireCaller, ownership.rejectForeignSession(pickSessionId, options));
	}
	for (const routePath of CHAT_MEDIA_ROUTES) {
		app.post(routePath, ownership.requireCaller, (_req, res, next) => {
			const caller = ownership.callerOf(res);
			// A local caller reaches every video, so its turns record nothing.
			const scope = caller.local ? null : { owner: caller.owner, store: generatedMediaOwnerStore };
			runWithGeneratedMediaScope(scope, next);
		});
	}
}

module.exports = {
	CHAT_MEDIA_ROUTES,
	CHAT_SESSION_ROUTES,
	CHAT_THREAD_ROUTES,
	createRovoAppThreadOwnership,
	registerChatThreadOwnershipGuards,
};
