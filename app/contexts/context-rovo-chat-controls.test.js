const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const { test } = require("node:test");
const ts = require("typescript");

// Execute the real provider with a persistent memo slot. This checks its selected
// inputs, not React's implementation: message-only changes must not enter them.
function createProviderHarness() {
	let previousDependencies;
	let previousValue;
	let consumedValue = null;
	const exports = {};
	const source = ts.transpileModule(readFileSync(join(__dirname, "context-rovo-chat-controls.tsx"), "utf8"), {
		compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
	}).outputText;
	runInNewContext(source, {
		exports,
		require(id) {
			if (id === "react/jsx-runtime") return { jsx: (_type, props) => props };
			if (id !== "react") throw new Error(`Unexpected runtime import: ${id}`);
			return {
				createContext: () => ({}),
				use: () => consumedValue,
				useMemo(create, dependencies) {
					if (!previousDependencies || dependencies.some((value, index) => !Object.is(value, previousDependencies[index]))) {
						previousValue = create();
						previousDependencies = dependencies;
					}
					return previousValue;
				},
			};
		},
	});
	return { ...exports, consume: (value) => { consumedValue = value; } };
}

function controls() {
	return {
		chatSurface: null, isOpen: false,
		openChat() {}, closeChat() {}, toggleChat() {}, selectAgent() {}, applyLocalTurn() {},
	};
}

test("message and queue updates preserve the controls context identity", () => {
	const harness = createProviderHarness();
	const value = controls();
	const first = harness.RovoChatControlsProvider({ value: { ...value, uiMessages: [] }, children: "workspace" });
	const next = harness.RovoChatControlsProvider({ value: { ...value, uiMessages: [{ text: "next token" }], queueCount: 3 }, children: "workspace" });
	assert.equal(next.value, first.value);
	assert.equal(next.children, "workspace");
	assert.equal("uiMessages" in next.value, false);
	assert.equal("queueCount" in next.value, false);
});

test("surface transitions and replacement actions publish current controls", () => {
	const harness = createProviderHarness();
	const value = controls();
	const first = harness.RovoChatControlsProvider({ value });
	let called = false;
	const next = harness.RovoChatControlsProvider({ value: { ...value, chatSurface: "floating", isOpen: true, closeChat: () => { called = true; } } });
	assert.notEqual(next.value, first.value);
	assert.equal(next.value.chatSurface, "floating");
	assert.equal(next.value.isOpen, true);
	next.value.closeChat();
	assert.equal(called, true);
});

test("optional controls support provider-free blocks; required controls fail clearly", () => {
	const harness = createProviderHarness();
	assert.equal(harness.useOptionalRovoChatControls(), null);
	assert.throws(() => harness.useRovoChatControls(), /within a RovoChatProvider/u);
	const value = controls();
	harness.consume(value);
	assert.equal(harness.useRovoChatControls(), value);
});
