const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT_DIR = process.cwd();

function readProjectFile(filePath) {
	return fs.readFileSync(path.join(ROOT_DIR, filePath), "utf8");
}

const CORE_HOOK_SOURCE = readProjectFile("components/projects/rovo-core/hooks/use-clicky-voice.ts");
const DEFAULT_WRAPPER_SOURCE = readProjectFile("components/projects/rovo-core/hooks/use-default-clicky-voice.ts");
const ROVO_WRAPPER_SOURCE = readProjectFile("components/projects/rovo/hooks/use-clicky-voice.ts");
const STUDIO_WRAPPER_SOURCE = readProjectFile("components/projects/studio/hooks/use-clicky-voice.ts");

test("Clicky voice lifecycle is owned by rovo-core", () => {
	assert.match(CORE_HOOK_SOURCE, /export function useClickyVoiceCore/u);
	assert.match(CORE_HOOK_SOURCE, /const wasActiveRef = useRef\(false\);/u);
	assert.match(CORE_HOOK_SOURCE, /const hasInjectedPromptRef = useRef\(false\);/u);
	assert.match(CORE_HOOK_SOURCE, /const connectedForClickyRef = useRef\(false\);/u);
	assert.match(CORE_HOOK_SOURCE, /if \(isClickyActive && !wasActiveRef\.current\) \{[\s\S]*connectRealtime\(\);/u);
	assert.match(CORE_HOOK_SOURCE, /type: "initial_context",[\s\S]*content: getInitialContextContent\(\),/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /buildStudioAssistantKnowledgeContext/u);
	assert.doesNotMatch(CORE_HOOK_SOURCE, /You are an app-owned screen assistant/u);
});

test("Rovo and Studio Clicky voice hooks are prompt wrappers over core", () => {
	assert.match(
		STUDIO_WRAPPER_SOURCE,
		/import \{[\s\S]*useClickyVoiceCore,[\s\S]*type UseClickyVoiceCoreOptions,[\s\S]*\} from "@\/components\/projects\/rovo-core\/hooks\/use-clicky-voice";/u,
	);
	assert.match(
		STUDIO_WRAPPER_SOURCE,
		/export type UseClickyVoiceOptions = Omit<[\s\S]*UseClickyVoiceCoreOptions,[\s\S]*"getInitialContextContent"[\s\S]*>;/u,
	);
	assert.match(STUDIO_WRAPPER_SOURCE, /useClickyVoiceCore\(\{[\s\S]*getInitialContextContent:/u);
	assert.doesNotMatch(STUDIO_WRAPPER_SOURCE, /const wasActiveRef = useRef\(false\);/u);
	assert.doesNotMatch(STUDIO_WRAPPER_SOURCE, /const hasInjectedPromptRef = useRef\(false\);/u);

	assert.match(ROVO_WRAPPER_SOURCE, /useDefaultClickyVoice\(\{/u);
	assert.match(ROVO_WRAPPER_SOURCE, /getDefaultClickyInitialContextContent as getRovoClickyInitialContextContent/u);
	assert.doesNotMatch(ROVO_WRAPPER_SOURCE, /const wasActiveRef = useRef\(false\);/u);
	assert.doesNotMatch(ROVO_WRAPPER_SOURCE, /const hasInjectedPromptRef = useRef\(false\);/u);
	assert.match(STUDIO_WRAPPER_SOURCE, /function getStudioClickyInitialContextContent\(\): string \{[\s\S]*buildStudioAssistantKnowledgeContext\(\)/u);
});

test("default Clicky voice prompt is owned by rovo-core for non-route surfaces", () => {
	assert.match(DEFAULT_WRAPPER_SOURCE, /export const DEFAULT_CLICKY_SYSTEM_INSTRUCTIONS = `You are an app-owned screen assistant/u);
	assert.match(DEFAULT_WRAPPER_SOURCE, /export function useDefaultClickyVoice/u);
	assert.match(DEFAULT_WRAPPER_SOURCE, /useClickyVoiceCore\(\{[\s\S]*getInitialContextContent: getDefaultClickyInitialContextContent/u);
	assert.match(ROVO_WRAPPER_SOURCE, /from "@\/components\/projects\/rovo-core\/hooks\/use-default-clicky-voice"/u);
	assert.doesNotMatch(ROVO_WRAPPER_SOURCE, /You are an app-owned screen assistant/u);
});
