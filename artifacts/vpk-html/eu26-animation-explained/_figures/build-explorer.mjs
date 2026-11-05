import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroFile } from '../../../../.agents/skills/vpk-html/scripts/anatomy/build-hero.mjs';
import { runRuntimePipeline } from '../../../../.agents/skills/vpk-html/scripts/runtime/pipeline.mjs';
import { ACCENT_TOKENS_CSS } from '../../../../.agents/skills/vpk-html/scripts/iso/accent.mjs';
import { inlineIcon } from '../../../../.agents/skills/vpk-html/scripts/icons.mjs';
import { CODE_BLOCK_CSS } from '../../../../.agents/skills/vpk-html/scripts/code/highlight.mjs';
import { data } from './eu26-hero.hero.mjs';
import { storySteps } from './story-content.mjs';
import { renderStoryShell, jsonIsland } from '../_layout/story-shell.mjs';
import { createTimelineMotion } from '../_layout/timeline-motion.mjs';
import { resolveMagneticAxisOffset } from '../../../../components/ui-custom/hooks/magnetic-proximity-model.ts';

const dir = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(dir, '../eu26-animation-explained.html');
const buildFile = path.resolve(dir, '../.eu26-animation-explained.build.html');
const contractFile = path.resolve(dir, '../eu26-animation-explained.content.json');
const read = name => fs.readFileSync(path.resolve(dir, name), 'utf8');
let source = read('../eu26-animation-explained.html');
for (const id of ['eu26-explorer-runtime', 'vpk-story-runtime']) source = source.replace(new RegExp(`<!-- ${id}:begin -->[\\s\\S]*?<!-- ${id}:end -->`, 'g'), '');
source = source.replace(/\n{2,}(?=<\/body>\s*<\/html>)/i, '\n');
source = source.replace(/<style data-(?:eu26-explorer|vpk-story)-css>[\s\S]*?<\/style>/g, '');
source = source.replace(/<body\b[^>]*>/, '<body data-vpk-layout="story" data-vpk-docnav="off" data-vpk-enhancements="off">');
const hero = `<section id="animation-explorer" class="animation-explorer" aria-label="Interactive animation study">
<!-- vpk-anatomy-hero:start id="eu26-hero" src="_figures/eu26-hero.hero.mjs" -->
<!-- vpk-anatomy-hero:end id="eu26-hero" -->
</section>`;
const shell = renderStoryShell({
	title: 'From Done to an endless wall.',
	description: 'How one card drop becomes a celebration, a 3D field, and a world of moving work.',
	eyebrow: 'Jira / Team ’26 Europe / Motion study',
	steps: storySteps(data), hero, playbackRate: data.playbackRate,
	controls: '<div id="eu26-explorer-controls" data-vpkh-no-lightbox></div>',
	appearance: '<div id="eu26-variant-controls" data-vpkh-no-lightbox></div>',
});
source = source.replace(/<main\b[^>]*\bid="content"[^>]*>[\s\S]*?<\/main>/, () => shell);
const css = `${ACCENT_TOKENS_CSS}
:root{--eu26-light-core:var(--paper)}[data-theme="dark"]{--eu26-light-core:var(--body-text)}
#animation-explorer [data-vpk-engine="anatomy-hero"] .iso-plate-corners,#animation-explorer [data-vpk-engine="anatomy-hero"] figcaption{display:none!important}
#animation-explorer svg *{transition:none!important;animation:none!important}
@media print{[data-eu26-cursor-layer]{display:none!important}}
${CODE_BLOCK_CSS}
${read('explorer.css')}
${read('../_layout/story-layout.css')}
${read('../_layout/footer-timeline.css')}`;
source = source.replace('</head>', () => `<style data-vpk-story-css>${css}</style></head>`);
const timelineIcons = Object.fromEntries(Object.entries({ previous: 'arrow-up', next: 'arrow-down', play: 'video-play', pause: 'video-pause', replay: 'retry', frames: 'grid' }).map(([key, name]) => [key, inlineIcon(name)]));
const model = { states: data.states, duration: data.duration, playbackRate: data.playbackRate, variants: data.variants, layout: 'story', timelineIcons };
source = source.replace('</body>', () => `<!-- vpk-story-runtime:begin --><script data-vpk-story-runtime>${read('../_layout/story-layout.js')}</script><!-- vpk-story-runtime:end -->
<!-- eu26-explorer-runtime:begin --><script type="application/json" data-eu26-explorer-model>${jsonIsland(model)}</script><script data-eu26-timeline-motion>window.eu26TimelineMotion=(${createTimelineMotion.toString()})(${resolveMagneticAxisOffset.toString()});</script><script data-eu26-footer-timeline>${read('../_layout/footer-timeline.js')}</script><script data-eu26-explorer-runtime>${read('explorer.js')}</script><script type="application/json" data-vpk-video-export>${jsonIsland({})}</script><script data-vpk-video-view>${read('../_layout/video-view.js')}</script><!-- eu26-explorer-runtime:end --></body>`);
fs.writeFileSync(buildFile, source);
const result = await buildHeroFile(buildFile, { audit: true });
if (!result.ok) throw new Error(`Anatomy audit failed (${result.auditFailures} findings)`);
fs.writeFileSync(buildFile, runRuntimePipeline(fs.readFileSync(buildFile, 'utf8'), { filePath: file, kind: 'artifact' }).html);
fs.renameSync(buildFile, file);
const contract = JSON.parse(read('../eu26-animation-explained.content.json'));
contract.brief.figure_engine = 'anatomy-hero';
contract.brief.figure_engine_source = 'user';
contract.brief.figures = [{ id: 'eu26-hero', kind: 'explainer', engine: 'anatomy-hero', tier: 'hero', job: 'One anchored animation follows the reader through twelve states in Page, Slides, X Threads and Video views.' }];
contract.brief.length_target = 'Two-column Page (stacked below 1024px), Slides, X Threads and Video; twelve states and a chapter rail.';
contract.brief.size_budget_kb = 5000;
contract.brief.explicit_deviations = [
	'User asked for two columns: text left, the figure right on a paper card with a live readout; stacked on narrow screens. Paper is the only style. Each step quotes real source.',
	'The user requested orange accents, border light and a directional gradient. These override fixed-camera and grayscale anatomy defaults; all cover artwork and diagram labels are omitted.',
	'Authored camera shots coordinate focus, zoom and angles. Navigation blends poses directly; scrolling and scrubbing seek exact time. Reduced motion selects still states.',
	'Play runs a 20-second sequence, then one irregular masonry field continues until paused. A bounded pool recycles individual cards without cloning neighboring layouts.',
	'The new reading layout omits optional floating enhancement chrome and owns its navigation. Shared embedded fonts, theme, figure runtime and offline delivery remain.',
	'The user requested a right-side chapter navigator with one-pixel ticks anchored at their right edge and expanding toward the left. Navigation shows chapter names without timestamps; Frames opens the full chapter list.',
	'The supplied marks.mov reference guides the ruler interaction. The orange indicator occupies a real tick; a magnetic approach and local proximity wave use a stationary native input, exact authored time and reduced-motion stillness.',
	'A single chapter image follows scrolling. Video remains a coded HTML preview; only the explicit Generate video action requests a Hyperframes render.',
];
contract.brief.assumptions = ['This artifact demonstrates the proposed reusable layout before a future consolidation of the entire template catalog.', 'Page, Slides, X Threads and Video share the same hero and state model; switching modes preserves the selected step.', 'X Threads is a local reading view. It does not publish or post anything.'];
contract.brief.evidence = [...new Set([...(contract.brief.evidence || []), 'Heerich interactive guide inspected 31 October 2026 for generous diagram framing and editorial reading rhythm: https://meodai.github.io/heerich/', 'Supplied timeline.mp4: 13.056 seconds, 1280x720 at 60fps. Its graduated ruler and large filmstrip inform the vertical adaptation. https://www.pengzhe.ng/#timeline'])];
contract.brief.acceptance_checks = ['check-placeholders', 'verify', 'check-html', 'check-content', 'build-hero --audit', 'build-hero --check', 'check-figures --strict', 'check-layout --strict', 'seven browser/model suites', 'deferred export service tests with a fake runner', 'light and dark desktop/mobile review', 'pnpm run lint', 'pnpm run typecheck'];
fs.writeFileSync(contractFile, JSON.stringify(contract, null, 2) + '\n');
console.log(`Built the anchored story: ${file}`);
