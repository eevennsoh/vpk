"use client";

import { usePathname } from "next/navigation";
import { RovoChatProvider } from "@/app/contexts";
import type { RovoButtonDemoVariantId } from "./rovo-button/demo-types";
import RovoButtonPage from "./rovo-button/page";
import { useProjectDemoEmbedded } from "../projects/use-project-demo-embedded";

export default function RovoButtonDemo() {
	const embedded = useProjectDemoEmbedded();
	const pathname = usePathname();
	const embeddedHeight = pathname.startsWith("/components/") ? "parent" : "viewport";

	return <RovoButtonPage embedded={embedded} embeddedHeight={embeddedHeight} />;
}

function RovoButtonExample({ variant }: Readonly<{ variant: RovoButtonDemoVariantId }>) {
	return (
		<RovoChatProvider>
			<div className="relative h-[400px] w-full">
				<RovoButtonPage embedded embeddedHeight="parent" variant={variant} />
			</div>
		</RovoChatProvider>
	);
}

export function RovoButtonDemoChat() { return <RovoButtonExample variant="chat" />; }
export function RovoButtonDemoToolbar() { return <RovoButtonExample variant="toolbar" />; }
export function RovoButtonDemoProactive() { return <RovoButtonExample variant="proactive" />; }
export function RovoButtonDemoInsights() { return <RovoButtonExample variant="insights" />; }
export function RovoButtonDemoOnboarding() { return <RovoButtonExample variant="onboarding" />; }
