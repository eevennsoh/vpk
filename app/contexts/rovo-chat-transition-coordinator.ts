export type RovoChatTransitionKind =
	| "activate-session"
	| "apply-local-turn"
	| "stop-streaming"
	| "destroy"
	| "delete-all-threads"
	| "delete-thread"
	| "hydrate-thread-snapshot"
	| "replace-messages"
	| "reset-chat"
	| "select-thread";

export interface RovoChatTransitionToken {
	readonly id: number;
	readonly kind: RovoChatTransitionKind;
}

export class RovoChatTransitionCoordinator {
	private cancellationOwnerId: number | null = null;
	private currentOperationId = 0;

	begin(
		kind: RovoChatTransitionKind,
		options: Readonly<{ ownsCancellation?: boolean }> = {}
	): RovoChatTransitionToken {
		this.currentOperationId += 1;
		const token = {
			id: this.currentOperationId,
			kind,
		};

		if (options.ownsCancellation) {
			this.cancellationOwnerId = token.id;
		}

		return token;
	}

	hasCancellationOwner(): boolean {
		return this.cancellationOwnerId !== null;
	}

	isCurrent(token: RovoChatTransitionToken): boolean {
		return token.id === this.currentOperationId;
	}

	ownsCancellation(token: RovoChatTransitionToken): boolean {
		return token.id === this.cancellationOwnerId;
	}

	releaseCancellation(token: RovoChatTransitionToken): boolean {
		if (!this.ownsCancellation(token)) {
			return false;
		}

		this.cancellationOwnerId = null;
		return true;
	}
}
