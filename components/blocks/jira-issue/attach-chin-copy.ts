/**
 * Placeholder copy for the link chin while a session (or cohort) is over
 * the card. Framework-free so the suite can lock pluralization without React.
 */

/**
 * `Link agent session` / `Link N agent sessions` for the open link chin.
 * Non-finite or non-positive counts fall back to a singleton — the chin only
 * mounts while a live transfer is approaching or receiving.
 */
export function linkAgentSessionChinCopy(count: number): string {
	const sessions = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
	return sessions === 1
		? "Link agent session"
		: `Link ${sessions} agent sessions`;
}

/**
 * Sessions in the current drag transfer. Prefer an explicit control count
 * (needed while a receiving card holds idle drag state, and during fusion
 * after pointer-up). Fall back to `transfer.members.length` on a live drag.
 */
export function resolveLinkAgentSessionChinCount(
	dragCount: number | undefined,
	transferCount: number | undefined,
): number {
	if (typeof dragCount === "number" && Number.isFinite(dragCount) && dragCount > 0) {
		return Math.floor(dragCount);
	}
	if (
		typeof transferCount === "number"
		&& Number.isFinite(transferCount)
		&& transferCount > 0
	) {
		return Math.floor(transferCount);
	}
	return 1;
}
