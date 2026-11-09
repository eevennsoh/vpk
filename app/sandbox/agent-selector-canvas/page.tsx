"use client";

import dynamic from "next/dynamic";

const AgentSelectorCanvas = dynamic(() => import("./workspace"), { ssr: false });

export default function Page() {
	return <AgentSelectorCanvas />;
}
