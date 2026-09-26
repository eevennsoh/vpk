import Image from "next/image";
import { Avatar } from "@/components/ui/avatar";
import type { AgentLanyardFirstPartyBadge } from "./first-party-badges";

export function AgentLanyardFirstPartyAvatar({ badge, backgroundColor }: Readonly<{ badge: AgentLanyardFirstPartyBadge; backgroundColor?: string }>) {
	return (
		<div className="absolute top-6.5 left-1/2 z-10 size-15 -translate-x-1/2" data-slot="agent-lanyard-first-party-avatar">
			<Avatar shape="hexagon" size="2xl" animate={false} className="size-full [&>[data-slot=avatar-hexagon-group-border]]:hidden">
				<span className="flex size-full items-center justify-center bg-bg-accent-blue-subtle" style={{ backgroundColor }}>
					{/* Preserve the logo's Figma frame; the shared Avatar owns the shape. */}
					<span className="relative size-14">
						<span className="absolute inset-0 size-12 origin-top-left" style={{ transform: "scale(1.1666666667)" }}>
							<span className="absolute top-1.5 left-1.5 size-9">
								<span className="absolute origin-top-left" style={{ left: badge.glyphX ?? 0, top: badge.glyphY ?? 0, transform: badge.glyphScale ? `scale(${badge.glyphScale})` : undefined }}>
									<Image alt="" src={badge.glyphSrc} width={badge.glyphWidth} height={badge.glyphHeight} className="max-w-none" style={{ width: "auto", height: "auto" }} />
								</span>
							</span>
						</span>
					</span>
				</span>
			</Avatar>
		</div>
	);
}
