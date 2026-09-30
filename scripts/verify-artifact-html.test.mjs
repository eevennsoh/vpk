import assert from "node:assert/strict";
import { test } from "node:test";
import { blockedUrlFromConsole, VIEWER_CSP } from "./verify-artifact-html.mjs";

test("blockedUrlFromConsole reads both Chromium CSP message shapes", () => {
	assert.equal(
		blockedUrlFromConsole("Connecting to 'https://api.open-meteo.com/v1/forecast?latitude=1' violates the following Content Security Policy directive: \"connect-src 'self'\". The action has been blocked."),
		"https://api.open-meteo.com/v1/forecast?latitude=1",
	);
	assert.equal(
		blockedUrlFromConsole("Fetch API cannot load https://api.open-meteo.com/v1/forecast?latitude=1. Refused to connect because it violates the document's Content Security Policy."),
		"https://api.open-meteo.com/v1/forecast?latitude=1",
	);
	assert.equal(blockedUrlFromConsole("Uncaught TypeError: x is undefined"), null);
});

test("VIEWER_CSP only allows Atlassian connect targets", () => {
	assert.match(VIEWER_CSP, /^connect-src 'self' hello\.atlassian\.net /u);
	assert.equal(/open-meteo|\*/u.test(VIEWER_CSP), false);
});
