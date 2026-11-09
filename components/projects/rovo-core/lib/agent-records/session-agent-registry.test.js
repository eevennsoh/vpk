const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { beforeEach } = test;
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
			export function repairGeneratedAgentCatalog() {
				return {};
			}
		`,
	],
	[
		"@/components/blocks/conversation-starter",
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
		"@/lib/agent-avatars",
		`
			export function getDeterministicAgentAvatarSrc(seed) {
				return "/avatar-agent/" + (seed || "default") + ".svg";
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
	[
		"@/lib/utils",
		`
			export function isPlainRecord(value) {
				return typeof value === "object" && value !== null && !Array.isArray(value);
			}
		`,
	],
	[
		"./agent-creation-context",
		`
			export function applyTemplateDefaultsToResult(result) {
				return result;
			}
		`,
	],
]);

async function loadSessionAgentRegistryModule() {
	const result = await esbuild.build({
		stdin: {
			contents: `
				export {
					STUDIO_SESSION_AGENT_SAVE_DEBOUNCE_MS,
					commitSessionAgentPublishReadyEntry,
					mergeRehydratedSessionAgentEntries,
					persistSessionAgentEntries,
					publishSessionAgentEntry,
					registerSessionAgentFromResult,
					rehydrateSessionAgentEntriesFromStorage,
					removeSessionAgentEntry,
					restoreSessionAgentVersionEntry,
					touchSessionAgentEntry,
					updateSessionAgentDraftEntry,
				} from "@/components/projects/rovo-core/lib/agent-records/session-agent-registry";
			`,
			loader: "ts",
			resolveDir: process.cwd(),
			sourcefile: "session-agent-registry-test-harness.ts",
		},
		bundle: true,
		format: "cjs",
		logLevel: "silent",
		platform: "node",
		tsconfig: path.join(process.cwd(), "tsconfig.json"),
		write: false,
		plugins: [
			{
				name: "session-agent-registry-test-mocks",
				setup(build) {
					build.onResolve({ filter: /.*/ }, (args) =>
						MOCK_MODULES.has(args.path)
							? { path: args.path, namespace: "session-agent-registry-test-mock" }
							: undefined,
					);
					build.onLoad(
						{ filter: /.*/, namespace: "session-agent-registry-test-mock" },
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

	return loadCjsModuleFromText(result.outputFiles[0].text, "session-agent-registry.cjs");
}

const modulePromise = loadSessionAgentRegistryModule();

function installStorageShim(mutator = {}) {
	const store = new Map();
	const shim = {
		getItem(key) {
			return store.has(key) ? store.get(key) : null;
		},
		setItem(key, value) {
			if (mutator.setItem) {
				mutator.setItem(key, value);
			}
			store.set(key, value);
		},
		removeItem(key) {
			store.delete(key);
		},
		clear() {
			store.clear();
		},
		key(index) {
			return Array.from(store.keys())[index] ?? null;
		},
		get length() {
			return store.size;
		},
	};

	globalThis.window = { localStorage: shim };
	globalThis.localStorage = shim;

	return store;
}

beforeEach(() => {
	installStorageShim();
});

function makeAgentResult(overrides = {}) {
	return {
		agentId: "release-agent",
		name: "Release Agent",
		summary: "Drafts release updates",
		action: "create",
		description: "Drafts release updates",
		...overrides,
	};
}

function makeStaticAgentProfile(overrides = {}) {
	return {
		id: "existing-agent",
		name: "Existing agent",
		byline: "Default agent",
		avatarSrc: "/avatar.svg",
		starters: [],
		...overrides,
	};
}

async function registerEntry(overrides = {}, options = {}) {
	const {
		registerSessionAgentFromResult,
	} = await modulePromise;

	return registerSessionAgentFromResult({
		agentResult: makeAgentResult(overrides),
		entries: options.entries ?? [],
		lastTouchedAt: options.lastTouchedAt ?? 1_700_000_000_000,
		sourceKey: options.sourceKey ?? "message-1",
		staticAgentProfiles: options.staticAgentProfiles ?? [],
	});
}

async function publishEntry(entry, versionIds = ["version-publish-1"], now = 1_700_000_001_000) {
	const {
		publishSessionAgentEntry,
	} = await modulePromise;
	let index = 0;

	return publishSessionAgentEntry({
		createVersionId(kind) {
			return versionIds[index++] ?? `version-${kind}-${index}`;
		},
		entries: [entry],
		now,
		profileId: entry.profile.id,
	});
}

test("registers session agents and dedupes by resultKey", async () => {
	const {
		STUDIO_SESSION_AGENT_SAVE_DEBOUNCE_MS,
	} = await modulePromise;

	assert.equal(STUDIO_SESSION_AGENT_SAVE_DEBOUNCE_MS, 900);

	const first = await registerEntry(
		{ name: "Release Agent" },
		{
			lastTouchedAt: 1_700_000_000_001,
			staticAgentProfiles: [makeStaticAgentProfile({ id: "release-agent", name: "Release Agent" })],
		},
	);

	assert.equal(first.changed, true);
	assert.equal(first.created, true);
	assert.equal(first.entries.length, 1);
	assert.equal(first.entry.profile.id, "release-agent");
	assert.equal(first.entry.lastTouchedAt, 1_700_000_000_001);

	const duplicate = await registerEntry(
		{ name: "Release Agent" },
		{
			entries: first.entries,
			lastTouchedAt: 1_700_000_000_099,
			staticAgentProfiles: [makeStaticAgentProfile({ id: "release-agent", name: "Release Agent" })],
		},
	);

	assert.equal(duplicate.changed, true);
	assert.equal(duplicate.created, false);
	assert.equal(duplicate.entries.length, 1);
	assert.equal(duplicate.entry.profile.id, first.entry.profile.id);
	assert.equal(duplicate.entry.resultKey, first.entry.resultKey);
	assert.equal(duplicate.entry.lastTouchedAt, 1_700_000_000_099);
	assert.equal(duplicate.entries[0].lastTouchedAt, 1_700_000_000_099);
});

test("updates drafts and touches entries with explicit timestamps", async () => {
	const {
		touchSessionAgentEntry,
		updateSessionAgentDraftEntry,
	} = await modulePromise;
	const registered = await registerEntry({ name: "Release Agent" });
	const entry = registered.entry;

	const updated = updateSessionAgentDraftEntry({
		entries: registered.entries,
		lastTouchedAt: 1_700_000_000_100,
		patch: {
			name: "Launch Agent",
			description: "Turns launch notes into stakeholder updates",
		},
		profileId: entry.profile.id,
	});

	assert.equal(updated.changed, true);
	assert.equal(updated.entry.lastTouchedAt, 1_700_000_000_100);
	assert.equal(updated.entry.draftResult.name, "Launch Agent");
	assert.equal(updated.entry.profile.name, "Launch Agent");
	assert.equal(updated.entry.publishStatus, "testing");

	const touched = touchSessionAgentEntry(
		updated.entries,
		entry.profile.id,
		1_700_000_000_200,
	);

	assert.equal(touched.changed, true);
	assert.equal(touched.entry.lastTouchedAt, 1_700_000_000_200);
	assert.deepEqual(touched.entry.draftResult, updated.entry.draftResult);

	const missing = touchSessionAgentEntry(touched.entries, "missing-agent", 1_700_000_000_300);
	assert.equal(missing.changed, false);
	assert.equal(missing.entry, null);
	assert.deepEqual(missing.entries, touched.entries);
});

test("publishes entries with metadata and prepends version history", async () => {
	const {
		commitSessionAgentPublishReadyEntry,
		publishSessionAgentEntry,
		updateSessionAgentDraftEntry,
	} = await modulePromise;
	const registered = await registerEntry({ name: "Release Agent" });
	const firstPublish = publishSessionAgentEntry({
		createVersionId: () => "version-publish-1",
		entries: registered.entries,
		now: 1_700_000_001_000,
		profileId: registered.entry.profile.id,
	});

	assert.equal(firstPublish.changed, true);
	assert.equal(firstPublish.entry.publishStatus, "published");
	assert.equal(firstPublish.entry.publishedVersion, 1);
	assert.equal(firstPublish.entry.lastPublishedAt, 1_700_000_001_000);
	assert.equal(firstPublish.entry.lastPublishedBy, "Venn Soh");
	assert.deepEqual(firstPublish.entry.publishedResult, registered.entry.publishReadyResult);
	assert.equal(firstPublish.entry.versionHistory.length, 1);
	assert.equal(firstPublish.entry.versionHistory[0].id, "version-publish-1");
	assert.equal(firstPublish.entry.versionHistory[0].kind, "publish");
	assert.equal(firstPublish.entry.versionHistory[0].label, "Agent published");
	assert.equal(firstPublish.entry.versionHistory[0].version, 1);
	assert.equal(firstPublish.entry.versionHistory[0].createdAt, 1_700_000_001_000);

	const draftUpdate = updateSessionAgentDraftEntry({
		entries: firstPublish.entries,
		lastTouchedAt: 1_700_000_001_100,
		patch: { description: "Drafts launch, release, and exec updates" },
		profileId: registered.entry.profile.id,
	});
	const publishReady = commitSessionAgentPublishReadyEntry(
		draftUpdate.entries,
		registered.entry.profile.id,
		1_700_000_001_200,
	);
	const secondPublish = publishSessionAgentEntry({
		createVersionId: () => "version-update-2",
		entries: publishReady.entries,
		now: 1_700_000_001_300,
		profileId: registered.entry.profile.id,
	});

	assert.equal(secondPublish.entry.publishedVersion, 2);
	assert.equal(secondPublish.entry.lastPublishedAt, 1_700_000_001_300);
	assert.equal(secondPublish.entry.versionHistory.length, 2);
	assert.equal(secondPublish.entry.versionHistory[0].id, "version-update-2");
	assert.equal(secondPublish.entry.versionHistory[0].kind, "update");
	assert.equal(secondPublish.entry.versionHistory[0].label, "1 update");
	assert.equal(secondPublish.entry.versionHistory[0].version, 2);
	assert.equal(secondPublish.entry.versionHistory[1].id, "version-publish-1");
});

test("restores a prior version into a rollback draft with rollback history", async () => {
	const {
		commitSessionAgentPublishReadyEntry,
		publishSessionAgentEntry,
		restoreSessionAgentVersionEntry,
		updateSessionAgentDraftEntry,
	} = await modulePromise;
	const registered = await registerEntry({ name: "Release Agent", description: "First version" });
	const firstPublish = publishSessionAgentEntry({
		createVersionId: () => "version-publish-1",
		entries: registered.entries,
		now: 1_700_000_001_000,
		profileId: registered.entry.profile.id,
	});
	const draftUpdate = updateSessionAgentDraftEntry({
		entries: firstPublish.entries,
		lastTouchedAt: 1_700_000_001_100,
		patch: { description: "Second version" },
		profileId: registered.entry.profile.id,
	});
	const publishReady = commitSessionAgentPublishReadyEntry(
		draftUpdate.entries,
		registered.entry.profile.id,
		1_700_000_001_200,
	);
	const secondPublish = publishSessionAgentEntry({
		createVersionId: () => "version-update-2",
		entries: publishReady.entries,
		now: 1_700_000_001_300,
		profileId: registered.entry.profile.id,
	});

	const restored = restoreSessionAgentVersionEntry({
		createVersionId: () => "version-rollback-2",
		entries: secondPublish.entries,
		now: 1_700_000_001_400,
		profileId: registered.entry.profile.id,
		versionId: "version-publish-1",
	});

	assert.equal(restored.changed, true);
	assert.equal(restored.entry.lastTouchedAt, 1_700_000_001_400);
	assert.equal(restored.entry.publishStatus, "testing");
	assert.equal(restored.entry.publishedVersion, 2);
	assert.equal(restored.entry.draftResult.description, "First version");
	assert.equal(restored.entry.publishedResult.description, "Second version");
	assert.equal(restored.entry.versionHistory.length, 3);
	assert.equal(restored.entry.versionHistory[0].id, "version-rollback-2");
	assert.equal(restored.entry.versionHistory[0].kind, "rollback");
	assert.equal(restored.entry.versionHistory[0].label, "Rollback prepared");
	assert.equal(restored.entry.versionHistory[0].version, 2);
	assert.equal(restored.entry.versionHistory[0].snapshot.description, "First version");
});

test("removes entries by profile id and leaves misses unchanged", async () => {
	const {
		removeSessionAgentEntry,
	} = await modulePromise;
	const first = await registerEntry({ name: "Release Agent" }, { sourceKey: "message-1" });
	const second = await registerEntry(
		{ agentId: "support-agent", name: "Support Agent" },
		{ entries: first.entries, sourceKey: "message-2" },
	);

	const removed = removeSessionAgentEntry(second.entries, first.entry.profile.id);
	assert.equal(removed.changed, true);
	assert.equal(removed.removed, true);
	assert.deepEqual(
		removed.entries.map((entry) => entry.profile.id),
		[second.entry.profile.id],
	);

	const missing = removeSessionAgentEntry(removed.entries, "missing-agent");
	assert.equal(missing.changed, false);
	assert.equal(missing.removed, false);
	assert.notEqual(missing.entries, removed.entries);
	assert.deepEqual(missing.entries, removed.entries);
});

test("mergeRehydratedSessionAgentEntries dedupes by profile id and result key", async () => {
	const {
		mergeRehydratedSessionAgentEntries,
	} = await modulePromise;
	const current = await registerEntry({ name: "Release Agent" }, { sourceKey: "message-1" });
	const duplicateProfile = await registerEntry(
		{ agentId: "duplicate-profile", name: "Duplicate Profile" },
		{ sourceKey: "message-2" },
	);
	const duplicateKey = await registerEntry(
		{ agentId: "duplicate-key", name: "Duplicate Key" },
		{ sourceKey: "message-3" },
	);
	const unique = await registerEntry(
		{ agentId: "unique-agent", name: "Unique Agent" },
		{ sourceKey: "message-4" },
	);
	const rehydratedEntries = [
		{
			...duplicateProfile.entry,
			profile: {
				...duplicateProfile.entry.profile,
				id: current.entry.profile.id,
			},
		},
		{
			...duplicateKey.entry,
			resultKey: current.entry.resultKey,
		},
		unique.entry,
	];

	const merged = mergeRehydratedSessionAgentEntries(current.entries, rehydratedEntries);

	assert.equal(merged.changed, true);
	assert.deepEqual(
		merged.entries.map((entry) => entry.profile.id),
		[current.entry.profile.id, unique.entry.profile.id],
	);

	const noChange = mergeRehydratedSessionAgentEntries(current.entries, rehydratedEntries.slice(0, 2));
	assert.equal(noChange.changed, false);
	assert.deepEqual(noChange.entries, current.entries);
});

test("persists and rehydrates entries through the registry storage helpers", async () => {
	const {
		persistSessionAgentEntries,
		rehydrateSessionAgentEntriesFromStorage,
	} = await modulePromise;
	const registered = await registerEntry({
		name: "Release Agent",
		conversationStarters: ["Draft a launch update"],
	});
	const published = await publishEntry(registered.entry, ["version-publish-1"], 1_700_000_002_000);

	assert.equal(persistSessionAgentEntries(published.entries), true);

	const rehydrated = rehydrateSessionAgentEntriesFromStorage();

	assert.equal(rehydrated.length, 1);
	assert.equal(rehydrated[0].profile.id, published.entry.profile.id);
	assert.equal(rehydrated[0].profile.name, "Release Agent");
	assert.equal(rehydrated[0].resultKey, published.entry.resultKey);
	assert.deepEqual(rehydrated[0].draftResult, published.entry.draftResult);
	assert.deepEqual(rehydrated[0].publishedResult, published.entry.publishedResult);
	assert.equal(rehydrated[0].publishStatus, "published");
	assert.equal(rehydrated[0].publishedVersion, 1);
	assert.equal(rehydrated[0].lastPublishedAt, 1_700_000_002_000);
	assert.equal(rehydrated[0].versionHistory.length, 1);
	assert.equal(rehydrated[0].versionHistory[0].id, "version-publish-1");
	assert.equal(rehydrated[0].versionHistory[0].kind, "publish");
});
