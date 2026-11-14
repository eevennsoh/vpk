const test = require("node:test")
const assert = require("node:assert/strict")

const {
	buildWorkspaceActionCommandArgs,
	getRovoAppThreadBrowserSessionName,
	getRovoAppThreadBrowserWorkspaceId,
	urlsLooselyMatch,
} = require("./rovo-app-browser-workspace")

test("thread browser workspace derives a stable agent-browser session name", () => {
	const firstSessionName = getRovoAppThreadBrowserSessionName("thread-browser-test")
	const secondSessionName = getRovoAppThreadBrowserSessionName("thread-browser-test")
	const alternateSessionName = getRovoAppThreadBrowserSessionName("thread browser test")

	assert.equal(firstSessionName, secondSessionName)
	assert.match(firstSessionName, /^rt-thread-browser-t-[0-9a-f]{12}$/)
	assert.notEqual(firstSessionName, alternateSessionName)
})

test("thread browser workspace exposes a deterministic workspace id for the session-backed preview", () => {
	assert.equal(
		getRovoAppThreadBrowserWorkspaceId("thread-browser-test"),
		`agent-browser-session:${getRovoAppThreadBrowserSessionName("thread-browser-test")}`,
	)
})

test("thread browser workspace url matching ignores hashes and trailing slashes", () => {
	assert.equal(
		urlsLooselyMatch(
			"https://www.theverge.com/2026/04/18/story#comments",
			"https://theverge.com/2026/04/18/story/",
		),
		true,
	)
	assert.equal(
		urlsLooselyMatch(
			"https://example.com/docs",
			"https://example.com/blog",
		),
		false,
	)
})

test("MCP workspace actions build agent-browser arguments by the same rules as the HTTP and socket paths", async () => {
	assert.deepEqual(await buildWorkspaceActionCommandArgs("thread-1", "click-ref", { ref: "@e3" }), ["click", "@e3"])
	assert.deepEqual(await buildWorkspaceActionCommandArgs("thread-1", "fill-ref", { ref: "e1", text: "- item" }), ["fill", "e1", "- item"])
	assert.deepEqual(await buildWorkspaceActionCommandArgs("thread-1", "press", { key: "Shift+-" }), ["press", "Shift+-"])
	assert.deepEqual(await buildWorkspaceActionCommandArgs("thread-1", "scroll", { direction: "down", pixels: 300 }), ["scroll", "down", "300"])
	const hostile = [
		["click-ref", { ref: "--help" }],
		["fill-ref", { ref: "e1", text: "--session other" }],
		["type-ref", { ref: "e1 --x", text: "hi" }],
		["select-ref", { ref: "e1", values: ["ok", " --x"] }],
		["press", { key: "--help" }],
		["scroll", { direction: "-x" }],
		["navigate", { url: "file:///etc/hosts" }],
		["navigate", { url: "chrome://settings" }],
		["navigate", { url: "javascript:alert(1)" }],
		["tab-new", { url: "file:///etc/hosts" }],
		["scroll", { direction: "sideways" }],
	]
	for (const [action, body] of hostile) {
		await assert.rejects(buildWorkspaceActionCommandArgs("thread-1", action, body), (error) => error.status === 400, `${action} ${JSON.stringify(body)}`)
	}
})

test("MCP navigate and new-tab URLs follow the HTTP routes' rule, and scroll is normalized", async () => {
	assert.deepEqual(await buildWorkspaceActionCommandArgs("thread-1", "navigate", { url: "example.com" }), ["open", "https://example.com/"])
	assert.deepEqual(await buildWorkspaceActionCommandArgs("thread-1", "navigate", { url: "localhost:3000/x" }), ["open", "http://localhost:3000/x"])
	assert.deepEqual(await buildWorkspaceActionCommandArgs("thread-1", "navigate", { url: "about:blank" }), ["open", "about:blank"])
	// An option-looking value becomes an https URL, never an argument starting with "-".
	const [, optionLike] = await buildWorkspaceActionCommandArgs("thread-1", "navigate", { url: "--executable-path=/bin/sh" })
	assert.equal(optionLike.startsWith("https://"), true)
	assert.deepEqual(await buildWorkspaceActionCommandArgs("thread-1", "tab-new", {}), ["tab", "new"])
	assert.deepEqual(await buildWorkspaceActionCommandArgs("thread-1", "tab-new", { url: "https://example.com/x" }), ["tab", "new", "https://example.com/x"])
	assert.deepEqual(await buildWorkspaceActionCommandArgs("thread-1", "scroll", { direction: "DOWN", pixels: "--x" }), ["scroll", "down", "300"])
	assert.deepEqual(await buildWorkspaceActionCommandArgs("thread-1", "scroll", { direction: "up", pixels: 1e9 }), ["scroll", "up", "5000"])
})
