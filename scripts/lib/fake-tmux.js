"use strict";

// A fake tmux for launcher tests, resolving targets the way tmux 3.8 does, so a target form that
// real tmux rejects or misreads fails here too:
//
// - Session commands (has-session, kill-session, attach-session, list-windows) take a session
//   target: "=name" matches exactly; a bare "name" matches exactly, else as a unique prefix.
// - Window and pane commands (send-keys, pipe-pane, list-panes, set-option, set-window-option,
//   select-pane, split-window, select-layout, display-message, new-window) take a window or pane
//   target: "=name:" (or "=name:window.pane") matches the session exactly; "=name" without the
//   colon is "no such window"; a bare "name" resolves exactly, else as a unique prefix.
//
// State lives in FAKE_TMUX_STATE as `name|start-directory` lines. Every invocation is appended to
// FAKE_TMUX_LOG. A send-keys that launches a dev server (`portless run`, `dev-rovo-port.js`,
// `dev:frontend`, `dev:backend`) appends the session name to FAKE_SERVER_LOG; for `portless run`,
// FAKE_READY_PORTS="<frontend> <backend>" makes the fake server write both port files in the
// current directory and listen (FAKE_LISTEN_FILE, read by the fake lsof). FAKE_TMUX_HAS_SESSION=1
// makes every session target resolve (a session the state file does not list).

const fs = require("node:fs");
const path = require("node:path");

// The script itself is scripts/lib/fake-tmux.sh.
const FAKE_TMUX_SCRIPT_PATH = path.join(__dirname, "fake-tmux.sh");

function writeFakeTmux(filePath) {
	fs.copyFileSync(FAKE_TMUX_SCRIPT_PATH, filePath);
	fs.chmodSync(filePath, 0o755);
	return filePath;
}

module.exports = { FAKE_TMUX_SCRIPT_PATH, writeFakeTmux };
