import { notFound } from "next/navigation";
import { isRetiredRovoThreadId } from "@/lib/rovo-retired-routes";
import StudioPage from "@/components/projects/studio/page";

interface StudioAppCatchAllPageProps {
	params: Promise<{ id?: string[] }>;
}

export function generateStaticParams() {
	return [{ id: [] }];
}

export default async function StudioAppCatchAllPage({
	params,
}: Readonly<StudioAppCatchAllPageProps>) {
	const { id } = await params;
	if (isRetiredRovoThreadId(id?.[0])) {
		notFound();
	}

	return <StudioPage initialThreadId={id?.[0] ?? null} />;
}
