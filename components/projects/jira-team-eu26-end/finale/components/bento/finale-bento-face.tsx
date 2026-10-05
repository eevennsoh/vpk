"use client";

import type { FinaleFeatureCode } from "@/components/projects/jira-team-eu26-end/finale/data/finale-stories";

import { FinaleBentoAgentEffectiveness } from "./finale-bento-agent-effectiveness";
import { FinaleBentoAgentSessions } from "./finale-bento-agent-sessions";
import { FinaleBentoAiCapital } from "./finale-bento-ai-capital";
import { FinaleBentoArtifacts } from "./finale-bento-artifacts";
import { FinaleBentoRecordForAgent } from "./finale-bento-record-for-agent";
import { FinaleBentoRovoWorkMode } from "./finale-bento-rovo-work-mode";

/** Each featured story's own face, as the Founder Keynote Figma bento draws it. */
export function FinaleBentoFace({ code }: Readonly<{ code: FinaleFeatureCode }>) {
	switch (code) {
		case "TEU-10":
			return <FinaleBentoAgentSessions />;
		case "TEU-4":
			return <FinaleBentoArtifacts />;
		case "TEU-11":
			return <FinaleBentoAgentEffectiveness />;
		case "TEU-12":
			return <FinaleBentoAiCapital />;
		case "TEU-3":
			return <FinaleBentoRovoWorkMode />;
		case "TEU-106":
			return <FinaleBentoRecordForAgent />;
	}
}
