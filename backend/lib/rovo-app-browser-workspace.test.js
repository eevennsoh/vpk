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
		["navigate", { url: "--executable-path=/bin/sh" }],
		["click-ref", { ref: "--help" }],
		["fill-ref", { ref: "e1", text: "--session other" }],
		["type-ref", { ref: "e1 --x", text: "hi" }],
		["select-ref", { ref: "e1", values: ["ok", " --x"] }],
		["press", { key: "--help" }],
		["scroll", { direction: "-x" }],
		["scroll", { direction: "down", pixels: "--x" }],
		["tab-new", { url: "--x" }],
	]
	for (const [action, body] of hostile) {
		await assert.rejects(buildWorkspaceActionCommandArgs("thread-1", action, body), (error) => error.status === 400, `${action} ${JSON.stringify(body)}`)
	}
})
