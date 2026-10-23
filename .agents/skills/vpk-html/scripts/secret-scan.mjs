/*
 * secret-scan: credential patterns for the publish preflight (P1) and the
 * review runtime's export and send warnings (integration K24; ws6 C7).
 *
 * The table is the union of html-plan's runtime/pack.mjs SECRET_TEXT list and
 * backend/lib/secret-redaction.js DEFAULT_SECRET_PATTERNS. The skill keeps its
 * own copy because it also installs standalone and ships inside documents;
 * secret-scan.test.js guards parity with the backend list.
 *
 * Module shape (frozen after B1, R29): only export function declarations, no
 * imports, no module-level state, plain ASCII. scanSecrets is self-contained,
 * so a serializer can ship it alone; secretPatterns delegates to it so the
 * table exists once. Findings never carry the matched secret: the preview is
 * its first four characters plus an ellipsis.
 */

export function secretPatterns() {
	return scanSecrets("", { listPatterns: true });
}

export function scanSecrets(text, options) {
	const table = [
		["AWS Access Key", /(?:AKIA|ASIA)[A-Z0-9]{16}/],
		["OpenAI API Key", /sk-(?:proj-|live-|test-)?[A-Za-z0-9]{20,}/],
		["Anthropic API Key", /sk-ant-[A-Za-z0-9_-]{20,}/],
		["GitHub token", /gh[pousr]_[A-Za-z0-9]{36,}/],
		["GitHub Fine-Grained PAT", /github_pat_[A-Za-z0-9_]{22,}/],
		["GitLab PAT", /glpat-[A-Za-z0-9_-]{20,}/],
		["Private Key", /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/],
		["Database URL", /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp):\/\/[^\s:@/"']+:[^\s@/"']+@\S+/],
		["Bearer Token", /Bearer\s+[A-Za-z0-9._~+/-]{20,}=*/],
		["Slack Token", /xox[abeoprs]-[A-Za-z0-9-]{10,}/],
		["SendGrid API Key", /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/],
		["Google API Key", /\bAIza[0-9A-Za-z_-]{35}\b/],
		["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
		["Credential assignment", /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i],
	];
	const patterns = table.map(([label, pattern]) => ({ label, source: pattern.source, flags: pattern.flags }));
	const settings = options || {};
	if (settings.listPatterns === true) return patterns;
	if (typeof text !== "string" || text.length === 0) return [];
	// Base64 payloads (fonts, images, films) false-match short key shapes, so data: URIs are
	// blanked first. Padding keeps every offset aligned with the original text.
	const haystack = settings.stripDataUris === false
		? text
		: text.replace(/\bdata:[^"')\s]+/g, (uri) => "data:" + " ".repeat(uri.length - 5));
	const ellipsis = String.fromCharCode(8230);
	const findings = [];
	for (const { label, source, flags } of patterns) {
		const pattern = new RegExp(source, flags.includes("g") ? flags : flags + "g");
		let match = pattern.exec(haystack);
		while (match !== null) {
			findings.push({ label, index: match.index, preview: match[0].slice(0, 4) + ellipsis });
			if (match[0].length === 0) pattern.lastIndex += 1;
			match = pattern.exec(haystack);
		}
	}
	return findings.sort((a, b) => a.index - b.index || a.label.localeCompare(b.label));
}
