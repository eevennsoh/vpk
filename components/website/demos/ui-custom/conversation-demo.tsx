import {
	Conversation,
	ConversationContent,
	ConversationDownload,
	ConversationScrollButton,
} from "@/components/ui-custom/conversation";
import { Message, MessageContent } from "@/components/ui/message";
import { MessageUserBubble } from "@/components/ui-custom/message-user-bubble";

const DEMO_MESSAGES: Array<{
	id: string;
	content: string;
	role: "user" | "assistant";
}> = [
	{
		id: "user-rollout-summary",
		content: "Pull together a rollout summary for the Rovo conversation polish work.",
		role: "user",
	},
	{
		id: "assistant-rollout-groups",
		content: "I grouped the updates into scroll behavior, composer clarity, and artifact layout fixes.",
		role: "assistant",
	},
	{
		id: "user-regression-note",
		content: "Call out any regressions we should watch before shipping.",
		role: "user",
	},
	{
		id: "assistant-follow-risk",
		content: "The main risk is chat surfaces that depend on follow-to-bottom behavior while streaming new content.",
		role: "assistant",
	},
	{
		id: "user-scroll-affordance",
		content: "Add a note about validating the down-arrow affordance when a user scrolls away from the latest message.",
		role: "user",
	},
	{
		id: "assistant-scroll-threshold",
		content: "Added. I would verify the button appears once the viewport is more than 24px away from the bottom.",
		role: "assistant",
	},
	{
		id: "user-docs-note",
		content: "Good. Include the markdown download action in the component docs preview as well.",
		role: "user",
	},
	{
		id: "assistant-docs-updated",
		content: "Done. The preview now shows the export button in the same bounded conversation surface.",
		role: "assistant",
	},
];

export default function ConversationDemo() {
	return (
		<Conversation className="h-80 w-full overflow-hidden rounded-xl border border-border bg-background">
			<ConversationContent className="min-h-full px-6 py-5 pr-20">
				{DEMO_MESSAGES.map((message) => (
					<Message align={message.role === "user" ? "end" : "start"} key={message.id}>
						{message.role === "user" ? (
							<MessageContent>
								<MessageUserBubble>{message.content}</MessageUserBubble>
							</MessageContent>
						) : (
							<MessageContent className="max-w-[80%]">{message.content}</MessageContent>
						)}
					</Message>
				))}
			</ConversationContent>
			<ConversationDownload className="top-5 right-5" messages={DEMO_MESSAGES} />
			<ConversationScrollButton />
		</Conversation>
	);
}
