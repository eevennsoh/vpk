"use strict";

/**
 * A Rovo call's hold on its pool lease (SM-BT-4): held → settled | handed-off. While held,
 * the call ends the lease once, with `settle("release")` or `settle("unhealthy", reason)`.
 * `handOff()` gives the lease to a paused tool call instead (the pool shows the port
 * `reserved`); after that this call never settles it, whoever ends the paused call does.
 * @param {{ port: number, settleLease?: Function, reserve?: Function }} handle
 * @param {{ logPrefix?: string, logger?: { warn?: (...args: unknown[]) => void } }} [options]
 */
function createRovoPortLease(handle, { logPrefix = "rovo", logger = console } = {}) {
	/** @type {"held" | "settled" | "handed-off"} */
	let state = "held";
	return {
		port: handle.port,
		get state() {
			return state;
		},
		isHeld: () => state === "held",
		/**
		 * @param {"release" | "unhealthy"} disposition
		 * @param {string} [reason]
		 * @returns {boolean} whether this call ended the lease
		 */
		settle(disposition, reason) {
			if (state !== "held") {
				return false;
			}
			state = "settled";
			const trimmedReason = typeof reason === "string" && reason.trim() ? reason.trim() : undefined;
			if (disposition === "unhealthy" && trimmedReason) {
				logger.warn?.(`[${logPrefix}] Marking port ${handle.port} unhealthy: ${trimmedReason}`);
			}
			handle.settleLease?.(disposition, trimmedReason ? { reason: trimmedReason } : {});
			return true;
		},
		/** Returns the pool handle for the paused tool call to keep, or null if not held. */
		handOff(reason = "paused tool call") {
			if (state !== "held") {
				return null;
			}
			state = "handed-off";
			handle.reserve?.(reason);
			return handle;
		},
	};
}

/**
 * The handle used when no pool is configured: one fixed port, nothing to settle.
 * @param {number} port
 */
function createUnpooledPortHandle(port) {
	return {
		port,
		settleLease: () => true,
	};
}

module.exports = {
	createRovoPortLease,
	createUnpooledPortHandle,
};
