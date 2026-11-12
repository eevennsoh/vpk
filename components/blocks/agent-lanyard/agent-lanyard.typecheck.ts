import type { AgentLanyardAgent, AgentLanyardProps, AgentLanyardTemplate } from "@/components/blocks/agent-lanyard";

type Expect<T extends true> = T;
type Accepts<T> = T extends AgentLanyardProps ? true : false;
type Rejects<T> = T extends AgentLanyardProps ? false : true;

/** Compiled by the repository typecheck; no runtime fixture is mounted. */
export type AgentLanyardVariantContracts = [
	Expect<Accepts<{ agent: AgentLanyardAgent }>>,
	Expect<Accepts<{ variant: "agent"; agent: AgentLanyardAgent }>>,
	Expect<Accepts<{ variant: "template"; template: AgentLanyardTemplate }>>,
	Expect<Accepts<{ variant: "recommended"; agent: AgentLanyardAgent; recommendationReason: string }>>,
	Expect<Rejects<{ agent: AgentLanyardAgent; recommendationReason: string }>>,
	Expect<Rejects<{ variant: "agent"; agent: AgentLanyardAgent; recommendationReason: string }>>,
	Expect<Rejects<{ variant: "template"; template: AgentLanyardTemplate; recommendationReason: string }>>,
	Expect<Rejects<{ variant: "recommended"; agent: AgentLanyardAgent }>>,
	Expect<Rejects<{ variant: "recommended"; agent: AgentLanyardAgent; recommendationReason: string; onAction: () => void }>>,
];
