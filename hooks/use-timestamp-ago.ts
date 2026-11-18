"use client";

import { useState } from "react";

/**
 * ISO timestamp `ageMs` before this component first rendered, fixed for the component's lifetime.
 * The clock is read once, in a lazy state initializer, so re-renders keep the same instant.
 */
export function useTimestampAgo(ageMs: number): string {
	const [timestamp] = useState(() => new Date(Date.now() - ageMs).toISOString());
	return timestamp;
}
