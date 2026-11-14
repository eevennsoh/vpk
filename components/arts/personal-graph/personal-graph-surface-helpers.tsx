import { cn } from "@/lib/utils";
import type { VaultNodeKind } from "./lib/personal-graph-types";

const NODE_KIND_MARKERS: Record<VaultNodeKind, string> = {
	concept: "rotate-45 rounded-xs bg-orange-300",
	entity: "rounded-full bg-green-500",
	raw: "rounded-xs bg-red-500",
	source: "rounded-full bg-blue-600",
	synthesis: "rotate-45 rounded-xs bg-purple-600",
};

export function GraphNodeMarker({
	className,
	kind,
}: Readonly<{
	className?: string;
	kind: VaultNodeKind;
}>) {
	return <span aria-hidden="true" className={cn("inline-block size-3 shrink-0", NODE_KIND_MARKERS[kind], className)} />;
}
