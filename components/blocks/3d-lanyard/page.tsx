"use client";

import { Lanyard3D } from "./index";

export default function Lanyard3DPage() {
	return (
		<div className="w-full bg-surface p-6" data-slot="lanyard-3d-demo">
			<div className="mx-auto max-w-[1200px]">
				<Lanyard3D />
			</div>
		</div>
	);
}
