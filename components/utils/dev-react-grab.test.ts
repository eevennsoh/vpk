import assert from "node:assert/strict";
import test from "node:test";

import { isAtlasTunnelHostname, isReactGrabDisabledPath, shouldDisableReactGrab } from "./dev-react-grab.ts";

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
	assert.equal(isReactGrabDisabledPath("/jira-golden-journeys-v4"), false);
});

test("hides react-grab on Atlas Tunnel hosts even for project routes", () => {
	assert.equal(
		shouldDisableReactGrab({
			hostname: "esoh-297426c52eae.public.atlastunnel.com",
			pathname: "/jira-golden-journeys-v4",
		}),
		true,
	);
	assert.equal(
		shouldDisableReactGrab({
			hostname: "project.localhost",
			pathname: "/jira-golden-journeys-v4",
		}),
		false,
	);
});
