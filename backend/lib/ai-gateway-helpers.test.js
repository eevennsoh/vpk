const test = require("node:test");
const assert = require("node:assert/strict");

const {
	fetchGatewayWithRateLimitRetry,
	parseRetryAfterMs,
	resolveGatewayCloudId,
	describeGatewayCloudIdError,
	getGatewayHeaders,
	getAIGatewayConfigReport,
	describeGatewayCloudIdKind,
	isDummyGatewayCloudId,
	isStagingAiGatewayUrl,
	getModelId,
} = require("./ai-gateway-helpers");

test("OpenAI gateway resolves GPT-6.1 Sol by default and honors model overrides", () => {
	const url = "https://ai-gateway.sgw.staging.atl-paas.net/v1/openai/v1/chat/completions";
	assert.equal(getModelId(url, {}), "gpt-6.1-sol");
	assert.equal(getModelId(url, { OPENAI_MODEL: " gpt-6-sol " }), "gpt-6-sol");
	assert.equal(getModelId(url, { OPENAI_MODEL: "  " }), "gpt-6.1-sol");
});

test("OpenAI model selection preserves URL-owned models and unknown endpoints", () => {
	const envVars = { OPENAI_MODEL: "gpt-6.1-sol" };
	assert.equal(getModelId("https://gateway/v1/bedrock/model/anthropic.claude-sonnet-5/invoke-with-response-stream", envVars), "anthropic.claude-sonnet-5");
	assert.equal(getModelId("https://gateway/v1/google/models/gemini-3-pro-image:streamRawPredict", envVars), "gemini-3-pro-image");
	assert.equal(getModelId("https://gateway/unknown", envVars), "");
	assert.equal(getModelId(null, envVars), "");
});

function makeResponse(status, headers = {}) {
	const lower = new Map(
		Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
	);
	return {
		status,
		ok: status >= 200 && status < 300,
		headers: { get: (name) => lower.get(String(name).toLowerCase()) ?? null },
	};
}

test("retries on a transient 429 then succeeds, without sleeping past the success", async () => {
	const statuses = [429, 429, 200];
	let calls = 0;
	const sleeps = [];
	const response = await fetchGatewayWithRateLimitRetry(
		() => Promise.resolve(makeResponse(statuses[calls++])),
		{ sleepFn: (ms) => { sleeps.push(ms); return Promise.resolve(); } },
	);

	assert.equal(response.status, 200, "resolves to the eventual success response");
	assert.equal(calls, 3, "issued exactly three requests (two 429s + one success)");
	assert.equal(sleeps.length, 2, "slept once before each retry, not after success");
});

test("gives up after maxAttempts and returns the final 429 for existing error handling", async () => {
	let calls = 0;
	const response = await fetchGatewayWithRateLimitRetry(
		() => { calls++; return Promise.resolve(makeResponse(429)); },
		{ maxAttempts: 4, sleepFn: () => Promise.resolve() },
	);

	assert.equal(response.status, 429, "returns the last 429 so the caller still throws its error");
	assert.equal(calls, 4, "attempted exactly maxAttempts times");
});

test("does not retry non-retryable error statuses", async () => {
	let calls = 0;
	const response = await fetchGatewayWithRateLimitRetry(
		() => { calls++; return Promise.resolve(makeResponse(400)); },
		{ sleepFn: () => Promise.resolve() },
	);

	assert.equal(response.status, 400);
	assert.equal(calls, 1, "a 400 is surfaced immediately with no retry");
});

test("honors a numeric Retry-After header over the default backoff", async () => {
	const statuses = [429, 200];
	let calls = 0;
	const sleeps = [];
	await fetchGatewayWithRateLimitRetry(
		() => Promise.resolve(makeResponse(statuses[calls++], calls === 1 ? { "retry-after": "2" } : {})),
		{ sleepFn: (ms) => { sleeps.push(ms); return Promise.resolve(); } },
	);

	assert.deepEqual(sleeps, [2000], "waited the Retry-After seconds (2000ms), not the 750ms backoff");
});

test("retries on 503 as well as 429", async () => {
	const statuses = [503, 200];
	let calls = 0;
	const response = await fetchGatewayWithRateLimitRetry(
		() => Promise.resolve(makeResponse(statuses[calls++])),
		{ sleepFn: () => Promise.resolve() },
	);

	assert.equal(response.status, 200);
	assert.equal(calls, 2);
});

test("parseRetryAfterMs handles seconds, missing, and garbage values", () => {
	assert.equal(parseRetryAfterMs("3"), 3000);
	assert.equal(parseRetryAfterMs(null), null);
	assert.equal(parseRetryAfterMs("not-a-date"), null);
	assert.equal(parseRetryAfterMs("0"), 0);
});

const STAGING_BEDROCK_URL =
	"https://ai-gateway.us-east-1.staging.atl-paas.net/v1/bedrock/model/anthropic.claude-sonnet-5/invoke-with-response-stream";
const PROD_BEDROCK_URL =
	"https://ai-gateway.us-east-1.prod.atl-paas.net/v1/bedrock/model/anthropic.claude-sonnet-5/invoke-with-response-stream";

test("describeGatewayCloudIdKind labels dummy, uuid, local-testing, and missing values", () => {
	assert.equal(describeGatewayCloudIdKind("internal-dummy-rad-venn-prototype"), "DUMMY");
	assert.equal(describeGatewayCloudIdKind("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"), "UUID");
	assert.equal(describeGatewayCloudIdKind("local-testing"), "LOCAL_TESTING");
	assert.equal(describeGatewayCloudIdKind(""), "MISSING");
	assert.equal(describeGatewayCloudIdKind("hello"), "OTHER");
});

test("isStagingAiGatewayUrl and isDummyGatewayCloudId recognize staging hosts and dummy CloudIDs", () => {
	assert.equal(isStagingAiGatewayUrl(STAGING_BEDROCK_URL), true);
	assert.equal(isStagingAiGatewayUrl(PROD_BEDROCK_URL), false);
	assert.equal(isDummyGatewayCloudId("internal-dummy-rad-venn-prototype"), true);
	assert.equal(isDummyGatewayCloudId("external-dummy-batch-1337"), true);
	assert.equal(isDummyGatewayCloudId("local-testing"), false);
	assert.equal(isDummyGatewayCloudId("a436116f-02ce-4520-8fbb-7301462a1674"), false);
});

test("resolveGatewayCloudId remaps staging tenant UUIDs and local-testing to the Proximity dummy", () => {
	assert.equal(
		resolveGatewayCloudId({
			AI_GATEWAY_URL: STAGING_BEDROCK_URL,
			AI_GATEWAY_USE_CASE_ID: "rad-venn-prototype",
			AI_GATEWAY_CLOUD_ID: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
		}),
		"internal-dummy-rad-venn-prototype",
	);
	assert.equal(
		resolveGatewayCloudId({
			AI_GATEWAY_URL: STAGING_BEDROCK_URL,
			AI_GATEWAY_USE_CASE_ID: "rad-venn-prototype",
			AI_GATEWAY_CLOUD_ID: "local-testing",
		}),
		"internal-dummy-rad-venn-prototype",
	);
	assert.equal(
		resolveGatewayCloudId({
			AI_GATEWAY_URL: STAGING_BEDROCK_URL,
			AI_GATEWAY_USE_CASE_ID: "rad-venn-prototype",
		}),
		"internal-dummy-rad-venn-prototype",
	);
});

test("resolveGatewayCloudId keeps dummy CloudIDs and production tenant CloudIDs", () => {
	assert.equal(
		resolveGatewayCloudId({
			AI_GATEWAY_URL: STAGING_BEDROCK_URL,
			AI_GATEWAY_USE_CASE_ID: "rad-venn-prototype",
			AI_GATEWAY_CLOUD_ID: "internal-dummy-custom",
		}),
		"internal-dummy-custom",
	);
	assert.equal(
		resolveGatewayCloudId({
			AI_GATEWAY_URL: PROD_BEDROCK_URL,
			AI_GATEWAY_USE_CASE_ID: "rad-venn-prototype",
			AI_GATEWAY_CLOUD_ID: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
		}),
		"aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
	);
});

test("getGatewayHeaders sends the resolved staging dummy CloudID", () => {
	const headers = getGatewayHeaders(
		{
			AI_GATEWAY_URL: STAGING_BEDROCK_URL,
			AI_GATEWAY_USE_CASE_ID: "rad-venn-prototype",
			AI_GATEWAY_CLOUD_ID: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
			AI_GATEWAY_USER_ID: "user@example.com",
		},
		"token",
		true,
	);

	assert.equal(headers["X-Atlassian-CloudId"], "internal-dummy-rad-venn-prototype");
	assert.equal(headers["X-Atlassian-UseCaseId"], "rad-venn-prototype");
});

test("getAIGatewayConfigReport reports CloudID kinds without values", () => {
	const report = getAIGatewayConfigReport({
		AI_GATEWAY_URL: STAGING_BEDROCK_URL,
		AI_GATEWAY_USE_CASE_ID: "rad-venn-prototype",
		AI_GATEWAY_CLOUD_ID: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
	});
	assert.equal(report.AI_GATEWAY_CLOUD_ID, "SET");
	assert.equal(report.AI_GATEWAY_CLOUD_ID_KIND, "UUID");
	assert.equal(report.AI_GATEWAY_CLOUD_ID_RESOLVED_KIND, "DUMMY");
});

test("describeGatewayCloudIdError explains the staging dummy CloudID workaround", () => {
	assert.match(
		describeGatewayCloudIdError('{"message":"CloudID is invalid or not provisioned in the staging environment."}'),
		/internal-dummy-<use-case-id>/u,
	);
	assert.equal(describeGatewayCloudIdError("other failure"), "other failure");
});
