import { isTextUIPart, type UIMessage } from "ai";

export { createChat } from "@shadcn/helpers/ai-sdk";

export function getMessageText(message: Pick<UIMessage, "parts">): string {
	return message.parts
		.filter(isTextUIPart)
		.map((part) => part.text)
		.join("\n\n")
		.trim();
}
