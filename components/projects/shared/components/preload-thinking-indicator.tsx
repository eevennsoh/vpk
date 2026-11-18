"use client";

import type { ReactNode } from "react";
import { Message, MessageContent } from "@/components/ui/message";
import {
	ChainOfThought,
	ChainOfThoughtContent,
	ChainOfThoughtHeader,
	ChainOfThoughtStep,
} from "@/components/ui/chain-of-thought";
import SearchIcon from "@atlaskit/icon/core/search";
import { getPreloadShimmerLabel } from "@/lib/reasoning-labels";

interface PreloadThinkingIndicatorProps {
	label?: string;
}

export function PreloadThinkingIndicator({
	label = getPreloadShimmerLabel(),
}: Readonly<PreloadThinkingIndicatorProps>): ReactNode {
	return (
		<Message className="cv-auto">
			<MessageContent>
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
			</MessageContent>
		</Message>
	);
}
