(() => {
	function mountExplorer() {
		const root = document.querySelector('[data-vpk-figure="eu26-hero"]');
		const controls = document.querySelector('#eu26-explorer-controls');
		const island = document.querySelector('[data-eu26-explorer-model]');
		const loop = window.vpkFrameLoop;
		if (!root || !controls || !island || !loop || controls.dataset.mounted) return;
		const { states, duration, playbackRate: configuredRate = 1.7, variants = [], timelineIcons = {}, layout } = JSON.parse(island.textContent);
		const storyRoot = document.querySelector('[data-vpk-story]');
		const storyLayout = layout === 'story' && !!storyRoot;
		let storyDriving = false;
		const detachStory = reason => { if (storyLayout && !storyDriving) window.__vpkStory?.suspendFollowing(reason); };
		if (!states?.length || !(duration > 0)) return;
		const playbackRate = Number.isFinite(configuredRate) && configuredRate > 0 ? configuredRate : 1.7;
		const durationSeconds = duration / playbackRate;
		const svg = root.querySelector('svg');
		if (!svg || root.dataset.heroTime === undefined) return;
		controls.dataset.mounted = 'true';
		controls.setAttribute('data-vpkh-no-lightbox', '');
		root.setAttribute('data-vpkh-no-lightbox', '');
		root.classList.remove('vpkh-zoomable');
		const stage = root.querySelector('.iso-stage') || root;
		const clampTime = value => Math.max(0, Math.min(duration, Number(value) || 0));
		const playbackTime = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
		const wallStart = 27;
		const stateAt = time => Math.max(0, states.findLastIndex(state => state.time <= time + 0.00001));
		const isVideoPreview = () => storyRoot?.dataset.storyMode === 'video';
		const node = (tag, className, text) => {
			const element = document.createElement(tag);
			if (className) element.className = className;
			if (text !== undefined) element.textContent = text;
			return element;
		};
		const setText = (element, text) => {
			if (element.textContent !== text) element.textContent = text;
		};
		const player = {
			variant: variants.find(variant => variant.id === root.dataset.heroVariant)?.id || variants[0]?.id || 'paper',
			time: loop.reducedMotion() && !storyLayout ? duration : 0,
			renderTime: 0,
			selectedIndex: loop.reducedMotion() && !storyLayout ? states.length - 1 : 0,
			visible: !window.IntersectionObserver,
			wantsPlay: false,
			manual: false,
			printing: false,
			tween: null,
			hoverPreview: null,
			focusIndex: null,
			apiPreviewIndex: null,
		};
		const previewIndex = () => player.apiPreviewIndex ?? player.hoverPreview?.index ?? player.focusIndex;
		const running = () => player.wantsPlay && player.visible && !document.hidden && !player.printing && previewIndex() === null && !player.tween;
		const wantsPause = () => player.wantsPlay || (player.tween && !player.tween.paused);
		const renderPose = (time, transition = null) => {
			player.renderTime = playbackTime(time);
			root.dispatchEvent(new CustomEvent('eu26:seek', { detail: { time: transition ? player.time : player.renderTime, transition } }));
		};
		const capturePose = () => {
			const detail = {};
			root.dispatchEvent(new CustomEvent('eu26:capture', { detail }));
			return detail.state;
		};
		const renderTween = tween => renderPose(tween.currentTime, { from: tween.fromState, progress: tween.progress });
		const variantControls = document.querySelector('#eu26-variant-controls');
		const variantButtons = [];
		const variantDescription = node('p', 'eu26-variant-description');
		variantDescription.id = 'eu26-variant-description';
		variantDescription.setAttribute('aria-live', 'polite');
		if (variantControls && variants.length > 1) {
			variantControls.setAttribute('data-vpkh-no-lightbox', '');
			const variantLabel = node('p', 'eu26-variant-label', 'Visual direction');
			variantLabel.id = 'eu26-variant-label';
			const options = node('div', 'eu26-variant-options');
			options.setAttribute('role', 'group');
			options.setAttribute('aria-labelledby', variantLabel.id);
			options.setAttribute('aria-describedby', variantDescription.id);
			for (const variant of variants) {
				const choice = node('button', 'eu26-variant-choice');
				choice.type = 'button';
				choice.dataset.eu26Variant = variant.id;
				const marker = node('span', 'eu26-variant-marker');
				marker.setAttribute('aria-hidden', 'true');
				choice.append(marker, node('span', '', storyLayout ? variant.title.replace(' model', '') : variant.title));
				options.append(choice);
				variantButtons.push(choice);
			}
			variantControls.append(variantLabel, options, variantDescription);
		}
		const anatomyCss = document.querySelector('style[data-vpk-anatomy-css]');
		if (anatomyCss) {
			const thumbnailCss = node('style');
			thumbnailCss.dataset.eu26ThumbnailCss = '';
			thumbnailCss.textContent = anatomyCss.textContent.replaceAll(':where([data-vpk-engine="anatomy-hero"])', ':where(.eu26-state-thumb)');
			controls.prepend(thumbnailCss);
		}

		function snapshot(index, scope = 'thumb') {
			renderPose(states[index].time);
			const svg = root.querySelector('svg');
			const copy = svg.cloneNode(true);
			const sourceElements = [svg, ...svg.querySelectorAll('*')];
			const copiedElements = [copy, ...copy.querySelectorAll('*')];
			for (let item = sourceElements.length - 1; item > 0; item--) {
				const source = sourceElements[item];
				if (source.closest('defs')) continue;
				const style = getComputedStyle(source);
				if (style.display === 'none' || style.visibility === 'hidden' || source.matches('script, animate, animateTransform, set, [data-eu26-hover]')) copiedElements[item].remove();
			}
			const elements = [copy, ...copy.querySelectorAll('*')];
			const ids = new Map(elements.filter(element => element.id).map(element => [element.id, `eu26-${scope}-${index}-${element.id}`]));
			const rewriteUrls = value => value.replace(/url\(\s*(['"]?)#([^\s)'"]+)\1\s*\)/g, (match, quote, id) => ids.has(id) ? `url(#${ids.get(id)})` : match);
			for (const element of elements) {
				if (element.id) element.id = ids.get(element.id);
				element.removeAttribute('tabindex');
				for (const attribute of [...element.attributes]) {
					let value = rewriteUrls(attribute.value);
					if ((attribute.localName === 'href') && value.startsWith('#') && ids.has(value.slice(1))) value = `#${ids.get(value.slice(1))}`;
					if (attribute.name === 'aria-labelledby' || attribute.name === 'aria-describedby') value = value.split(/\s+/).map(id => ids.get(id) || id).join(' ');
					if (value !== attribute.value) element.setAttributeNS(attribute.namespaceURI, attribute.name, value);
				}
				if (element.tagName.toLowerCase() === 'style') element.textContent = rewriteUrls(element.textContent);
			}
			copy.classList.remove('iso-svg');
			copy.classList.add('eu26-thumb-svg');
			copy.removeAttribute('role');
			copy.removeAttribute('aria-label');
			copy.removeAttribute('aria-labelledby');
			copy.setAttribute('aria-hidden', 'true');
			copy.setAttribute('focusable', 'false');
			copy.dataset.heroVariant = player.variant;
			return copy;
		}

		const dock = window.mountEu26Timeline({
			controls, states, duration, playbackRate, icons: timelineIcons, snapshot,
			onAction: (action, index) => {
				if (action === 'select') select(index);
				else if (action === 'previous' && player.selectedIndex > 0) select(player.selectedIndex - 1);
				else if (action === 'next' && player.selectedIndex < states.length - 1) select(player.selectedIndex + 1);
				else if (action === 'play') {
					if (wantsPause()) pause();
					else play();
				}
				else if (action === 'replay') replay();
			},
			onSeek: time => seek(time, { scrollStory: true }),
			onPreview: (index, source, time = states[index].time) => {
				if (source === 'focus') player.focusIndex = index;
				else player.hoverPreview = { index, time };
				showCurrent();
			},
			onClearPreview: source => {
				if (source === 'focus') player.focusIndex = null;
				else player.hoverPreview = null;
				showCurrent();
			},
		});
		const { stateButtons, announcement } = dock;
		renderPose(player.time);

		function sync({ scrollStory = false } = {}) {
			const preview = previewIndex();
			const variant = variants.find(option => option.id === player.variant);
			if (variant) setText(variantDescription, variant.description || '');
			for (const choice of variantButtons) choice.setAttribute('aria-pressed', String(choice.dataset.eu26Variant === player.variant));
			const playing = running();
			const action = wantsPause() ? 'Pause' : 'Play';
			const timelineTime = clampTime(player.time);
			const status = preview !== null ? 'Temporary preview' : player.tween && !player.tween.paused ? 'Moving to state' : playing ? player.time >= wallStart ? 'Wall scrolling' : 'Playing' : 'Paused';
			dock.render({ time: timelineTime, displayTime: clampTime(player.renderTime), selectedIndex: player.selectedIndex, previewIndex: preview, playAction: action, status, infinite: player.time >= duration });
			controls.dataset.previewing = String(preview !== null);
			root.dataset.playbackTime = player.time.toFixed(3);
			root.dataset.playbackElapsed = (player.time / playbackRate).toFixed(3);
			root.dataset.playbackRate = String(playbackRate);
			root.dataset.playbackState = preview !== null ? 'preview' : player.tween ? 'seeking' : playing ? 'playing' : 'paused';
			root.dataset.wallLooping = String(player.time >= wallStart);
			if (storyLayout) window.__vpkStory?.reflect(player.selectedIndex, player.time, { scroll: scrollStory, previewIndex: preview, playing });
			storyRoot?.dispatchEvent(new CustomEvent('eu26:state', { detail: {
				time: player.time, playing, wantsPlay: player.wantsPlay,
				selectedIndex: player.selectedIndex, transitioning: !!player.tween,
			} }));
		}

		let lastFrameTime = null;
		const board = loop.register(stage, (dt, now) => {
			if (!player.visible || document.hidden || player.printing || previewIndex() !== null) {
				lastFrameTime = null;
				return false;
			}
			const frameTime = Number.isFinite(now) ? now : performance.now();
			const elapsed = lastFrameTime === null ? 0 : Math.max(0, (frameTime - lastFrameTime) / 1000);
			lastFrameTime = frameTime;
			if (player.tween) {
				const tween = player.tween;
				if (tween.paused) return false;
				tween.elapsed = Math.min(tween.duration, tween.elapsed + elapsed);
				const progress = tween.elapsed / tween.duration;
				const eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
				tween.progress = eased;
				tween.currentTime = tween.from + (player.time - tween.from) * eased;
				renderTween(tween);
				if (progress >= 1) player.tween = null;
			} else if (running()) {
				const nextTime = playbackTime(player.time + elapsed * playbackRate);
				player.time = isVideoPreview() ? Math.min(duration, nextTime) : nextTime;
				if (isVideoPreview() && player.time >= duration) player.wantsPlay = false;
				player.selectedIndex = stateAt(player.time);
				renderPose(player.time);
			}
			sync();
			return Boolean(player.tween && !player.tween.paused) || running();
		}, { rest: () => {
			player.printing = true;
			renderPose(duration);
			sync();
		} });
		const wake = options => { sync(options); lastFrameTime = performance.now(); board.wake(); };
		const clearPreviewSources = () => {
			dock.lockHover();
			player.hoverPreview = null;
			player.focusIndex = null;
			player.apiPreviewIndex = null;
		};
		const showCurrent = () => {
			const preview = previewIndex();
			if (preview !== null) renderPose(player.apiPreviewIndex !== null ? states[preview].time : player.hoverPreview?.time ?? states[preview].time);
			else if (player.tween) renderTween(player.tween);
			else renderPose(player.time);
			wake();
		};
		const getState = () => ({
			variant: player.variant,
			time: player.time, renderTime: player.renderTime, selectedIndex: player.selectedIndex,
			previewIndex: previewIndex(), playing: running(), wantsPlay: player.wantsPlay,
			visible: player.visible, reducedMotion: loop.reducedMotion(), duration, transitioning: !!player.tween,
			timelineTime: clampTime(player.time), wallElapsed: Math.max(0, player.time - wallStart), looping: player.time >= wallStart,
			playbackRate, durationSeconds, elapsedSeconds: player.time / playbackRate, timelineSeconds: clampTime(player.time) / playbackRate,
		});
		const setVariant = id => {
			if (id === player.variant || !variants.some(variant => variant.id === id)) return getState();
			const renderTime = player.renderTime;
			player.variant = id;
			root.dispatchEvent(new CustomEvent('eu26:variant', { detail: { variant: id } }));
			for (const [index, choice] of stateButtons.entries()) {
				const thumbnail = choice.querySelector('.eu26-state-thumb');
				thumbnail.dataset.heroVariant = id;
				thumbnail.replaceChildren(snapshot(index));
			}
			if (player.tween) renderTween(player.tween);
			else renderPose(renderTime);
			wake();
			return getState();
		};
		const seek = (time, options) => {
			detachStory('scrub');
			player.manual = true;
			player.wantsPlay = false;
			player.tween = null;
			clearPreviewSources();
			player.time = playbackTime(time);
			player.selectedIndex = stateAt(player.time);
			renderPose(player.time);
			wake(options);
			return getState();
		};
		const select = index => {
			dock.lockHover();
			if (storyLayout && !storyDriving && window.__vpkStory) {
				window.__vpkStory.select(index, { following: false });
				return getState();
			}
			const target = Math.max(0, Math.min(states.length - 1, Math.trunc(Number(index) || 0)));
			const from = player.renderTime;
			const fromState = capturePose();
			const frame = stage.getBoundingClientRect();
			const canAnimate = !loop.reducedMotion() && !document.hidden && frame.width > 0 && frame.height > 0 && frame.bottom > 0 && frame.top < window.innerHeight && frame.right > 0 && frame.left < window.innerWidth;
			player.manual = true;
			player.wantsPlay = false;
			clearPreviewSources();
			player.selectedIndex = target;
			player.time = states[target].time;
			const motionToken = getComputedStyle(document.documentElement).getPropertyValue('--vpk-dur-fast').trim();
			const motionSeconds = (Number.parseFloat(motionToken) || 140) / (motionToken.endsWith('ms') || !motionToken ? 1000 : 1);
			const navigationSeconds = Math.min(0.42, Math.max(0.24, motionSeconds * 2 + Math.abs(from - player.time) / duration * 0.14));
			player.tween = canAnimate && Math.abs(from - player.time) > 0.001 ? { from, fromState, currentTime: from, progress: 0, elapsed: 0, duration: navigationSeconds } : null;
			if (!player.tween) renderPose(player.time);
			setText(announcement, states[target].title);
			wake();
			return getState();
		};
		const preview = index => {
			player.apiPreviewIndex = Math.max(0, Math.min(states.length - 1, Math.trunc(Number(index) || 0)));
			showCurrent();
			return getState();
		};
		const clearPreview = () => {
			clearPreviewSources();
			showCurrent();
			return getState();
		};
		const play = () => {
			detachStory('play');
			player.manual = true;
			clearPreviewSources();
			if (isVideoPreview() && player.time >= duration) {
				player.time = 0;
				player.selectedIndex = 0;
				player.tween = null;
			}
			if (player.tween) player.tween.paused = false;
			else player.selectedIndex = stateAt(player.time);
			player.wantsPlay = true;
			if (player.tween) renderTween(player.tween);
			else renderPose(player.time);
			wake();
			return getState();
		};
		const pause = () => {
			detachStory('pause');
			player.manual = true;
			player.wantsPlay = false;
			if (player.tween) player.tween.paused = true;
			wake();
			return getState();
		};
		const replay = () => {
			seek(0);
			return play();
		};
		window.__eu26Explorer = { getState, seek, select, preview, clearPreview, play, pause, replay, setVariant };
		if (storyLayout) {
			storyRoot.addEventListener('vpk:story-frame', event => {
				storyDriving = true;
				try {
					if (event.detail.reason === 'scroll') seek(event.detail.time);
					else if (event.detail.reason === 'mode') { clearPreviewSources(); showCurrent(); }
					else select(event.detail.index);
				} finally { storyDriving = false; }
			});
			const attachStory = () => {
				const theme = document.querySelector('[data-vpk-theme-toggle]');
				const slot = document.querySelector('[data-story-theme]');
				if (theme && slot) slot.append(theme);
				window.__vpkStory?.follow();
			};
			if (window.__vpkStory) attachStory();
			else storyRoot.addEventListener('vpk:story-ready', attachStory, { once: true });
		}
		for (const choice of variantButtons) choice.addEventListener('click', () => setVariant(choice.dataset.eu26Variant));
		if (window.IntersectionObserver) {
			const observer = new IntersectionObserver(entries => {
				for (const entry of entries) {
					player.visible = entry.isIntersecting && entry.intersectionRatio > 0;
					if (!player.visible && player.tween) {
						player.tween = null;
						renderPose(player.time);
					}
					if (player.visible && !player.manual && !loop.reducedMotion() && !storyLayout) player.wantsPlay = true;
					wake();
				}
			}, { threshold: [0, 0.01] });
			observer.observe(root);
		} else if (!loop.reducedMotion() && !storyLayout) player.wantsPlay = true;
		const handleReducedMotion = reduced => {
			if (reduced) {
				player.wantsPlay = false;
				player.tween = null;
				showCurrent();
			}
			wake();
		};
		loop.onReducedMotionChange(handleReducedMotion);
		window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener('change', event => handleReducedMotion(event.matches));
		document.addEventListener('visibilitychange', () => {
			if (document.hidden && player.tween) {
				player.tween = null;
				renderPose(player.time);
			}
			wake();
		});
		window.addEventListener('afterprint', () => {
			player.printing = false;
			showCurrent();
		});
		wake();
	}
	if (document.readyState === 'complete') mountExplorer();
	else window.addEventListener('load', mountExplorer, { once: true });
})();
