/*
 * json-island: the one serializer for JSON embedded in vpk-html documents
 * (integration contract K9; ws6 C1). Every island in a page uses it: review
 * data, revisions, content IR, thread state, film data, anatomy data.
 *
 * The escape set defeats the whole-file check-html scans (raw colours,
 * double-brace placeholders, remote url() and import patterns, script and
 * comment terminators) and stays lossless for JSON.parse:
 *   - inside string literals only: the two curly braces;
 *   - everywhere: less-than, greater-than, ampersand, number sign, both
 *     parentheses, apostrophe, at sign, U+2028 and U+2029.
 * Each one is written as a six-character backslash-u escape.
 *
 * Module shape (frozen after B1, R29): only export function declarations, no
 * imports and no module-level state, so the review runtime can serialize
 * serializeJsonIsland and parseJsonIsland individually and the x-thread
 * runtime can bundle the whole file. The source is plain ASCII and contains no
 * less-than character: the escape class and the markup are built from
 * String.fromCharCode, so neither esbuild nor an HTML parser can change them.
 */

export function serializeJsonIsland(value, space) {
	if (typeof space === "string" && /\S/.test(space)) {
		throw new TypeError("serializeJsonIsland: space must be a number or whitespace");
	}
	const json = JSON.stringify(value, null, space);
	if (typeof json !== "string") {
		throw new TypeError("serializeJsonIsland: value is not JSON-serializable");
	}
	const special = new RegExp("[" + String.fromCharCode(123, 125, 60, 62, 38, 35, 40, 41, 39, 64, 8232, 8233) + "]", "g");
	const escape = (character) => "\\u" + character.charCodeAt(0).toString(16).padStart(4, "0");
	return json.replace(/"(?:[^"\\]|\\[\s\S])*"/g, (literal) => literal.replace(special, escape));
}

export function parseJsonIsland(text) {
	if (typeof text !== "string") {
		throw new TypeError("parseJsonIsland: text must be a string");
	}
	try {
		return JSON.parse(text);
	} catch (error) {
		throw new SyntaxError("invalid JSON island: " + (error && error.message ? error.message : String(error)));
	}
}

export function findJsonIslands(html, attrName) {
	if (typeof html !== "string") {
		throw new TypeError("findJsonIslands: html must be a string");
	}
	const wanted = String(attrName ?? "").toLowerCase();
	if (!/^[a-z][a-z0-9:._-]*$/.test(wanted)) {
		throw new TypeError("findJsonIslands: invalid attribute name");
	}
	const lt = String.fromCharCode(60);
	const openTag = new RegExp(lt + "script\\b((?:[^\"'>]|\"[^\"]*\"|'[^']*')*)>", "gi");
	const closeTag = new RegExp(lt + "\\/script\\s*>", "gi");
	const attrToken = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=>`]+)))?/g;
	const islands = [];
	let open = openTag.exec(html);
	while (open !== null) {
		const attrs = {};
		attrToken.lastIndex = 0;
		let token = attrToken.exec(open[1]);
		while (token !== null) {
			const name = token[1].toLowerCase();
			if (name !== "__proto__" && !Object.prototype.hasOwnProperty.call(attrs, name)) {
				attrs[name] = token[2] ?? token[3] ?? token[4] ?? "";
			}
			token = attrToken.exec(open[1]);
		}
		const contentStart = openTag.lastIndex;
		closeTag.lastIndex = contentStart;
		const close = closeTag.exec(html);
		if (close === null) break;
		const isJson = String(attrs.type ?? "").trim().toLowerCase() === "application/json";
		if (isJson && Object.prototype.hasOwnProperty.call(attrs, wanted)) {
			islands.push({
				raw: html.slice(contentStart, close.index),
				attrs,
				start: open.index,
				end: closeTag.lastIndex,
				contentStart,
				contentEnd: close.index,
			});
		}
		openTag.lastIndex = closeTag.lastIndex;
		open = openTag.exec(html);
	}
	return islands;
}

export function extractJsonScript(html, attrName) {
	const [first] = findJsonIslands(html, attrName);
	return first ? first.raw : null;
}

export function jsonIslandTag(attrs, value, space) {
	const lt = String.fromCharCode(60);
	let tag = lt + "script type=\"application/json\"";
	for (const [name, attrValue] of Object.entries(attrs ?? {})) {
		if (!/^[a-z][a-z0-9-]*$/.test(name) || name === "type") {
			throw new TypeError("jsonIslandTag: invalid attribute name \"" + name + "\"");
		}
		if (typeof attrValue !== "string" || !/^[A-Za-z0-9._:/-]*$/.test(attrValue)) {
			throw new TypeError("jsonIslandTag: unsafe attribute value for " + name);
		}
		tag += " " + name + "=\"" + attrValue + "\"";
	}
	return tag + ">" + serializeJsonIsland(value, space) + lt + "/script>";
}
