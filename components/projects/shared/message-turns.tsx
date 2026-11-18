"use client";

import type { CSSProperties, ReactElement, ReactNode } from "react";
import { Fragment, useMemo } from "react";

import { cn } from "@/lib/utils";

export interface ThreadMessage {
	id: string;
}

function groupMessagesByTurn<MESSAGE extends ThreadMessage>(
	messages: ReadonlyArray<MESSAGE>,
	isUserMessage: (message: MESSAGE) => boolean
): MESSAGE[][] {
	return messages.reduce<MESSAGE[][]>((turns, message) => {
		if (isUserMessage(message)) {
			turns.push([message]);
			return turns;
		}

		if (turns.length === 0) {
			turns.push([message]);
			return turns;
		}

		turns[turns.length - 1].push(message);
		return turns;
	}, []);
}

interface MessageTurnsProps<MESSAGE extends ThreadMessage> {
	messages: ReadonlyArray<MESSAGE>;
	isUserMessage: (message: MESSAGE) => boolean;
	latestTurnClassName?: string;
	latestTurnDataAttribute?: `data-${string}`;
	getTurnContainerClassName?: (
		turn: ReadonlyArray<MESSAGE>,
		turnIndex: number,
		turns: ReadonlyArray<ReadonlyArray<MESSAGE>>
	) => string | undefined;
	getTurnContainerStyle?: (
		turn: ReadonlyArray<MESSAGE>,
		turnIndex: number,
		turns: ReadonlyArray<ReadonlyArray<MESSAGE>>
	) => CSSProperties | undefined;
	renderTurnAfter?: (
		turn: ReadonlyArray<MESSAGE>,
		turnIndex: number,
		turns: ReadonlyArray<ReadonlyArray<MESSAGE>>
	) => ReactNode;
	renderTurnContainer?: (turn: ReadonlyArray<MESSAGE>, children: ReactNode) => ReactNode;
	getMessageContainerClassName?: (
		message: MESSAGE,
		messageIndex: number,
		turn: ReadonlyArray<MESSAGE>
	) => string | undefined;
	getMessageContainerStyle?: (
		message: MESSAGE,
		messageIndex: number,
		turn: ReadonlyArray<MESSAGE>
	) => CSSProperties | undefined;
	renderMessage: (
		message: MESSAGE,
		messageIndex: number,
		turn: ReadonlyArray<MESSAGE>
	) => ReactNode;
	renderMessageAfter?: (
		message: MESSAGE,
		messageIndex: number,
		turn: ReadonlyArray<MESSAGE>
	) => ReactNode;
}

export function MessageTurns<MESSAGE extends ThreadMessage>({
	messages,
	isUserMessage,
	latestTurnClassName,
	latestTurnDataAttribute,
	getTurnContainerClassName,
	getTurnContainerStyle,
	renderTurnAfter,
	renderTurnContainer,
	getMessageContainerClassName,
	getMessageContainerStyle,
	renderMessage,
	renderMessageAfter,
}: Readonly<MessageTurnsProps<MESSAGE>>): ReactElement {
	const turns = useMemo(
		() => groupMessagesByTurn(messages, isUserMessage),
		[messages, isUserMessage]
	);

	return (
		<>
			{turns.map((turn, turnIndex) => {
				const isLatestTurn = turnIndex === turns.length - 1;
				const latestTurnProps =
					isLatestTurn && latestTurnDataAttribute
						? ({ [latestTurnDataAttribute]: "true" } as Record<string, string>)
						: {};
				const renderedTurnAfter = renderTurnAfter?.(turn, turnIndex, turns);
				const hasRenderedTurnAfter = !(
					renderedTurnAfter === null ||
					renderedTurnAfter === undefined ||
					renderedTurnAfter === false
				);

				const children = (
					<>
						<div
							className={cn(
								isLatestTurn ? latestTurnClassName : undefined,
								getTurnContainerClassName?.(turn, turnIndex, turns)
							)}
							style={getTurnContainerStyle?.(turn, turnIndex, turns)}
							{...latestTurnProps}
						>
							{turn.map((message, messageIndex) => {
								const renderedMessage = renderMessage(message, messageIndex, turn);
								const renderedMessageAfter = renderMessageAfter?.(message, messageIndex, turn);
								const hasRenderedMessage = !(
									renderedMessage === null ||
									renderedMessage === undefined ||
									renderedMessage === false
								);
								const hasRenderedMessageAfter = !(
									renderedMessageAfter === null ||
									renderedMessageAfter === undefined ||
									renderedMessageAfter === false
								);
								if (
									!hasRenderedMessage &&
									!hasRenderedMessageAfter
								) {
									return null;
								}

								return (
									<Fragment key={`turn-${turnIndex}-message-${messageIndex}-${message.id}`}>
										{hasRenderedMessage ? (
											<div
												className={cn(
													getMessageContainerClassName?.(message, messageIndex, turn)
												)}
												style={getMessageContainerStyle?.(message, messageIndex, turn)}
											>
												{renderedMessage}
											</div>
										) : null}
										{hasRenderedMessageAfter ? renderedMessageAfter : null}
									</Fragment>
								);
							})}
						</div>
						{hasRenderedTurnAfter ? renderedTurnAfter : null}
					</>
				);

				return (
					<Fragment key={`turn-${turnIndex}-${turn[0]?.id ?? "empty"}`}>
						{renderTurnContainer ? renderTurnContainer(turn, children) : children}
					</Fragment>
				);
			})}
		</>
	);
}
