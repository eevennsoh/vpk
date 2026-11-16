"use client";

import Page from "@/components/blocks/agent-session/page";

export default function AgentSessionDemo() {
	return <Page />;
}

export function AgentSessionDemoMediumDetached() {
	return <Page variant="medium-detached" />;
}

export function AgentSessionDemoMediumAttached() {
	return <Page variant="medium-attached" />;
}

export function AgentSessionDemoSmall() {
	return <Page variant="small" />;
}

export function AgentSessionDemoDrag() {
	return <Page drag />;
}

export function AgentSessionDemoUnlinked() {
	return <Page density="unlinked" host="local" />;
}

export function AgentSessionDemoLocalShort() {
	return <Page density="short" host="local" />;
}

export function AgentSessionDemoLocalLong() {
	return <Page density="long" host="local" />;
}

export function AgentSessionDemoCloudShort() {
	return <Page density="short" host="cloud" />;
}

export function AgentSessionDemoCloudLong() {
	return <Page density="long" host="cloud" />;
}
