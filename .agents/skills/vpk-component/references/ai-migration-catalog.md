# ui-custom Migration Catalog

Quick-lookup catalog of the VPK AI components grouped by category. Each entry includes the import path, description, and primary sub-components. A linked name has a shadcn AI Elements pattern or shadcn component page to mirror; an unlinked name is VPK-owned with no shadcn counterpart.

---

## Message / Chat Core

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| [message](https://ui.shadcn.com/docs/ai-elements/base/message) | `@/components/ui/message` | Chat message turn with start/end alignment and actions; user text via `MessageUserBubble`, markdown via `MessageResponse` (`@/components/ui-custom/message-markdown`) | `Message`, `MessageContent`, `MessageActions`, `MessageAction`, `MessageCopyAction`, `MessageVoteActions` |
| [conversation](https://ui.shadcn.com/docs/ai-elements/base/chat) | `@/components/ui/message-scroller` (see its Chat example) | Chat thread: Message Scroller with person turns as scroll anchors, scroll button, `Empty` for no messages | `MessageScroller`, `MessageScrollerViewport`, `MessageScrollerContent`, `MessageScrollerItem`, `MessageScrollerButton` |
| [prompt-input](https://ui.shadcn.com/docs/ai-elements/base/prompt-input) | `@/components/ui-custom/prompt-input` | Message input with textarea, submit, file attachments, model selector, and action menu | `PromptInput`, `Input`, `PromptInputTextarea`, `PromptInputSubmit`, `PromptInputBody`, `PromptInputHeader`, `PromptInputFooter`, `PromptInputTools`, `PromptInputSelect`, `PromptInputActionAddAttachments`, `PromptInputActionMenu`, `PromptInputButton` |
| [attachments](https://ui.shadcn.com/docs/components/base/attachment) | `@/components/ui/attachment` | File attachment display with previews and remove actions; AI SDK part helpers in `@/lib/attachment-media` | `AttachmentGroup`, `Attachment`, `AttachmentMedia`, `AttachmentContent`, `AttachmentAction` |

## Content Display

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| [code-block](https://ui.shadcn.com/docs/components/base/code-block) | `@/components/ui/code-block` | Syntax-highlighted code with copy button, line numbers, and filename display | `CodeBlock`, `CodeBlockHeader`, `CodeBlockTitle`, `CodeBlockFilename`, `CodeBlockActions`, `CodeBlockCopyButton`, `CodeBlockContent` |
| image | `@/components/ui-custom/image` | AI-generated image display | `Image` |
| web-preview | `@/components/ui-custom/web-preview` | Web page preview embed | `WebPreview` |
| canvas | `@/components/ui-custom/canvas` | Canvas area for visual content | `Canvas` |

## AI Features

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| [reasoning](https://ui.shadcn.com/docs/ai-elements/base/reasoning) | `@/components/ui/reasoning` | Expandable thinking/reasoning process display | `Reasoning` |
| [chain-of-thought](https://ui.shadcn.com/docs/ai-elements/base/chain-of-thought) | `@/components/ui/chain-of-thought` | Step-by-step reasoning chain visualization, on Trace | `ChainOfThought` |
| [tool](https://ui.shadcn.com/docs/ai-elements/base/tool) | `@/components/ui/tool` | Tool invocation and result display | `Tool` |
| [terminal](https://ui.shadcn.com/docs/ai-elements/base/terminal) | `@/components/ui/terminal` | Shell command line with streamed output, on Trace (`TerminalPanel` for full-pane IDE/TUI output) | `Terminal` |

## User Feedback

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| [suggestion](https://ui.shadcn.com/docs/ai-elements/base/suggestion) | `@/components/ui/suggestion` | Clickable suggestion chips/pills | `Suggestions`, `Suggestion` |
| [confirmation](https://ui.shadcn.com/docs/ai-elements/base/confirmation) | `@/components/ui-custom/confirmation` | Confirmation dialog for AI actions | `Confirmation` |
| [inline-citation](https://ui.shadcn.com/docs/ai-elements/base/inline-citation) | `@/components/ui-custom/inline-citation` | Inline source citation markers | `InlineCitation` |
| [sources](https://ui.shadcn.com/docs/ai-elements/base/sources) | `@/components/ui/sources` | Source reference list display | `Source` |

## Input Controls

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| mic-selector | `@/components/ui-custom/mic-selector` | Microphone device selector | `MicSelector` |
| voice-selector | `@/components/ui-custom/voice-selector` | Voice/TTS voice picker | `VoiceSelector` |
| [model-selector](https://ui.shadcn.com/docs/ai-elements/base/model-selector) | `@/components/ui-custom/model-selector` | AI model picker dropdown | `ModelSelector` |
| audio-player | `@/components/ui-custom/audio-player` | Audio playback controls | `AudioPlayer` |
| speech-input | `@/components/ui-custom/speech-input` | Voice-to-text input | `SpeechInput` |
| open-in-chat | `@/components/ui-custom/open-in-chat` | "Open in chat" action button | `OpenInChat` |

## Workflow

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| [checkpoint](https://ui.shadcn.com/docs/ai-elements/base/checkpoint) | `@/components/ui/checkpoint` | Workflow checkpoint/milestone marker | `Checkpoint` |
| [commit](https://ui.shadcn.com/docs/components/base/trace) | `@/components/ui/trace` | Code commit display (a Trace example) | `Trace` |
| [stack-trace](https://ui.shadcn.com/docs/ai-elements/base/stack-trace) | `@/components/ui/stack-trace` | Failed tool call with its stack frames, on Trace | `StackTrace` |
| [test-results](https://ui.shadcn.com/docs/ai-elements/base/test-results) | `@/components/ui/test-results` | Test run summary, suites and failures, on Trace | `TestResult` |
| [file-tree](https://ui.shadcn.com/docs/ai-elements/base/file-tree) | `@/components/ui-custom/file-tree` | File system tree visualization | `FileTree` |
| [task](https://ui.shadcn.com/docs/ai-elements/base/task) | `@/components/ui/task` | Task/step tracking display | `Task` |
| [agent](https://ui.shadcn.com/docs/ai-elements/base/subagent) | `@/components/ui/subagent` | Subagent run with its tool calls and result, on Trace | `Agent` |
| [plan](https://ui.shadcn.com/docs/ai-elements/base/plan) | `@/components/ui/plan` | Multi-step plan visualization (card, or `variant="inline"` Trace line) | `Plan` |

## Visual

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| shimmer | `@/components/ui/shimmer` | Loading shimmer/skeleton animation | `Shimmer` |
| toolbar | `@/components/ui-custom/toolbar` | Toolbar with action buttons | `Toolbar` |
| connection | `@/components/ui-custom/connection` | Connection line between nodes | `Connection` |
| edge | `@/components/ui-custom/edge` | Graph edge visualization | `Edge` |
| node | `@/components/ui-custom/node` | Graph node visualization | `Node` |
| persona | `@/components/ui-custom/persona` | AI persona/avatar display | `Persona` |

## Advanced

| Component | Import | Description | Primary Sub-components |
|---|---|---|---|
| jsx-preview | `@/components/ui-custom/jsx-preview` | Live JSX preview renderer | `JsxPreview` |
| sandbox | `@/components/ui-custom/sandbox` | Sandboxed code execution environment | `Sandbox` |
| package-info | `@/components/ui-custom/package-info` | Package/dependency information display | `PackageInfo` |
| [context](https://ui.shadcn.com/docs/ai-elements/base/context) | `@/components/ui-custom/context` | Context/memory display | `Context` |
| controls | `@/components/ui-custom/control` | Interactive parameter controls | `Control` |
| environment-variables | `@/components/ui-custom/environment-variable` | Environment variable display/editor | `EnvironmentVariable` |
| [queue](https://ui.shadcn.com/docs/ai-elements/base/queue) | `@/components/ui/queue` | Prompt queue (composer) or inline todo list (`variant="inline"`) | `Queue` |
| schema-display | `@/components/ui-custom/schema-display` | Data schema visualization | `SchemaDisplay` |
| snippet | `@/components/ui-custom/snippet` | Code snippet display (lightweight) | `Snippet` |
| transcription | `@/components/ui-custom/transcription` | Audio/video transcription display | `Transcription` |
