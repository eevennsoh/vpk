"use client";

import { CodeReview } from "./components/code-review";

export default function CodeReviewPage() {
	return (
		<div className="h-screen">
			<CodeReview defaultOpen />
		</div>
	);
}
