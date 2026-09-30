import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { APP_ORIGIN_ENV, FRONTEND_PORT_FILE, appUrl, resolveAppOrigin } from "./origin.ts";

// pid 0 marks an alias route: never "alive", but still the only match for its port.
const ROUTES = [
	{ hostname: "this-worktree.localhost", port: 4312, pid: 0 },
	{ hostname: "other-worktree.localhost", port: 4999, pid: 0 },
];

function withWorktree(port: string | null, run: (repoRoot: string) => void) {
	const repoRoot = mkdtempSync(path.join(tmpdir(), "vpk-origin-"));
	try {
		if (port !== null) writeFileSync(path.join(repoRoot, FRONTEND_PORT_FILE), `${port}\n`);
		run(repoRoot);
	} finally {
		rmSync(repoRoot, { force: true, recursive: true });
	}
}

test("the env override wins over this worktree's port file and Portless route", () => {
	withWorktree("4312", (repoRoot) => {
		assert.equal(
			resolveAppOrigin({ env: { [APP_ORIGIN_ENV]: " https://ci.example.test/ " }, repoRoot, routes: ROUTES }),
			"https://ci.example.test",
		);
	});
});

test("an empty override is ignored instead of producing a relative URL", () => {
	withWorktree("4312", (repoRoot) => {
		assert.equal(resolveAppOrigin({ env: { [APP_ORIGIN_ENV]: "" }, repoRoot, routes: ROUTES }), "https://this-worktree.localhost");
	});
});

test("a non-URL override fails loudly", () => {
	withWorktree("4312", (repoRoot) => {
		assert.throws(
			() => resolveAppOrigin({ env: { [APP_ORIGIN_ENV]: "my-worktree.localhost" }, repoRoot, routes: ROUTES }),
			/is not an absolute URL/u,
		);
	});
});

test("without an override, this worktree's Portless URL is preferred", () => {
	withWorktree("4312", (repoRoot) => {
		assert.equal(resolveAppOrigin({ env: {}, repoRoot, routes: ROUTES }), "https://this-worktree.localhost");
	});
});

test("without a matching Portless route, the recorded port is used on 127.0.0.1", () => {
	withWorktree("4313", (repoRoot) => {
		assert.equal(resolveAppOrigin({ env: {}, repoRoot, routes: ROUTES }), "http://127.0.0.1:4313");
	});
});

test("a missing port file throws the fix instead of guessing a port", () => {
	withWorktree(null, (repoRoot) => {
		assert.throws(
			() => resolveAppOrigin({ env: {}, repoRoot, routes: ROUTES }),
			(error: unknown) => error instanceof Error
				&& error.message.includes("pnpm run dev:tmux:start")
				&& error.message.includes(APP_ORIGIN_ENV)
				&& !error.message.includes("3000"),
		);
	});
});

test("a malformed port file throws", () => {
	withWorktree("port-unknown", (repoRoot) => {
		assert.throws(() => resolveAppOrigin({ env: {}, repoRoot, routes: ROUTES }), /not a port/u);
	});
});

test("appUrl joins root-relative routes onto the resolved origin", () => {
	withWorktree("4312", (repoRoot) => {
		const options = { env: {}, repoRoot, routes: ROUTES };
		assert.equal(appUrl("/jira-team-eu26?variants=autoArrange#top", options), "https://this-worktree.localhost/jira-team-eu26?variants=autoArrange#top");
		assert.throws(() => appUrl("jira-team-eu26", options), /root-relative/u);
	});
});
