"use client";

import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { Lanyard3DAgentSection } from "./components/lanyard-3d-agent-section";
import { Lanyard3DProfileSection } from "./components/lanyard-3d-profile-section";
import { Lanyard3DSceneSection } from "./components/lanyard-3d-scene-section";
import {
	LANYARD_3D_AGENTS, LANYARD_3D_DEFAULT_SCENE, LANYARD_3D_PROFILES,
	type Lanyard3DAgent, type Lanyard3DProfile, type Lanyard3DScene,
} from "./data";
import { Lanyard3DStage } from "./lanyard-3d-stage";
import type { LanyardConfig } from "./renderer/types";

export interface Lanyard3DProps {
	/** People who can wear the lanyard. Defaults to the four presenters. */
	profiles?: readonly Lanyard3DProfile[];
	/** Agents that can hang on the back card. Defaults to the five coding agents. */
	agents?: readonly Lanyard3DAgent[];
	defaultProfileId?: string;
	defaultAgentId?: string;
	defaultScene?: Partial<Lanyard3DScene>;
	/** Hides the editor and renders only the animated stage. */
	showEditor?: boolean;
	className?: string;
}

function patchById<T extends { id: string }>(items: readonly T[], id: string, patch: Partial<T>): readonly T[] {
	return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

/** A two-card lanyard that drops, catches and swings, with editable person and agent details. */
export function Lanyard3D({
	profiles: initialProfiles = LANYARD_3D_PROFILES,
	agents: initialAgents = LANYARD_3D_AGENTS,
	defaultProfileId,
	defaultAgentId,
	defaultScene,
	showEditor = true,
	className,
}: Readonly<Lanyard3DProps>) {
	const [profiles, setProfiles] = useState(initialProfiles);
	const [agents, setAgents] = useState(initialAgents);
	const [profileId, setProfileId] = useState(defaultProfileId ?? initialProfiles[0].id);
	const [agentId, setAgentId] = useState(defaultAgentId ?? initialAgents[0].id);
	const [scene, setScene] = useState<Lanyard3DScene>({ ...LANYARD_3D_DEFAULT_SCENE, ...defaultScene });

	const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
	const agent = agents.find((item) => item.id === agentId) ?? agents[0];

	const config = useMemo<LanyardConfig>(() => ({
		name: profile.name, role: profile.role, photo: profile.photo,
		background: scene.background, format: scene.format, swing: scene.swing, revealAngle: scene.revealAngle,
		backCard: agent, backCardTheme: scene.agentTheme,
	}), [profile, agent, scene]);

	return (
		<div className={cn("flex min-h-[560px] w-full flex-col gap-4 rounded-xl border border-border bg-surface p-4 lg:h-[800px] lg:flex-row", className)} data-slot="lanyard-3d">
			{showEditor ? (
				<aside aria-label="Lanyard editor" className="flex w-full shrink-0 flex-col gap-6 overflow-y-auto lg:w-80 lg:pr-2">
					<Lanyard3DProfileSection
						onChange={(patch) => setProfiles((current) => patchById<Lanyard3DProfile>(current, profile.id, patch))}
						onSelect={setProfileId}
						profile={profile}
						profiles={profiles}
					/>
					<Lanyard3DAgentSection
						agent={agent}
						agents={agents}
						onChange={(patch) => setAgents((current) => patchById<Lanyard3DAgent>(current, agent.id, patch))}
						onSelect={setAgentId}
						onThemeChange={(agentTheme) => setScene((current) => ({ ...current, agentTheme }))}
						theme={scene.agentTheme}
					/>
					<Lanyard3DSceneSection onChange={(patch) => setScene((current) => ({ ...current, ...patch }))} scene={scene} />
				</aside>
			) : null}
			<Lanyard3DStage className="h-[420px] flex-1 lg:h-auto" config={config} />
		</div>
	);
}
