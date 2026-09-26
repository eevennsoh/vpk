const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

function loadHelpers() {
	const result = esbuild.buildSync({
		entryPoints: [path.join(process.cwd(), "app/contexts/rovo-chat-helpers.ts")],
		bundle: true,
		format: "cjs",
		loader: {
			".css": "empty",
		},
		logLevel: "silent",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
	});

	return loadCjsModuleFromText(result.outputFiles[0].text, "rovo-chat-helpers.cjs");
}

const {
	buildSelectableAgents,
	buildCompactThreadPersistKey,
	buildSendMessageBody,
	deriveCompactThreadTitle,
	didAssistantCompleteActivePrompt,
	clearSkillInvocationForEdit,
	hasTurnCompleteForPrompt,
	isPayloadTooLargeError,
	mergeSendPromptOptions,
	sanitizeMessagesForTransport,
} = loadHelpers();

test("editing a structured skill invocation removes only its stale display metadata", () => {
	assert.deepEqual(clearSkillInvocationForEdit({
		source: "jira-issue-generative-action",
		skillInvocation: {
			id: "skill:design-landing-page",
			label: "Design landing page",
			instruction: "for Jira issue PAY-124.",
		},
	}), {
		source: "jira-issue-generative-action",
	});
	assert.equal(clearSkillInvocationForEdit(undefined), undefined);
});

test("buildSelectableAgents keeps static order while session profiles override matching ids", () => {
	const agents = buildSelectableAgents(
		[
			{ id: "static-a", name: "Static A", byline: "Static", avatarSrc: "/static-a.png" },
			{ id: "shared", name: "Static shared", byline: "Static", avatarSrc: "/static-shared.png" },
		],
		[
			{
				profile: {
					id: "shared",
					name: "Edited shared",
					byline: "Session",
					avatarSrc: "/session-shared.png",
					logoName: "github-copilot",
					brandName: "GitHub Copilot",
				},
			},
			{
				profile: {
					id: "session-only",
					name: "Session only",
					byline: "Session",
					avatarSrc: "/session-only.png",
				},
			},
		],
	);

	assert.deepEqual(agents.map((agent) => agent.id), ["static-a", "shared", "session-only"]);
	assert.deepEqual(agents[1], {
		id: "shared",
		name: "Edited shared",
		byline: "Session",
		avatarSrc: "/session-shared.png",
		logoName: "github-copilot",
		brandName: "GitHub Copilot",
	});
});

test("mergeSendPromptOptions merges prompt context without dropping nested metadata", () => {
	const merged = mergeSendPromptOptions(
		{
			contextDescription: "Default context",
			messageMetadata: {
				source: "default",
			},
			smartGeneration: {
				enabled: true,
				surface: "sidebar",
			},
		},
		{
			contextDescription: "Local context",
			messageMetadata: {
				urgency: "high",
			},
			smartGeneration: {
				widthClass: "wide",
			},
		},
	);

	assert.equal(merged.messageMetadata.source, "default");
	assert.equal(merged.messageMetadata.urgency, "high");
	assert.equal(merged.smartGeneration.enabled, true);
	assert.equal(merged.smartGeneration.widthClass, "wide");
	assert.match(merged.contextDescription, /Default context/u);
	assert.match(merged.contextDescription, /Local context/u);
});

test("sanitizeMessagesForTransport drops inline file payloads and masks nested data URLs", () => {
	const messages = [
		{
			id: "m1",
			role: "user",
			parts: [
				{ type: "text", text: "hello" },
				{
					type: "file",
					url: "data:image/png;base64,abc",
					mediaType: "image/png",
				},
				{
					type: "data-widget",
					data: {
						image: "data:image/png;base64,def",
						plain: "keep",
					},
				},
			],
		},
	];

	const sanitized = sanitizeMessagesForTransport(messages);

	assert.equal(sanitized[0].parts.length, 2);
	assert.equal(sanitized[0].parts[0].type, "text");
	assert.deepEqual(sanitized[0].parts[1].data, {
		image: "[inline data omitted]",
		plain: "keep",
	});
});

test("compact thread helpers preserve stable persistence and titles", () => {
	assert.equal(deriveCompactThreadTitle(""), "New chat");
	assert.equal(
		deriveCompactThreadTitle("   This is a very long request that should become a compact thread title with an ellipsis   "),
		"This is a very long request that should becom...",
	);
	assert.equal(
		buildCompactThreadPersistKey("thread-1", [{ id: "m1", role: "user", parts: [] }]),
		JSON.stringify({ threadId: "thread-1", messages: [{ id: "m1", role: "user", parts: [] }] }),
	);
});

test("chat request body and payload errors stay normalized", () => {
	assert.deepEqual(
		buildSendMessageBody(
			{
				backendPreference: "rovo",
				clientTimeZone: "  Australia/Sydney  ",
				creationMode: "agent",
			},
			true,
		),
		{
			approval: undefined,
			backendPreference: "rovo",
			clarification: undefined,
			clientTimeZone: "Australia/Sydney",
			contextDescription: undefined,
			creationMode: "agent",
			deferredToolResponse: undefined,
			hasQueuedPrompts: true,
			planRequestId: undefined,
			smartGeneration: undefined,
			userName: undefined,
		},
	);
	assert.equal(isPayloadTooLargeError(JSON.stringify({ error: { message: "PayloadTooLargeError" } })), true);
});

test("turn-complete matching ignores stale timestamps before the active prompt", () => {
	const prompt = {
		id: "queued-1",
		text: "Generate the report",
		files: [],
		createdAt: Date.parse("2026-07-07T00:00:02.000Z"),
	};

	assert.equal(
		hasTurnCompleteForPrompt({
			id: "assistant-current",
			role: "assistant",
			parts: [
				{
					type: "data-turn-complete",
					data: { timestamp: "2026-07-07T00:00:01.000Z" },
				},
			],
		}, prompt),
		true,
	);
	assert.equal(
		hasTurnCompleteForPrompt({
			id: "assistant-stale",
			role: "assistant",
			parts: [
				{
					type: "data-turn-complete",
					data: { timestamp: "2026-07-07T00:00:00.999Z" },
				},
			],
		}, prompt),
		false,
	);
	assert.equal(
		hasTurnCompleteForPrompt({
			id: "assistant-legacy",
			role: "assistant",
			parts: [{ type: "data-turn-complete", data: {} }],
		}, prompt),
		true,
	);
});

test("assistant completion matches the active queued prompt by nearest user text or files", () => {
	const filePart = {
		type: "file",
		url: "https://example.test/report.png",
		filename: "report.png",
		mediaType: "image/png",
	};
	const assistantMessage = {
		id: "assistant",
		role: "assistant",
		parts: [{ type: "data-turn-complete", data: {} }],
	};

	assert.equal(
		didAssistantCompleteActivePrompt([
			{
				id: "user-text",
				role: "user",
				parts: [{ type: "text", text: "Generate the report" }],
			},
			assistantMessage,
		], 1, {
			id: "queued-text",
			text: "  Generate the report  ",
			files: [],
			createdAt: 0,
		}),
		true,
	);
	assert.equal(
		didAssistantCompleteActivePrompt([
			{
				id: "user-file",
				role: "user",
				parts: [filePart],
			},
			assistantMessage,
		], 1, {
			id: "queued-file",
			text: "",
			files: [filePart],
			createdAt: 0,
		}),
		true,
	);
	assert.equal(
		didAssistantCompleteActivePrompt([
			{
				id: "user-previous",
				role: "user",
				parts: [{ type: "text", text: "Generate the report" }],
			},
			assistantMessage,
			assistantMessage,
		], 2, {
			id: "queued-blocked",
			text: "Generate the report",
			files: [],
			createdAt: 0,
		}),
		false,
	);
});


test("chat transport discards retired context metadata supplied by older clients", () => {
	const body = buildSendMessageBody({ hermesContext: { selectedSkillIds: ["old-skill"] } }, false);
	assert.equal(Object.hasOwn(body, "hermesContext"), false);
});
