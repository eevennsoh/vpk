export function shouldSendExplicitRovoCancel(input: {
	/**
	 * The user pressed Stop. AI SDK `stop()` settles the chat locally the moment
	 * it aborts, so `stopSettledInTime` cannot show whether the backend saw the
	 * disconnect; an explicit user cancel always reaches the backend.
	 */
	explicitUserCancel?: boolean;
	hasBackgroundCancelableWork: boolean;
	hasUseChatTurn: boolean;
	stopSettledInTime: boolean;
}): boolean {
	if (input.explicitUserCancel === true || input.hasBackgroundCancelableWork) {
		return true;
	}

	if (!input.hasUseChatTurn) {
		return true;
	}

	return input.stopSettledInTime !== true;
}
