"use client";

import { RovoAppQueueBoundary } from "@/app/rovo/rovo-queue-provider";
import { RovoAppShell } from "@/components/projects/rovo/components/rovo-app-shell";
import { usePreloadMessageMarkdownForThread } from "@/components/projects/rovo-core/hooks/use-preload-message-markdown";
import type { RovoAppEmptyStateHeadingAs } from "@/components/projects/rovo-core/components/rovo-app-empty-state-config";

interface RovoPageProps {
	embedded?: boolean;
	headingAs?: RovoAppEmptyStateHeadingAs;
	initialThreadId?: string | null;
}

export default function RovoPage({
	embedded = false,
	headingAs = "h1",
	initialThreadId = null,
}: Readonly<RovoPageProps>) {
	usePreloadMessageMarkdownForThread(initialThreadId);
	return (
		<RovoAppQueueBoundary>
			<RovoAppShell
				embedded={embedded}
				headingAs={headingAs}
				initialThreadId={initialThreadId}
			/>
		</RovoAppQueueBoundary>
	);
}
