const test = require("node:test");
const assert = require("node:assert/strict");

const {
	getLatestVisibleRovoAppMessageIdByRole,
	getRovoAppAssistantSuggestionQuestions,
	getVisibleRovoAppMessages,
	ROVO_APP_ARTIFACT_INTENT_LEAK_FALLBACK,
	removeRovoAppDirectMediaFences,
	removeRovoAppSpecFences,
	sanitizeRovoAppAssistantText,
	looksLikeBrowserFallbackAssistantText,
	shouldRenderRovoAppAssistantActions,
	shouldRenderRovoAppAssistantText,
	shouldRenderRovoAppAssistantMessage,
	shouldRenderRovoAppVisibleWidget,
	shouldRenderRovoAppWidget,
} = require("./rovo-app-message-display.ts");

function createMessage(id, role, parts = [], metadata = undefined) {
	return {
		id,
		role,
		parts,
		...(metadata ? { metadata } : {}),
	};
}

test("filters hidden and non-conversation messages from the visible render model", () => {
	const messages = [
		createMessage("system-1", "system"),
		createMessage("user-1", "user"),
		createMessage("assistant-hidden", "assistant", [], { visibility: "hidden" }),
		createMessage("assistant-1", "assistant"),
	];
	assert.deepEqual(getVisibleRovoAppMessages(messages).map((message) => message.id), ["user-1", "assistant-1"]);
});

test("finds the latest visible message id by role", () => {
	const messages = [
		createMessage("user-1", "user"),
		createMessage("assistant-1", "assistant"),
		createMessage("user-2", "user"),
	];

	assert.equal(getLatestVisibleRovoAppMessageIdByRole(messages, "user"), "user-2");
	assert.equal(
		getLatestVisibleRovoAppMessageIdByRole(messages, "assistant"),
		"assistant-1",
	);
	assert.equal(getLatestVisibleRovoAppMessageIdByRole([], "assistant"), null);
});

test("shows suggested questions only for the latest assistant message", () => {
	const message = createMessage("assistant-1", "assistant", [
		{
			type: "data-suggested-questions",
			data: { questions: ["One?", 2, "Two?"] },
		},
	]);

	assert.deepEqual(
		getRovoAppAssistantSuggestionQuestions({
			lastAssistantMessageId: "assistant-1",
			message,
			shouldSuppressLatestAssistantSuggestions: false,
		}),
		["One?", "Two?"],
	);
	assert.deepEqual(
		getRovoAppAssistantSuggestionQuestions({
			lastAssistantMessageId: "assistant-2",
			message,
			shouldSuppressLatestAssistantSuggestions: false,
		}),
		[],
	);
	assert.deepEqual(
		getRovoAppAssistantSuggestionQuestions({
			lastAssistantMessageId: "assistant-1",
			message,
			shouldSuppressLatestAssistantSuggestions: true,
		}),
		[],
	);
});

test("shouldRenderRovoAppWidget keeps direct media widgets visible on text routes", () => {
	assert.equal(
		shouldRenderRovoAppWidget({
			hasBrowserScreenshots: false,
			hasWidget: true,
			routeDecision: { presentation: "text" },
			widgetType: "image-preview",
		}),
		true
	);
	assert.equal(
		shouldRenderRovoAppWidget({
			hasBrowserScreenshots: false,
			hasWidget: true,
			routeDecision: { presentation: "text" },
			widgetType: "audio-preview",
		}),
		true
	);
	assert.equal(
		shouldRenderRovoAppWidget({
			hasBrowserScreenshots: false,
			hasWidget: true,
			routeDecision: { presentation: "text" },
			widgetType: "video-preview",
		}),
		true
	);
});

test("shouldRenderRovoAppWidget hides non-tool widgets on text routes", () => {
	assert.equal(
		shouldRenderRovoAppWidget({
			hasBrowserScreenshots: false,
			hasWidget: true,
			routeDecision: { presentation: "text" },
			widgetType: "genui-preview",
		}),
		false
	);
});

test("shouldRenderRovoAppWidget allows route-owned extra tool-driven widget types", () => {
	assert.equal(
		shouldRenderRovoAppWidget({
			hasBrowserScreenshots: false,
			hasWidget: true,
			routeDecision: { presentation: "text" },
			widgetType: "studio-automation-artifact-list",
		}),
		false,
	);

	assert.equal(
		shouldRenderRovoAppWidget({
			additionalToolDrivenWidgetTypes: new Set([
				"studio-automation-artifact-list",
			]),
			hasBrowserScreenshots: false,
			hasWidget: true,
			routeDecision: { presentation: "text" },
			widgetType: "studio-automation-artifact-list",
		}),
		true,
	);
});

test("shouldRenderRovoAppWidget hides generic genui widgets when browser screenshots exist", () => {
	assert.equal(
		shouldRenderRovoAppWidget({
			hasBrowserScreenshots: true,
			hasWidget: true,
			routeDecision: { presentation: "genui_card" },
			widgetType: "genui-preview",
		}),
		false,
	);
});

test("removeRovoAppDirectMediaFences strips complete and incomplete direct-media fences", () => {
	const completeFence = removeRovoAppDirectMediaFences(
		"Intro\n```image\n{\"prompt\":\"Draw a cat\"}\n```\nOutro"
	);
	assert.equal(completeFence.removed, true);
	assert.equal(completeFence.text, "Intro\n\nOutro");

	const incompleteFence = removeRovoAppDirectMediaFences(
		"Intro\n```audio\n{\"text\":\"Narrate this\"}"
	);
	assert.equal(incompleteFence.removed, true);
	assert.equal(incompleteFence.text, "Intro");
});

test("removeRovoAppSpecFences strips spec fences and unfenced patch lines", () => {
	const fencedSpec = removeRovoAppSpecFences(
		"Intro\n```spec\n{\"op\":\"add\",\"path\":\"/root\",\"value\":\"main\"}\n```\nOutro"
	);
	assert.equal(fencedSpec.removed, true);
	assert.equal(fencedSpec.text, "Intro\n\nOutro");

	const unfencedPatch = removeRovoAppSpecFences(
		"Intro\n{\"op\":\"add\",\"path\":\"/root\",\"value\":\"main\"}\nOutro"
	);
	assert.equal(unfencedPatch.removed, true);
	assert.equal(unfencedPatch.text, "Intro\n\nOutro");
});

test("sanitizeRovoAppAssistantText falls back for artifact-intent leaks after fence removal", () => {
	const sanitizedText = sanitizeRovoAppAssistantText(
		'{"action":"createDocument","title":"Spec","kind":"text"}'
	);

	assert.equal(sanitizedText, ROVO_APP_ARTIFACT_INTENT_LEAK_FALLBACK);
});

test("sanitizeRovoAppAssistantText strips persisted spec fences from assistant text", () => {
	const sanitizedText = sanitizeRovoAppAssistantText(
		"Based on the supplied context, here's what I know about you.\n\n```spec\n{\"op\":\"add\",\"path\":\"/root\",\"value\":\"main\"}\n```\n\nThat's what I've got received so far."
	);

	assert.equal(
		sanitizedText,
		"Based on the supplied context, here's what I know about you.\n\nThat's what I've got received so far."
	);
});

test("looksLikeBrowserFallbackAssistantText detects misleading browser fallback prose", () => {
	assert.equal(
		looksLikeBrowserFallbackAssistantText(
			"The screenshot image itself isn't rendering visibly in the response. What would you like to do instead?",
		),
		true,
	);
	assert.equal(
		looksLikeBrowserFallbackAssistantText(
			"Captured a screenshot of the current page from the active browser workspace.",
		),
		false,
	);
});

test("shouldRenderRovoAppAssistantActions hides actions for the active in-flight assistant placeholder", () => {
	assert.equal(
		shouldRenderRovoAppAssistantActions({
			hasArtifactCard: false,
			hasBrowserScreenshots: false,
			hasAssistantText: false,
			hasInterruption: false,
			hasSources: false,
			hasWidget: false,
			hasWidgetError: false,
			isLastAssistant: true,
			isResponseInFlight: true,
		}),
		false,
	);
});

test("shouldRenderRovoAppAssistantActions shows actions for settled assistant output", () => {
	assert.equal(
		shouldRenderRovoAppAssistantActions({
			hasArtifactCard: false,
			hasBrowserScreenshots: false,
			hasAssistantText: true,
			hasInterruption: false,
			hasSources: false,
			hasWidget: false,
			hasWidgetError: false,
			isLastAssistant: true,
			isResponseInFlight: false,
		}),
		true,
	);
});

test("shouldRenderRovoAppAssistantText defers provisional tool-driven text until turn completion", () => {
	assert.equal(
		shouldRenderRovoAppAssistantText({
			hasText: true,
			hasTurnComplete: false,
			hasToolActivity: true,
			hasWidgetSignal: false,
			isFallbackRoute: false,
			isResponseInFlight: true,
			isTextPresentation: true,
			shouldRenderPlanWidget: false,
		}),
		false,
	);
});

test("shouldRenderRovoAppAssistantText renders settled text once the tool-driven turn completes", () => {
	assert.equal(
		shouldRenderRovoAppAssistantText({
			hasText: true,
			hasTurnComplete: true,
			hasToolActivity: true,
			hasWidgetSignal: false,
			isFallbackRoute: false,
			isResponseInFlight: false,
			isTextPresentation: true,
			shouldRenderPlanWidget: false,
		}),
		true,
	);
});

test("shouldRenderRovoAppAssistantText does not suppress ordinary streaming text turns without tool activity", () => {
	assert.equal(
		shouldRenderRovoAppAssistantText({
			hasText: true,
			hasTurnComplete: false,
			hasToolActivity: false,
			hasWidgetSignal: false,
			isFallbackRoute: false,
			isResponseInFlight: true,
			isTextPresentation: true,
			shouldRenderPlanWidget: false,
		}),
		true,
	);
});

test("shouldRenderRovoAppVisibleWidget hides resolved question cards", () => {
	assert.equal(
		shouldRenderRovoAppVisibleWidget({
			hasWidget: true,
			shouldHideResolvedQuestionCard: true,
		}),
		false,
	);
	assert.equal(
		shouldRenderRovoAppVisibleWidget({
			hasWidget: true,
			shouldHideResolvedQuestionCard: false,
		}),
		true,
	);
});

test("shouldRenderRovoAppAssistantActions hides actions for settled reasoning-only output", () => {
	assert.equal(
		shouldRenderRovoAppAssistantActions({
			hasArtifactCard: false,
			hasBrowserScreenshots: false,
			hasAssistantText: false,
			hasInterruption: false,
			hasSources: false,
			hasWidget: false,
			hasWidgetError: false,
			isLastAssistant: true,
			isResponseInFlight: false,
		}),
		false,
	);
});

test("shouldRenderRovoAppAssistantMessage hides the blank assistant placeholder shell", () => {
	assert.equal(
		shouldRenderRovoAppAssistantMessage({
			hasArtifactCard: false,
			hasBrowserScreenshots: false,
			hasAssistantText: false,
			hasInterruption: false,
			hasReasoning: false,
			hasSources: false,
			hasWidget: false,
			hasWidgetError: false,
		}),
		false,
	);
});

test("shouldRenderRovoAppAssistantMessage keeps rendering once thinking or content exists", () => {
	assert.equal(
		shouldRenderRovoAppAssistantMessage({
			hasArtifactCard: false,
			hasBrowserScreenshots: false,
			hasAssistantText: false,
			hasInterruption: false,
			hasReasoning: true,
			hasSources: false,
			hasWidget: false,
			hasWidgetError: false,
		}),
		true,
	);
});

test("shouldRenderRovoAppAssistantMessage keeps screenshot-only browser responses visible", () => {
	assert.equal(
		shouldRenderRovoAppAssistantMessage({
			hasArtifactCard: false,
			hasBrowserScreenshots: true,
			hasAssistantText: false,
			hasInterruption: false,
			hasReasoning: false,
			hasSources: false,
			hasWidget: false,
			hasWidgetError: false,
		}),
		true,
	);
});

test("shouldRenderRovoAppAssistantMessage does not keep a blank shell for loading-only widget state", () => {
	assert.equal(
		shouldRenderRovoAppAssistantMessage({
			hasArtifactCard: false,
			hasAssistantText: false,
			hasInterruption: false,
			hasReasoning: false,
			hasSources: false,
			hasWidget: false,
			hasWidgetError: false,
		}),
		false,
	);
});

const T = "```";

test("removeRovoAppDirectMediaFences keeps a media body with backticks hidden", () => {
	// Before: the block ended at the body's first backticks: text 'Intro\n\njs"}\n```\nOutro'.
	for (const block of [`${T}image\n{"prompt":"${T}js"}\n${T}`, `${T}audio\nplain ${T}js body\n${T}`]) {
		assert.deepEqual(removeRovoAppDirectMediaFences(`Intro\n${block}\nOutro`), { removed: true, text: "Intro\n\nOutro" }, block);
	}
	assert.deepEqual(removeRovoAppDirectMediaFences(`Intro\n${T}image\n{"prompt":"draw`), { removed: true, text: "Intro" });
	// With no close at a line edge, backticks with text on both sides of them close it, as before.
	assert.deepEqual(removeRovoAppDirectMediaFences(`Intro\n${T}image\nsunset${T}Outro`), { removed: true, text: "Intro\n\nOutro" });
});

test("every media block reader ends a block where the backend rule does", () => {
	// The display keeps its own copy of the closing fence rule of backend/lib/direct-media-fence.js;
	// this fails when it drifts, or when the stripper, the generation body or the streamed wire end a
	// block anywhere else. Two differences are allowed, each counted below:
	// - partial opener: text that ends in a partial opener ("```image ") right before a closed block
	//   becomes an opener in the backend's stripper and splitter, which the display does not copy;
	// - spec order: streaming removes spec fences before media fences, so the wire is compared with the
	//   rule applied to the text without them.
	// The generation body reads each kind on its own (per kind), so it is compared where that reading
	// starts at the same block.
	const { findDirectMediaFenceBody, findDirectMediaFences, stripDirectMediaFences, splitDirectMediaTextForStreaming } = require("../../../../backend/lib/direct-media-fence");
	const { splitSpecFenceTextForStreaming } = require("../../../../backend/lib/tool-output-sanitizer");
	const { isClassifierIntentLeakCandidate, parseClassifierIntentPayload } = require("../../../../backend/chat/classifier-intent");
	const { createRovoTextOutputController } = require("../../../../backend/chat/rovo-text-output");
	const OPENER = /```(?:image|audio)\s*\n/iu;
	const collapse = (text) => text.replace(/\n{3,}/g, "\n\n");
	/** `text` with each block the rule finds replaced by a paragraph break; an open one is cut off. */
	const byRule = (text, { cutOpen }) => {
		let result = "";
		let at = 0;
		for (const fence of findDirectMediaFences(text)) {
			result += text.slice(at, fence.start);
			if (!fence.closed && cutOpen) {
				return result;
			}
			result += "\n\n";
			at = fence.end;
		}
		return `${result}${text.slice(at)}`;
	};
	const streamWire = (chunks) => {
		const parts = [];
		const controller = createRovoTextOutputController({
			classifierJsonBufferMaxChars: 320,
			isClassifierIntentLeakCandidate,
			parseClassifierIntentPayload,
			splitDirectMediaTextForStreaming,
			splitSpecFenceTextForStreaming,
			textId: "text-test",
			writer: { write: (part) => parts.push(part) },
		});
		for (const chunk of chunks) {
			controller.emitTextDelta(chunk);
		}
		controller.finalizeBufferedAssistantText();
		return parts.filter((part) => part.type === "text-delta").map((part) => part.delta).join("");
	};
	const counted = { compared: 0, partialOpener: 0, perKind: 0, specOrder: 0, streamed: 0 };
	const openers = [`${T}image\n`, `${T}AUDIO \n`, `${T}audio\r\n`];
	const bodies = ["", "sunset", '{"prompt":"x"}', `{"prompt":"${T}js"}`, `plain ${T}js`, '{\n "a": "]}"\n}', "{open", `a ${T} b`, "line\n  ", `{"prompt":"x ${"`".repeat(6)}js"}`, `plain ${"`".repeat(4)} more`];
	const closers = ["", T, `\n${T}`, `${T}\n`, `${T} \n`, `${T}x`, ` ${T} y`, `\n  ${T} z`, `${T}\``, `${T}spec\n{}\n${T}`, `${"`".repeat(7)}\n`, `${T}${T}x`];
	const tails = ["", "\nOutro", ` ${T}image\nmore`, "``", `\n${T}audio\nx${T}\n`, `\n${T}image ${T}audio\nx\n${T}`];
	for (const opener of openers) {
		for (const body of bodies) {
			for (const closer of closers) {
				for (const tail of tails) {
					const text = `Intro ${opener}${body}${closer}${tail}`;
					const label = JSON.stringify(text);
					const replaced = byRule(text, { cutOpen: false });
					assert.equal(removeRovoAppDirectMediaFences(text).text, collapse(replaced).trim(), label);
					if (OPENER.test(replaced)) {
						counted.partialOpener += 1;
					} else {
						assert.equal(stripDirectMediaFences(text), collapse(replaced.replace(/[ \t]+\n/g, "\n")).trim(), label);
					}
					const fences = findDirectMediaFences(text);
					for (const kind of ["image", "audio"]) {
						const firstOfKind = new RegExp(`\`\`\`${kind}\\s*\\n`, "iu").exec(text);
						const fence = fences.find((candidate) => candidate.kind === kind);
						if (firstOfKind && fence?.start !== firstOfKind.index) {
							counted.perKind += 1;
						} else {
							assert.equal(findDirectMediaFenceBody(text, kind), fence?.closed ? text.slice(fence.bodyStart, fence.bodyEnd) : null, `${kind} ${label}`);
						}
					}
					const specless = splitSpecFenceTextForStreaming(text).visibleText;
					counted.specOrder += specless === text ? 0 : 1;
					const wireByRule = byRule(specless, { cutOpen: true });
					if (!OPENER.test(wireByRule)) {
						for (let cut = 0; cut < text.length; cut += 1) {
							const chunks = cut === 0 ? [text] : [text.slice(0, cut), text.slice(cut)];
							assert.equal(collapse(streamWire(chunks)), collapse(wireByRule), `${label} cut ${cut}`);
							counted.streamed += 1;
						}
					}
					counted.compared += 1;
				}
			}
		}
	}
	assert.deepEqual(counted, { compared: 2376, partialOpener: 318, perKind: 42, specOrder: 198, streamed: 84563 });
});
