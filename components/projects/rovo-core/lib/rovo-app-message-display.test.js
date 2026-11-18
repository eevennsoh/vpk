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

const { findDirectMediaFenceBody, findDirectMediaFences, stripDirectMediaFences, splitDirectMediaTextForStreaming } = require("../../../../backend/lib/direct-media-fence");
const { splitSpecFenceTextForStreaming } = require("../../../../backend/lib/tool-output-sanitizer");
const { isClassifierIntentLeakCandidate, parseClassifierIntentPayload } = require("../../../../backend/chat/classifier-intent");
const { createRovoTextOutputController } = require("../../../../backend/chat/rovo-text-output");

const MEDIA_OPENER = /```(?:image|audio)\s*\n/iu;
const collapseBlankLines = (text) => text.replace(/\n{3,}/g, "\n\n");

/**
 * `text` with each block the backend rule finds replaced by a paragraph break. An open block is cut
 * off (`open: "cut"`), replaced too (`"break"`), or left as written (`"raw"`).
 */
function replaceBlocksByRule(text, { open }) {
	let result = "";
	let at = 0;
	for (const fence of findDirectMediaFences(text)) {
		result += text.slice(at, fence.start);
		if (!fence.closed && open !== "break") {
			return open === "cut" ? result : `${result}${text.slice(fence.start)}`;
		}
		result += "\n\n";
		at = fence.end;
	}
	return `${result}${text.slice(at)}`;
}

/**
 * The backend's reading of `text`: blocks replaced, an open one left as written, and everything from
 * the first opener left in that cut off (`visible`). `partialOpener` says that opener comes before the
 * open block (or there is none): replacing a block completed it.
 */
function backendReading(text) {
	const raw = replaceBlocksByRule(text, { open: "raw" });
	const openStart = replaceBlocksByRule(text, { open: "cut" }).length;
	const opener = MEDIA_OPENER.exec(raw);
	return {
		cutOff: Boolean(opener),
		partialOpener: Boolean(opener) && opener.index < openStart,
		visible: opener ? raw.slice(0, opener.index) : raw,
	};
}

/** The wire for `chunks` streamed as production wires the controller, once the stream ends. */
function streamWire(chunks) {
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
}

/** The wire for every two-way chunking of `text`, blank lines collapsed, without repeats. */
function wiresOverChunkings(text) {
	const wires = new Set();
	for (let cut = 0; cut < text.length; cut += 1) {
		wires.add(collapseBlankLines(streamWire(cut === 0 ? [text] : [text.slice(0, cut), text.slice(cut)])));
	}
	return [...wires];
}

test("every media block reader ends a block where the backend rule does", () => {
	// The display keeps its own copy of the closing fence rule of backend/lib/direct-media-fence.js;
	// this fails when it drifts, or when the stripper, the generation body or the streamed wire end a
	// block anywhere else. Each reader is compared with what the rule gives it, including the three
	// ways the readers differ, each stated by a named test below and counted here:
	// - partial opener: the backend reads text left by a closed block as an opener when it completes
	//   one ("```image " then the block's paragraph break), and cuts there; the display does not. Once
	//   streamed, the wire has either reading, by chunking.
	// - spec order: streaming removes spec fences before media blocks, so the wire is the rule applied
	//   to the text without them; the other readers remove media blocks first.
	// - per kind: the generation body reads each kind's first opener with the rule, as if no other
	//   block came before it.
	const counted = { compared: 0, partialOpener: 0, partialOpenerWire: 0, perKind: 0, specOrder: 0, streamed: 0 };
	const [noBreakSpace, byteOrderMark, ideographicSpace, lineSeparator, paragraphSeparator] = [0xa0, 0xfeff, 0x3000, 0x2028, 0x2029].map((code) => String.fromCharCode(code));
	const openers = [`${T}image\n`, `${T}AUDIO \n`, `${T}audio\r\n`, `${T}image${ideographicSpace}\n`];
	const bodies = ["", "sunset", '{"prompt":"x"}', `{"prompt":"${T}js"}`, `plain ${T}js`, '{\n "a": "]}"\n}', "{open", `a ${T} b`, "line\n  ", `{"prompt":"x ${"`".repeat(6)}js"}`, `plain ${"`".repeat(4)} more`, `${byteOrderMark}{"prompt":"x"}\v`, `${paragraphSeparator}{"prompt":"${T}"}${noBreakSpace}`];
	const closers = ["", T, `\n${T}`, `${T}\n`, `${T} \n`, `${T}x`, ` ${T} y`, `\n  ${T} z`, `${T}\``, `${T}spec\n{}\n${T}`, `${"`".repeat(7)}\n`, `${T}${T}x`, `${noBreakSpace}${T}Outro`, `${T}${ideographicSpace}\f\nB`, `\n${lineSeparator}${T} z`];
	const tails = ["", "\nOutro", ` ${T}image\nmore`, "``", `\n${T}audio\nx${T}\n`, `\n${T}image ${T}audio\nx\n${T}`];
	for (const opener of openers) {
		for (const body of bodies) {
			for (const closer of closers) {
				for (const tail of tails) {
					const text = `Intro ${opener}${body}${closer}${tail}`;
					const label = JSON.stringify(text);
					assert.equal(removeRovoAppDirectMediaFences(text).text, collapseBlankLines(replaceBlocksByRule(text, { open: "break" })).trim(), label);
					const backend = backendReading(text);
					counted.partialOpener += backend.partialOpener ? 1 : 0;
					const stripped = backend.cutOff ? `${backend.visible}\n\n` : backend.visible;
					assert.equal(stripDirectMediaFences(text), collapseBlankLines(stripped.replace(/[ \t]+\n/g, "\n")).trim(), label);
					const fences = findDirectMediaFences(text);
					for (const kind of ["image", "audio"]) {
						const firstOfKind = new RegExp(`\`\`\`${kind}\\s*\\n`, "iu").exec(text);
						const own = firstOfKind ? findDirectMediaFences(text.slice(firstOfKind.index))[0] : null;
						counted.perKind += firstOfKind && fences.find((fence) => fence.kind === kind)?.start !== firstOfKind.index ? 1 : 0;
						assert.equal(findDirectMediaFenceBody(text, kind), own?.closed ? text.slice(firstOfKind.index + own.bodyStart, firstOfKind.index + own.bodyEnd) : null, `${kind} ${label}`);
					}
					const specless = splitSpecFenceTextForStreaming(text).visibleText;
					counted.specOrder += specless === text ? 0 : 1;
					const wire = backendReading(specless);
					const readings = [collapseBlankLines(wire.visible)];
					if (wire.partialOpener) {
						readings.push(collapseBlankLines(replaceBlocksByRule(specless, { open: "cut" })));
					}
					for (const streamed of wiresOverChunkings(text)) {
						assert.ok(readings.includes(streamed), `${label} wire ${JSON.stringify(streamed)}`);
						counted.partialOpenerWire += streamed === readings[0] ? 0 : 1;
					}
					counted.streamed += text.length;
					counted.compared += 1;
				}
			}
		}
	}
	assert.deepEqual(counted, { compared: 4680, partialOpener: 648, partialOpenerWire: 596, perKind: 86, specOrder: 312, streamed: 204810 });
});

test("a partial media opener before a closed block opens a block for the backend and not for the display", () => {
	// Text that ends in "```image " right before a closed block reads, once the block is replaced by
	// a paragraph break, as an opener: the backend hides from there, the display shows it. So it was
	// before the line-edge rule.
	const text = `Intro ${T}image ${T}audio\n{"prompt":"x"}\n${T}\nOutro`;
	assert.equal(stripDirectMediaFences(text), "Intro");
	assert.equal(removeRovoAppDirectMediaFences(text).text, `Intro ${T}image \n\nOutro`);
	assert.equal(sanitizeRovoAppAssistantText(text), `Intro ${T}image \n\nOutro`);
	assert.equal(findDirectMediaFenceBody(text, "image"), null);
	assert.equal(findDirectMediaFenceBody(text, "audio"), '{"prompt":"x"}\n');
	assert.deepEqual(wiresOverChunkings(text).sort(), ["Intro ", `Intro ${T}image \n\nOutro`]);
	assert.equal(streamWire([text]), "Intro ");
});

test("streaming removes spec fences before media blocks, and the display after them", () => {
	// A spec opener glued to the block's closing backticks is removed with its spec fence before the
	// media splitter runs, so the wire reads the block without that close; the display and the stripper
	// use it to close the block and show the spec fence's remains.
	const text = `A ${T}image\n{"prompt":"${T}js"}${T}spec\n{}\n${T}`;
	assert.deepEqual(wiresOverChunkings(text), ['A \n\njs"}\n\n']);
	assert.equal(stripDirectMediaFences(text), `A\n\nspec\n{}\n${T}`);
	assert.equal(removeRovoAppDirectMediaFences(text).text, `A \n\nspec\n{}\n${T}`);
	assert.equal(sanitizeRovoAppAssistantText(text), `A \n\nspec\n{}\n${T}`);
	assert.equal(findDirectMediaFenceBody(text, "image"), `{"prompt":"${T}js"}`);
	// With no backticks in the body, every reader gives what it did before the line-edge rule.
	const clean = `A ${T}image\n{"prompt":"x"}${T}spec\n{}\n${T}`;
	assert.deepEqual(wiresOverChunkings(clean), ["A "]);
	assert.equal(sanitizeRovoAppAssistantText(clean), `A \n\nspec\n{}\n${T}`);
	assert.equal(findDirectMediaFenceBody(clean, "image"), '{"prompt":"x"}');
});

test("the generation body reads each kind's first opener on its own", () => {
	// An audio opener inside an image block's body starts the audio body, as if the image block were not
	// there; the other readers hide it with the image block.
	const text = `Intro ${T}image\nsunset ${T}audio\n{"text":"x"}\n${T}`;
	assert.equal(findDirectMediaFenceBody(text, "image"), `sunset ${T}audio\n{"text":"x"}\n`);
	assert.equal(findDirectMediaFenceBody(text, "audio"), '{"text":"x"}\n');
	assert.equal(stripDirectMediaFences(text), "Intro");
	assert.equal(removeRovoAppDirectMediaFences(text).text, "Intro");
	assert.deepEqual(wiresOverChunkings(text), ["Intro \n\n"]);
});

test("removeRovoAppDirectMediaFences closes a block at backticks after any whitespace trim strips, as before", () => {
	// Before: only spaces, tabs or a carriage return counted, so a block whose closing backticks stood
	// after a no-break space ran on to the next fence on its own line: 'Intro\n\njs\ncode\n```'.
	const spaces = [...Array.from({ length: 0x10000 }, (_, code) => String.fromCharCode(code)).filter((char) => char !== "\n" && char.trim() === ""), ` \t${String.fromCharCode(0xa0)}\t ${String.fromCharCode(0x3000)}`];
	assert.equal(spaces.length, 25);
	const after = `\n${T}js\ncode\n${T}`;
	for (const space of spaces) {
		const replies = [
			[`Intro\n${T}image\n{"prompt":"x"}${space}${T}Outro`, "Intro\n\nOutro"],
			[`Intro\n${T}image\n${space}{"prompt":"x"}${space}${T}Outro`, "Intro\n\nOutro"],
			[`Intro\n${T}image\nsunset\n${space}${T}Outro`, "Intro\n\nOutro"],
			[`Intro\n${T}image\nsunset${T}${space}\nOutro`, `Intro\n\n${space}\nOutro`],
		];
		for (const [text, shown] of replies) {
			assert.deepEqual(removeRovoAppDirectMediaFences(text), { removed: true, text: shown }, JSON.stringify(text));
			assert.deepEqual(removeRovoAppDirectMediaFences(`${text}${after}`), { removed: true, text: `${shown}${after}` }, JSON.stringify(text));
		}
	}
});
