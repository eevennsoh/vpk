const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function readSource(relativePath) {
	return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const STUDIO_ROUTE_HOOK_SOURCE = readSource("components/projects/studio/hooks/use-rovo-app.ts");
const ROVO_ROUTE_HOOK_SOURCE = readSource("components/projects/rovo/hooks/use-rovo-app.ts");
const CORE_HOOK_SOURCE = readSource("components/projects/rovo-core/hooks/use-rovo-app-core.ts");
const STUDIO_APP_ADAPTER_SOURCE = readSource("components/projects/studio/studio-app-adapter.ts");
const ROVO_APP_ADAPTER_SOURCE = readSource("components/projects/rovo/rovo-app-adapter.ts");
const CHAT_TRANSPORT_SOURCE = readSource("components/projects/rovo-core/hooks/use-rovo-app-chat-transport.ts");
const CHAT_REQUEST_BODY_SOURCE = readSource("components/projects/rovo-core/lib/rovo-app-chat-request-body.ts");

function assertIncludesAll(source, snippets) {
	for (const snippet of snippets) {
		assert.match(source, snippet);
	}
}

test("Studio useRovoApp remains a thin route adapter over shared Rovo core", () => {
	assertIncludesAll(STUDIO_ROUTE_HOOK_SOURCE, [
		/import \{ useRovoAppQueue \} from "@\/app\/studio\/rovo-queue-provider";/u,
		/import \{ usePersistentState \} from "@\/lib\/use-persistent-state";/u,
		/import \{ studioAppAdapter \} from "@\/components\/projects\/studio\/studio-app-adapter";/u,
		/import \{[\s\S]*useRovoAppCore,[\s\S]*type RovoAppHookOptions,[\s\S]*type RovoAppHookResult,[\s\S]*\} from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-core";/u,
		/const STUDIO_CLARIFICATION_BEHAVIOR = \{[\s\S]*dismissUsesPlanMode: true,[\s\S]*includeDeferredToolPlanMode: false,[\s\S]*rollbackFailedSend: true,[\s\S]*\} as const;/u,
		/usePersistentState<RovoAppSendMode>\("rovo-app-send-mode", "queue"\)/u,
		/return useRovoAppCore\(\{[\s\S]*clarificationBehavior: STUDIO_CLARIFICATION_BEHAVIOR,[\s\S]*queue,[\s\S]*routeAdapter: studioAppAdapter,[\s\S]*sendMode,[\s\S]*setSendMode,[\s\S]*\}\);/u,
	]);

	assert.doesNotMatch(STUDIO_ROUTE_HOOK_SOURCE, /DefaultChatTransport|useChat\(|fetchRovoApp|submitRovoApp|setInterval\(/u);
});

test("Rovo useRovoApp remains a thin route adapter over shared Rovo core", () => {
	assertIncludesAll(ROVO_ROUTE_HOOK_SOURCE, [
		/import \{ useRovoAppQueue \} from "@\/app\/rovo\/rovo-queue-provider";/u,
		/import \{ rovoAppAdapter \} from "@\/components\/projects\/rovo\/rovo-app-adapter";/u,
		/import \{[\s\S]*useRovoAppCore,[\s\S]*type RovoAppHookOptions,[\s\S]*type RovoAppHookResult,[\s\S]*\} from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-core";/u,
		/const ROVO_CLARIFICATION_BEHAVIOR = \{[\s\S]*dismissUsesPlanMode: false,[\s\S]*includeDeferredToolPlanMode: true,[\s\S]*rollbackFailedSend: false,[\s\S]*\} as const;/u,
		/const setSendMode = useCallback<RovoAppSendModeSetter>\(\(\) => \{\}, \[\]\);/u,
		/return useRovoAppCore\(\{[\s\S]*clarificationBehavior: ROVO_CLARIFICATION_BEHAVIOR,[\s\S]*queue,[\s\S]*routeAdapter: rovoAppAdapter,[\s\S]*sendMode: "queue",[\s\S]*setSendMode,[\s\S]*\}\);/u,
	]);

	assert.doesNotMatch(ROVO_ROUTE_HOOK_SOURCE, /usePersistentState|DefaultChatTransport|useChat\(|fetchRovoApp|submitRovoApp|setInterval\(/u);
});

test("Studio adapter opts into creation-mode chat body metadata without leaking into Rovo", () => {
	assertIncludesAll(STUDIO_APP_ADAPTER_SOURCE, [
		/createRovoAppRouteAdapter\(\{[\s\S]*rootPath: "\/studio",[\s\S]*chatRequestBodyOptions: \{[\s\S]*chatSdkSource: "studio",[\s\S]*includeCreationMode: true,[\s\S]*\},[\s\S]*\}\)/u,
		/export const ROVO_APP_ROOT_PATH = studioAppAdapter\.rootPath;/u,
	]);

	assertIncludesAll(ROVO_APP_ADAPTER_SOURCE, [
		/createRovoAppRouteAdapter\(\{[\s\S]*rootPath: "\/rovo",[\s\S]*\}\)/u,
		/export const ROVO_APP_ROOT_PATH = rovoAppAdapter\.rootPath;/u,
	]);
	assert.doesNotMatch(ROVO_APP_ADAPTER_SOURCE, /chatSdkSource|includeCreationMode/u);

	assertIncludesAll(CHAT_TRANSPORT_SOURCE, [
		/routeAdapter: RovoAppRouteAdapter;/u,
		/\.\.\.routeAdapter\.chatRequestBodyOptions,/u,
	]);
	assertIncludesAll(CHAT_REQUEST_BODY_SOURCE, [
		/chatSdkSource\?: "studio";/u,
		/includeCreationMode\?: boolean;/u,
		/const requestedCreationMode = getRovoAppRequestedCreationMode\(body, includeCreationMode\);/u,
		/\.\.\.\(chatSdkSource \? \{ chatSdkSource \} : \{\}\),/u,
		/\.\.\.\(requestedCreationMode \? \{ creationMode: requestedCreationMode \} : \{\}\),/u,
	]);
});

test("shared Rovo core owns orchestration through focused route-agnostic hooks", () => {
	assertIncludesAll(CORE_HOOK_SOURCE, [
		/import \{ useRovoAppPromptActions \} from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-prompt-actions";/u,
		/import \{ useRovoAppClarificationPlanActions \} from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-clarification-plan-actions";/u,
		/import \{ useRovoAppDelegationQueueActions \} from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-delegation-queue-actions";/u,
		/import \{ useRovoAppActiveTurnActions \} from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-active-turn-actions";/u,
		/import \{ useRovoAppThreadMutationActions \} from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-thread-mutation-actions";/u,
		/import \{ useRovoAppMessageEditActions \} from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-message-edit-actions";/u,
		/import \{ useRovoAppDataPartActions \} from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-data-part-actions";/u,
		/import \{ useRovoAppRunSideEffectActions \} from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-run-side-effect-actions";/u,
		/import \{ useRovoAppThreadLifecycleActions \} from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-thread-lifecycle-actions";/u,
		/import \{ useRovoAppBackgroundRefresh \} from "@\/components\/projects\/rovo-core\/hooks\/use-rovo-app-background-refresh";/u,
		/routeAdapter: RovoAppRouteAdapter;/u,
		/const \{[\s\S]*rootPath: ROVO_APP_ROOT_PATH,[\s\S]*\} = routeAdapter;/u,
		/useRovoAppChatTransport\(\{[\s\S]*routeAdapter,[\s\S]*\}\);/u,
	]);

	assert.doesNotMatch(CORE_HOOK_SOURCE, /@\/components\/projects\/studio\//u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /@\/components\/projects\/rovo\//u);
});
