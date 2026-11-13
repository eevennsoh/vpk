const test = require("node:test");
const assert = require("node:assert/strict");

const { ChromiumPreviewManager } = require("./chromium-preview");

class TestChromiumPreviewManager extends ChromiumPreviewManager {
	constructor() {
		super({
			delayFn: async () => {},
		});
		this.commands = [];
		this._isInstalled = true;
		this._isBrowserReady = true;
		this.capturedBuffers = [];
	}

	async _ensureInstalled() {}

	async _ensureBrowser() {
		this._isBrowserReady = true;
	}

	async _run(args) {
		this.commands.push(args);
		return "";
	}

	async _captureScreenshotBuffer() {
		const nextBuffer = Buffer.from(`capture-${this.capturedBuffers.length + 1}`);
		this.capturedBuffers.push(nextBuffer);
		this.commands.push(["capture-screenshot"]);
		return nextBuffer;
	}

	async _refreshState() {
		return {
			ready: true,
			title: "Example",
			url: "https://example.com",
			viewportWidth: 1280,
			viewportHeight: 900,
			canGoBack: false,
			canGoForward: false,
		};
	}
}

test("clickRef invokes agent-browser click with the accessibility ref", async () => {
	const manager = new TestChromiumPreviewManager();

	await manager.clickRef("@e1");

	assert.deepEqual(manager.commands, [["click", "@e1"]]);
});

test("fillRef invokes agent-browser fill with the ref and text", async () => {
	const manager = new TestChromiumPreviewManager();

	await manager.fillRef("@e2", "search text");

	assert.deepEqual(manager.commands, [["fill", "@e2", "search text"]]);
});

test("selectRef forwards all provided option values", async () => {
	const manager = new TestChromiumPreviewManager();

	await manager.selectRef("@e3", ["alpha", "beta"]);

	assert.deepEqual(manager.commands, [["select", "@e3", "alpha", "beta"]]);
});

test("scroll normalizes direction casing and uses the provided distance", async () => {
	const manager = new TestChromiumPreviewManager();

	await manager.scroll("Down", "640");

	assert.deepEqual(manager.commands, [["scroll", "down", "640"]]);
});

test("snapshot with interactive flag adds -i to the underlying command", async () => {
	const manager = new TestChromiumPreviewManager();

	const result = await manager.snapshot({ interactive: true });

	assert.deepEqual(manager.commands, [["snapshot", "-i"]]);
	assert.equal(typeof result.snapshot, "string");
});

test("screenshot reuses the cached capture until the preview becomes dirty", async () => {
	const manager = new TestChromiumPreviewManager();
	const first = await manager.screenshot();
	const second = await manager.screenshot();

	assert.equal(first.buffer.equals(Buffer.from("capture-1")), true);
	assert.equal(second.buffer.equals(Buffer.from("capture-1")), true);
	assert.deepEqual(manager.commands, [["capture-screenshot"]]);

	manager._markScreenshotDirty();
	const third = await manager.screenshot();

	assert.equal(third.buffer.equals(Buffer.from("capture-2")), true);
	assert.deepEqual(manager.commands, [
		["capture-screenshot"],
		["capture-screenshot"],
	]);
});

test("close closes an open preview browser once and is a no-op afterwards", async () => {
	const manager = new TestChromiumPreviewManager();
	assert.equal(await manager.close(), true);
	assert.equal(await manager.close(), false);
	assert.deepEqual(manager.commands, [["close"]]);
	assert.equal((await manager.getState()).ready, true, "a later command reopens it, as before");
});

test("close does nothing when no preview browser was opened", async () => {
	const manager = new TestChromiumPreviewManager();
	manager._isBrowserReady = false;
	assert.equal(await manager.close(), false);
	assert.deepEqual(manager.commands, []);
});
