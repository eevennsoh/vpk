export function ProjectButterSessionSummary() {
	return (
		<div className="space-y-4 text-sm leading-6 text-text">
			<div><h3 className="mb-1 font-semibold">Session summary</h3><p>Published the Teamwork onboarding inventory evidence to VITA-1. The session captured all 61 call sites and owners in PR #1839. The separate keep-or-delete rationale remains out of scope.</p></div>
			<div><h3 className="mb-1 font-semibold">Key decisions</h3><ul className="list-disc space-y-2 pl-5"><li><strong>Keep the call-site inventory and owner mapping in one commit</strong><p><strong>Why:</strong> Reviewers can validate the evidence and ownership handoff together.</p><p><strong>Alternative considered:</strong> Split commits by package, rejected because it fragmented the review.</p></li><li><strong>Leave the keep-or-delete rationale for a separate session</strong><p><strong>Why:</strong> That decision needs product-owner input that was not available in this session.</p><p><strong>Alternative considered:</strong> Infer a recommendation from usage data, rejected because the evidence was incomplete.</p></li></ul></div>
			<div><h3 className="mb-1 font-semibold">Trade-offs</h3><p><strong>Gain:</strong> A single consolidated inventory makes the handoff easier to scan. <strong>Cost:</strong> a larger review surface. <strong>Revisit when:</strong> teams need independent approval or ownership updates.</p></div>
			<div><h3 className="mb-1 font-semibold">Artifacts</h3><ul className="list-disc space-y-1 pl-5"><li>Work item: VITA-1</li><li>Pull request: <a className="text-link hover:underline" href="https://bitbucket.org/atlassian/teamwork-platform/pull-requests/1839" rel="noreferrer" target="_blank">#1839 Publish onboarding inventory evidence</a> — 2 review passes</li><li>Branch: feature/VITA-1-teamwork-inventory</li><li>Commit: 8c2f4e1</li><li><strong>Files changed: 4</strong></li></ul></div>
		</div>
	);
}
