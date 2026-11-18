"use client"

import { createContext, use } from "react"

export type GenerativeCardContextValue = {
	expanded: boolean
	setExpanded: (next: boolean) => void
}

export const GenerativeCardContext = createContext<GenerativeCardContextValue | null>(null)

export function useGenerativeCardContext(optional: true): GenerativeCardContextValue | null
export function useGenerativeCardContext(optional?: false): GenerativeCardContextValue
export function useGenerativeCardContext(optional = false) {
	const context = use(GenerativeCardContext)

	if (context === null && !optional) {
		throw new Error("GenerativeCard components must be used within <GenerativeCard>.")
	}

	return context
}
