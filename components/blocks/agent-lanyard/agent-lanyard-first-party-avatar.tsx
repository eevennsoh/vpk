import Image from "next/image";
import type { ReactNode } from "react";
import type { AgentLanyardFirstPartyBadge } from "./first-party-badges";

export function AgentLanyardAvatarFrame({ children }: Readonly<{ children: ReactNode }>) {
	return <span className="relative z-10 flex h-[60px] w-[54px] items-center justify-center [&_[data-slot=avatar-hexagon-artwork]]:[clip-path:none] [&_[data-slot=avatar-hexagon-border]]:hidden" data-slot="agent-lanyard-avatar" style={{ maskImage: "url('/avatar-agent-new/blue/backlog-buddy.svg')", maskSize: "100% 100%", maskRepeat: "no-repeat" }}>{children}</span>;
}

export function AgentLanyardFirstPartyAvatar({ badge, backgroundColor }: Readonly<{ badge: AgentLanyardFirstPartyBadge; backgroundColor?: string }>) {
	return (
		<AgentLanyardAvatarFrame>
				<span className="flex size-full items-center justify-center bg-bg-accent-blue-subtle" style={{ backgroundColor }}>
					{/* Preserve the logo's Figma frame; the shared Avatar owns the shape. */}
					<span className="relative size-14 shrink-0">
						<span className="absolute inset-0 size-12 origin-top-left" style={{ transform: "scale(1.1666666667)" }}>
							<span className="absolute top-1.5 left-1.5 size-9">
								<span className="absolute origin-top-left" style={{ left: badge.glyphX ?? 0, top: badge.glyphY ?? 0, transform: badge.glyphScale ? `scale(${badge.glyphScale})` : undefined }}>
									<Image alt="" src={badge.glyphSrc} width={badge.glyphWidth} height={badge.glyphHeight} className="max-w-none" style={{ width: "auto", height: "auto" }} />
								</span>
							</span>
						</span>
					</span>
				</span>
		</AgentLanyardAvatarFrame>
	);
}
