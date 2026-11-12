"use client";

import { useState } from "react";

import { ToolDirectoryDialog } from "@/components/blocks/tool-directory";
import { DEMO_SESSION_TOOLS, DEMO_TOOLS } from "@/app/data/directory/tools";
import { Button } from "@/components/ui/button";

export default function ToolDirectoryPage() {
	const [open, setOpen] = useState(false);

	return (
		<div className="flex h-full min-h-screen items-center justify-center p-4">
			<Button onClick={() => setOpen(true)}>Open tools directory</Button>
			<ToolDirectoryDialog
				defaultAddedToolIds={["atlassian"]}
				open={open}
				onOpenChange={setOpen}
				sessionTools={DEMO_SESSION_TOOLS}
				tools={DEMO_TOOLS}
			/>
		</div>
	);
}
