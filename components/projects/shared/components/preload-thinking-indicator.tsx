"use client";

import type { ReactNode } from "react";
import { Message } from "@/components/ui-custom/message";
import {
	ChainOfThought,
	ChainOfThoughtContent,
	ChainOfThoughtHeader,
	ChainOfThoughtStep,
} from "@/components/ui-custom/chain-of-thought";
import SearchIcon from "@atlaskit/icon/core/search";
import { getPreloadShimmerLabel } from "@/components/ui-custom/lib/reasoning-labels";

interface PreloadThinkingIndicatorProps {
	label?: string;
}

export function PreloadThinkingIndicator({
	label = getPreloadShimmerLabel(),
}: Readonly<PreloadThinkingIndicatorProps>): ReactNode {
	return (
		<Message from="assistant" className="max-w-full">
			<ChainOfThought className="w-full" defaultOpen={false}>
				<ChainOfThoughtHeader showChevron={false} shimmer>
					{label}
				</ChainOfThoughtHeader>
				<ChainOfThoughtContent>
					<ChainOfThoughtStep
						icon={SearchIcon}
						label="Preparing reasoning trace"
						status="pending"
					/>
				</ChainOfThoughtContent>
			</ChainOfThought>
		</Message>
	);
}
