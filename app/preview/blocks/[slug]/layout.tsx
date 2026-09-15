import type { Metadata } from "next";
import { PreviewCategoryLayout, getCategoryPreviewMetadata, type PreviewLayoutProps } from "@/app/preview/_shared/preview-metadata";

const CHAT_CAPABLE_BLOCK_PREVIEWS = new Set([
	"jira-work-item",
	"jira-work-item-demo-standard",
	"jira-work-item-demo-experimental",
	"jira-work-item-demo-experimental-v2",
	"jira-work-item-demo-experimental-v3",
	"jira-work-item-demo-experimental-v4",
	"jira-work-item-demo-experimental-v5",
	"jira-work-item-demo-team-eu26",
	"terminal-switch",
]);

export async function generateMetadata({ params }: PreviewLayoutProps): Promise<Metadata> {
	return getCategoryPreviewMetadata(params, "blocks");
}

export default async function BlockPreviewLayout(props: Readonly<PreviewLayoutProps>) {
	const { slug } = await props.params;

	if (!CHAT_CAPABLE_BLOCK_PREVIEWS.has(slug)) {
		return <PreviewCategoryLayout {...props} />;
	}

	const { BlockPreviewChatRuntimeProvider } = await import("./chat-runtime-provider");
	return (
		<BlockPreviewChatRuntimeProvider>
			<PreviewCategoryLayout {...props} />
		</BlockPreviewChatRuntimeProvider>
	);
}
