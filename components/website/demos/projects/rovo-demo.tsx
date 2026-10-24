"use client";

import RovoPage from "@/components/projects/rovo/page";
import { usePathname } from "next/navigation";
import { useProjectDemoEmbedded } from "./use-project-demo-embedded";

export default function RovoDemo() {
	const pathname = usePathname() ?? "";
	const embedded = useProjectDemoEmbedded() && !pathname.startsWith("/components/");

	return <RovoPage embedded={embedded} headingAs={pathname.startsWith("/components/") ? "h2" : "h1"} />;
}
