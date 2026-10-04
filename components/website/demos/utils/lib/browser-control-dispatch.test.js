const assert = require("node:assert/strict");
const { test } = require("node:test");
const { dispatchBrowserControl } = require("./browser-control-dispatch.ts");

const commands = [
	{ type: "click", x: 125, y: 80 },
	{ type: "wheel", x: 100, y: 200, deltaX: -4, deltaY: 75 },
	{ type: "paste", text: "Pasted\ntext" },
	{ type: "key", key: "a", code: "KeyA" },
	{ type: "key", key: "Enter", code: "Enter", ctrlKey: true, shiftKey: true },
];
const previewPayloads = [
	[{ type: "preview-click", x: 125, y: 80 }],
	[{ type: "preview-wheel", x: 100, y: 200, deltaX: -4, deltaY: 75 }],
	[{ type: "preview-paste", text: "Pasted\ntext" }],
	[
		{ type: "preview-key", eventType: "keyDown", key: "a", code: "KeyA", text: "a" },
		{ type: "preview-key", eventType: "keyUp", key: "a", code: "KeyA" },
	],
	[
		{ type: "preview-key", eventType: "keyDown", key: "Enter", code: "Enter", text: undefined },
		{ type: "preview-key", eventType: "keyUp", key: "Enter", code: "Enter" },
	],
];
const workspacePayloads = [
	{ action: "click", body: { x: 125, y: 80 } },
	{ action: "wheel", body: { deltaX: -4, deltaY: 75 } },
	{ action: "type", body: { text: "Pasted\ntext" } },
	{ action: "type", body: { text: "a" } },
	{ action: "press", body: { key: "Control+Shift+Enter" } },
];

function harness(previewResult) {
	const previewCalls = [];
	const workspaceCalls = [];
	return {
		previewCalls, workspaceCalls,
		delivery: {
			preview: previewResult === null ? null : (message) => {
				previewCalls.push(message);
				return typeof previewResult === "function" ? previewResult(message) : previewResult;
			},
			workspace: async (action, body) => { workspaceCalls.push({ action, body }); },
		},
	};
}

test("accepted preview controls preserve wire payloads and never send HTTP actions", async () => {
	for (const [index, command] of commands.entries()) {
		const { delivery, previewCalls, workspaceCalls } = harness(true);
		await dispatchBrowserControl(command, delivery);
		assert.deepEqual(previewCalls, previewPayloads[index]);
		assert.deepEqual(workspaceCalls, []);
	}
});

test("unavailable and rejected preview delivery fall back once with workspace payloads", async () => {
	for (const result of [null, false]) {
		for (const [index, command] of commands.entries()) {
			const { delivery, previewCalls, workspaceCalls } = harness(result);
			await dispatchBrowserControl(command, delivery);
			assert.deepEqual(workspaceCalls, [workspacePayloads[index]]);
			assert.deepEqual(previewCalls, result === null ? [] : [previewPayloads[index][0]]);
		}
	}
});

test("a socket failure before acceptance falls back once", async () => {
	const { delivery, previewCalls, workspaceCalls } = harness(() => { throw new Error("Socket closed"); });
	await dispatchBrowserControl(commands[0], delivery);
	assert.equal(previewCalls.length, 1);
	assert.deepEqual(workspaceCalls, [workspacePayloads[0]]);
});

test("a rejected or failing key release never replays an accepted keyDown over HTTP", async () => {
	for (const release of [() => false, () => { throw new Error("Socket closed after keyDown"); }]) {
		const { delivery, previewCalls, workspaceCalls } = harness((message) => message.eventType === "keyDown" ? true : release());
		await dispatchBrowserControl(commands[3], delivery);
		assert.deepEqual(previewCalls, previewPayloads[3]);
		assert.deepEqual(workspaceCalls, []);
	}
});

test("workspace delivery failures propagate to the caller without retrying", async () => {
	const { delivery, workspaceCalls } = harness(false);
	const failure = new Error("Workspace unavailable");
	delivery.workspace = async (action, body) => {
		workspaceCalls.push({ action, body });
		throw failure;
	};
	await assert.rejects(dispatchBrowserControl(commands[0], delivery), (error) => error === failure);
	assert.deepEqual(workspaceCalls, [workspacePayloads[0]]);
});

test("special keys and modifier order preserve the existing workspace contract", async () => {
	for (const key of ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "Backspace", "Delete", "End", "Enter", "Escape", "Home", "PageDown", "PageUp", "Tab"]) {
		const { delivery, workspaceCalls } = harness(null);
		await dispatchBrowserControl({ type: "key", key, code: key, ctrlKey: true, metaKey: true, altKey: true, shiftKey: true }, delivery);
		assert.deepEqual(workspaceCalls, [{ action: "press", body: { key: `Control+Meta+Alt+Shift+${key}` } }]);
	}
});

test("shifted text and space remain typed text while unsupported shortcuts are ignored in HTTP mode", async () => {
	const { delivery, workspaceCalls } = harness(null);
	await dispatchBrowserControl({ type: "key", key: "A", code: "KeyA", shiftKey: true }, delivery);
	await dispatchBrowserControl({ type: "key", key: " ", code: "Space" }, delivery);
	await dispatchBrowserControl({ type: "key", key: "F1", code: "F1" }, delivery);
	await dispatchBrowserControl({ type: "key", key: "a", code: "KeyA", ctrlKey: true }, delivery);
	assert.deepEqual(workspaceCalls, [
		{ action: "type", body: { text: "A" } },
		{ action: "type", body: { text: " " } },
	]);
});
