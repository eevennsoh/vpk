(() => {
	function mountStory(root) {
		if (root.dataset.storyMounted) return;
		const island = root.querySelector('[data-vpk-story-model]');
		const container = root.querySelector('[data-story-steps]');
		const stage = root.querySelector('[data-story-stage]');
		const videoPanel = root.querySelector('[data-story-video]');
		if (!island || !container || !stage) return;
		const config = JSON.parse(island.textContent);
		const articles = [...container.querySelectorAll('[data-story-step]')];
		const stepDetails = [...container.querySelectorAll('details.story-step-detail')];
		const steps = config.steps;
		if (!Array.isArray(steps) || !steps.length || steps.length !== articles.length || steps.some(step => !Number.isFinite(step.time))) return;
		root.dataset.storyMounted = 'true';
		const modes = ['story', 'slides', 'twitter', 'video'];
		const clampIndex = value => Math.max(0, Math.min(steps.length - 1, Math.trunc(Number(value) || 0)));
		const modeButtons = [...root.querySelectorAll('button[data-story-mode]')];
		const jumpLinks = [...root.querySelectorAll('[data-story-jump]')];
		const actions = [...root.querySelectorAll('button[data-story-action]')];
		const progressElement = root.querySelector('[data-story-progress]');
		const loop = window.vpkFrameLoop;
		const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const supportsTimeline = Boolean(window.CSS?.supports('animation-timeline', 'scroll()') && window.CSS.supports('animation-range', '0% 100%'));
		const abort = new AbortController();
		let mode = modes.includes(config.mode) ? config.mode : 'story';
		let index = clampIndex(config.index), time = steps[index].time, following = true, suspendedReason = '';
		let preview = null;
		let reducedMotion = loop?.reducedMotion() ?? reducedQuery.matches;
		let anchors = [], readingLine = 0, dirtyGeometry = true, queued = false, fallbackFrame = null;
		let connected = false, destroyed = false, lastScrollY = window.scrollY, userIntentAt = -Infinity, awaitingUserScroll = false;
		let printOpen = null, printing = false;
		let syncedIndex = -1, syncedMode = '', syncedFollowing = null, lastFrame = null;
		const interactive = target => target instanceof Element && Boolean(target.closest('button, a, input, textarea, select, summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="slider"], [role="textbox"]'));
		const progress = () => {
			const span = steps[steps.length - 1].time - steps[0].time;
			return Math.max(0, Math.min(1, span ? (time - steps[0].time) / span : index / Math.max(1, steps.length - 1)));
		};
		const figNumber = stage.querySelector('[data-story-fig-number]');
		const figTitle = stage.querySelector('[data-story-fig-title]');
		const figReadout = stage.querySelector('[data-story-fig-readout]');
		const rate = Number(config.playbackRate) > 0 ? Number(config.playbackRate) : 1;
		const pad = value => String(value).padStart(2, '0');
		let figIndex = -1, figText = '';
		// Figure corner furniture: the chapter number and title follow the shown chapter, the readout follows exact time.
		function syncFigure(displayIndex) {
			if (figIndex !== displayIndex) {
				figIndex = displayIndex;
				if (figNumber) figNumber.textContent = pad(displayIndex + 1);
				if (figTitle) figTitle.textContent = steps[displayIndex].title;
			}
			const text = `t ${(Math.max(0, time) / rate).toFixed(1)} s · ${pad(displayIndex + 1)} / ${pad(steps.length)}`;
			if (figReadout && text !== figText) figReadout.textContent = figText = text;
		}
		const getState = () => ({ mode, index, time, displayIndex: preview?.index ?? index, progress: progress(), following, reducedMotion, readingLine, stepCount: steps.length, stepId: steps[index].id || articles[index].id, suspendedReason });
		function sync() {
			const displayIndex = preview?.index ?? index;
			root.dataset.storyMode = mode;
			const isVideo = mode === 'video';
			const currentFocus = document.activeElement;
			if (isVideo && container.contains(currentFocus)) {
				root.querySelector('button[data-story-mode="video"]')?.focus({ preventScroll: true });
			} else if (!isVideo && videoPanel?.contains(currentFocus)) {
				root.querySelector(`button[data-story-mode="${mode}"]`)?.focus({ preventScroll: true });
			}
			stage.hidden = stage.inert = false;
			container.hidden = container.inert = isVideo;
			if (videoPanel) videoPanel.hidden = videoPanel.inert = !isVideo;
			root.dataset.storyIndex = String(displayIndex);
			root.dataset.storyFollowing = String(following);
			root.dataset.storyNativeProgress = String(supportsTimeline && !reducedMotion);
			syncFigure(displayIndex);
			if (syncedIndex !== displayIndex || syncedMode !== mode) {
				if (syncedMode !== mode) for (const detail of stepDetails) detail.open = mode !== 'twitter';
				const focused = document.activeElement;
				if (mode === 'slides' && articles.some((article, position) => position !== displayIndex && article.contains(focused))) {
					articles[displayIndex].hidden = false;
					articles[displayIndex].inert = false;
					articles[displayIndex].removeAttribute('aria-hidden');
					articles[displayIndex].setAttribute('tabindex', '-1');
					articles[displayIndex].focus({ preventScroll: true });
				}
				articles.forEach((article, position) => {
					const active = position === displayIndex, hidden = mode === 'slides' && !active;
					article.hidden = hidden;
					article.inert = hidden;
					article.toggleAttribute('data-active', active);
					if (active) article.setAttribute('aria-current', 'step');
					else article.removeAttribute('aria-current');
					if (hidden) article.setAttribute('aria-hidden', 'true');
					else article.removeAttribute('aria-hidden');
				});
				for (const choice of modeButtons) choice.setAttribute('aria-pressed', String(choice.dataset.storyMode === mode));
				for (const link of jumpLinks) {
					if (Number(link.dataset.storyJump) === index) link.setAttribute('aria-current', 'step');
					else link.removeAttribute('aria-current');
				}
				for (const button of actions) {
					if (button.dataset.storyAction === 'previous') button.disabled = index === 0;
					if (button.dataset.storyAction === 'next') button.disabled = index === steps.length - 1;
				}
				syncedIndex = displayIndex; syncedMode = mode;
			}
			if (syncedFollowing !== following) {
				for (const button of actions) if (button.dataset.storyAction === 'follow') button.setAttribute('aria-pressed', String(following));
				syncedFollowing = following;
			}
		}
		function measure() {
			const viewport = window.innerHeight;
			const stageRect = stage.getBoundingClientRect();
			const readingRect = container.getBoundingClientRect();
			const stickyTop = Number.parseFloat(getComputedStyle(stage).top) || 0;
			// Side by side, the stage never covers the text, so read at a fixed line in the upper third.
			const beside = stageRect.left >= readingRect.right - 1 || stageRect.right <= readingRect.left + 1;
			readingLine = beside ? stickyTop + (viewport - stickyTop) * 0.4 : Math.min(viewport - 24, stickyTop + stageRect.height + 32);
			// Side by side, bottom controls (the Slides timeline) centre under the figure page, not the whole window.
			const shift = beside ? Math.round((stageRect.left + stageRect.right) / 2 - document.documentElement.clientWidth / 2) : 0;
			root.style.setProperty('--story-stage-shift', `${shift}px`);
			root.style.setProperty('--story-stage-width', `${Math.round(beside ? stageRect.width : document.documentElement.clientWidth)}px`);
			const scrollY = window.scrollY;
			anchors = mode === 'slides' || mode === 'video' ? [] : articles.map(article => {
				const target = article.querySelector('h2') || article;
				const rect = target.getBoundingClientRect();
				return scrollY + rect.top;
			});
			dirtyGeometry = false;
		}
		function emit(reason, fromIndex = index, force = false) {
			sync();
			if (!force && lastFrame?.mode === mode && lastFrame.index === index && Math.abs(lastFrame.time - time) < 0.000001) return;
			lastFrame = { mode, index, time };
			root.dispatchEvent(new CustomEvent('vpk:story-frame', { bubbles: true, detail: { ...getState(), reason, fromIndex } }));
		}
		function readScroll(force = false) {
			if (printing || !following || mode === 'slides' || mode === 'video' || !connected) return;
			if (awaitingUserScroll && !force) return;
			preview = null;
			if (dirtyGeometry) measure();
			const point = window.scrollY + readingLine, fromIndex = index;
			let upper = anchors.findIndex(anchor => anchor > point);
			if (upper < 0) upper = anchors.length - 1;
			const lower = Math.max(0, upper - 1);
			const span = anchors[upper] - anchors[lower];
			const fraction = span > 0 ? Math.max(0, Math.min(1, (point - anchors[lower]) / span)) : 0;
			if (point >= anchors[anchors.length - 1]) { index = steps.length - 1; time = steps[index].time; }
			else if (mode === 'twitter' || reducedMotion) { index = fraction < 0.5 ? lower : upper; time = steps[index].time; }
			else { index = lower; time = steps[lower].time + (steps[upper].time - steps[lower].time) * fraction; }
			emit('scroll', fromIndex, force);
		}
		function flush() {
			queued = false; fallbackFrame = null;
			if (destroyed) return;
			if (dirtyGeometry) measure();
			readScroll();
		}
		const board = loop?.register(root, () => { flush(); return false; });
		function schedule(geometry = false) {
			dirtyGeometry ||= geometry;
			if (queued || destroyed) return;
			queued = true;
			if (board) board.wake();
			else fallbackFrame = window.requestAnimationFrame(flush);
		}
		function align(targetIndex = index) {
			if (mode === 'slides' || mode === 'video') {
				window.scrollTo({ top: Math.max(0, window.scrollY + root.getBoundingClientRect().top), behavior: 'instant' });
				lastScrollY = window.scrollY;
				return;
			}
			if (dirtyGeometry) measure();
			window.scrollTo({ top: Math.max(0, anchors[targetIndex] - readingLine), behavior: 'instant' });
			lastScrollY = window.scrollY;
		}
		function updateHash() {
			const id = articles[index].id || steps[index].id;
			if (config.history === true && id) history.replaceState(history.state, '', `#${encodeURIComponent(id)}`);
		}
		function select(value, options = {}) {
			preview = null;
			const fromIndex = index;
			index = clampIndex(value); time = steps[index].time;
			following = options.following !== false; suspendedReason = following ? '' : 'navigate';
			connected = true; userIntentAt = -Infinity; awaitingUserScroll = true;
			sync(); dirtyGeometry = true; measure();
			if (options.scroll !== false) align();
			updateHash(); emit('navigate', fromIndex, true);
			return getState();
		}
		function setMode(value) {
			if (!modes.includes(value) || value === mode) return getState();
			const previousMode = mode;
			preview = null;
			mode = value; connected = true; userIntentAt = -Infinity; awaitingUserScroll = true;
			sync();
			root.dispatchEvent(new CustomEvent('vpk:story-mode', { bubbles: true, detail: { mode, previousMode } }));
			dirtyGeometry = true; measure(); align();
			emit('mode', index, true);
			return getState();
		}
		function suspendFollowing(reason = 'manual') {
			following = false; suspendedReason = reason; userIntentAt = -Infinity;
			lastScrollY = window.scrollY;
			sync();
			return getState();
		}
		function follow() {
			following = true; suspendedReason = ''; connected = true; dirtyGeometry = true; awaitingUserScroll = false;
			measure();
			if (mode === 'slides') emit('navigate', index, true);
			else readScroll(true);
			return getState();
		}
		function reflect(value, authoredTime, { scroll = false, previewIndex = null, playing = false } = {}) {
			const previousIndex = index, previousPreview = preview;
			index = clampIndex(value);
			if (Number.isFinite(authoredTime)) time = authoredTime;
			else if (!following) time = steps[index].time;
			preview = previewIndex === null ? null : { index: clampIndex(previewIndex), scrollY: previousPreview?.scrollY ?? window.scrollY };
			sync();
			if (mode !== 'video' && !printing) {
				if (scroll) align(index);
				else if (preview && preview.index !== previousPreview?.index) align(preview.index);
				else if (playing && index !== previousIndex) align(index);
				else if (previousPreview && !preview) {
					window.scrollTo({ top: previousPreview.scrollY, behavior: 'instant' });
					lastScrollY = window.scrollY;
				}
			}
			return getState();
		}
		const api = { getState, setMode, select, follow, suspendFollowing, reflect };
		root.story = api;
		window.__vpkStory ||= api;
		progressElement?.setAttribute('aria-hidden', 'true');
		articles.forEach((article, position) => { if (!article.id && steps[position].id) article.id = steps[position].id; });
		root.addEventListener('click', event => {
			const target = event.target instanceof Element ? event.target : null;
			const choice = target?.closest('button[data-story-mode]');
			if (choice) { setMode(choice.dataset.storyMode); return; }
			const jump = target?.closest('[data-story-jump]');
			if (jump) { event.preventDefault(); select(jump.dataset.storyJump); return; }
			const action = target?.closest('button[data-story-action]')?.dataset.storyAction;
			if (action === 'previous' && index > 0) select(index - 1);
			if (action === 'next' && index < steps.length - 1) select(index + 1);
			if (action === 'follow') follow();
		}, { signal: abort.signal });
		const intent = event => { if (event.isTrusted) userIntentAt = performance.now(); };
		window.addEventListener('wheel', intent, { passive: true, signal: abort.signal });
		window.addEventListener('touchmove', intent, { passive: true, signal: abort.signal });
		window.addEventListener('pointerdown', event => {
			if (event.clientX >= document.documentElement.clientWidth) intent(event);
		}, { passive: true, signal: abort.signal });
		window.addEventListener('keydown', event => {
			if (interactive(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
			if (mode === 'slides' && (root.contains(event.target) || event.target === document.body)) {
				const offset = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
				if (offset !== undefined) { event.preventDefault(); select(index + offset); return; }
			}
			if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) intent(event);
		}, { signal: abort.signal });
		window.addEventListener('scroll', () => {
			const moved = window.scrollY !== lastScrollY;
			lastScrollY = window.scrollY;
			if (printing || !moved || mode === 'slides' || mode === 'video') return;
			if (!following) {
				if (performance.now() - userIntentAt > 1200) return;
				following = true; suspendedReason = '';
			}
			if (performance.now() - userIntentAt <= 1200) awaitingUserScroll = false;
			connected = true; schedule();
		}, { passive: true, signal: abort.signal });
		window.addEventListener('resize', () => schedule(true), { passive: true, signal: abort.signal });
		window.addEventListener('beforeprint', () => {
			if (printOpen !== null) return;
			printing = true;
			printOpen = stepDetails.map(detail => detail.open);
			for (const detail of stepDetails) detail.open = true;
		}, { signal: abort.signal });
		window.addEventListener('afterprint', () => {
			if (printOpen === null) return;
			stepDetails.forEach((detail, position) => { detail.open = printOpen[position]; });
			printOpen = null; printing = false; awaitingUserScroll = true;
			schedule(true);
		}, { signal: abort.signal });
		const motionChanged = () => {
			const next = loop?.reducedMotion() ?? reducedQuery.matches;
			if (next === reducedMotion) return;
			reducedMotion = next; sync(); schedule(true);
		};
		reducedQuery.addEventListener('change', motionChanged, { signal: abort.signal });
		const stopReducedListener = loop?.onReducedMotionChange(motionChanged);
		const resize = window.ResizeObserver ? new ResizeObserver(() => schedule(true)) : null;
		resize?.observe(container); resize?.observe(stage);
		document.fonts?.ready.then(() => schedule(true));
		window.addEventListener('pagehide', event => {
			if (event.persisted) return;
			destroyed = true; abort.abort(); resize?.disconnect(); board?.unregister(); stopReducedListener?.();
			if (fallbackFrame !== null) window.cancelAnimationFrame(fallbackFrame);
		}, { signal: abort.signal });
		sync(); measure();
		root.dispatchEvent(new CustomEvent('vpk:story-ready', { bubbles: true, detail: { api, state: getState() } }));
	}
	const mount = () => document.querySelectorAll('[data-vpk-story]').forEach(mountStory);
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
	else mount();
})();
