"use strict";

const { isOwnedByCaller } = require("./caller-identity");

// Two stored threads with different owners name this session: it is nobody's.
const CONTESTED = Symbol("contested");

function sessionIdsOf(thread) {
	return [thread?.sessionId, thread?.activeRun?.sessionId]
		.filter((sessionId) => typeof sessionId === "string" && sessionId.trim())
		.map((sessionId) => sessionId.trim());
}

/**
 * Which caller each Rovo Serve session belongs to. A session id restores that whole
 * conversation, and the thread fields that carry it are written from the request body, so
 * a session belongs to the first caller whose thread stores it: a later thread of someone
 * else's that names the same id is refused (`claim`), never trusted.
 *
 * Built once from the stored threads (the session ids already saved keep their thread's
 * owner), then kept in memory as thread writes claim sessions. One index per thread store,
 * so the Rovo app routes and the chat guards share it.
 * @param {{ listThreads: Function }} rovoAppThreadManager
 */
function createRovoSessionOwnerIndex(rovoAppThreadManager) {
	/** @type {Map<string, string | null | typeof CONTESTED>} */
	const ownerBySessionId = new Map();
	let loading = null;

	function bind(sessionId, owner) {
		const current = ownerBySessionId.get(sessionId);
		if (current === undefined) {
			ownerBySessionId.set(sessionId, owner);
		} else if (current !== owner) {
			ownerBySessionId.set(sessionId, CONTESTED);
		}
	}

	function load() {
		if (!loading) {
			loading = rovoAppThreadManager.listThreads({
				limit: Number.MAX_SAFE_INTEGER,
				filter: (thread) => sessionIdsOf(thread).length > 0,
			}).then((threads) => {
				for (const thread of threads) {
					for (const sessionId of sessionIdsOf(thread)) {
						bind(sessionId, thread.owner || null);
					}
				}
			});
			loading.catch(() => {
				loading = null;
			});
		}
		return loading;
	}

	/**
	 * Whether the session is the caller's. A local caller is the only caller there is, so
	 * every session is theirs; an SLAuth caller needs a session their thread claimed.
	 */
	async function owns(caller, sessionId) {
		if (!caller) return false;
		if (caller.local) return true;
		await load();
		const owner = ownerBySessionId.get(sessionId);
		return owner !== undefined && owner !== CONTESTED && isOwnedByCaller(owner, caller);
	}

	/**
	 * Binds an unclaimed session to the caller, before their thread stores it. False when
	 * the session is someone else's (or contested), so the write must not store it.
	 */
	async function claim(caller, sessionId) {
		if (!caller) return false;
		if (caller.local) return true;
		await load();
		const owner = ownerBySessionId.get(sessionId);
		if (owner === undefined) {
			ownerBySessionId.set(sessionId, caller.owner);
			return true;
		}
		return owner === caller.owner;
	}

	return { claim, owns };
}

const indexByThreadManager = new WeakMap();

/** The session index for this thread store (created on first use). */
function getRovoSessionOwnerIndex(rovoAppThreadManager) {
	let index = indexByThreadManager.get(rovoAppThreadManager);
	if (!index) {
		index = createRovoSessionOwnerIndex(rovoAppThreadManager);
		indexByThreadManager.set(rovoAppThreadManager, index);
	}
	return index;
}

module.exports = {
	createRovoSessionOwnerIndex,
	getRovoSessionOwnerIndex,
};
