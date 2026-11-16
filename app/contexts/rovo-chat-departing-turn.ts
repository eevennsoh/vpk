/** What ending a departing transcript's turn needs from RovoChatProvider. */
export interface RovoChatDepartingTurnOwner {
	/** The thread whose run is detached afterwards, read before anything changes. */
	readonly threadId: string | null;
	/**
	 * Whether a request may be in flight. Read before `resetTurn`, which clears
	 * the turn state it reads: a request that has started but whose streaming
	 * status React has not committed yet shows only in the turn machine.
	 */
	readonly isSendInFlight: () => boolean;
	readonly resetTurn: () => void;
	readonly stopRequest: () => Promise<void>;
	readonly waitForStreamStop: () => Promise<unknown>;
	readonly detachRun: (threadId: string) => Promise<unknown>;
}

/**
 * Ends the departing transcript's turn work, then stops its request and
 * detaches its run, so nothing from it (reply chunks, settlements, a cut-short
 * notice, a queued prompt) lands on the transcript that replaces it. Every path
 * that replaces or drops the transcript for a thread change runs it before the
 * replacement.
 */
export async function endDepartingTurn(owner: RovoChatDepartingTurnOwner): Promise<void> {
	const sendInFlight = owner.isSendInFlight();
	owner.resetTurn();
	if (sendInFlight) {
		try {
			await owner.stopRequest();
		} catch (error) {
			console.warn("[RovoChatProvider] Failed to detach compact stream:", error);
		}
		await owner.waitForStreamStop();
	}

	if (owner.threadId) {
		await owner.detachRun(owner.threadId).catch(() => {});
	}
}
