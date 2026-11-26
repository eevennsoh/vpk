"use client";

import { ScreenAssistant } from "@/components/screen-assistant";
import { Button } from "@/components/ui/button";
import { SCREEN_ASSISTANT_TARGET_ATTR } from "@/components/projects/rovo-core/lib/screen-assistant";

// ---------------------------------------------------------------------------
// Isolated sandbox for the AI Cursor + Live chat (screen assistant) unit.
//
// Mounts ONLY the standalone <ScreenAssistant /> over a small set of taggable
// demo targets, so the cursor companion, pointing, and the live-chat transcript
// can be exercised and iterated on without the rest of Studio.
//
// Run: `pnpm run dev`, then open http://localhost:3000/sandbox/screen-assistant
// (Live voice additionally needs the Realtime backend; the cursor + harness
// controls work without it.)
// ---------------------------------------------------------------------------

const DEMO_TARGETS = [
	{ id: "sandbox-create-agent", label: "Create agent" },
	{ id: "sandbox-open-settings", label: "Open settings" },
	{ id: "sandbox-publish", label: "Publish" },
];

export default function ScreenAssistantSandboxPage() {
	return (
		<div className="min-h-dvh bg-bg-neutral-subtle p-8">
			<div className="mx-auto flex max-w-3xl flex-col gap-6">
				<header className="flex flex-col gap-1">
					<h1 className="text-xl font-semibold text-text">Screen assistant sandbox</h1>
					<p className="text-sm text-text-subtle">
						Isolated harness for the AI cursor (Clicky) and the live voice chat. Toggle
						the AI cursor or use the offline harness buttons in the bottom-right panel.
						Ask the assistant to point at one of the targets below.
					</p>
				</header>

				<section className="flex flex-col gap-3 rounded-xl bg-surface-raised p-5 shadow-sm">
					<h2 className="text-sm font-semibold text-text">Pointable targets</h2>
					<p className="text-xs text-text-subtle">
						Each button is tagged with <code>{SCREEN_ASSISTANT_TARGET_ATTR}</code> so the
						assistant&apos;s <code>get_screen_state</code> / <code>point_at_target</code>{" "}
						tools (and the harness &ldquo;Point&rdquo; button) can ground onto them.
					</p>
					<div className="flex flex-wrap gap-2">
						{DEMO_TARGETS.map((target) => (
							<Button
								key={target.id}
								variant="outline"
								data-screen-assistant-target={target.id}
							>
								{target.label}
							</Button>
						))}
					</div>
				</section>

				<section className="rounded-xl bg-surface-raised p-5 shadow-sm">
					<h2 className="mb-2 text-sm font-semibold text-text">How to use</h2>
					<ul className="list-disc pl-5 text-xs text-text-subtle">
						<li>Move your mouse — the AI cursor follows once activated.</li>
						<li>
							Offline (no Realtime backend): use the harness buttons to drive
							listen / process / speak / point states.
						</li>
						<li>
							Online (Realtime backend running): &ldquo;Start live chat&rdquo; opens a
							voice session; the transcript appears in the live-chat panel.
						</li>
					</ul>
				</section>
			</div>

			<ScreenAssistant showHarnessControls />
		</div>
	);
}
