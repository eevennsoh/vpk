# ui-custom Quick API Reference

> Sub-component listings and key props for all ui-custom compound components.

## Message (`components/ui/message.tsx`)

| Sub-component | Purpose |
|---|---|
| `Message` | Row for one turn; `align="end"` for the person's turn, `"start"` (default) for the agent |
| `MessageContent` | Column holding bubbles, markdown, attachments, and the footer |
| `MessageActions` | Footer row for action buttons; `reveal="hover"` hides it until hover/focus on md+ |
| `MessageAction` | Ghost icon button with a tooltip; `label` is the accessible name |
| `MessageCopyAction` / `MessageEditAction` / `MessageVoteActions` / `MessageRegenerateAction` | VPK preset actions |

Render the person's text with `MessageUserBubble` (`components/ui-custom/message-user-bubble.tsx`) and agent markdown with `MessageResponse` (`components/ui-custom/message-markdown.tsx`).

Key props: `align`, `className`, `children`

## Conversation (`components/ui-custom/conversation.tsx`)

| Sub-component | Purpose |
|---|---|
| `Conversation` | Root scroll container with auto-scroll |
| `ConversationContent` | Content area inside scroll |
| `ConversationScrollButton` | Floating scroll-to-bottom button |
| `ConversationEmptyState` | Placeholder when no messages |
| `ConversationDownload` | Download conversation action |

Key props: `className`, `children`

## PromptInput (`components/ui-custom/prompt-input/`)

| Sub-component | Purpose |
|---|---|
| `PromptInput` / `Input` | Root form container (`Input` is an alias for `PromptInput`) |
| `PromptInputTextarea` | Auto-resizing textarea |
| `PromptInputSubmit` | Submit button |
| `PromptInputMicrophone` | Microphone/voice input button (ghost icon, renders `MicIcon` by default) |
| `PromptInputBody` | Layout wrapper for textarea area |
| `PromptInputHeader` / `PromptInputFooter` | Header/footer slots |
| `PromptInputTools` | Tool bar area |
| `PromptInputSelect` | Model selector dropdown |
| `PromptInputActionAddAttachments` | File attachment button |
| `PromptInputActionMenu` | Action menu dropdown |
| `PromptInputActionMenuTrigger` | Trigger button for action menu |
| `PromptInputActionMenuItem` | Menu item (use `onSelect`, not `onClick`) |
| `PromptInputButton` | Generic action button |
| `PromptInputHoverCard` | Hover-triggered flyout (Base UI PreviewCard) |
| `PromptInputHoverCardTrigger` | Trigger element for hover card |
| `PromptInputHoverCardContent` | Content panel for hover card (renders via Portal) |
| `PromptInputCommand` | cmdk Command wrapper for searchable menus |
| `PromptInputCommandInput` | Search input inside Command |
| `PromptInputCommandList` | Scrollable list container for Command items |
| `PromptInputCommandItem` | Individual Command item |
| `PromptInputCommandGroup` | Grouped Command items with heading |
| `PromptInputCommandEmpty` | Empty state for Command |
| `PromptInputCommandSeparator` | Visual separator between Command groups |
| `PromptInputTab` | Tab container for file/context lists |
| `PromptInputTabLabel` | Tab section label |
| `PromptInputTabBody` | Tab section body |
| `PromptInputTabItem` | Individual tab item |

Key props: `onSubmit`, `className`, `children`

## Suggestion (`components/ui/suggestion.tsx`)

| Sub-component | Purpose |
|---|---|
| `Suggestions` | Scroll-fade row, or a vertical stack with `orientation="vertical"` |
| `Suggestion` | Subtle Button with a leading curved-arrow icon |

Key props: `suggestion` (string, required), `onClick` (`(suggestion: string) => void`), `children` (optional, falls back to `suggestion` text)

## CodeBlock (`components/ui/code-block.tsx`)

| Sub-component | Purpose |
|---|---|
| `CodeBlock` | Container (`variant`, `size`) |
| `CodeBlockHeader` | Header bar |
| `CodeBlockTitle` | Title area |
| `CodeBlockFilename` | Filename display |
| `CodeBlockActions` | Action buttons area |
| `CodeBlockCopyButton` | Copy-to-clipboard button (`value`) |
| `CodeBlockContent` | Scrollable `<pre>` (`lineNumbers`, `wrap`) |
| `CodeBlockLine` | One line of code |

Highlighted content: `HighlightedCodeContent` (`components/ui-custom/highlighted-code-content.tsx`, props `code`, `language`) or `useHighlightedCode` (`hooks/use-highlighted-code.ts`).

## Other Components

| Component File | Purpose |
|---|---|
| `components/ui/reasoning.tsx` | Reasoning/thinking expandable display |
| `components/ui/shimmer.tsx` | Loading shimmer/skeleton animation |
| `components/ui-custom/model-selector.tsx` | AI model picker dropdown |

For the full categorized list of all 47 ui-custom modules, see [ai-migration-catalog.md](ai-migration-catalog.md).
