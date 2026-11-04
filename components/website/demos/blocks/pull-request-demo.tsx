"use client";

import ChecksPage from "@/components/blocks/pull-request/checks-page";
import Page from "@/components/blocks/pull-request/page";

export default function PullRequestDemo() {
	return <Page />;
}

export function PullRequestDemoDropdown() {
	return <Page variant="dropdown" />;
}

export function PullRequestDemoSpacious() {
	return <Page variant="spacious" />;
}

export function PullRequestDemoFlyout() {
	return <Page variant="flyout" />;
}

export function PullRequestDemoChecks() {
	return <ChecksPage />;
}
