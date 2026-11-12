"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	ConversationStarterDialog,
	getStarterIcon,
	type ConversationStarter,
} from "@/components/blocks/conversation-starter";

const INITIAL_STARTERS: ConversationStarter[] = [
	{ id: "s1", text: "Summarize this project's status", icon: "ai-sparkle" },
	{ id: "s2", text: "What are the open risks?", icon: "question-circle" },
];

export default function ConversationStarterPage() {
	const [open, setOpen] = useState(false);
	const [starters, setStarters] = useState<readonly ConversationStarter[]>(INITIAL_STARTERS);

	return (
		<div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
			<div className="flex w-full max-w-md flex-col gap-2">
				{starters.length > 0 ? (
					starters.map((starter) => {
						const Icon = getStarterIcon(starter.icon);
						return (
							<div
								className="flex items-center gap-2 rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text"
								key={starter.id}
							>
								<span className="text-icon-subtle">
									<Icon label="" size="small" color="currentColor" />
								</span>
								{starter.text}
							</div>
						);
					})
				) : (
					<p className="text-center text-sm text-text-subtlest">No conversation starters set.</p>
				)}
			</div>

			<Button onClick={() => setOpen(true)}>Edit conversation starters</Button>

			<ConversationStarterDialog
				open={open}
				onOpenChange={setOpen}
				starters={starters}
				onSave={setStarters}
			/>
		</div>
	);
}
