# ui-custom Quick API Reference

> Sub-component listings and key props for all ui-custom compound components.

## Message (`components/ui-custom/message.tsx`)

| Sub-component | Purpose |
|---|---|
| `Message` | Root container, accepts `from` prop (`"user"` / `"assistant"`) |
| `MessageContent` | Content wrapper |
| `MessageResponse` | Markdown renderer (uses Streamdown) |
| `MessageActions` | Action button container |
| `MessageAction` | Individual action button with tooltip |
| `MessageToolbar` | Toolbar wrapper for message-level actions |
| `MessageBranch` | Response branch navigation root |
| `MessageBranchContent` | Content area within a branch |
| `MessageBranchSelector` | Branch selector controls |
| `MessageBranchPrevious` | Previous branch button |
| `MessageBranchNext` | Next branch button |
| `MessageBranchPage` | Branch page indicator |

Key props: `from`, `className`, `children`

## Conversation (`components/ui-custom/conversation.tsx`)

| Sub-component | Purpose |
|---|---|
| `Conversation` | Root scroll container with auto-scroll |
| `ConversationContent` | Content area inside scroll |
| `ConversationScrollButton` | Floating scroll-to-bottom button |
| `ConversationEmptyState` | Placeholder when no messages |
| `ConversationDownload` | Download conversation action |

Key props: `className`, `children`

## PromptInput (`components/ui-custom/prompt-input.tsx`)

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

## Suggestion (`components/ui-custom/suggestion.tsx`)

| Sub-component | Purpose |
|---|---|
| `Suggestions` | Horizontally scrollable container for suggestion chips |
| `Suggestion` | Individual clickable suggestion button |

Key props: `suggestion` (string, required), `onClick` (`(suggestion: string) => void`), `children` (optional, falls back to `suggestion` text)

## CodeBlock (`components/ui-custom/code-block.tsx`)

| Sub-component | Purpose |
|---|---|
| `CodeBlock` | Root with syntax highlighting |
| `CodeBlockHeader` | Header bar |
| `CodeBlockTitle` | Title area |
| `CodeBlockFilename` | Filename display |
| `CodeBlockActions` | Action buttons area |
| `CodeBlockCopyButton` | Copy-to-clipboard button |

Key props: `code`, `language`, `className`

## Other Components

| Component File | Purpose |
|---|---|
| `components/ui-custom/reasoning.tsx` | Reasoning/thinking expandable display |
| `components/ui-custom/shimmer.tsx` | Loading shimmer/skeleton animation |
| `components/ui-custom/model-selector.tsx` | AI model picker dropdown |

For the full categorized list of all 47 ui-custom modules, see `references/migration-catalog.md`.
