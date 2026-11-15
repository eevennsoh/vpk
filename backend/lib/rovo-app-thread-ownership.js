"use strict";

const { isOwnedByCaller } = require("./caller-identity");
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

	function filterOwnedThreads(caller, threads) {
		return (Array.isArray(threads) ? threads : []).filter((thread) => ownsThread(caller, thread));
	}

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

	/** Middleware: a document under someone else's thread is "Document not found". */
	function rejectForeignDocument(pickDocumentId) {
		return async (req, res, next) => {
			try {
				const documentId = firstValue(pickDocumentId(req));
				if (documentId) {
					const document = await rovoAppDocumentManager.getDocument(documentId);
					if (document && await isForeignThread(callerOf(res), document.threadId)) {
						return res.status(404).json({ error: "Document not found" });
					}
				}
				return next();
			} catch (error) {
				return next(error);
			}
		};
	}

	/** Middleware: an upload under someone else's thread is "File not found". */
	async function rejectForeignUpload(req, res, next) {
		try {
			const upload = await rovoAppUploadManager.getUpload(req.params.fileId);
			if (upload && await isForeignThread(callerOf(res), upload.threadId)) {
				return res.status(404).json({ error: "File not found" });
			}
			return next();
		} catch (error) {
			return next(error);
		}
	}

	/** The documents whose thread the caller can see (a missing thread counts as not theirs). */
	async function filterOwnedDocuments(caller, documents) {
		const list = Array.isArray(documents) ? documents : [];
		const threadIds = [...new Set(list.map((document) => document?.threadId).filter(Boolean))];
		const visible = new Set();
		await Promise.all(threadIds.map(async (threadId) => {
			if (ownsThread(caller, await rovoAppThreadManager.getThread(threadId))) visible.add(threadId);
		}));
		return list.filter((document) => visible.has(document?.threadId));
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
		filterOwnedThreads,
		isForeignThread,
		ownsThread,
		rejectForeignDocument,
		rejectForeignThread,
		rejectForeignUpload,
		requireCaller,
	};
}

module.exports = {
	createRovoAppThreadOwnership,
};
