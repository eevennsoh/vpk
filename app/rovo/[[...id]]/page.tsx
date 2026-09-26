import { notFound } from "next/navigation";
import { isRetiredRovoThreadId } from "@/lib/rovo-retired-routes";
import RovoPage from "@/components/projects/rovo/page";

interface RovoAppCatchAllPageProps {
	params: Promise<{ id?: string[] }>;
}

export function generateStaticParams() {
	return [{ id: [] }];
}

export default async function RovoAppCatchAllPage({
	params,
}: Readonly<RovoAppCatchAllPageProps>) {
	const { id } = await params;
	if (isRetiredRovoThreadId(id?.[0])) {
		notFound();
	}

	return <RovoPage initialThreadId={id?.[0] ?? null} />;
}
