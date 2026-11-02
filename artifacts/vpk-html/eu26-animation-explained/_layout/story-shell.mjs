const escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export const jsonIsland = value => JSON.stringify(value).replaceAll('<', '\\u003c');

export function renderStoryShell({ title, description, eyebrow, steps, hero, controls = '', appearance = '', diagramNote = '', appendix = '', reference }) {
	return `<main id="content" tabindex="-1" data-vpk-story data-story-mode="story">
	<nav class="story-bar" aria-label="Reading controls">
		<a class="story-brand" href="#content" aria-label="VPK story, back to beginning">VPK <span>/ FIELD NOTES</span></a>
		<div class="story-modes" role="group" aria-label="View mode">${[['story', 'Page'], ['slides', 'Slides'], ['twitter', 'X Threads'], ['video', 'Video']].map(([id, label]) => `<button type="button" data-story-mode="${id}" aria-pressed="${id === 'story'}">${label}</button>`).join('')}</div>
		<div class="story-tools"><a href="#sources">Sources</a><div data-story-theme></div></div>
		<div class="story-progress" aria-hidden="true" data-story-progress></div>
	</nav>
	<div class="story-layout">
		<aside class="story-stage" data-story-stage aria-label="Anchored animation">
			<div class="story-stage-heading">${appearance}<button type="button" class="story-follow" data-story-action="follow" aria-pressed="true">Follow scroll</button></div>
			${hero}
		</aside>
		<section class="story-video" data-story-video hidden inert aria-labelledby="video-heading">
			<div class="story-video-toolbar"><div><p class="story-kicker">HTML preview</p><h1 id="video-heading" class="story-video-heading">${escape(title)}</h1></div><button type="button" data-video-action="generate" class="story-video-generate">Generate video</button></div>
			<div class="story-video-timeline" data-video-timeline></div>
			<p class="story-video-chapter" data-video-chapter>${escape(steps[0].title)}</p><p class="story-video-status" data-video-status role="status">Preview instantly. Generate a video when you're ready.</p><a data-video-download hidden download>Download video</a>
		</section>
		<div class="story-reading" data-story-steps>
			<header class="story-intro"><p class="story-kicker">${escape(eyebrow)}</p><h1>${escape(title)}</h1><p class="story-deck">${escape(description)}</p><p class="story-reading-hint">One drawing. ${steps.length} moments. Scroll to follow the work.</p><a class="story-start" href="#${escape(steps[0].id)}" data-story-jump="0">Begin the story <span aria-hidden="true">↓</span></a></header>
			${steps.map((step, index) => `<article id="${escape(step.id)}" class="story-step" data-story-step data-story-index="${index}" aria-labelledby="${escape(step.id)}-heading">
				<p class="story-step-kicker"><span class="story-step-index">${String(index + 1).padStart(2, '0')}</span> / ${String(steps.length).padStart(2, '0')} <span class="story-step-time">${(step.seconds ?? step.time).toFixed(1)}s</span></p>
				<h2 id="${escape(step.id)}-heading">${escape(step.title)}</h2><p class="story-step-summary">${escape(step.description)}</p>
				<details class="story-step-detail" open><summary>How it works</summary><div class="story-step-body"><p>${escape(step.body)}</p>${step.href ? `<a class="story-step-link" href="${escape(step.href)}">${escape(step.source)} <span aria-hidden="true">↗</span></a>` : ''}</div></details>
				<a class="story-step-play" href="#${escape(step.id)}" data-story-jump="${index}">View this moment <span aria-hidden="true">↗</span></a>
			</article>`).join('')}
		</div>
	</div>
	${controls}
	<section id="sources" class="story-footer" aria-labelledby="story-sources-heading"><p class="story-kicker">Behind the drawing</p><h2 id="story-sources-heading">The details, when you need them.</h2><p>${escape(diagramNote)}</p><details><summary>Implementation, references and production timings</summary>${appendix}</details><p class="story-colophon">VPK / Algebrica · Offline HTML · ${reference ? `<a href="${escape(reference)}">Open the production experience ↗</a>` : ''}</p></section>
	<script type="application/json" data-vpk-story-model>${jsonIsland({ mode: 'story', steps: steps.map(({ id, title, time }) => ({ id, title, time })) })}</script>
</main>`;
}
