const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");
const { loadCjsModuleFromText } = require(path.join(process.cwd(), "scripts/lib/esbuild-cjs-loader.js"));

const MOCK_MODULES = new Map([
	[
		"@/app/data/directory/agents",
		`
			export const ROVO_AGENT_ID = "rovo";
			export function getRovoAgentProfile(id) {
				return {
					id,
					name: id === "rovo" ? "Rovo" : "Existing agent",
					byline: "Default agent",
					avatarSrc: "/avatar.svg",
					starters: [],
				};
			}
		`,
	],
	[
		"@/app/data/directory/repair-agent-result",
		`
			export function repairGeneratedAgentCatalog(result) {
				return result.instructions
					? { skills: ["repaired-skill"] }
					: {};
			}
		`,
	],
	[
		"@/components/blocks/conversation-starters",
		`
			export const DEFAULT_STARTER_ICON = "ai-chat";
			export function getStarterIcon(key) {
				return function StarterIcon() {
					return key;
				};
			}
		`,
	],
	[
		"@/components/projects/rovo-core/lib/agent-records/agent-creation-context",
		`
			export function applyTemplateDefaultsToResult(result) {
				return result.templateDefaults
					? { ...result, byline: result.byline || "Template default" }
					: result;
			}
		`,
	],
	[
		"./agent-creation-context",
		`
			export function applyTemplateDefaultsToResult(result) {
				return result.templateDefaults
					? { ...result, byline: result.byline || "Template default" }
					: result;
			}
		`,
	],
	[
		"@/lib/rovo-suggestions",
		`
			export function resolveConversationStarterVisualIdentity(input) {
				return {
					identitySeed: input.agentId + ":" + input.label,
					title: input.label,
				};
			}
		`,
	],
]);

async function loadSessionAgentEntryModule() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				export {
					buildSessionAgentProfileFromResult,
					createSessionAgentEntryFromResult,
					getStudioSessionAgentDisplayName,
					normalizeSessionAgentResult,
				} from "@/components/projects/rovo-core/lib/agent-records/session-agent-entry";
				export {
					createStudioAgentVersionRecord,
				} from "@/components/projects/rovo-core/lib/agent-records/agent-versioning";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "session-agent-entry-test-harness.ts",
		},
		bundle: true,
		format: "cjs",
		logLevel: "silent",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		plugins: [
			{
				name: "session-agent-entry-test-mocks",
				setup(build) {
					build.onResolve({ filter: /.*/ }, (args) =>
						MOCK_MODULES.has(args.path)
							? { path: args.path, namespace: "session-agent-entry-test-mock" }
							: undefined,
					);
					build.onLoad(
						{ filter: /.*/, namespace: "session-agent-entry-test-mock" },
						(args) => ({
							contents: MOCK_MODULES.get(args.path),
							loader: "ts",
							resolveDir: process.cwd(),
						}),
					);
				},
			},
		],
	});

	return loadCjsModuleFromText(result.outputFiles[0].text, "session-agent-entry.cjs");
}

const modulePromise = loadSessionAgentEntryModule();

test("keeps agent version records free of runtime id generation", () => {
	const source = readFileSync(
		path.join(process.cwd(), "components/projects/rovo-core/lib/agent-records/agent-versioning.ts"),
		"utf8",
	);

	assert.doesNotMatch(source, /randomUUID|Date\.now\(/u);
});

function makeAgentResult(overrides = {}) {
	return {
		action: "create",
		name: "Release Agent",
		summary: "Drafts release updates",
		...overrides,
	};
}

function makeProfile(overrides = {}) {
	return {
		id: "release-agent",
		name: "Release Agent",
		byline: "Existing profile",
		avatarSrc: "/avatar.svg",
		starters: [],
		...overrides,
	};
}

test("normalizes legacy names and starter variants into display-ready results", async () => {
	const {
		getStudioSessionAgentDisplayName,
		normalizeSessionAgentResult,
	} = await modulePromise;
	const normalized = normalizeSessionAgentResult(makeAgentResult({
		name: "New agent",
		suggestions: [
			{ label: "Review roadmap" },
			"Review roadmap",
			{ prompt: "Draft a launch update" },
		],
		starterIcons: ["calendar", "task"],
	}));

	assert.equal(normalized.name, "");
	assert.deepEqual(normalized.conversationStarters, [
		"Review roadmap",
		"Draft a launch update",
	]);
	assert.deepEqual(normalized.conversationStarterIcons, ["calendar", "task"]);
	assert.equal(getStudioSessionAgentDisplayName({ draftResult: normalized }), "Untitled agent");
});

test("creates session entries with suffixed identities, repaired catalog fields, and stable avatars", async () => {
	const {
		createSessionAgentEntryFromResult,
	} = await modulePromise;
	const originalNow = Date.now;
	Date.now = () => 1_700_000_000_001;
	try {
		const entry = createSessionAgentEntryFromResult({
			agentResult: makeAgentResult({
				instructions: "Use @[skill:unknown] for launch notes.",
				templateDefaults: true,
				conversationStarters: [
					{ label: "Plan the launch" },
					{ prompt: "Draft the release note" },
				],
			}),
			lastTouchedAt: 1_700_000_000_000,
			sessionAgentEntries: [],
			sourceKey: "message-1",
			staticAgentProfiles: [makeProfile()],
		});

		assert.ok(entry);
		assert.equal(entry.profile.id, "release-agent-2");
		assert.equal(entry.profile.name, "Release Agent 2");
		assert.equal(entry.profile.byline, "Template default");
		assert.equal(entry.lastTouchedAt, 1_700_000_000_000);
		assert.equal(entry.publishStatus, "testing");
		assert.match(entry.sourceResult.avatarSrc, /^\/avatar-agent-new\//u);
		assert.deepEqual(entry.sourceResult.skills, ["repaired-skill"]);
		assert.match(entry.resultKey, /^message-1:/u);
		assert.deepEqual(
			entry.profile.starters.map((starter) => starter.id),
			["release-agent-2-starter-1", "release-agent-2-starter-2"],
		);
		assert.match(entry.profile.contextDescription, /Agent: Release Agent 2/u);
		assert.match(entry.profile.contextDescription, /Instructions: Use @\[skill:unknown\]/u);
	} finally {
		Date.now = originalNow;
	}
});

test("returns an existing entry when a generated result key is already registered", async () => {
	const {
		createSessionAgentEntryFromResult,
	} = await modulePromise;
	const firstEntry = createSessionAgentEntryFromResult({
		agentResult: makeAgentResult({ name: "Ops Agent" }),
		lastTouchedAt: 1_700_000_000_000,
		sessionAgentEntries: [],
		sourceKey: "message-2",
		staticAgentProfiles: [],
	});
	assert.ok(firstEntry);

	const duplicate = createSessionAgentEntryFromResult({
		agentResult: makeAgentResult({ name: "Ops Agent" }),
		lastTouchedAt: 1_700_000_000_001,
		sessionAgentEntries: [firstEntry],
		sourceKey: "message-2",
		staticAgentProfiles: [],
	});

	assert.equal(duplicate, firstEntry);
});

test("builds agent profiles and version records outside the React provider", async () => {
	const {
		buildSessionAgentProfileFromResult,
		createStudioAgentVersionRecord,
	} = await modulePromise;
	const profile = buildSessionAgentProfileFromResult({
		agentResult: makeAgentResult({
			byline: "Release helper",
			description: "Turns Jira and Confluence context into release notes.",
			instructions: "Draft concise release updates.",
			tools: ["jira", "confluence"],
			conversationStarters: ["Summarize launch risk"],
		}),
		profileId: "release-helper",
		profileName: "Release Helper",
	});

	assert.equal(profile.id, "release-helper");
	assert.equal(profile.name, "Release Helper");
	assert.match(profile.contextDescription, /Tools: jira, confluence/u);
	assert.equal(profile.starters[0].visualIdentity.identitySeed, "release-helper:Summarize launch risk");

	const version = createStudioAgentVersionRecord({
		before: makeAgentResult({ name: "Before" }),
		createdAt: 1_700_000_000_100,
		createdBy: "",
		id: "version-update-2",
		kind: "update",
		snapshot: makeAgentResult({ name: "After" }),
		version: 2,
	});

	assert.equal(version.id, "version-update-2");
	assert.equal(version.label, "1 update");
	assert.equal(version.createdBy, "Venn Soh");
	assert.equal(version.version, 2);
	assert.equal(version.changeSummary.count, 1);
});
