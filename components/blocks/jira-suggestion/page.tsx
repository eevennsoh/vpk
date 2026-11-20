"use client";

import { JiraSuggestion } from "@/components/blocks/jira-suggestion";
import type { ReactNode } from "react";

export default function JiraSuggestionPage({ children }: Readonly<{ children?: ReactNode }>) {
	return (
		<div className="relative h-[760px] w-full max-w-[1040px] overflow-hidden rounded-xl border border-border bg-surface">
			{children ?? <JiraSuggestion />}
		</div>
	);
}
