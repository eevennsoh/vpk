"use client";

import { EDITOR_PALETTE_MENTION_SOURCES } from "@/components/blocks/editor-palette/data/mention-sources";
import { RovoSparkle } from "@/components/ui-custom/rovo-sparkle";
import { getMentionChildItems } from "@/components/ui-custom/rich-text-editor/menus";

const DEMO_AGENTS = getMentionChildItems(EDITOR_PALETTE_MENTION_SOURCES, "subagent");
const DEMO_SKILLS = getMentionChildItems(EDITOR_PALETTE_MENTION_SOURCES, "skill");

export default function RovoSparkleDemo() {
	return (
		<div className="flex flex-col items-start gap-4" data-testid="rovo-sparkle-demo">
			<div className="flex items-end gap-5">
				<div className="flex flex-col items-center gap-2">
					<RovoSparkle
						agents={DEMO_AGENTS}
						ariaLabel="Open compact Rovo actions"
						onSubmit={() => undefined}
						size="compact"
						skills={DEMO_SKILLS}
					/>
					<span className="text-xs text-text-subtle">Compact · 24px</span>
				</div>
				<div className="flex flex-col items-center gap-2">
					<RovoSparkle
						agents={DEMO_AGENTS}
						ariaLabel="Open default Rovo actions"
						onSubmit={() => undefined}
						skills={DEMO_SKILLS}
					/>
					<span className="text-xs text-text-subtle">Default · 32px</span>
				</div>
			</div>
		</div>
	);
}
