const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const USER_MESSAGE_BUBBLE_SOURCE = fs.readFileSync(
	path.join(__dirname, "user-message-bubble.tsx"),
	"utf8",
);
const THREAD_MESSAGE_ROOT_SOURCE = fs.readFileSync(
	path.join(__dirname, "../thread-message/thread-message-root.tsx"),
	"utf8",
);
const SIDEBAR_MESSAGE_BUBBLE_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../sidebar-chat/components/message-bubble.tsx"),
	"utf8",
);
const CHAT_PANEL_SOURCE = fs.readFileSync(
	path.join(__dirname, "../../sidebar-chat/page.tsx"),
	"utf8",
);
const ROVO_CHAT_CONTEXT_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "app/contexts/context-rovo-chat.tsx"),
	"utf8",
);
const ROVO_CHAT_HELPERS_SOURCE = fs.readFileSync(
	path.join(process.cwd(), "app/contexts/rovo-chat-helpers.ts"),
	"utf8",
);

test("shared user message bubble exposes copy and edit prompt actions", () => {
	assert.match(USER_MESSAGE_BUBBLE_SOURCE, /MessageCopyAction/);
	assert.match(USER_MESSAGE_BUBBLE_SOURCE, /MessageEditAction/);
	assert.match(USER_MESSAGE_BUBBLE_SOURCE, /MessageResponse/);
	assert.match(USER_MESSAGE_BUBBLE_SOURCE, /<InlineEdit/);
	assert.match(USER_MESSAGE_BUBBLE_SOURCE, /showPromptActions/);
	assert.match(USER_MESSAGE_BUBBLE_SOURCE, /onConfirm=\{\(nextValue\) => void onEdit\(nextValue\)\}/);
	assert.match(
		USER_MESSAGE_BUBBLE_SOURCE,
		/<MessageResponse plain className="font-medium text-inherit \[&>\*\+\*\]:mt-3">[\s\S]*\{messageText\}[\s\S]*<\/MessageResponse>/u,
	);
	assert.match(USER_MESSAGE_BUBBLE_SOURCE, /fitContent=\{!isEditing\}/);
});

test("Improve description renders as a skill tag without changing the raw message value", () => {
	assert.match(
		USER_MESSAGE_BUBBLE_SOURCE,
		/import \{ SkillTag \} from "@\/components\/ui-custom\/skill-tag";/u,
	);
	assert.match(
		USER_MESSAGE_BUBBLE_SOURCE,
		/\["\/Improve description", "Improve description"\]/u,
	);
	assert.match(
		USER_MESSAGE_BUBBLE_SOURCE,
		/skillInvocationLabel && skillTagProps \? \([\s\S]*<SkillTag[\s\S]*\{skillInvocationLabel\}[\s\S]*<\/SkillTag>[\s\S]*\) : \([\s\S]*<MessageResponse/u,
	);
	assert.match(USER_MESSAGE_BUBBLE_SOURCE, /<MessageCopyAction text=\{messageText\} \/>/u);
	assert.match(USER_MESSAGE_BUBBLE_SOURCE, /value=\{messageText\}/u);
});

test("structured skill invocations keep normal inline text flow around the skill tag", () => {
	assert.match(
		USER_MESSAGE_BUBBLE_SOURCE,
		/import \{ getSkillTagCatalogProps \} from "@\/components\/ui-custom\/skill-tag-catalog";/u,
	);
	assert.match(
		USER_MESSAGE_BUBBLE_SOURCE,
		/const skillInvocation = metadata\?\.skillInvocation;[\s\S]*const skillTagProps = skillInvocationLabel \? getSkillTagCatalogProps\(skillInvocationLabel\) : null;/u,
	);
	assert.match(USER_MESSAGE_BUBBLE_SOURCE, /skillInvocationLabel && skillTagProps \? \(/u);
	assert.match(
		USER_MESSAGE_BUBBLE_SOURCE,
		/<p className="font-medium leading-5">[\s\S]*skillInvocation \? <>Use\{" "\}<\/> : null[\s\S]*<SkillTag[\s\S]*color=\{skillTagProps\.color\}[\s\S]*icon=\{skillTagProps\.icon\}[\s\S]*\{skillInvocationLabel\}[\s\S]*<\/SkillTag>[\s\S]*skillInvocation\?\.instruction \? <>\{" "\}\{skillInvocation\.instruction\}<\/> : null[\s\S]*<\/p>/u,
	);
	assert.doesNotMatch(USER_MESSAGE_BUBBLE_SOURCE, /flex flex-wrap items-center/u);
});

test("sidebar and floating chat thread messages wire compact edit state", () => {
	assert.match(THREAD_MESSAGE_ROOT_SOURCE, /editingMessageId\?: string \| null;/);
	assert.match(THREAD_MESSAGE_ROOT_SOURCE, /showUserMessagePromptActions\?: boolean;/);
	assert.match(THREAD_MESSAGE_ROOT_SOURCE, /isEditing=\{editingMessageId === message\.id\}/);
	assert.match(THREAD_MESSAGE_ROOT_SOURCE, /showPromptActions=\{showUserMessagePromptActions\}/);

	assert.match(SIDEBAR_MESSAGE_BUBBLE_SOURCE, /showUserMessagePromptActions/);
	assert.match(CHAT_PANEL_SOURCE, /const \{[\s\S]*editMessage,[\s\S]*editingMessageId,[\s\S]*setEditingMessageId,[\s\S]*\} = useRovoChat\(\);/u);
	assert.match(CHAT_PANEL_SOURCE, /ConversationScrollButton/);
	assert.match(
		CHAT_PANEL_SOURCE,
		/<ConversationScrollButton className="z-10 transition-all" \/>/u,
	);
	assert.match(
		CHAT_PANEL_SOURCE,
		/onEditMessage=\{\(messageId, nextText\) =>\s*editMessage\(messageId, nextText, resolvedSendPromptOptions\)\s*\}/u,
	);
});

test("assistant bubbles render agent text before chain-of-thought and tool calls", () => {
	const chatMessagesSource = fs.readFileSync(
		path.join(__dirname, "chat-messages.tsx"),
		"utf8",
	);
	assert.match(
		SIDEBAR_MESSAGE_BUBBLE_SOURCE,
		/<ThreadMessage\.Content \/>[\s\S]*<ThreadMessage\.Reasoning \/>[\s\S]*<ThreadMessage\.ThinkingStatus \/>/u,
	);
	assert.match(
		chatMessagesSource,
		/<ThreadMessage\.Content \/>[\s\S]*<ThreadMessage\.Reasoning \/>[\s\S]*<ThreadMessage\.ThinkingStatus \/>/u,
	);
	assert.doesNotMatch(
		SIDEBAR_MESSAGE_BUBBLE_SOURCE,
		/<ThreadMessage\.Reasoning \/>[\s\S]*<ThreadMessage\.ThinkingStatus[\s\S]*<ThreadMessage\.Content \/>/u,
	);
});

test("compact chat edit uses AI SDK message replacement semantics", () => {
	assert.match(
		ROVO_CHAT_CONTEXT_SOURCE,
		/editMessage: \(messageId: string, nextText: string, options\?: SendPromptOptions\) => Promise<void>;/,
	);
	assert.match(
		ROVO_CHAT_CONTEXT_SOURCE,
		/await sendMessage\(messagePayload, bodyPayload\);/,
	);
	assert.match(
		ROVO_CHAT_CONTEXT_SOURCE,
		/messageId,\s*\};/u,
	);
	assert.match(
		ROVO_CHAT_CONTEXT_SOURCE,
		/setQueuedPrompts\(\[\]\);/,
	);
});

test("compact chat message sanitizers tolerate persisted messages without parts arrays", () => {
	assert.match(
		ROVO_CHAT_HELPERS_SOURCE,
		/const hasPartsArray = Array\.isArray\(message\.parts\);[\s\S]*const messageParts = hasPartsArray \? message\.parts : \[\];[\s\S]*if \(!hasPartsArray \|\| nextParts\.length !== messageParts\.length\)/u,
	);
	assert.match(
		ROVO_CHAT_HELPERS_SOURCE,
		/const hasPartsArray = Array\.isArray\(message\.parts\);[\s\S]*let messageChanged = !hasPartsArray;[\s\S]*const messageParts = hasPartsArray \? message\.parts : \[\];/u,
	);
});
