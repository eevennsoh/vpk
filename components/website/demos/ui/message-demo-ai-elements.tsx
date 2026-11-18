"use client";

import { useEffect, useState } from "react";
import CheckMarkIcon from "@atlaskit/icon/core/check-mark";
import CopyIcon from "@atlaskit/icon/core/copy";
import EditIcon from "@atlaskit/icon/core/edit";
import RetryIcon from "@atlaskit/icon/core/retry";
import ThumbsDownIcon from "@atlaskit/icon/core/thumbs-down";
import ThumbsUpIcon from "@atlaskit/icon/core/thumbs-up";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
	Message,
	MessageAction,
	MessageActions,
	MessageContent,
	MessageCopyAction,
	MessageEditAction,
	MessageFooter,
	MessageRegenerateAction,
	MessageVoteActions,
	type MessageVote,
} from "@/components/ui/message";
import { MessageResponse } from "@/components/ui-custom/message-markdown";
import { MessageUserBubble } from "@/components/ui-custom/message-user-bubble";

const reply = `Install Dialog, then open it from the gear button in \`site-header.tsx\`.

\`\`\`bash
npx shadcn@latest add dialog
\`\`\`

Wrap the button in a \`DialogTrigger\` and put the settings form in \`DialogContent\`. Focus moves into the dialog when it opens, and **Esc** closes it.`;

/** shadcn's AI Elements Message pattern: the person's bubble, then the agent's markdown reply with actions. */
export function MessageDemoPattern() {
	const [copied, setCopied] = useState(false);
	const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);

	useEffect(() => {
		if (!copied) {
			return;
		}

		const timeout = setTimeout(() => setCopied(false), 2000);
		return () => clearTimeout(timeout);
	}, [copied]);

	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-8 py-6 text-sm">
			<Message align="end">
				<MessageContent className="gap-2">
					<Bubble align="end" variant="muted">
						<BubbleContent>
							How do I add a settings dialog? It should open from the gear icon in the header.
						</BubbleContent>
					</Bubble>
					<MessageFooter>
						<MessageAction label="Copy">
							<CopyIcon label="" size="small" />
						</MessageAction>
						<MessageAction label="Edit">
							<EditIcon label="" size="small" />
						</MessageAction>
					</MessageFooter>
				</MessageContent>
			</Message>
			<Message>
				<MessageContent className="gap-2">
					<MessageResponse>{reply}</MessageResponse>
					<MessageFooter className="px-0">
						<MessageAction
							label={copied ? "Copied" : "Copy"}
							onClick={() => {
								void navigator.clipboard.writeText(reply);
								setCopied(true);
							}}
						>
							{copied ? <CheckMarkIcon label="" size="small" /> : <CopyIcon label="" size="small" />}
						</MessageAction>
						<MessageAction
							label="Good response"
							aria-pressed={feedback === "like"}
							onClick={() => setFeedback(feedback === "like" ? null : "like")}
						>
							<ThumbsUpIcon label="" size="small" />
						</MessageAction>
						<MessageAction
							label="Bad response"
							aria-pressed={feedback === "dislike"}
							onClick={() => setFeedback(feedback === "dislike" ? null : "dislike")}
						>
							<ThumbsDownIcon label="" size="small" />
						</MessageAction>
						<MessageAction label="Retry">
							<RetryIcon label="" size="small" />
						</MessageAction>
					</MessageFooter>
				</MessageContent>
			</Message>
		</div>
	);
}

/** VPK's chat turn: the neutral user bubble with hover-revealed Copy/Edit, and the reply's Copy/Vote/Regenerate presets. */
export function MessageDemoPresetActions() {
	const [vote, setVote] = useState<MessageVote | null>(null);
	const prompt = "Summarize the open blockers for the Q3 launch.";
	const answer = "Two blockers remain: the billing migration is waiting on legal review, and the onboarding flow needs a final accessibility pass.";

	return (
		<div className="mx-auto flex w-full max-w-md flex-col gap-8 py-6">
			<Message align="end">
				<MessageContent className="max-w-[80%] items-end gap-2">
					<MessageUserBubble className="max-w-full">{prompt}</MessageUserBubble>
					<MessageActions reveal="hover" className="text-text-subtle">
						<MessageCopyAction text={prompt} />
						<MessageEditAction />
					</MessageActions>
				</MessageContent>
			</Message>
			<Message>
				<MessageContent className="gap-2">
					<MessageResponse>{answer}</MessageResponse>
					<MessageActions className="text-text-subtle">
						<MessageCopyAction text={answer} />
						<MessageVoteActions value={vote} onVote={setVote} />
						<MessageRegenerateAction />
					</MessageActions>
				</MessageContent>
			</Message>
		</div>
	);
}
