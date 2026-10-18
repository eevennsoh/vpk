import type { ComponentDetail } from "@/app/data/component-detail-types";

export const PROMPT_INPUT_DETAIL: ComponentDetail = {
	description:
		"A composable AI prompt composer built on a tiptap rich-text editor, with an inline `/` (skills) and `@` (mentions) palette, Enter-to-submit semantics, action menus, model/tool controls, file attachments, and provider-based external control. Typing `/` or `@` opens the command palette; selections insert non-editable inline reference tokens (pills) while the serialized text stays a plain string for `onSubmit`/`value`/`onChange`. The catalog backing the palette is configurable via the `mentionSources` prop and defaults to the unified editor-palette directory.",
	usage: `import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputSubmit,
} from "@/components/ui-custom/prompt-input";
import AddIcon from "@atlaskit/icon/core/add";

<PromptInput onSubmit={({ text, files }) => sendMessage({ text, files })}>
  <PromptInputBody>
    {/* Type "/" for skills or "@" to mention. Pass mentionSources to scope the palette. */}
    <PromptInputTextarea placeholder="Ask, @mention, or / for skills" rows={1} />
  </PromptInputBody>
  <PromptInputFooter className="justify-between px-1">
    <PromptInputTools>
      <PromptInputActionMenu>
        <PromptInputActionMenuTrigger aria-label="Add">
          <AddIcon label="" />
        </PromptInputActionMenuTrigger>
        <PromptInputActionMenuContent>
          <PromptInputActionMenuItem>Add context</PromptInputActionMenuItem>
        </PromptInputActionMenuContent>
      </PromptInputActionMenu>
    </PromptInputTools>
    <PromptInputSubmit />
  </PromptInputFooter>
</PromptInput>`,
	props: [
		{
			name: "onSubmit",
			type: '(message: { text: string; files: FileUIPart[] }, event: FormEvent<HTMLFormElement>) => void | Promise<void>',
			required: true,
			description: "Submit handler for the composed message. Supports sync and async flows.",
		},
		{
			name: "accept",
			type: "string",
			description: "Optional file MIME filter for uploads (for example, 'image/*,application/pdf').",
		},
		{
			name: "multiple",
			type: "boolean",
			default: "false",
			description: "Allow selecting multiple files from the file picker.",
		},
		{
			name: "globalDrop",
			type: "boolean",
			default: "false",
			description: "When true, file drag-and-drop is captured at the document level.",
		},
		{
			name: "maxFiles",
			type: "number",
			description: "Maximum number of files accepted by the composer.",
		},
		{
			name: "maxFileSize",
			type: "number",
			description: "Maximum file size in bytes for each uploaded file.",
		},
		{
			name: "onError",
			type: '(error: { code: \"max_files\" | \"max_file_size\" | \"accept\"; message: string }) => void',
			description: "Validation callback for file acceptance/size/count failures.",
		},
		{
			name: "className",
			type: "string",
			description: "Additional classes applied to the form wrapper.",
		},
		{
			name: "variant",
			type: '"default" | "floating"',
			default: '"default"',
			description: 'Visual variant. "floating" applies rounded border, input background, padding, and elevated shadow for overlay use.',
		},
		{
			name: "mentionSources",
			type: "RichTextMentionSources",
			description: "PromptInputTextarea prop. Catalog backing the inline `/` and `@` palette. Defaults to the unified editor-palette catalog built from the app directory; pass a custom catalog to scope skills/mentions per surface.",
		},
		{
			name: "onEditorReady",
			type: "(editor: Editor) => void",
			description: "PromptInputTextarea prop. Called once the tiptap editor mounts. Use it (or the forwarded ref, which points at the contentEditable DOM) to drive focus or measurement.",
		},
	],
	subComponents: [
		{ name: "PromptInputProvider", description: "Optional provider for externally controlled text input and attachments." },
		{ name: "PromptInputBody", description: "Body slot that wraps the main textarea input region." },
		{ name: "PromptInputTextarea", description: "Rich-text composer (tiptap) with Enter-to-submit, an inline `/` (skills) + `@` (mentions) palette, inline reference pills, and a configurable `mentionSources` catalog. Serializes to a plain string for `value`/`onChange`/`onSubmit`." },
		{ name: "PromptInputHeader", description: "Top aligned addon row for tabs, modes, or context chips." },
		{ name: "PromptInputFooter", description: "Bottom aligned addon row for tools and submit actions." },
		{ name: "PromptInputTools", description: "Inline tools container commonly used inside PromptInputFooter." },
		{ name: "PromptInputButton", description: "Action button primitive with optional tooltip support." },
		{ name: "PromptInputActionMenu", description: "Dropdown menu container for add/context actions." },
		{ name: "PromptInputActionMenuTrigger", description: "Menu trigger button specialized for PromptInput actions." },
		{ name: "PromptInputActionMenuContent", description: "Menu content panel aligned for prompt actions." },
		{ name: "PromptInputActionMenuItem", description: "Individual menu item for quick prompt actions." },
		{ name: "PromptInputActionAddAttachments", description: "Prebuilt menu item that opens the file picker." },
		{ name: "PromptInputSelect", description: "Select wrapper for model/reasoning/verbosity controls." },
		{ name: "PromptInputSubmit", description: "Submit/stop button with chat status-aware icon states." },
	],
	examples: [
		{ title: "Microphone + text send — default", description: "The default Rovo-style composer keeps dictation available and the send CTA visible. Send is disabled until text is ready; live chat is not enabled.", demoSlug: "prompt-input-demo-chat-composer" },
		{ title: "Microphone + live chat — opt-in", description: "An explicit live-chat variant that retains dictation. With an empty prompt, the live chat CTA replaces the disabled send CTA; while live chat is active, the action rail also exposes the AI cursor control.", demoSlug: "prompt-input-demo-chat-composer-live-voice" },
		{ title: "Microphone + live chat — compact", description: "A compact floating composer with dictation and the opt-in live chat CTA, using the default black Rovo button treatment.", demoSlug: "prompt-input-demo-floating-bar" },
		{ title: "Microphone + text send — compact", description: "A compact text-send composer that keeps dictation available and the send CTA visible, disabled while the prompt is empty and enabled once text is entered.", demoSlug: "prompt-input-demo-floating-bar-text-send" },
		{ title: "Microphone + text send — 24px", description: "The same compact text-send composer with 24×24 (`icon-xs`) Add, microphone, and send hits instead of the default 32/36 cluster.", demoSlug: "prompt-input-demo-floating-bar-text-send-icon-xs" },
	],
};
