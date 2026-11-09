"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useRovoChat } from "@/app/contexts";
import { RovoChatProvider } from "@/app/contexts/context-rovo-chat";
import { Gallery, type GalleryPalette } from "@/components/blocks/gallery";
import { JGP_CHAT_AGENT_PROFILES } from "./data/agent-chat-data";
import { JGP_GALLERY_ITEMS } from "./data/gallery-items";
import {
	GLOBAL_SESSION_SCREENS,
	LOCAL_SESSION_SCREENS,
	type SessionScreen,
} from "./data/session-screens";
import {
	useScreenNavigator,
	type ScreenNavigatorController,
} from "./hooks/use-screen-navigator";
import {
	CompactSessionScreenControls,
	SessionScreenControls,
	SessionStage,
} from "./components/session-stage";

// ---------------------------------------------------------------------------
// JGP — Jira Golden Journey v1
//
// The gallery dock has two cards: "Carl's local session" and "Sarah's global session". Each is
// a presenter-paced walkthrough of an ordered set of screens, navigated
// left/right from the gallery top bar (see `SessionScreenControls`) or the ←/→
// arrow keys — mirroring the terminal demo's beat stepping. Screens are
// Each screen is a prepared beat in Carl's local or Sarah's global story. The
// existing Terminal, Kanban, Rovo, and For You stages render those
// route-owned scenarios without introducing gallery-specific UI variants.
// ---------------------------------------------------------------------------

const ROVO_PURPLE_PALETTE: GalleryPalette = ["#5E2C9D", "#7A3BB3", "#9850CC", "#AF59E1"];

interface SessionCard {
	screens: readonly SessionScreen[];
	controller: ScreenNavigatorController;
}

function ResetRovoChatOnEntry({ screen }: Readonly<{ screen: SessionScreen | undefined }>): null {
	const { resetAgentToRovo, resetChat } = useRovoChat();

	useEffect(() => {
		if (screen?.design !== "rovo") return;
		resetAgentToRovo();
		resetChat();
	}, [resetAgentToRovo, resetChat, screen?.design, screen?.id]);

	return null;
}

// The window-level arrow handler must not steal keys from a focused interactive
// control (the top-bar prev/next buttons, the dock tiles): ←/→ on those must act
// on the control, not step the walkthrough. So bail whenever focus is within any
// editable field or activatable control.
function isInteractiveTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	return Boolean(
		target.closest(
			'input, textarea, select, button, a[href], [role="button"], [role="link"], [role="menuitem"], [role="tab"], [role="checkbox"], [role="switch"], [role="option"]',
		),
	);
}

export default function JgpPage(): React.ReactElement {
	const [selectedId, setSelectedId] = useState(JGP_GALLERY_ITEMS[0]?.id ?? "");
	const [terminalTheme, setTerminalTheme] = useState<"dark" | "light">("dark");
	const [dockOpen, setDockOpen] = useState(true);
	// One navigator per card, hoisted here so the top-bar controls and the stage
	// share a single source of truth (each card keeps its own place).
	const localNav = useScreenNavigator(LOCAL_SESSION_SCREENS.length);
	const globalNav = useScreenNavigator(GLOBAL_SESSION_SCREENS.length);

	const cardsById = useMemo<Record<string, SessionCard>>(
		() => ({
			"local-session": { screens: LOCAL_SESSION_SCREENS, controller: localNav },
			"global-session": { screens: GLOBAL_SESSION_SCREENS, controller: globalNav },
		}),
		[localNav, globalNav],
	);
	const activeCard = cardsById[selectedId] ?? cardsById["local-session"];

	const handleSelectedChange = useCallback((nextSelectedId: string) => {
		setSelectedId(nextSelectedId);
	}, []);
	const handleTerminalThemeCycle = useCallback(() => {
		setTerminalTheme((current) => (current === "dark" ? "light" : "dark"));
	}, []);

	// ←/→ step the active card's screens, mirroring the terminal demo. Depend on
	// the stable per-card callbacks so this re-subscribes only when the active
	// card changes, not on every screen change.
	const { next: activeNext, prev: activePrev } = activeCard.controller;
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent): void {
			if (event.metaKey || event.ctrlKey || event.altKey) return;
			if (isInteractiveTarget(event.target)) return;
			if (event.key === "ArrowRight") {
				event.preventDefault();
				activeNext();
			} else if (event.key === "ArrowLeft") {
				event.preventDefault();
				activePrev();
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [activeNext, activePrev]);

	// The Terminal section defaults to a dark ADS subtree while keeping that
	// choice route-local and controllable from Gallery's theme button. The user
	// can switch the full Terminal surface to light without changing the global
	// app theme; non-Terminal sections fall back to the normal global theme.
	const activeScreen = activeCard.screens[activeCard.controller.index];
	const isTerminalSection = activeScreen?.section === "Terminal";
	// Jira shell screens want a divider under the gallery top bar; other screens
	// keep the borderless header. Gate on the typed `design` identity, not the
	// free-form `section` label, mirroring `isTerminalSection` above.
	const showTopBarBorder = activeScreen?.design === "for-you"
		|| activeScreen?.design === "jira-kanban";
	const subtreeThemeProps = isTerminalSection
		? {
				"data-subtree-theme": "",
				"data-color-mode": terminalTheme,
				"data-theme": `${terminalTheme}:${terminalTheme} spacing:spacing typography:typography shape:shape`,
			}
		: {};

	// The Kanban and Rovo design screens run on a JGP-wide `RovoChatProvider`
	// (their stages call `useRovoChat` for the agent chat overlay), so the whole
	// gallery tree is wrapped here rather than relying on an ancestor route to
	// supply the context — this keeps the standalone and exported routes working.
	// The JGP agent profiles are passed in so route-owned Claude Code and Cursor
	// sessions resolve without changing the global agent directory.
	return (
		<RovoChatProvider agentProfiles={JGP_CHAT_AGENT_PROFILES}>
			<ResetRovoChatOnEntry screen={activeScreen} />
			<div className="relative h-dvh w-full overflow-hidden bg-surface" {...subtreeThemeProps}>
				<Gallery
					items={JGP_GALLERY_ITEMS}
					palette={ROVO_PURPLE_PALETTE}
					title="Jira Golden Journey v1"
					showTopBarBorder={showTopBarBorder}
					selectedId={selectedId}
					onSelectedChange={handleSelectedChange}
					open={dockOpen}
					onOpenChange={setDockOpen}
					theme={isTerminalSection ? terminalTheme : undefined}
					onThemeCycle={isTerminalSection ? handleTerminalThemeCycle : undefined}
					topBarCenter={(
						<SessionScreenControls
							screens={activeCard.screens}
							controller={activeCard.controller}
						/>
					)}
					topBarCenterCompact={(
						<CompactSessionScreenControls
							screens={activeCard.screens}
							controller={activeCard.controller}
						/>
					)}
					renderSelectedItem={(item) => {
						const card = cardsById[item.id] ?? activeCard;
						return (
							<SessionStage
								controller={card.controller}
								screens={card.screens}
							/>
						);
					}}
				/>
			</div>
		</RovoChatProvider>
	);
}
