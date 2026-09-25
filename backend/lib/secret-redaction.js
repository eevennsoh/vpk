/**
 * Secret exfiltration blocking for tool outputs.
 *
 * Scans text for credential patterns (API keys, private keys, database URLs,
 * bearer tokens) and replaces matches with [REDACTED: type] placeholders.
 *
 * Used by this repository's backend to sanitize tool results from Rovo Serve
 * before they reach the frontend or are persisted.
 */

/**
 * @typedef {{ pattern: RegExp, label: string }} SecretPattern
 * @typedef {{ label: string, match: string, index: number }} DetectedSecret
 */

/** @type {SecretPattern[]} */
const DEFAULT_SECRET_PATTERNS = [
	{ pattern: /(?:AKIA|ASIA)[A-Z0-9]{16}/gu, label: "AWS Access Key" },
	{ pattern: /sk-(?:proj-|live-|test-)?[a-zA-Z0-9]{20,}/gu, label: "OpenAI API Key" },
	{ pattern: /sk-ant-[a-zA-Z0-9_-]{20,}/gu, label: "Anthropic API Key" },
	{ pattern: /ghp_[a-zA-Z0-9]{36,}/gu, label: "GitHub PAT" },
	{ pattern: /ghs_[a-zA-Z0-9]{36,}/gu, label: "GitHub App Token" },
	{ pattern: /github_pat_[a-zA-Z0-9_]{22,}/gu, label: "GitHub Fine-Grained PAT" },
	{ pattern: /glpat-[a-zA-Z0-9_-]{20,}/gu, label: "GitLab PAT" },
	{ pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/gu, label: "Private Key" },
	{ pattern: /(?:postgres|postgresql|mysql|mongodb|redis|amqp):\/\/\S+:\S+@\S+/gu, label: "Database URL" },
	{ pattern: /Bearer\s+[a-zA-Z0-9._-]{20,}/gu, label: "Bearer Token" },
	{ pattern: /xox[bpoas]-[a-zA-Z0-9-]{10,}/gu, label: "Slack Token" },
	{ pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/gu, label: "SendGrid API Key" },
];

/**
 * Detect secrets in text and return details about each match.
 *
 * @param {string} text - The text to scan.
 * @param {SecretPattern[]} [extraPatterns] - Additional patterns beyond defaults.
 * @returns {DetectedSecret[]} Array of detected secrets with labels and positions.
 */
function detectSecrets(text, extraPatterns) {
	if (typeof text !== "string" || text.length === 0) {
		return [];
	}

	const allPatterns = extraPatterns
		? [...DEFAULT_SECRET_PATTERNS, ...extraPatterns]
		: DEFAULT_SECRET_PATTERNS;

	/** @type {DetectedSecret[]} */
	const detected = [];
	for (const { pattern, label } of allPatterns) {
		// Reset lastIndex for global regexes
		pattern.lastIndex = 0;
		let match;
		while ((match = pattern.exec(text)) !== null) {
			detected.push({
				label,
				match: match[0],
				index: match.index,
			});
		}
	}

	return detected;
}

/**
 * Replace secret patterns in text with [REDACTED: label] placeholders.
 *
 * @param {string} text - The text to redact.
 * @param {SecretPattern[]} [extraPatterns] - Additional patterns beyond defaults.
 * @returns {string} Text with secrets replaced by redaction placeholders.
 */
function redactSecrets(text, extraPatterns) {
	if (typeof text !== "string" || text.length === 0) {
		return text;
	}

	const allPatterns = extraPatterns
		? [...DEFAULT_SECRET_PATTERNS, ...extraPatterns]
		: DEFAULT_SECRET_PATTERNS;

	let result = text;
	for (const { pattern, label } of allPatterns) {
		pattern.lastIndex = 0;
		result = result.replace(pattern, `[REDACTED: ${label}]`);
	}

	return result;
}

module.exports = {
	DEFAULT_SECRET_PATTERNS,
	detectSecrets,
	redactSecrets,
};
