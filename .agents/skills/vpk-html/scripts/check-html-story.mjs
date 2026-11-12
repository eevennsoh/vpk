// Story-explainer checks for check-html (references/quality-gates.md § Story-explainer checks).
// They run only on a page whose <body> carries data-vpk-layout="story", so other templates are untouched.
//   rail-title           a control carrying title= instead of data-tip (accessibility.md)
//   duplicate-id         one id on two elements in the static markup
//   straight-apostrophe  ' or " in visible text or a data-tip (writing.md § Keep exactly)
//   inline-script-syntax a classic inline script that does not parse
import vm from "node:vm";

export const isStoryPage = html => /<body\b[^>]*\sdata-vpk-layout=["']story["']/i.test(html);

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const JS_TYPES = /^(?:|text\/javascript|application\/javascript)$/i;

// Markup a reader sees: no comments, scripts, styles or inert templates.
function visibleMarkup(html) {
	return html
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(SCRIPT, "")
		.replace(/<(style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
}

const sample = (items, limit = 6) => `${items.slice(0, limit).join(", ")}${items.length > limit ? ` and ${items.length - limit} more` : ""}`;

export function collectRailTitleIssues(markup) {
	const tags = markup.match(/<(?:button|a|summary|label|input|select)\b[^>]*\stitle=["'][^"']*["'][^>]*>/gi) ?? [];
	if (!tags.length) return [];
	return [`rail-title: ${tags.length} control${tags.length === 1 ? "" : "s"} set a tooltip with title=; use aria-label plus data-tip: ${sample(tags, 2)}`];
}

export function collectDuplicateIdIssues(markup) {
	const counts = new Map();
	for (const [, id] of markup.matchAll(/<[a-z][\w:-]*\b[^>]*?\sid=["']([^"']+)["']/gi)) counts.set(id, (counts.get(id) ?? 0) + 1);
	const duplicates = [...counts].filter(([, n]) => n > 1).map(([id, n]) => `${id} (${n}×)`);
	return duplicates.length ? [`duplicate-id: ${sample(duplicates)}; scope every copy’s ids`] : [];
}

const STRAIGHT = /['"]|&(?:#39|#x27|apos|quot|#34|#x22);/i;

export function collectStraightApostropheIssues(markup) {
	// Code is quoted verbatim, so pre, code, kbd, samp and textarea keep their quotes.
	const prose = markup.replace(/<(pre|code|kbd|samp|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
	const hits = [];
	for (const [, text] of prose.matchAll(/>([^<]+)</g)) if (STRAIGHT.test(text)) hits.push(JSON.stringify(text.trim().slice(0, 40)));
	for (const [, , tip] of prose.matchAll(/\sdata-tip=(["'])(.*?)\1/gi)) if (STRAIGHT.test(tip)) hits.push(`data-tip ${JSON.stringify(tip.slice(0, 40))}`);
	return hits.length ? [`straight-apostrophe: ' or " in visible text; write ’ “ ”: ${sample(hits, 3)}`] : [];
}

export function collectInlineScriptSyntaxIssues(html) {
	const issues = [];
	let index = 0;
	for (const [, attrs, code] of html.matchAll(SCRIPT)) {
		index += 1;
		const type = attrs.match(/\stype=["']([^"']*)["']/i)?.[1] ?? "";
		// Module scripts (import/export) do not parse as a classic script; the pageerror filter of verification § 5 owns them.
		if (!JS_TYPES.test(type) || /\ssrc=/i.test(attrs) || !code.trim()) continue;
		try {
			new vm.Script(code, { filename: `inline-script-${index}` });
		} catch (error) {
			issues.push(`inline-script-syntax: inline script ${index} does not parse (${error.name}: ${error.message})`);
		}
	}
	return issues;
}

export function collectStoryExplainerIssues(html) {
	if (!isStoryPage(html)) return [];
	const markup = visibleMarkup(html);
	return [
		...collectRailTitleIssues(markup),
		...collectDuplicateIdIssues(markup),
		...collectStraightApostropheIssues(markup),
		...collectInlineScriptSyntaxIssues(html),
	];
}
