// Value coercion helpers shared by the json-render registry component groups.
/** Convert null to undefined for React component props that expect optional values */
export function nu<T>(v: T | null | undefined): T | undefined {
	return v ?? undefined;
}

function isDynamicExpressionObject(value: unknown): boolean {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return false;
	}

	const record = value as Record<string, unknown>;
	return (
		Object.prototype.hasOwnProperty.call(record, "$state") ||
		Object.prototype.hasOwnProperty.call(record, "$item") ||
		Object.prototype.hasOwnProperty.call(record, "$index") ||
		Object.prototype.hasOwnProperty.call(record, "$bindState") ||
		Object.prototype.hasOwnProperty.call(record, "$bindItem") ||
		Object.prototype.hasOwnProperty.call(record, "$cond")
	);
}

export function toSafeText(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		return String(value);
	}

	if (Array.isArray(value)) {
		return value
			.map((entry) => toSafeText(entry))
			.filter(Boolean)
			.join(", ");
	}

	if (isDynamicExpressionObject(value)) {
		return "";
	}

	try {
		return JSON.stringify(value);
	} catch {
		return "";
	}
}

export function toSafeOptionalText(value: unknown): string | undefined {
	const text = toSafeText(value).trim();
	return text.length > 0 ? text : undefined;
}

export function toPositiveDimension(value: unknown, fallbackValue: number): number {
	if (typeof value === "number" && Number.isFinite(value) && value > 0) {
		return Math.round(value);
	}

	if (typeof value === "string") {
		const trimmedValue = value.trim();
		if (!trimmedValue) {
			return fallbackValue;
		}

		const parsedValue = Number.parseFloat(trimmedValue);
		if (Number.isFinite(parsedValue) && parsedValue > 0) {
			return Math.round(parsedValue);
		}
	}

	return fallbackValue;
}

const MERMAID_FENCE_BLOCK_REGEX = /```mermaid\b[\s\S]*?```/i;

export function isMermaidLanguage(value: unknown): boolean {
	const normalizedLanguage = toSafeOptionalText(value)?.toLowerCase();
	return normalizedLanguage === "mermaid" || normalizedLanguage === "mmd";
}

export function hasMermaidFenceBlock(value: string): boolean {
	return MERMAID_FENCE_BLOCK_REGEX.test(value);
}

export function toMermaidMarkdown(code: string): string {
	const normalizedCode = code.trim();
	if (!normalizedCode) {
		return "";
	}

	if (hasMermaidFenceBlock(normalizedCode)) {
		return normalizedCode;
	}

	return ["```mermaid", normalizedCode, "```", ""].join("\n");
}

export function cloneStateModel<TState extends Record<string, unknown>>(state: TState): TState {
	return structuredClone(state);
}

export function toDataArray(raw: unknown): Array<Record<string, unknown>> {
	if (Array.isArray(raw)) return raw;
	if (raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).data)) {
		return (raw as Record<string, unknown>).data as Array<Record<string, unknown>>;
	}
	return [];
}
