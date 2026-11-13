"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
	BROWSER_WORKSPACE_ERROR_CODES: CODES,
	BROWSER_WORKSPACE_STATUSES,
	BrowserWorkspaceLimitError,
	BrowserWorkspaceNotFoundError,
	BrowserWorkspaceUnavailableError,
	INITIAL_BROWSER_WORKSPACE_LIFECYCLE,
	decideBrowserWorkspaceCall,
	decideBrowserWorkspaceCreate,
	holdsBrowser,
	isBrowserWorkspaceLimitError,
	isBrowserWorkspaceNotFoundError,
	isListed,
	transitionBrowserWorkspace,
} = require("./browser-workspace-lifecycle");

const at = (status, reason = null) => ({ status, reason });
const EVENTS = ["LAUNCHED", "CLOSE_REQUESTED", "CLOSED", "CRASHED"];

test("a workspace starts launching", () => {
	assert.deepEqual(BROWSER_WORKSPACE_STATUSES, ["launching", "ready", "closing", "closed", "crashed"]);
	assert.deepEqual(INITIAL_BROWSER_WORKSPACE_LIFECYCLE, at("launching"));
});

test("transition table", () => {
	const rows = [
		[at("launching"), { type: "LAUNCHED" }, at("ready")],
		[at("launching"), { type: "CLOSE_REQUESTED" }, at("closing")],
		[at("launching"), { type: "CRASHED", reason: "Chrome exited early" }, at("crashed", "Chrome exited early")],
		[at("ready"), { type: "CLOSE_REQUESTED" }, at("closing")],
		[at("ready"), { type: "CRASHED", reason: "exited" }, at("crashed", "exited")],
		[at("ready"), { type: "CRASHED" }, at("crashed", "unknown")],
		[at("closing"), { type: "CLOSED" }, at("closed")],
	];
	for (const [from, event, to] of rows) {
		assert.deepEqual(transitionBrowserWorkspace(from, event), to, `${from.status} + ${event.type}`);
	}
});

test("events that cannot change the state return the same object", () => {
	const cannotHappen = [
		// launch completes once, and not after a close began (a delete during launch)
		[at("ready"), { type: "LAUNCHED" }],
		[at("closing"), { type: "LAUNCHED" }],
		// a second close joins the first; a crash during close changes nothing
		[at("closing"), { type: "CLOSE_REQUESTED" }],
		[at("closing"), { type: "CRASHED", reason: "exited" }],
		// close completes only from closing
		[at("launching"), { type: "CLOSED" }],
		[at("ready"), { type: "CLOSED" }],
		// closed and crashed are terminal
		...EVENTS.map((type) => [at("closed"), { type }]),
		...EVENTS.map((type) => [at("crashed", "exited"), { type, reason: "again" }]),
		[at("ready"), { type: "NOT_AN_EVENT" }],
		[at("ready"), undefined],
	];
	for (const [from, event] of cannotHappen) {
		assert.equal(transitionBrowserWorkspace(from, event), from, `${from.status} + ${event?.type}`);
	}
});

test("calls run while launching or ready and get a typed rejection otherwise", () => {
	assert.deepEqual(decideBrowserWorkspaceCall(at("launching")), { action: "run" });
	assert.deepEqual(decideBrowserWorkspaceCall(at("ready")), { action: "run" });
	assert.deepEqual(decideBrowserWorkspaceCall(at("closing")), { action: "reject", code: CODES.CLOSING });
	assert.deepEqual(decideBrowserWorkspaceCall(at("closed")), { action: "reject", code: CODES.CLOSED });
	assert.deepEqual(decideBrowserWorkspaceCall(at("crashed", "exited")), { action: "reject", code: CODES.CRASHED });
});

test("only launching, ready and closing workspaces hold a browser; closing ones are not listed", () => {
	const held = BROWSER_WORKSPACE_STATUSES.filter((status) => holdsBrowser(at(status)));
	const listed = BROWSER_WORKSPACE_STATUSES.filter((status) => isListed(at(status)));
	assert.deepEqual(held, ["launching", "ready", "closing"]);
	assert.deepEqual(listed, ["launching", "ready"]);
});

test("create decisions reject at the cap", () => {
	assert.deepEqual(decideBrowserWorkspaceCreate({ liveCount: 0, limit: 4 }), { action: "create" });
	assert.deepEqual(decideBrowserWorkspaceCreate({ liveCount: 3, limit: 4 }), { action: "create" });
	assert.deepEqual(decideBrowserWorkspaceCreate({ liveCount: 4, limit: 4 }), { action: "reject", code: CODES.LIMIT });
	assert.deepEqual(decideBrowserWorkspaceCreate({ liveCount: 5, limit: 4 }), { action: "reject", code: CODES.LIMIT });
});

test("errors carry stable codes; gone workspaces read as not found", () => {
	const missing = new BrowserWorkspaceNotFoundError("w1");
	assert.equal(missing.code, CODES.NOT_FOUND);
	assert.equal(missing.message, "Browser workspace not found: w1");

	const crashed = new BrowserWorkspaceUnavailableError("w1", CODES.CRASHED, "exited");
	assert.equal(crashed.message, "Browser workspace crashed: w1 (exited)");
	for (const code of [CODES.CLOSING, CODES.CLOSED, CODES.CRASHED]) {
		assert.equal(isBrowserWorkspaceNotFoundError(new BrowserWorkspaceUnavailableError("w1", code, "x")), true, code);
	}
	assert.equal(isBrowserWorkspaceNotFoundError(missing), true);

	const limit = new BrowserWorkspaceLimitError(4);
	assert.equal(limit.code, CODES.LIMIT);
	assert.equal(isBrowserWorkspaceLimitError(limit), true);
	assert.equal(isBrowserWorkspaceNotFoundError(limit), false);
	assert.equal(isBrowserWorkspaceNotFoundError(new Error("Browser workspace not found: w1")), false);
});
