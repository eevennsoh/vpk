const assert = require("node:assert/strict");
const test = require("node:test");
const { createProbe, preflight, resolveModel } = require("./vpk-remote-preflight.js");

const toolReply = () => new Response(JSON.stringify({
	status: "completed",
	output: [{ type: "function_call", namespace: "vpk_remote", name: "probe", arguments: '{"value":"ok"}' }],
}));

test("a working inference route passes without depending on model discovery", async () => {
	const calls = [];
	const result = await preflight({ app: "codex", model: "gpt-6.1-sol" }, {
		fetch: async (url, init) => { calls.push({ url, init }); return toolReply(); },
	});
	assert.equal(result.ok, true);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].url, "http://localhost:29576/openai/v1/responses");
	assert.equal(JSON.parse(calls[0].init.body).model, "gpt-6.1-sol");
});

test("Claude workers probe the native Messages route, independent of OpenAI discovery", async () => {
	const calls = [];
	const result = await preflight({ app: "claude", model: "claude-sonnet-5-5" }, {
		fetch: async (url) => {
			calls.push(url);
			return new Response(JSON.stringify({ content: [{ type: "tool_use", name: "probe", input: { value: "ok" } }] }));
		},
	});
	assert.equal(result.ok, true);
	assert.deepEqual(calls, ["http://localhost:29576/vertex/claude/v1/messages"]);
});

test("cross-provider probes exercise namespace collisions and use the translator key", async () => {
	let request;
	const result = await preflight({ app: "codex", model: "claude-sonnet-5-5", key: "fixture-secret" }, {
		fetch: async (url, init) => { request = { url, ...init }; return toolReply(); },
	});
	assert.equal(result.ok, true);
	assert.equal(request.url, "http://127.0.0.1:4000/v1/responses");
	assert.equal(request.headers.Authorization, "Bearer fixture-secret");
	const { tools } = JSON.parse(request.body);
	assert.deepEqual(tools.map((t) => [t.name, t.tools[0].name]), [["vpk_remote", "probe"], ["vpk_other", "probe"]]);
	assert.equal(JSON.parse(request.body).input[1].type, "additional_tools");
	assert.equal(JSON.stringify(result).includes("fixture-secret"), false);
});

test("duplicate tool rejection is actionable and never retried", async () => {
	let calls = 0;
	const result = await preflight({ app: "codex", model: "claude-sonnet-5-5", key: "fixture-secret" }, {
		fetch: async () => {
			calls++;
			return new Response('{"error":{"message":"tools: Tool names must be unique. fixture-secret"}}', { status: 400 });
		},
	});
	assert.equal(result.ok, false);
	assert.equal(result.code, "duplicate-tools");
	assert.equal(calls, 1);
	assert.equal(JSON.stringify(result).includes("fixture-secret"), false);
});

test("transient upstream failures have bounded retries and can recover", async () => {
	let calls = 0;
	const waits = [];
	const result = await preflight({ app: "codex", model: "gpt-6.1-sol" }, {
		fetch: async () => ++calls === 1 ? new Response("bad gateway", { status: 502 }) : toolReply(),
		sleep: async (ms) => waits.push(ms),
	});
	assert.equal(result.ok, true);
	assert.equal(calls, 2);
	assert.deepEqual(waits, [250]);
});

test("persistent upstream failure stops after two attempts", async () => {
	let calls = 0;
	const result = await preflight({ app: "codex", model: "gpt-6.1-sol" }, {
		fetch: async () => { calls++; return new Response("bad gateway", { status: 502 }); },
		sleep: async () => {},
	});
	assert.equal(result.ok, false);
	assert.equal(result.code, "upstream");
	assert.equal(result.status, 502);
	assert.equal(calls, 2);
});

test("an HTTP 200 without a valid tool round-trip cannot pass", async () => {
	for (const response of [{ status: "completed", output: [] }, { status: "incomplete", output: [] }, { error: "failure" }]) {
		const result = await preflight({ app: "codex", model: "gpt-6.1-sol" }, {
			fetch: async () => new Response(JSON.stringify(response)),
		});
		assert.equal(result.ok, false);
	}
});

test("tool names and arguments must survive the namespace round-trip", async () => {
	const result = await preflight({ app: "codex", model: "gpt-6.1-sol" }, {
		fetch: async () => new Response(JSON.stringify({ status: "completed", output: [
			{ type: "function_call", namespace: "wrong", name: "probe", arguments: '{"value":"ok"}' },
		] })),
	});
	assert.equal(result.code, "tool-round-trip");
});

test("streamed Codex tool calls require a completed response event", async () => {
	const reply = { status: "completed", output: [{ type: "function_call", namespace: "vpk_remote", name: "probe", arguments: '{"value":"ok"}' }] };
	for (const [event, ok] of [[{ type: "response.completed", response: reply }, true], [{ type: "response.created", response: reply }, false]]) {
		const result = await preflight({ app: "codex", model: "gpt-6.1-sol" }, {
			fetch: async () => new Response(`data: ${JSON.stringify(event)}\n\ndata: [DONE]\n\n`),
		});
		assert.equal(result.ok, ok);
	}
});

test("streamed Claude tool arguments are assembled before declaring readiness", async () => {
	const events = [
		{ type: "content_block_start", index: 0, content_block: { type: "tool_use", name: "probe", input: {} } },
		{ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '{"value":' } },
		{ type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: '"ok"}' } },
		{ type: "message_stop" },
	];
	const result = await preflight({ app: "claude", model: "claude-sonnet-5-5" }, {
		fetch: async () => new Response(events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("")),
	});
	assert.equal(result.ok, true);
});

test("an error inside an HTTP 200 stream remains a failure with its actual cause", async () => {
	const result = await preflight({ app: "codex", model: "claude-sonnet-5-5", key: "test-key" }, {
		fetch: async () => new Response('data: {"type":"error","error":{"message":"tools: Tool names must be unique"}}\n\n'),
	});
	assert.equal(result.code, "duplicate-tools");
});

test("auth and model rejection are not retried or silently routed to another model", async () => {
	for (const [status, message, expected] of [[401, "unauthorized", "authentication"], [400, "Model Id not found", "model"], [400, "CloudID is invalid", "cloud-id"]]) {
		let calls = 0;
		const result = await preflight({ app: "codex", model: "gpt-6.1-sol" }, {
			fetch: async () => { calls++; return new Response(message, { status }); },
		});
		assert.equal(result.code, expected);
		assert.equal(calls, 1);
	}
});

test("an unsupported tool option is not mislabeled as a missing model", async () => {
	const result = await preflight({ app: "claude", model: "claude-sonnet-5-5" }, {
		fetch: async () => new Response(JSON.stringify({ message: 'tool_choice: type "tool" is not supported for this model.', path: "/models/claude-sonnet-5-5", upstream: { error: { message: 'tool_choice is not supported for this model.' } } }), { status: 400 }),
	});
	assert.equal(result.code, "request");
});

test("deterministic model or schema errors wrapped by a 502 are not retried", async () => {
	for (const message of ["Model not found", "tools: Tool names must be unique"]) {
		let calls = 0;
		const result = await preflight({ app: "codex", model: "gpt-6.1-sol" }, {
			fetch: async () => { calls++; return new Response(message, { status: 502 }); },
		});
		assert.equal(result.ok, false);
		assert.equal(calls, 1);
	}
});

test("overloaded stream errors retry once without inventing an HTTP status", async () => {
	let calls = 0;
	const result = await preflight({ app: "codex", model: "gpt-6.1-sol" }, {
		fetch: async () => { calls++; return new Response('data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n'); },
		sleep: async () => {},
	});
	assert.equal(calls, 2);
	assert.equal(result.code, "upstream");
	assert.equal(result.status, 200);
	assert.equal(result.errorType, "overloaded_error");
	assert.equal(result.message.includes("HTTP 400"), false);
});

test("aliases resolve from the supplied defaults without evaluating shell code", () => {
	assert.equal(resolveModel("sonnet", 'ALIAS_sonnet="claude-sonnet-5-5"'), "claude-sonnet-5-5");
	assert.throws(() => resolveModel("sonnet", 'ALIAS_sonnet="$(echo secret)"'), /Unsupported model/u);
	assert.throws(() => resolveModel("missing", ""), /Unsupported model/u);
});

test("cross-provider probes cannot send credentials to non-loopback URLs", () => {
	assert.throws(() => createProbe({ app: "codex", model: "claude-sonnet-5-5", key: "secret", baseUrl: "https://example.com" }), /loopback/u);
});
