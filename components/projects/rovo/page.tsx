"use client";

import { RovoAppQueueBoundary } from "@/app/rovo/rovo-queue-provider";
import { RovoAppShell } from "@/components/projects/rovo/components/rovo-app-shell";
// Messages are this page, so the markdown runtime loads with it (C-8g) instead of on first message.
import "@/components/ui-custom/message-markdown-runtime";
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
