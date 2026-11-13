const CHAT_CAPABLE_COMPONENT_DOCS = new Set([
	"blocks/jira-work-item",
	"blocks/terminal-switch",
	"projects/admin",
	"projects/rovo",
	"blocks/rovo-button",
	"projects/sidebar-chat",
	"projects/skills",
	"projects/studio",
	"utility/tool-invocation",
]);

interface ComponentDocLayoutProps {
	children: React.ReactNode;
	params: Promise<{
		category: string;
		slug: string;
	}>;
}

export default async function ComponentDocLayout({
	children,
	params,
}: Readonly<ComponentDocLayoutProps>) {
	const { category, slug } = await params;

	if (!CHAT_CAPABLE_COMPONENT_DOCS.has(`${category}/${slug}`)) {
		return children;
	}

	const { ComponentDocChatRuntimeProvider } = await import("./chat-runtime-provider");
	return <ComponentDocChatRuntimeProvider>{children}</ComponentDocChatRuntimeProvider>;
}
