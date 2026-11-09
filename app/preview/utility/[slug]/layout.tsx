import type { Metadata } from "next";
import { PreviewCategoryLayout, getCategoryPreviewMetadata, type PreviewLayoutProps } from "@/app/preview/_shared/preview-metadata";

const CHAT_CAPABLE_UTILITY_PREVIEWS = new Set(["tool-invocation"]);

export async function generateMetadata({ params }: PreviewLayoutProps): Promise<Metadata> {
	return getCategoryPreviewMetadata(params, "utility");
}

export default async function UtilityPreviewLayout(props: Readonly<PreviewLayoutProps>) {
	const { slug } = await props.params;

	if (!CHAT_CAPABLE_UTILITY_PREVIEWS.has(slug)) {
		return <PreviewCategoryLayout {...props} />;
	}

	const { UtilityPreviewChatRuntimeProvider } = await import("./chat-runtime-provider");
	return (
		<UtilityPreviewChatRuntimeProvider>
			<PreviewCategoryLayout {...props} />
		</UtilityPreviewChatRuntimeProvider>
	);
}
