import type { Metadata } from "next";
import { PreviewCategoryLayout, getCategoryPreviewMetadata, type PreviewLayoutProps } from "@/app/preview/_shared/preview-metadata";

const CHAT_CAPABLE_PROJECT_PREVIEWS = new Set([
	"admin",
	"rovo",
	"sidebar-chat",
	"skills",
	"studio",
]);

export async function generateMetadata({ params }: PreviewLayoutProps): Promise<Metadata> {
	return getCategoryPreviewMetadata(params, "projects");
}

export default async function ProjectPreviewLayout(props: Readonly<PreviewLayoutProps>) {
	const { slug } = await props.params;

	if (!CHAT_CAPABLE_PROJECT_PREVIEWS.has(slug)) {
		return <PreviewCategoryLayout {...props} />;
	}

	const { ProjectPreviewChatRuntimeProvider } = await import("./chat-runtime-provider");
	return (
		<ProjectPreviewChatRuntimeProvider>
			<PreviewCategoryLayout {...props} />
		</ProjectPreviewChatRuntimeProvider>
	);
}
