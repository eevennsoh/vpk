"use strict";

// The lifecycle of one browser workspace as one state value, owned by
// BrowserWorkspace in browser-workspace-manager.js.
//
//   launching --LAUNCHED-->        ready
//   launching --CLOSE_REQUESTED--> closing
//   launching --CRASHED-->         crashed   (a failed launch)
//   ready     --CLOSE_REQUESTED--> closing
//   ready     --CRASHED-->         crashed
//   closing   --CLOSED-->          closed
//
// closed and crashed are terminal. A crash while closing changes nothing: the
// close is already releasing the browser. Events that cannot change the state
// return the same object, so a second close or a second crash is a no-op and
// the caller that saw the change is the only one that releases.

const BROWSER_WORKSPACE_STATUSES = Object.freeze(["launching", "ready", "closing", "closed", "crashed"]);

const INITIAL_BROWSER_WORKSPACE_LIFECYCLE = Object.freeze({ status: "launching", reason: null });

// Provisional: the most workspaces that may hold a browser at once (launching,
// ready or closing). Today one demo (`useBrowserWorkspace`) creates one
// workspace per mounted page and creates its replacement before deleting the
// old one, so a page holds at most two; four allows two open pages. Each holds
// a Chromium. Tune with the owner.
const MAX_LIVE_BROWSER_WORKSPACES = 4;

const BROWSER_WORKSPACE_ERROR_CODES = Object.freeze({
	NOT_FOUND: "BROWSER_WORKSPACE_NOT_FOUND",
	CLOSING: "BROWSER_WORKSPACE_CLOSING",
	CLOSED: "BROWSER_WORKSPACE_CLOSED",
	CRASHED: "BROWSER_WORKSPACE_CRASHED",
	LIMIT: "BROWSER_WORKSPACE_LIMIT",
});

function transitionBrowserWorkspace(state, event) {
	switch (event?.type) {
		case "LAUNCHED":
			return state.status === "launching" ? { status: "ready", reason: null } : state;
		case "CLOSE_REQUESTED":
			return state.status === "launching" || state.status === "ready"
				? { status: "closing", reason: null }
				: state;
		case "CLOSED":
			return state.status === "closing" ? { status: "closed", reason: null } : state;
		case "CRASHED":
			return state.status === "launching" || state.status === "ready"
				? { status: "crashed", reason: typeof event.reason === "string" && event.reason ? event.reason : "unknown" }
				: state;
		default:
			return state;
	}
}

// Whether the workspace still holds a browser (and so counts against the cap).
function holdsBrowser(state) {
	return state.status === "launching" || state.status === "ready" || state.status === "closing";
}

// Whether the workspace is listed to clients (main listed launching and ready ones).
function isListed(state) {
	return state.status === "launching" || state.status === "ready";
}

// What a call (navigate, click, screenshot …) on a workspace in `state` gets.
// A call during launching waits behind the launch on the workspace queue.
function decideBrowserWorkspaceCall(state) {
	switch (state.status) {
		case "launching":
		case "ready":
			return { action: "run" };
		case "closing":
			return { action: "reject", code: BROWSER_WORKSPACE_ERROR_CODES.CLOSING };
		case "closed":
			return { action: "reject", code: BROWSER_WORKSPACE_ERROR_CODES.CLOSED };
		default:
			return { action: "reject", code: BROWSER_WORKSPACE_ERROR_CODES.CRASHED };
	}
}

function decideBrowserWorkspaceCreate({ liveCount, limit }) {
	return liveCount >= limit
		? { action: "reject", code: BROWSER_WORKSPACE_ERROR_CODES.LIMIT }
		: { action: "create" };
}

class BrowserWorkspaceNotFoundError extends Error {
	constructor(workspaceId) {
		super(`Browser workspace not found: ${workspaceId}`);
		this.name = "BrowserWorkspaceNotFoundError";
		this.code = BROWSER_WORKSPACE_ERROR_CODES.NOT_FOUND;
		this.workspaceId = workspaceId;
	}
}

const UNAVAILABLE_MESSAGES = {
	[BROWSER_WORKSPACE_ERROR_CODES.CLOSING]: (id) => `Browser workspace is closing: ${id}`,
	[BROWSER_WORKSPACE_ERROR_CODES.CLOSED]: (id) => `Browser workspace is closed: ${id}`,
	[BROWSER_WORKSPACE_ERROR_CODES.CRASHED]: (id, reason) => `Browser workspace crashed: ${id} (${reason})`,
};

// A workspace that exists but can no longer take calls (closing, closed or crashed).
class BrowserWorkspaceUnavailableError extends Error {
	constructor(workspaceId, code, reason = null) {
		super(UNAVAILABLE_MESSAGES[code](workspaceId, reason));
		this.name = "BrowserWorkspaceUnavailableError";
		this.code = code;
		this.workspaceId = workspaceId;
		this.reason = reason;
	}
}

class BrowserWorkspaceLimitError extends Error {
	constructor(limit) {
		super(`Browser workspace limit reached: ${limit} workspaces are open; close one before creating another.`);
		this.name = "BrowserWorkspaceLimitError";
		this.code = BROWSER_WORKSPACE_ERROR_CODES.LIMIT;
		this.limit = limit;
	}
}

// True when the workspace is gone for the caller: never existed, or is closing,
// closed or crashed. Routes answer 404, which is what the client recovers from
// by creating a new workspace.
function isBrowserWorkspaceNotFoundError(error) {
	return error instanceof BrowserWorkspaceNotFoundError || error instanceof BrowserWorkspaceUnavailableError;
}

function isBrowserWorkspaceLimitError(error) {
	return error instanceof BrowserWorkspaceLimitError;
}

module.exports = {
	BROWSER_WORKSPACE_ERROR_CODES,
	BROWSER_WORKSPACE_STATUSES,
	BrowserWorkspaceLimitError,
	BrowserWorkspaceNotFoundError,
	BrowserWorkspaceUnavailableError,
	INITIAL_BROWSER_WORKSPACE_LIFECYCLE,
	MAX_LIVE_BROWSER_WORKSPACES,
	decideBrowserWorkspaceCall,
	decideBrowserWorkspaceCreate,
	holdsBrowser,
	isBrowserWorkspaceLimitError,
	isBrowserWorkspaceNotFoundError,
	isListed,
	transitionBrowserWorkspace,
};
