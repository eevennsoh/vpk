// Bounded, display-safe text for tool call input and output values.

import { isValidElement } from "react"

const MAX_TOOL_PREVIEW_CHARS = 1200
const MAX_TOOL_PREVIEW_LINES = 20
const MAX_SERIALIZE_DEPTH = 4
const MAX_SERIALIZE_ARRAY_ITEMS = 50
const MAX_SERIALIZE_OBJECT_KEYS = 50

export type ToolValuePreview = { text: string; truncated: boolean }

function truncateTextByLines(value: string, maxLines: number): ToolValuePreview {
	const lines = value.split(/\r?\n/u)
	if (lines.length <= maxLines) {
		return { text: value, truncated: false }
	}
	return { text: lines.slice(0, maxLines).join("\n"), truncated: true }
}

function truncateTextByChars(value: string, maxChars: number): ToolValuePreview {
	if (value.length <= maxChars) {
		return { text: value, truncated: false }
	}
	return { text: `${value.slice(0, Math.max(0, maxChars - 1))}…`, truncated: true }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Object.prototype.toString.call(value) === "[object Object]"
}

function toBoundedSerializableValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
	if (value === null || typeof value !== "object") {
		return value
	}
	if (seen.has(value)) {
		return "[Circular]"
	}
	if (depth >= MAX_SERIALIZE_DEPTH) {
		return Array.isArray(value) ? `[Array(${value.length})]` : "[Object]"
	}

	seen.add(value)
	try {
		if (Array.isArray(value)) {
			const items = value
				.slice(0, MAX_SERIALIZE_ARRAY_ITEMS)
				.map((item) => toBoundedSerializableValue(item, depth + 1, seen))
			if (value.length > MAX_SERIALIZE_ARRAY_ITEMS) {
				items.push(`[+${value.length - MAX_SERIALIZE_ARRAY_ITEMS} more items]`)
			}
			return items
		}

		if (isPlainObject(value)) {
			const entries = Object.entries(value)
			const bounded: Record<string, unknown> = {}
			for (const [key, entryValue] of entries.slice(0, MAX_SERIALIZE_OBJECT_KEYS)) {
				bounded[key] = toBoundedSerializableValue(entryValue, depth + 1, seen)
			}
			if (entries.length > MAX_SERIALIZE_OBJECT_KEYS) {
				bounded.__truncated__ = `+${entries.length - MAX_SERIALIZE_OBJECT_KEYS} more keys`
			}
			return bounded
		}

		return String(value)
	} finally {
		seen.delete(value)
	}
}

function stringifyScalar(value: unknown): string | null {
	if (typeof value === "string") {
		return value
	}
	if (value === null || value === undefined) {
		return ""
	}
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value)
	}
	return null
}

/** The whole value as text: strings as-is, everything else as pretty JSON. */
export function stringifyToolValue(value: unknown): string {
	const scalar = stringifyScalar(value)
	if (scalar !== null) {
		return scalar
	}
	try {
		return JSON.stringify(value, null, 2)
	} catch {
		return String(value)
	}
}

/** A preview capped by depth, keys, lines and characters, so huge payloads stay cheap to render. */
export function toToolValuePreview(
	value: unknown,
	{ maxChars = MAX_TOOL_PREVIEW_CHARS, maxLines = MAX_TOOL_PREVIEW_LINES } = {}
): ToolValuePreview {
	let text = stringifyScalar(value)
	if (text === null) {
		try {
			text = JSON.stringify(toBoundedSerializableValue(value, 0, new WeakSet<object>()), null, 2)
		} catch {
			text = String(value)
		}
	}
	const byLines = truncateTextByLines(text, maxLines)
	const byChars = truncateTextByChars(byLines.text, maxChars)
	return { text: byChars.text, truncated: byLines.truncated || byChars.truncated }
}

export function formatByteSize(bytes: number): string | null {
	if (!Number.isFinite(bytes) || bytes <= 0) {
		return null
	}
	if (bytes < 1024) {
		return `${bytes} B`
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export type ToolOutputDisplayOptions = {
	outputPreview?: string
	outputTruncated?: boolean
	outputBytes?: number
	suppressedRawOutput?: boolean
}

export type ToolOutputDisplay = {
	text: string
	language: "json" | "markdown"
	truncationNotice: string | null
}

/**
 * What ToolOutput shows for a value: the exact output unless the caller says it was
 * dropped or it is a rendered element, otherwise the caller's or a bounded preview.
 */
export function toToolOutputDisplay(
	output: unknown,
	{ outputPreview, outputTruncated, outputBytes, suppressedRawOutput }: ToolOutputDisplayOptions = {}
): ToolOutputDisplay {
	const hasOutput = output !== undefined && output !== null
	const isElement = isValidElement(output)
	const showExact = hasOutput && !isElement && suppressedRawOutput !== true
	const language = typeof output === "object" && !isElement ? "json" : "markdown"

	if (showExact) {
		return { text: stringifyToolValue(output), language, truncationNotice: null }
	}

	const preview =
		typeof outputPreview === "string" && outputPreview.length > 0
			? { text: outputPreview, truncated: outputTruncated === true }
			: toToolValuePreview(output)
	const truncated = outputTruncated === true || preview.truncated
	const bytes = typeof outputBytes === "number" ? formatByteSize(outputBytes) : null

	return {
		text: preview.text,
		language,
		truncationNotice: truncated ? `Result preview truncated for display${bytes ? ` (${bytes} received)` : ""}.` : null,
	}
}
