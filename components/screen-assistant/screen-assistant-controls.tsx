"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { token } from "@/lib/tokens";
import type { UseScreenAssistantResult } from "./use-screen-assistant";

// ---------------------------------------------------------------------------
// Control bar — toggles for the AI cursor + Live chat, a text-send composer,
// and (optionally) offline harness buttons that drive the cursor directly.
// ---------------------------------------------------------------------------

interface ScreenAssistantControlsProps {
	assistant: UseScreenAssistantResult;
	showHarnessControls?: boolean;
	className?: string;
}

export function ScreenAssistantControls({
	assistant,
	showHarnessControls = false,
	className,
}: Readonly<ScreenAssistantControlsProps>) {
	const [draft, setDraft] = useState("");

	const handleSend = () => {
		if (!draft.trim()) return;
		assistant.sendText(draft);
		setDraft("");
	};

	const voiceLabel = assistant.isRealtimeActive
		? `Live chat: ${assistant.realtime.voiceState}`
		: "Start live chat";

	return (
		<div
			className={cn(
				"flex w-80 flex-col gap-2 rounded-xl bg-surface-raised p-3",
				className,
			)}
			style={{ boxShadow: token("elevation.shadow.overlay") }}
		>
			<span className="text-[10px] font-semibold text-text-subtlest">
				Screen assistant
			</span>

			<div className="flex flex-wrap gap-1.5">
				<Button
					size="default"
					variant={assistant.isActive ? "default" : "outline"}
					aria-pressed={assistant.isActive}
					onClick={assistant.toggleCursor}
				>
					{assistant.isActive ? "AI cursor on" : "AI cursor off"}
				</Button>
				<Button
					size="default"
					variant={assistant.isRealtimeActive ? "default" : "outline"}
					aria-pressed={assistant.isRealtimeActive}
					onClick={assistant.toggleVoice}
				>
					{voiceLabel}
				</Button>
			</div>

				<div className="flex items-center gap-1.5">
					<input
						aria-label="Screen assistant command"
						value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							handleSend();
						}
					}}
					placeholder="Send a message…"
					className="h-7 flex-1 rounded-md border border-border bg-bg-neutral-subtle px-2 text-xs text-text outline-none placeholder:text-text-subtlest focus-visible:border-ring"
				/>
				<Button size="default" onClick={handleSend} disabled={!draft.trim()}>
					Send
				</Button>
			</div>

			{assistant.realtime.statusMessage ? (
				<p className="text-[11px] text-text-subtle">{assistant.realtime.statusMessage}</p>
			) : null}

			{showHarnessControls ? (
				<div className="mt-1 flex flex-col gap-1.5 border-t border-border pt-2">
					<span className="text-[10px] font-semibold text-text-subtlest">
						Offline harness
					</span>
					<div className="flex flex-wrap gap-1.5">
						<Button size="compact" variant="secondary" onClick={assistant.simulate.listening}>
							Listen
						</Button>
						<Button size="compact" variant="secondary" onClick={assistant.simulate.processing}>
							Process
						</Button>
						<Button size="compact" variant="secondary" onClick={() => assistant.simulate.speaking()}>
							Speak
						</Button>
						<Button size="compact" variant="secondary" onClick={assistant.simulate.point}>
							Point
						</Button>
						<Button size="compact" variant="ghost" onClick={assistant.clearTranscript}>
							Clear
						</Button>
					</div>
				</div>
			) : null}
		</div>
	);
}
