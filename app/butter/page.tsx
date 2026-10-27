"use client";

import { Suspense, createElement, use } from "react";
import { loadDemoComponent } from "@/components/website/demo-registry-loader";

function ButterContent() {
	const Demo = use(loadDemoComponent("butter", "projects"));
	if (!Demo) return null;
	return createElement(Demo);
}

export default function ButterPage() {
	return (
		<Suspense>
			<ButterContent />
		</Suspense>
	);
}
