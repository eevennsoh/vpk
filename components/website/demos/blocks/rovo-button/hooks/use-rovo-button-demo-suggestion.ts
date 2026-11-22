"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { FloatingRovoButtonSuggestion } from "@/components/blocks/rovo-button";

const LABELS = ["Summarize RFP requirements", "Review the project timeline", "Find outstanding decisions", "Draft a status update"];

export function useRovoButtonDemoSuggestion() {
	const [items, setItems] = useState<{ id: string; label: string }[]>([]);
	const nextId = useRef(0);
	const show = useCallback(() => {
		const id = nextId.current++;
		setItems((current) => [...current, { id: String(id), label: LABELS[id % LABELS.length] }]);
	}, []);
	const hide = useCallback(() => setItems([]), []);
	const remove = useCallback((id: string) => setItems((current) => current.filter((item) => item.id !== id)), []);
	const suggestions = useMemo<readonly FloatingRovoButtonSuggestion[]>(() => items.map((item) => ({
		...item,
		onSelect: () => remove(item.id),
		onDismiss: () => remove(item.id),
	})), [items, remove]);
	return { suggestions, show, hide };
}
