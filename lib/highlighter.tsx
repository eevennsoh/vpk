import * as React from "react"
import {
	createHighlighterCore,
	type GrammarState,
	type HighlighterCore,
} from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"

// Add the languages you need. Each one loads the first time it is used.
const languages = {
	bash: () => import("shiki/langs/shellscript.mjs"),
	css: () => import("shiki/langs/css.mjs"),
	diff: () => import("shiki/langs/diff.mjs"),
	html: () => import("shiki/langs/html.mjs"),
	javascript: () => import("shiki/langs/javascript.mjs"),
	json: () => import("shiki/langs/json.mjs"),
	jsx: () => import("shiki/langs/jsx.mjs"),
	markdown: () => import("shiki/langs/markdown.mjs"),
	python: () => import("shiki/langs/python.mjs"),
	sql: () => import("shiki/langs/sql.mjs"),
	tsx: () => import("shiki/langs/tsx.mjs"),
	typescript: () => import("shiki/langs/typescript.mjs"),
	yaml: () => import("shiki/langs/yaml.mjs"),
}

const aliases: Record<string, keyof typeof languages> = {
	js: "javascript",
	md: "markdown",
	py: "python",
	sh: "bash",
	shell: "bash",
	shellscript: "bash",
	ts: "typescript",
	yml: "yaml",
	zsh: "bash",
}

let highlighter: Promise<HighlighterCore> | undefined

// GitHub's high-contrast themes keep every token at 4.5:1 or better on the
// Code Block surface in both modes (VPK's muted, #f0f1f2 / #303134). The one
// exception is the light theme's comment gray, darkened from #66707b (4.45:1).
const LIGHT_THEME = "github-light-high-contrast"
const DARK_THEME = "github-dark-high-contrast"
const LIGHT_COMMENT = { from: "#66707b", to: "#626b76" }

async function loadLightTheme() {
	const theme = (await import("shiki/themes/github-light-high-contrast.mjs")).default

	return {
		...theme,
		tokenColors: theme.tokenColors?.map((rule) =>
			rule.settings?.foreground?.toLowerCase() === LIGHT_COMMENT.from
				? { ...rule, settings: { ...rule.settings, foreground: LIGHT_COMMENT.to } }
				: rule
		),
	}
}

function getHighlighter() {
	highlighter ??= createHighlighterCore({
		themes: [loadLightTheme(), import("shiki/themes/github-dark-high-contrast.mjs")],
		langs: [],
		engine: createJavaScriptRegexEngine({ forgiving: true }),
	})

	return highlighter
}

function getLanguage(language: string) {
	const name = language.toLowerCase()

	if (name === "ansi") {
		return name
	}

	if (name in languages) {
		return name as keyof typeof languages
	}

	return aliases[name] ?? null
}

// Loads a language and returns a highlighter for it, or null for a language
// that is not listed.
export async function loadHighlighter(language: string) {
	const lang = getLanguage(language)

	if (!lang) {
		return null
	}

	const shiki = await getHighlighter()

	if (lang !== "ansi" && !shiki.getLoadedLanguages().includes(lang)) {
		await shiki.loadLanguage(languages[lang])
	}

	return {
		// Returns one React node per line, and the grammar state after the last
		// line. Pass that state back to continue where the code left off.
		highlight(code: string, state?: GrammarState) {
			const tokenize = (text: string) =>
				shiki.codeToTokens(text, {
					lang,
					themes: { light: LIGHT_THEME, dark: DARK_THEME },
					defaultColor: false,
					grammarState: state,
				}).tokens

			// ANSI has no grammar state, so each line is tokenized on its own and
			// gets the same colors whether it arrives in one piece or streams.
			const tokens =
				lang === "ansi"
					? code.split("\n").flatMap((line) => tokenize(line))
					: tokenize(code)

			return {
				lines: tokens.map((line) =>
					line.map((token, index) => (
						<span
							key={index}
							style={token.htmlStyle as React.CSSProperties}
							className="text-(--shiki-light) dark:text-(--shiki-dark)"
						>
							{token.content}
						</span>
					))
				),
				state: shiki.getLastGrammarState(tokens),
			}
		},
	}
}

// Returns one React node per line, or null for a language that is not listed.
export async function highlightCode(code: string, language: string) {
	const highlighter = await loadHighlighter(language)

	return highlighter ? highlighter.highlight(code).lines : null
}
