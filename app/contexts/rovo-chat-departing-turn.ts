/** What stopping a departing transcript's request needs from RovoChatProvider. */
export interface RovoChatDepartingRequestOwner {
	/** The thread whose run is detached afterwards, read before anything changes. */
	readonly threadId: string | null;
	/**
	 * Whether a request may be in flight: a request that has started but whose
	 * streaming status React has not committed yet shows only in the turn machine.
	 */
	readonly isSendInFlight: () => boolean;
	/**
	 * Whether the request is live (started, and not yet finished by its own
	 * onFinish or onError), so stopping it ends its turn. A request that already
	 * finished keeps its turn's pending work, whatever the streaming flag says.
	 */
	readonly isRequestLive: () => boolean;
	/** Ends the turn of the request being stopped as a user Stop does (no notice). */
	readonly endStoppedTurn: () => void;
	readonly stopRequest: () => Promise<void>;
	readonly waitForStreamStop: () => Promise<unknown>;
	readonly detachRun: (threadId: string) => Promise<unknown>;
}

/**
 * The stop phase of a thread change: stops the departing transcript's request
 * and detaches its run, so no reply chunk from it lands on the transcript that
 * replaces it. It reads what is in flight when called, before its first await,
 * so a caller that resets the turn right after calling it still stops a
 * request whose streaming status has not committed.
 *
 * It never resets the turn. A thread change that can be superseded resets it
 * at its commit point, in the same synchronous step that replaces the
 * transcript; a superseded change leaves the old transcript its pending work
 * (a cut-short wait and its notice, the queue, a retry countdown), and a live
 * request it stopped ends as a user Stop ends it, so the queue goes on.
 */
export async function stopDepartingRequest(owner: RovoChatDepartingRequestOwner): Promise<void> {
	if (owner.isSendInFlight()) {
		if (owner.isRequestLive()) {
			owner.endStoppedTurn();
		}
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
