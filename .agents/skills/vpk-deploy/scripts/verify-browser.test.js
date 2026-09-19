const assert = require("node:assert/strict");
const test = require("node:test");
const browser = import("./verify-browser.mjs");

function fixture({ mismatch = false, tool = false, echoedOnly = false } = {}) {
	const calls = [];
	const token = "VPK_VERIFY_TEST";
	const prompt = `Reply exactly ${token}. Do not use tools.`;
	const id = "718a32d7-6ef0-4be7-8e2c-974e2a8265b3";
	const thread = { id, messages: [{ role: "user", parts: [{ type: "text", text: mismatch ? "another user prompt" : prompt }] }, { role: "assistant", parts: [{ type: "text", text: token }, ...(tool ? [{ type: "tool-example" }] : [])] }] };
	const adapter = {
		click: async name => calls.push(["click", name]), fill: async (label, value) => calls.push(["fill", label, value]),
		clearRequests: async () => {}, requests: async () => [{ method: "POST", url: "https://fixture.test/api/rovo/threads", postData: JSON.stringify({ id }) }],
		evaluate: async () => !echoedOnly,
		request: async (pathname, method = "GET") => { calls.push([method, pathname]); return method === "DELETE" ? { status: 200 } : calls.some(([operation]) => operation === "DELETE") ? { status: 404 } : { status: 200, body: { thread } }; },
	};
	return { calls, token, adapter };
}

test("chat verifies actual assistant DOM and persisted role before deleting only its own thread", async () => {
	const { verifyChat } = await browser;
	const f = fixture();
	const result = await verifyChat(f.adapter, new URL("https://fixture.test/"), { token: f.token, timeoutMs: 100 });
	assert.equal(result.assistantVerified, true);
	assert.equal(result.threadRemoved, true);
	assert.equal(f.calls.filter(([operation]) => operation === "DELETE").length, 1);
});

test("matching the echoed user token cannot pass the chat smoke", async () => {
	const { verifyChat } = await browser;
	const f = fixture({ echoedOnly: true });
	await assert.rejects(verifyChat(f.adapter, new URL("https://fixture.test/"), { token: f.token, timeoutMs: 10 }), /assistant|timed out/u);
});

test("another user's persisted prompt is never deleted", async () => {
	const { verifyChat } = await browser;
	const f = fixture({ mismatch: true });
	await assert.rejects(verifyChat(f.adapter, new URL("https://fixture.test/"), { token: f.token, timeoutMs: 10 }), /ownership|prompt/u);
	assert.equal(f.calls.some(([operation]) => operation === "DELETE"), false);
});

test("a tool-using turn fails a tool-free probe", async () => {
	const { verifyChat } = await browser;
	const f = fixture({ tool: true });
	await assert.rejects(verifyChat(f.adapter, new URL("https://fixture.test/"), { token: f.token, timeoutMs: 10 }), /tool/u);
});


test("malformed captured requests produce sanitized errors without deleting a thread", async () => {
	const { verifyChat } = await browser;
	const f = fixture();
	f.adapter.requests = async () => [{ method: "POST", url: "https://fixture.test/api/rovo/threads", postData: '{"private":"fixture-secret" invalid}' }];
	await assert.rejects(verifyChat(f.adapter, new URL("https://fixture.test/"), { token: f.token, timeoutMs: 10 }), error => error.message === "Invalid chat probe request JSON");
	assert.equal(f.calls.some(([operation]) => operation === "DELETE"), false);
});
