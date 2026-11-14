import assert from "node:assert/strict";
import test from "node:test";

import {
	DEFAULT_REACT_GRAB_SCRIPT_SRC,
	isAtlasTunnelHostname,
	isReactGrabDisabledPath,
	resolveReactGrabScriptSources,
	shouldDisableReactGrab,
} from "./dev-react-grab.ts";

test("treats Atlas Tunnel public and private hosts as share hosts", () => {
	assert.equal(isAtlasTunnelHostname("esoh-297426c52eae.public.atlastunnel.com"), true);
	assert.equal(isAtlasTunnelHostname("research-session.atlastunnel.com"), true);
	assert.equal(isAtlasTunnelHostname("atlastunnel.com"), true);
	assert.equal(isAtlasTunnelHostname("project.localhost"), false);
	assert.equal(isAtlasTunnelHostname("localhost"), false);
	assert.equal(isAtlasTunnelHostname(null), false);
});

test("keeps existing local-dev path exclusions", () => {
	assert.equal(isReactGrabDisabledPath("/make"), true);
	assert.equal(isReactGrabDisabledPath("/jira-team-eu26-end"), true);
	assert.equal(isReactGrabDisabledPath("/jira-team-eu26"), false);
	assert.equal(isReactGrabDisabledPath("/jira-golden-journey-v4"), false);
});

test("hides react-grab on Atlas Tunnel hosts even for project routes", () => {
	assert.equal(
		shouldDisableReactGrab({
			hostname: "esoh-297426c52eae.public.atlastunnel.com",
			pathname: "/jira-golden-journey-v4",
		}),
		true,
	);
	assert.equal(
		shouldDisableReactGrab({
			hostname: "project.localhost",
			pathname: "/jira-golden-journey-v4",
		}),
		false,
	);
});

test("loads the published React Grab build unless another build is configured", () => {
	assert.deepEqual(resolveReactGrabScriptSources(undefined), [DEFAULT_REACT_GRAB_SCRIPT_SRC]);
	assert.deepEqual(resolveReactGrabScriptSources("  "), [DEFAULT_REACT_GRAB_SCRIPT_SRC]);
	assert.deepEqual(resolveReactGrabScriptSources(DEFAULT_REACT_GRAB_SCRIPT_SRC), [DEFAULT_REACT_GRAB_SCRIPT_SRC]);
});

test("tries a configured React Grab build first and keeps the published build as fallback", () => {
	assert.deepEqual(resolveReactGrabScriptSources(" /dev-local/react-grab.global.js "), [
		"/dev-local/react-grab.global.js",
		DEFAULT_REACT_GRAB_SCRIPT_SRC,
	]);
});
