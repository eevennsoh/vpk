/**
 * SKILL.md frontmatter codec — parse/serialize the YAML block between the
 * leading `---` fences, plus the markdown body.
 *
 * Per the Anthropic "Agent Skills" standard a SKILL.md is:
 *
 *     ---
 *     name: my-skill            # required, slug
 *     description: ...          # required, "when to use" + what it does
 *     allowed-tools:            # optional
 *       - Jira
 *       - Confluence
 *     ---
 *
 *     # body markdown...
 *
 * Frontmatter keys are DYNAMIC — whatever sits between the fences is preserved
 * as ordered key→value entries so the editor's frontmatter card can render any
 * keys (not a fixed schema). This is a deliberately small, forgiving YAML subset
 * (scalars, block/flow lists, graceful raw passthrough for nested blocks) rather
 * than a full YAML parser: VPK is a prototype and we author the frontmatter
 * shape ourselves. Everything is isolated behind these functions so swapping in
 * a real `yaml` dependency later is a localized change.
 *
 * Pure (no JSX / app imports) so it is unit-testable under `node --test`.
 */

export type FrontmatterValue = string | readonly string[];

export interface FrontmatterEntry {
	key: string;
	value: FrontmatterValue;
}

export type FrontmatterEntries = readonly FrontmatterEntry[];

const LIST_ITEM_RE = /^\s*-\s+(.*)$/u;
const TOP_LEVEL_RE = /^([^\s:][^:]*?):\s*(.*)$/u;
const FLOW_LIST_RE = /^\[(.*)\]$/u;
// YAML block scalar indicator: `|` (literal) or `>` (folded), with optional
// chomping (`+`/`-`) and explicit-indent digits, e.g. `|`, `|-`, `>`, `>2`.
const BLOCK_SCALAR_RE = /^([|>])[+-]?\d*$/u;

function unquoteScalar(raw: string): string {
	const value = raw.trim();
	if (value.startsWith('"')) {
		try {
			return JSON.parse(value) as string;
		} catch {
			return value;
		}
	}
	if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
		return value.slice(1, -1);
	}
	return value;
}

function scalarNeedsQuotes(value: string): boolean {
	return (
		value.includes("\n") ||
		value.includes(": ") ||
		value.includes(":\t") ||
		value.endsWith(":") ||
		/^\s|\s$/u.test(value) ||
		/^["'[\]{}#>|*&!%@`]/u.test(value)
	);
}

function quoteScalar(value: string): string {
	return scalarNeedsQuotes(value) ? JSON.stringify(value) : value;
}

/** Parse the YAML text between the `---` fences into ordered entries. */
export function parseFrontmatterYaml(yaml: string): FrontmatterEntries {
	const lines = yaml.replace(/\r\n/gu, "\n").split("\n");
	const entries: FrontmatterEntry[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];
		if (line.trim() === "") {
			i += 1;
			continue;
		}

		const match = TOP_LEVEL_RE.exec(line);
		if (!match) {
			// Unparseable top-level line — skip rather than throw (forgiving).
			i += 1;
			continue;
		}

		const key = match[1].trim();
		const inline = match[2];

		if (inline.trim() !== "") {
			const blockScalar = BLOCK_SCALAR_RE.exec(inline.trim());
			if (blockScalar) {
				// YAML block scalar (`|` literal / `>` folded): the marker is not the
				// value — gather the indented continuation lines (so they aren't dropped),
				// dedent, and join. Re-serializes as a quoted scalar, preserving the text.
				const blockLines: string[] = [];
				let j = i + 1;
				while (j < lines.length && (lines[j].trim() === "" || /^[ \t]/u.test(lines[j]))) {
					blockLines.push(lines[j]);
					j += 1;
				}
				while (blockLines.length > 0 && blockLines[blockLines.length - 1].trim() === "") {
					blockLines.pop();
				}
				const indents = blockLines
					.filter((blockLine) => blockLine.trim() !== "")
					.map((blockLine) => /^[ \t]*/u.exec(blockLine)![0].length);
				const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
				const content = blockLines.map((blockLine) => blockLine.slice(minIndent));
				const value =
					blockScalar[1] === ">"
						? content.map((blockLine) => blockLine.trim()).filter((blockLine) => blockLine !== "").join(" ")
						: content.join("\n");
				entries.push({ key, value });
				i = j;
				continue;
			}

			const flow = FLOW_LIST_RE.exec(inline.trim());
			if (flow) {
				const items = flow[1]
					.split(",")
					.map((item) => unquoteScalar(item))
					.filter((item) => item.length > 0);
				entries.push({ key, value: items });
			} else {
				entries.push({ key, value: unquoteScalar(inline) });
			}
			i += 1;
			continue;
		}

		// Empty inline value — gather the indented block that follows.
		const indented: string[] = [];
		let j = i + 1;
		while (j < lines.length && /^[ \t]/u.test(lines[j])) {
			indented.push(lines[j]);
			j += 1;
		}

		if (indented.length > 0 && indented.every((entry) => LIST_ITEM_RE.test(entry))) {
			entries.push({
				key,
				value: indented.map((entry) => unquoteScalar(LIST_ITEM_RE.exec(entry)![1])),
			});
		} else if (indented.length > 0) {
			// Nested map / unsupported block — round-trip the raw indented text verbatim.
			entries.push({ key, value: indented.join("\n") });
		} else {
			entries.push({ key, value: "" });
		}

		i = j;
	}

	return entries;
}

/** Serialize ordered entries back into the YAML body (no surrounding fences). */
export function serializeFrontmatterYaml(entries: FrontmatterEntries): string {
	return entries
		.map((entry) => {
			if (Array.isArray(entry.value)) {
				if (entry.value.length === 0) {
					return `${entry.key}: []`;
				}
				return `${entry.key}:\n${entry.value.map((item) => `  - ${quoteScalar(String(item))}`).join("\n")}`;
			}

			const value = String(entry.value);
			if (value === "") {
				return `${entry.key}:`;
			}
			// Multi-line values (e.g. a multi-line description, or a parsed nested
			// block) are JSON-quoted onto one line by quoteScalar so they survive the
			// parse round-trip instead of being silently dropped as an unindented block.
			return `${entry.key}: ${quoteScalar(value)}`;
		})
		.join("\n");
}

/** Split a full SKILL.md into its frontmatter entries + markdown body. */
export function parseSkillMd(text: string): { frontmatter: FrontmatterEntries; body: string } {
	const normalized = (text ?? "").replace(/\r\n/gu, "\n");
	const fence = /^---\n([\s\S]*?)\n---\n?/u.exec(normalized);
	if (!fence) {
		return { frontmatter: [], body: normalized.replace(/^\n+/u, "").replace(/\s+$/u, "") };
	}
	return {
		frontmatter: parseFrontmatterYaml(fence[1]),
		body: normalized
			.slice(fence[0].length)
			.replace(/^\n+/u, "")
			.replace(/\s+$/u, ""),
	};
}

/** Compose frontmatter entries + body back into a full SKILL.md string. */
/** A skill's file-safe name ("Draft release notes" -> "draft-release-notes"), as in SKILL.md frontmatter. */
export function slugifySkillName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/gu, "-")
		.replace(/^-|-$/gu, "");
}

export function serializeSkillMd(frontmatter: FrontmatterEntries, body: string): string {
	const yaml = serializeFrontmatterYaml(frontmatter);
	const trimmedBody = (body ?? "").replace(/^\n+/u, "").replace(/\s+$/u, "");
	return `---\n${yaml}\n---\n\n${trimmedBody}\n`;
}

/** Look up a frontmatter value by key (case-sensitive, first match). */
export function getFrontmatterField(
	entries: FrontmatterEntries,
	key: string,
): FrontmatterValue | undefined {
	return entries.find((entry) => entry.key === key)?.value;
}

/** Set/replace a frontmatter value by key, preserving order (appends if new). */
export function setFrontmatterField(
	entries: FrontmatterEntries,
	key: string,
	value: FrontmatterValue,
): FrontmatterEntries {
	const index = entries.findIndex((entry) => entry.key === key);
	if (index === -1) {
		return [...entries, { key, value }];
	}
	return entries.map((entry, entryIndex) => (entryIndex === index ? { key, value } : entry));
}

/** Render a frontmatter value as a single display string (lists → comma-joined). */
export function frontmatterValueToString(value: FrontmatterValue | undefined): string {
	if (value === undefined) {
		return "";
	}
	return Array.isArray(value) ? value.join(", ") : String(value);
}
