"use client";

import { createContext, type ReactNode } from "react";
import type { AgentListAgent } from "@/components/blocks/agent-list/agent-list-types";

export type AgentSessionAvatarPreview = (agent: AgentListAgent, avatar: ReactNode) => ReactNode;
export const AgentSessionAvatarPreviewContext = createContext<AgentSessionAvatarPreview | null>(null);
