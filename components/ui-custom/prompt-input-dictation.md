# PromptInput dictation integration

`PromptInputDictationControl` is opt-in and presentation-only. The host owns
microphone permission, browser/API support detection, speech recognition,
transcript commits, and the state transition callbacks.

Direct PromptInput usage:

```tsx
<PromptInputDictationControl
	disabled={permission !== "granted"}
	mediaStream={micStream}
	onStart={startDictation}
	onStop={stopDictation}
	state={dictationState}
	supported={speechRecognitionSupported}
	transcriptPreview={latestTranscript}
/>
```

Use `"idle"`, `"listening"`, or `"processing"` for `state`. An unsupported
control renders nothing. A disabled control remains a native disabled button.

## Jira For You

Jira For You should consume the existing `RovoAppComposer` card chrome instead
of assembling the action rail itself. This preserves the sidebar-chat ordering:
attachment menu on the left, then dictation, Live chat, and submit actions on
the right. Use these integration props:

```tsx
<RovoAppComposer
	composerStatus="ready"
	dictationState={dictationState}
	dictationTranscriptPreview={dictationTranscriptPreview}
	hideReasoningSelector
	micStream={micStream}
	onStartDictation={startDictation}
	onStop={stopGeneration}
	onStopDictation={stopDictation}
	onSubmit={submitMessage}
	onToggleRealtimeVoice={toggleRealtimeVoice}
	prefillRequestKey={dictationPrefillRequestKey}
	prefillText={committedComposerText}
	realtimeVoiceActive={realtimeVoiceActive}
	realtimeVoiceState={realtimeVoiceState}
/>
```

- Live chat and submit use the black Rovo CTA treatment by default.
- `hideReasoningSelector` removes the model/reasoning selector without removing
  the attachment menu.
- Keep the final transcript in the host. Increment `prefillRequestKey` and pass
  the merged draft through `prefillText` when a dictation result is committed.
- Omit `onStartDictation` when dictation is unsupported; the microphone control
  is then absent. Permission failures stay in the host callback and state.
