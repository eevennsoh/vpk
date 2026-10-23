import type { BundledLanguage } from "shiki";

export function getTokensCacheKey(code: string, language: BundledLanguage): string {
	return JSON.stringify([language, code]);
}
