"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { streamLocalModel } = require("./local-model-provider");

test("a local model error keeps no credential, even one that straddles the message's length cap", async (t) => {
	const madeUpPassword = "madeUpLocalModelPassword0123456789";
	// The userinfo starts before the 300-character cap and its "@" falls after it.
	const body = `${"x".repeat(280)} https://svc:${madeUpPassword}@models.example/v1 ${"y".repeat(50)}`;
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response(body, { status: 502 });
	t.after(() => {
		globalThis.fetch = originalFetch;
	});
	const silence = t.mock.method(console, "info", () => {});
	await assert.rejects(
		streamLocalModel({ userMessage: "hi", conversationHistory: [], writer: { write() {} } }),
		(error) => {
			assert.match(error.message, /^Local model server error \(502\): /u);
			// No part of it: a cut before the "@" leaves a password the userinfo pattern cannot see.
			assert.equal(error.message.includes(madeUpPassword.slice(0, 6)), false, error.message);
			return true;
		},
	);
	silence.mock.restore();
});
