# Migration detail

Use this reference during discovery and mapping. It keeps family selection and
source-specific hazards out of the skill interface.

## Contents

- [Source hierarchy](#source-hierarchy)
- [Family resolver](#family-resolver)
- [Duplicate-name resolver](#duplicate-name-resolver)
- [Detection checklist](#detection-checklist)
- [Mapping rules](#mapping-rules)
- [Migration gotchas](#migration-gotchas)

## Source hierarchy

1. Read the target file, folder, or component URL and classify it as local
   custom code, ai-elements, ElevenLabs UI, or another third-party library.
2. Inspect `components/ui` and `components/ui-custom`
   for an existing VPK target.
3. For ai-elements, read the matching global ai-elements reference when local
   source is insufficient.
4. For ElevenLabs or another library, use official docs, source examples, or a
   registry payload only when the local VPK port is missing or incomplete.
5. Trace providers, callbacks, schemas, playback state, transcript state, and
   controlled props through the consuming surface.
6. For generic UI or a clear Atlassian interaction, use ADS planning and the
   relevant accessibility guidance. Use the official migration guide for
   legacy spotlight/onboarding patterns.

## Family resolver

| Behavior | Preferred family |
| --- | --- |
| Chat thread, assistant messages, prompt composer, reasoning, suggestions, code blocks | `components/ui-custom/*` |
| Audio player, waveform, transcript playback, voice picker, microphone selection, standalone speech capture | `components/ui-custom/*` |
| General presentational component without AI/voice behavior | `components/ui/*` |
| ai-elements component | Usually `components/ui-custom/*` |
| ElevenLabs component | Usually `components/ui-custom/*` |
| Unknown third-party component | Choose by behavior, then nearest VPK family |

The source library's folder structure does not determine VPK ownership.

## Duplicate-name resolver

| Need | Use |
| --- | --- |
| AI/chat message with rich response, actions, or branching | `ui-custom/message` |
| Assistant chat thread container | `ui-custom/conversation` |
| AI SDK speech playback in assistant widgets | `ui-custom/audio-player` |
| Inline composer microphone | `PromptInputMicrophone` or `ui-custom/speech-input` |
| Composer microphone selector | `ui-custom/mic-selector` |

Alias imports whenever multiple families or a local type use the same name.

## Detection checklist

### AI and chat

| Source pattern | Likely target |
| --- | --- |
| Role-styled message bubble | `Message` + `MessageContent` |
| Markdown/HTML response renderer | `MessageResponse` |
| Copy, retry, like, dislike | `MessageActions` + `MessageAction` |
| Response versions | `MessageBranch` |
| Scroll-to-bottom thread | `Conversation` family |
| Welcome or no-message view | `ConversationEmptyState` |
| Message textarea and send button | `PromptInput` family |
| Composer dictation | `PromptInputMicrophone` |
| Uploads and attachment pills | `Attachments` + `Attachment` |
| Prompt chips | `Suggestions` + `Suggestion` |
| Syntax-highlighted code | `CodeBlock` family |
| Expandable thinking | `Reasoning` |
| Streaming placeholder | `Shimmer` |
| Model/provider dropdown | `ModelSelector` |

### Voice and audio

| Source pattern | Likely target |
| --- | --- |
| Play, pause, progress, speed | `AudioPlayerProvider` and controls |
| Static or scrolling audio bars | `LiveWaveform` |
| Device-reactive waveform | `LiveWaveform` |
| Mic dropdown or mute toggle | `MicSelector` |
| Standalone transcription | `SpeechInput` |

### Generic libraries

- Replace generic controls with an existing `components/ui` primitive.
- Replace a thin styling wrapper with the existing primitive or a thin adapter.
- For a genuine behavioral gap, create the smallest VPK-native composition and
  wire its docs and examples immediately.

## Mapping rules

Classify each mapping as exact, approximate, or a gap. Record the target family,
prop/event changes, and why any adapter remains. Preserve callbacks and
controlled state. Normalize naming only at a thin adapter boundary; do not
blindly carry upstream naming into VPK.

- Assistant rich text uses `ui-custom/MessageResponse`.
- Plain voice/transcript labels remain plain children.
- Prefer composition to reimplementation.
- Preserve local hooks when they own behavior not covered by the target.
- Use semantic VPK tokens and primitives when upstream visuals conflict.

For icon-only controls, provide an accessible label. Keep decorative icon
labels empty. Use `onSelect` where VPK menu items depend on selection semantics,
and do not assume an upstream `asChild` API exists locally.

## Migration gotchas

### ElevenLabs generator collision

Do not run the ElevenLabs installer into the repo root. It expects different
`components.json` conventions and writes into `components/ui`. Inspect generated
source in a scratch area and translate it into `components/ui-custom`.

### Canonical demos

Update the matching demo under `components/website/demos/ui` or `ui-custom` first. Feature surfaces should follow that pattern rather than
developing divergent local composition.

### InputGroupTextarea chrome

When the outer input group owns the border and hover treatment,
`InputGroupTextarea` must render its inner `Textarea` with `variant="none"`.
Do not counteract the inner default hover state with ad hoc overrides.

### TypeScript coverage

All project component families are included in the repository TypeScript check.
Fix type errors rather than masking them.
