const assert = require("node:assert/strict");
const test = require("node:test");

const {
	redactSecrets,
	detectSecrets,
} = require("./secret-redaction");

test("redacts AWS access key", () => {
	const text = "Found key AKIAIOSFODNN7EXAMPLE in config";
	const result = redactSecrets(text);
	assert.ok(!result.includes("AKIAIOSFODNN7EXAMPLE"));
	assert.ok(result.includes("[REDACTED: AWS Access Key]"));
});

test("redacts OpenAI API key", () => {
	const text = "export OPENAI_API_KEY=sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234";
	const result = redactSecrets(text);
	assert.ok(!result.includes("sk-proj-abc123"));
	assert.ok(result.includes("[REDACTED: OpenAI API Key]"));
});

test("redacts Anthropic API key", () => {
	const text = "ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";
	const result = redactSecrets(text);
	assert.ok(!result.includes("sk-ant-"));
	assert.ok(result.includes("[REDACTED: Anthropic API Key]"));
});

test("redacts GitHub PAT", () => {
	const text = "token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";
	const result = redactSecrets(text);
	assert.ok(!result.includes("ghp_"));
	assert.ok(result.includes("[REDACTED: GitHub PAT]"));
});

test("redacts private key block", () => {
	const text = "-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA\n-----END RSA PRIVATE KEY-----";
	const result = redactSecrets(text);
	assert.ok(!result.includes("BEGIN RSA PRIVATE KEY"));
	assert.ok(result.includes("[REDACTED: Private Key]"));
});

test("redacts database URL with credentials", () => {
	const text = "DATABASE_URL=postgres://admin:s3cret@db.example.com:5432/mydb";
	const result = redactSecrets(text);
	assert.ok(!result.includes("s3cret"));
	assert.ok(result.includes("[REDACTED: Database URL]"));
});

test("redacts bearer token", () => {
	const text = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc123";
	const result = redactSecrets(text);
	assert.ok(!result.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"));
	assert.ok(result.includes("[REDACTED: Bearer Token]"));
});

test("leaves non-secret content unchanged", () => {
	const text = "This is a normal message with no secrets. Status code: 200";
	const result = redactSecrets(text);
	assert.equal(result, text);
});

test("redacts multiple secrets in same text", () => {
	const text = "key1=AKIAIOSFODNN7EXAMPLE key2=sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789";
	const result = redactSecrets(text);
	assert.ok(!result.includes("AKIAIOSFODNN7EXAMPLE"));
	assert.ok(!result.includes("sk-ant-"));
	assert.ok(result.includes("[REDACTED: AWS Access Key]"));
	assert.ok(result.includes("[REDACTED: Anthropic API Key]"));
});

test("detectSecrets returns matched types", () => {
	const text = "AKIAIOSFODNN7EXAMPLE and ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";
	const detected = detectSecrets(text);
	assert.ok(detected.length >= 2);
	assert.ok(detected.some((d) => d.label === "AWS Access Key"));
	assert.ok(detected.some((d) => d.label === "GitHub PAT"));
});

test("detectSecrets returns empty for clean text", () => {
	const detected = detectSecrets("just normal output");
	assert.equal(detected.length, 0);
});

test("redacts Slack token", () => {
	const text = "SLACK_TOKEN=xoxb-123456789012-abcdefghijkl";
	const result = redactSecrets(text);
	assert.ok(!result.includes("xoxb-"));
	assert.ok(result.includes("[REDACTED: Slack Token]"));
});

test("redacts with custom extra patterns", () => {
	const text = "SECRET_1234 in output";
	const extra = [{ pattern: /SECRET_\d{4}/gu, label: "Custom Secret" }];
	const result = redactSecrets(text, extra);
	assert.ok(!result.includes("SECRET_1234"));
	assert.ok(result.includes("[REDACTED: Custom Secret]"));
});
