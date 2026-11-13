# ui-custom Migration Catalog

Quick-lookup catalog of all ui-custom components grouped by category. Each entry includes the import path, description, primary sub-components, and link to the ai-elements reference doc.

Reference docs are at `~/.agents/skills/ai-elements/references/[slug].md`.

---

## Message / Chat Core

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| [message](~/.agents/skills/ai-elements/references/message.md) | `@/components/ui-custom/message` | Chat message display with role-based styling, markdown, actions, and branching | `Message`, `MessageContent`, `MessageResponse`, `MessageActions`, `MessageAction`, `MessageBranch` |
| [conversation](~/.agents/skills/ai-elements/references/conversation.md) | `@/components/ui-custom/conversation` | Auto-scrolling message container with scroll button and empty state | `Conversation`, `ConversationContent`, `ConversationScrollButton`, `ConversationEmptyState`, `ConversationDownload` |
| [prompt-input](~/.agents/skills/ai-elements/references/prompt-input.md) | `@/components/ui-custom/prompt-input` | Message input with textarea, submit, file attachments, model selector, and action menu | `PromptInput`, `Input`, `PromptInputTextarea`, `PromptInputSubmit`, `PromptInputBody`, `PromptInputHeader`, `PromptInputFooter`, `PromptInputTools`, `PromptInputSelect`, `PromptInputActionAddAttachments`, `PromptInputActionMenu`, `PromptInputButton` |
| [attachments](~/.agents/skills/ai-elements/references/attachments.md) | `@/components/ui-custom/attachment` | File attachment display with previews and remove functionality | `Attachment`, `AttachmentItem`, `AttachmentPreview`, `AttachmentRemove` |

## Content Display

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| [code-block](~/.agents/skills/ai-elements/references/code-block.md) | `@/components/ui-custom/code-block` | Syntax-highlighted code with copy button, line numbers, and filename display | `CodeBlock`, `CodeBlockHeader`, `CodeBlockTitle`, `CodeBlockFilename`, `CodeBlockActions`, `CodeBlockCopyButton` |
| [image](~/.agents/skills/ai-elements/references/image.md) | `@/components/ui-custom/image` | AI-generated image display | `Image` |
| [web-preview](~/.agents/skills/ai-elements/references/web-preview.md) | `@/components/ui-custom/web-preview` | Web page preview embed | `WebPreview` |
| [canvas](~/.agents/skills/ai-elements/references/canvas.md) | `@/components/ui-custom/canvas` | Canvas area for visual content | `Canvas` |

## AI Features

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| [reasoning](~/.agents/skills/ai-elements/references/reasoning.md) | `@/components/ui-custom/reasoning` | Expandable thinking/reasoning process display | `Reasoning` |
| [chain-of-thought](~/.agents/skills/ai-elements/references/chain-of-thought.md) | `@/components/ui-custom/chain-of-thought` | Step-by-step reasoning chain visualization | `ChainOfThought` |
| [tool](~/.agents/skills/ai-elements/references/tool.md) | `@/components/ui-custom/tool` | Tool invocation and result display | `Tool` |
| [terminal](~/.agents/skills/ai-elements/references/terminal.md) | `@/components/ui-custom/terminal` | Terminal/command output display | `Terminal` |

## User Feedback

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| [suggestion](~/.agents/skills/ai-elements/references/suggestion.md) | `@/components/ui-custom/suggestion` | Clickable suggestion chips/pills | `Suggestions`, `Suggestion` |
| [confirmation](~/.agents/skills/ai-elements/references/confirmation.md) | `@/components/ui-custom/confirmation` | Confirmation dialog for AI actions | `Confirmation` |
| [inline-citation](~/.agents/skills/ai-elements/references/inline-citation.md) | `@/components/ui-custom/inline-citation` | Inline source citation markers | `InlineCitation` |
| [sources](~/.agents/skills/ai-elements/references/sources.md) | `@/components/ui-custom/source` | Source reference list display | `Source` |

## Input Controls

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| [mic-selector](~/.agents/skills/ai-elements/references/mic-selector.md) | `@/components/ui-custom/mic-selector` | Microphone device selector | `MicSelector` |
| [voice-selector](~/.agents/skills/ai-elements/references/voice-selector.md) | `@/components/ui-custom/voice-selector` | Voice/TTS voice picker | `VoiceSelector` |
| [model-selector](~/.agents/skills/ai-elements/references/model-selector.md) | `@/components/ui-custom/model-selector` | AI model picker dropdown | `ModelSelector` |
| [audio-player](~/.agents/skills/ai-elements/references/audio-player.md) | `@/components/ui-custom/audio-player` | Audio playback controls | `AudioPlayer` |
| [speech-input](~/.agents/skills/ai-elements/references/speech-input.md) | `@/components/ui-custom/speech-input` | Voice-to-text input | `SpeechInput` |
| [open-in-chat](~/.agents/skills/ai-elements/references/open-in-chat.md) | `@/components/ui-custom/open-in-chat` | "Open in chat" action button | `OpenInChat` |

## Workflow

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| [checkpoint](~/.agents/skills/ai-elements/references/checkpoint.md) | `@/components/ui-custom/checkpoint` | Workflow checkpoint/milestone marker | `Checkpoint` |
| [commit](~/.agents/skills/ai-elements/references/commit.md) | `@/components/ui-custom/commit` | Code commit display | `Commit` |
| [stack-trace](~/.agents/skills/ai-elements/references/stack-trace.md) | `@/components/ui-custom/stack-trace` | Error stack trace display | `StackTrace` |
| [test-results](~/.agents/skills/ai-elements/references/test-results.md) | `@/components/ui-custom/test-result` | Test execution results display | `TestResult` |
| [file-tree](~/.agents/skills/ai-elements/references/file-tree.md) | `@/components/ui-custom/file-tree` | File system tree visualization | `FileTree` |
| [task](~/.agents/skills/ai-elements/references/task.md) | `@/components/ui-custom/task` | Task/step tracking display | `Task` |
| [plan](~/.agents/skills/ai-elements/references/plan.md) | `@/components/ui-custom/plan` | Multi-step plan visualization | `Plan` |

## Visual

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| [shimmer](~/.agents/skills/ai-elements/references/shimmer.md) | `@/components/ui-custom/shimmer` | Loading shimmer/skeleton animation | `Shimmer` |
| [toolbar](~/.agents/skills/ai-elements/references/toolbar.md) | `@/components/ui-custom/toolbar` | Toolbar with action buttons | `Toolbar` |
| [connection](~/.agents/skills/ai-elements/references/connection.md) | `@/components/ui-custom/connection` | Connection line between nodes | `Connection` |
| [edge](~/.agents/skills/ai-elements/references/edge.md) | `@/components/ui-custom/edge` | Graph edge visualization | `Edge` |
| [node](~/.agents/skills/ai-elements/references/node.md) | `@/components/ui-custom/node` | Graph node visualization | `Node` |
| [persona](~/.agents/skills/ai-elements/references/persona.md) | `@/components/ui-custom/persona` | AI persona/avatar display | `Persona` |

## Advanced

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| [jsx-preview](~/.agents/skills/ai-elements/references/jsx-preview.md) | `@/components/ui-custom/jsx-preview` | Live JSX preview renderer | `JsxPreview` |
| [sandbox](~/.agents/skills/ai-elements/references/sandbox.md) | `@/components/ui-custom/sandbox` | Sandboxed code execution environment | `Sandbox` |
| [package-info](~/.agents/skills/ai-elements/references/package-info.md) | `@/components/ui-custom/package-info` | Package/dependency information display | `PackageInfo` |
| [context](~/.agents/skills/ai-elements/references/context.md) | `@/components/ui-custom/context` | Context/memory display | `Context` |
| [controls](~/.agents/skills/ai-elements/references/controls.md) | `@/components/ui-custom/control` | Interactive parameter controls | `Control` |
| [environment-variables](~/.agents/skills/ai-elements/references/environment-variables.md) | `@/components/ui-custom/environment-variable` | Environment variable display/editor | `EnvironmentVariable` |
| [queue](~/.agents/skills/ai-elements/references/queue.md) | `@/components/ui-custom/queue` | Task queue display | `Queue` |
| [schema-display](~/.agents/skills/ai-elements/references/schema-display.md) | `@/components/ui-custom/schema-display` | Data schema visualization | `SchemaDisplay` |
| [snippet](~/.agents/skills/ai-elements/references/snippet.md) | `@/components/ui-custom/snippet` | Code snippet display (lightweight) | `Snippet` |
| [transcription](~/.agents/skills/ai-elements/references/transcription.md) | `@/components/ui-custom/transcription` | Audio/video transcription display | `Transcription` |
