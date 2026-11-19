"use client";

import ChatContextBar from "@/components/projects/shared/components/chat-context-bar";
import type { ChatContextBarDescriptor } from "@/components/projects/shared/lib/chat-context-bar";
import { Footer } from "@/components/ui-custom/footer";

export function ReadOnlySessionComposer({ context, hideAiDisclaimer, onContextBarOpenChange }: Readonly<{
	context?: ChatContextBarDescriptor | null;
	hideAiDisclaimer?: boolean;
	onContextBarOpenChange?: (open: boolean) => void;
}>) {
	return (
		<div className="min-w-0 px-3">
			<ChatContextBar context={context} onOpenChange={onContextBarOpenChange} />
			{hideAiDisclaimer ? null : <Footer />}
		</div>
	);
}
