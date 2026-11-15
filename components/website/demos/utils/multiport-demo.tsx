"use client";

import type { ReactElement } from "react";
import { RovoChatProvider } from "@/app/contexts";
import ChatPanel from "@/components/projects/sidebar-chat/page";
import type { GenerativeCardAnimationProps } from "@/components/projects/shared/components/generative-widget-card";

const PORT_COUNT = 3;

const MULTIPORT_GENERATIVE_CARD_ANIMATION: GenerativeCardAnimationProps = {
	distortion: false,
};

export default function MultiportDemo(): ReactElement {
	return (
		<div className="mx-auto flex h-screen items-center justify-center gap-12 px-6">
			{Array.from({ length: PORT_COUNT }, (_, i) => (
				<div key={i} className="flex h-full min-w-0 flex-1 justify-center" style={{ maxWidth: 400 }}>
					<RovoChatProvider portIndex={i}>
						<ChatPanel
							onClose={() => {}}
							autoFocusComposer={i === 0}
							enableSmartWidgets={true}
							sendPromptOptions={{
								smartGeneration: {
									enabled: true,
									surface: "multiport",
								},
							}}
							cards={{ generativeAnimation: MULTIPORT_GENERATIVE_CARD_ANIMATION }}
						/>
					</RovoChatProvider>
				</div>
			))}
		</div>
	);
}
