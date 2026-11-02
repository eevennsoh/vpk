(() => {
	window.mountEu26Timeline = ({ controls, states, duration, playbackRate, icons = {}, snapshot, onAction, onSeek, onPreview, onClearPreview }) => {
		const loop = window.vpkFrameLoop;
		const motion = window.eu26TimelineMotion;
		const storyRoot = document.querySelector('[data-vpk-story]');
		const home = document.createComment('timeline home');
		controls.before(home);
		let horizontal = false;
		let pageBased = ['story', 'slides'].includes(storyRoot?.dataset.storyMode);
		const node = (tag, className, text) => {
			const element = document.createElement(tag);
			if (className) element.className = className;
			if (text !== undefined) element.textContent = text;
			return element;
		};
		const setText = (element, text) => { if (element.textContent !== text) element.textContent = text; };
		const setIcon = (element, action, fallback) => {
			if (element.dataset.eu26Icon === action) return;
			element.dataset.eu26Icon = action;
			if (icons[action]) element.innerHTML = icons[action];
			else element.textContent = fallback;
		};
		const durationSeconds = duration / playbackRate;
		const timeIntervals = Math.max(12, Math.min(32, Math.ceil(durationSeconds)));
		let tickGap = 20;
		controls.classList.add('eu26-timeline-dock');
		controls.setAttribute('role', 'group');
		controls.setAttribute('aria-label', 'Chapter navigation');
		const bar = node('div', 'eu26-dock-bar');
		const transport = node('div', 'eu26-dock-transport');
		const actionButton = (action, symbol, label, className = '') => {
			const button = node('button', `eu26-explorer-button ${className}`.trim());
			button.type = 'button';
			button.dataset.eu26Action = action;
			button.setAttribute('aria-label', label);
			button.title = label;
			const icon = node('span', 'eu26-dock-icon');
			icon.setAttribute('aria-hidden', 'true');
			setIcon(icon, action, symbol);
			button.append(icon);
			return button;
		};
		const playButton = actionButton('play', '▶', 'Play animation');
		const replayButton = actionButton('replay', '↻', 'Replay story');
		transport.append(playButton);
		const rulerGroup = node('div', 'eu26-dock-ruler');
		const label = node('label', 'eu26-dock-sr', 'Chapter navigation');
		label.htmlFor = 'eu26-explorer-timeline';
		const ruler = node('div', 'eu26-timeline-ruler');
		const ticks = node('div', 'eu26-timeline-ticks');
		ticks.setAttribute('aria-hidden', 'true');
		const videoPlayhead = node('span', 'eu26-video-playhead');
		videoPlayhead.setAttribute('aria-hidden', 'true');
		const tickLines = [];
		let tickCount = 0, tickPositions = [];
		const tickRows = [];
		const timestampLabels = node('div', 'eu26-timeline-timestamps');
		timestampLabels.setAttribute('aria-hidden', 'true');
		const elapsed = node('output', 'eu26-video-elapsed');
		elapsed.setAttribute('aria-hidden', 'true');
		const formatTime = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
		const buildTicks = videoIntervals => {
			tickCount = pageBased ? states.length - 1 : horizontal ? videoIntervals ?? Math.max(1, Math.floor((window.innerWidth - 240) / tickGap)) : timeIntervals;
			tickPositions = motion.marks(tickCount);
			timeline.max = String(pageBased ? states.length - 1 : durationSeconds);
			timeline.step = pageBased ? 'any' : '0.01';
			tickLines.length = tickRows.length = 0;
			ticks.replaceChildren(); timestampLabels.replaceChildren();
			for (const [index, position] of tickPositions.entries()) {
				const mark = node('span', 'eu26-timeline-mark');
				mark.dataset.timelinePosition = String(position.fraction);
				const tick = node('span', 'eu26-timeline-tick');
				tick.dataset.timelineTick = String(index);
				tick.dataset.intermediate = String(horizontal && !pageBased && index % 4 !== 0);
				mark.append(tick); ticks.append(mark); tickLines.push(tick); tickRows.push(mark);
			}
			if (horizontal && !pageBased) {
				const times=[];for(let seconds=0;seconds<durationSeconds;seconds+=5)times.push(seconds);times.push(durationSeconds);
				for(const seconds of times) {
					const label=node('span','eu26-timeline-timestamp',formatTime(seconds));
					label.dataset.timelinePosition=String(seconds/durationSeconds);
					label.dataset.edge=seconds===0?'start':seconds===durationSeconds?'end':'';
					timestampLabels.append(label);
				}
			}
		};
		ruler.append(ticks, videoPlayhead);
		const timeline = node('input');
		timeline.type = 'range';
		timeline.setAttribute('aria-orientation', 'vertical');
		timeline.id = 'eu26-explorer-timeline';
		timeline.min = '0';
		timeline.value = '0';
		timeline.setAttribute('aria-describedby', 'eu26-explorer-hint');
		buildTicks();
		ruler.append(timeline);
		rulerGroup.append(label, ruler);
		const playbackStatus = node('span', 'eu26-explorer-status eu26-dock-sr');
		playbackStatus.dataset.eu26PlaybackStatus = '';
		const framesButton = actionButton('frames', '▦', 'Preview frames', 'eu26-dock-frames');
		framesButton.setAttribute('aria-controls', 'eu26-dock-tray');
		framesButton.setAttribute('aria-expanded', 'false');
		const fullscreen = node('button', 'eu26-explorer-button eu26-video-fullscreen', 'Fullscreen');
		fullscreen.type = 'button'; fullscreen.dataset.videoAction = 'fullscreen'; fullscreen.hidden = true;
		const dockActions = node('div', 'eu26-dock-actions');
		dockActions.append(framesButton, fullscreen);
		bar.append(transport, rulerGroup, dockActions);
		const context = node('button', 'eu26-chapter-context');
		context.type = 'button';
		const contextThumb = node('span', 'eu26-state-thumb eu26-context-thumb');
		contextThumb.setAttribute('aria-hidden', 'true');
		const contextTitle = node('span', 'eu26-context-title');
		context.append(contextThumb, contextTitle);
		const tray = node('div', 'eu26-dock-tray');
		tray.id = 'eu26-dock-tray';
		tray.setAttribute('role', 'group');
		tray.setAttribute('aria-label', 'All chapters');
		const list = node('ol', 'eu26-dock-filmstrip');
		list.setAttribute('role', 'list');
		list.setAttribute('aria-label', 'Chapters');
		const stateButtons = states.map((state, index) => {
			const item = node('li', 'eu26-dock-frame');
			const choice = node('button', 'eu26-state-choice');
			choice.type = 'button';
			choice.dataset.eu26StateIndex = String(index);
			choice.setAttribute('aria-label', state.title);
			choice.setAttribute('aria-pressed', 'false');
			choice.tabIndex = -1;
			const thumbnail = node('span', 'eu26-state-thumb');
			thumbnail.setAttribute('aria-hidden', 'true');
			const image = snapshot(index);
			thumbnail.dataset.heroVariant = image.dataset.heroVariant;
			thumbnail.append(image);
			const text = node('span', 'eu26-state-text');
			text.append(node('span', 'eu26-state-title', state.title));
			choice.append(thumbnail, text);
			item.append(choice);
			list.append(item);
			return choice;
		});
		tray.append(list);
		const hint = node('p', 'eu26-explorer-hint eu26-dock-sr', 'Explore chapters with the rail. Select a preview to move there. Frames opens every chapter. Use the arrow keys to navigate. Escape closes previews.');
		hint.id = 'eu26-explorer-hint';
		const announcement = node('p', 'eu26-explorer-announcement');
		announcement.setAttribute('aria-live', 'polite');
		announcement.setAttribute('aria-atomic', 'true');
		controls.append(bar, context, tray, playbackStatus, hint, announcement);

		let expanded = false, pinned = false, pointerInside = false, focusInside = false, dismissed = false;
		let dragging = false, pointerId = null, hoverLocked = false, hoverIndex = null, hoverTime = null, focusIndex = null;
		let gestureActive = false, browseIntent = false, hoverFrameIndex = null;
		let lastPointer = null, pointerFocus = false, selectedIndex = 0, rovingIndex = 0, gesture = null;
		let contextVisible = false, contextIndex = 0, contextFraction = 0, contextY = 0, contextClosing = false;
		let contextImageSource = null, imageSerial = 0, scrollingUntil = 0, scrollTimer = null;
		let rulerHeight = 0, rulerTop = 0, controlsTop = 0, controlsLeft = 0, contextHeight = 0, contextWidth = 0, geometryDirty = true, spacingDirty = false;
		let pendingRailY = null, fraction = 0, playbackFraction = 0, playbackSeconds = 0, activeTick = -1, lensCenter = 0, latestPoint = null;
		let rulerBounds = { top: 0, bottom: 0, left: 0, right: 0 };
		const magnet = { x: motion.spring(), y: motion.spring(), amount: motion.spring() };
		const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
		const canHover = event => event.pointerType !== 'touch' && hoverQuery.matches;
		const coordinate = event => horizontal ? event.clientX : event.clientY;
		const proximityTarget = point => {
			if (!horizontal) return motion.target(point, rulerBounds);
			const right = (rulerBounds.top + rulerBounds.bottom) / 2 + 8;
			return motion.target(point ? { x: point.y, y: point.x } : null, { left: right - (rulerBounds.bottom - rulerBounds.top), right, top: rulerBounds.left, bottom: rulerBounds.right });
		};
		const clampIndex = value => Math.max(0, Math.min(states.length - 1, Math.trunc(Number(value) || 0)));
		const chapterFraction = index => pageBased ? index / Math.max(1, states.length - 1) : states[index].time / duration;
		const pageTime = value => {
			const position = Math.max(0, Math.min(states.length - 1, Number(value) || 0));
			const index = Math.floor(position), next = Math.min(states.length - 1, index + 1);
			return states[index].time + (states[next].time - states[index].time) * (position - index);
		};
		const pagePosition = time => {
			const index = Math.max(0, states.findLastIndex(state => state.time <= time));
			const next = states[index + 1];
			return next ? index + Math.max(0, Math.min(1, (time - states[index].time) / (next.time - states[index].time))) : index;
		};
		const nearestChapter = y => {
			const position = Math.max(0, Math.min(1, (y - rulerTop) / Math.max(1, rulerHeight)));
			if (pageBased) return Math.round(position * (states.length - 1));
			const target = position * duration;
			return states.reduce((closest, state, index) => Math.abs(state.time - target) < Math.abs(states[closest].time - target) ? index : closest, 0);
		};
		const clearSource = source => {
			if (source === 'hover') { if (hoverIndex === null) return; hoverIndex = hoverTime = null; }
			else { if (focusIndex === null) return; focusIndex = null; }
			onClearPreview(source);
		};
		const clearSources = () => { clearSource('hover'); clearSource('focus'); };
		const browsingFrames = () => browseIntent || gestureActive || hoverFrameIndex !== null || list.contains(document.activeElement);
		const scrollFrame = index => {
			const frame = stateButtons[index].getBoundingClientRect(), viewport = list.getBoundingClientRect();
			const position = horizontal
				? { left: Math.max(0, list.scrollLeft + frame.left - viewport.left - (list.clientWidth - frame.width) / 2), top: 0 }
				: { top: Math.max(0, list.scrollTop + frame.top - viewport.top - (list.clientHeight - frame.height) / 2), left: 0 };
			list.scrollTo({ ...position, behavior: 'instant' });
		};
		const syncTabStops = () => {
			for (const [index, choice] of stateButtons.entries()) choice.tabIndex = expanded && index === rovingIndex ? 0 : -1;
		};
		const syncContextImage = () => {
			const source = stateButtons[contextIndex].querySelector('.eu26-state-thumb svg');
			if (!source || source === contextImageSource) return;
			contextImageSource = source;
			const copy = source.cloneNode(true);
			const elements = [copy, ...copy.querySelectorAll('*')];
			const prefix = `eu26-context-${++imageSerial}-`;
			const ids = new Map(elements.filter(element => element.id).map(element => [element.id, `${prefix}${element.id}`]));
			const rewriteUrls = value => value.replace(/url\(\s*(['"]?)#([^\s)'"]+)\1\s*\)/g, (match, quote, id) => ids.has(id) ? `url(#${ids.get(id)})` : match);
			for (const element of elements) {
				if (element.id) element.id = ids.get(element.id);
				for (const attribute of [...element.attributes]) {
					let value = rewriteUrls(attribute.value);
					if (attribute.localName === 'href' && value.startsWith('#') && ids.has(value.slice(1))) value = `#${ids.get(value.slice(1))}`;
					if (attribute.name === 'aria-labelledby' || attribute.name === 'aria-describedby') value = value.split(/\s+/).map(id => ids.get(id) || id).join(' ');
					if (value !== attribute.value) element.setAttributeNS(attribute.namespaceURI, attribute.name, value);
				}
				if (element.tagName.toLowerCase() === 'style') element.textContent = rewriteUrls(element.textContent);
			}
			contextThumb.dataset.heroVariant = source.dataset.heroVariant;
			contextThumb.replaceChildren(copy);
			setText(contextTitle, states[contextIndex].title);
			context.setAttribute('aria-label', states[contextIndex].title);
			context.dataset.eu26ContextIndex = String(contextIndex);
			geometryDirty = true;
		};
		const refreshContext = () => {
			const visible = !expanded && !dismissed && !document.hidden && (pointerInside || focusInside || dragging || scrollingUntil > performance.now());
			if (!visible && context.contains(document.activeElement)) {
				contextClosing = true;
				timeline.focus({ preventScroll: true });
				contextClosing = false;
			}
			contextVisible = visible;
			controls.dataset.contextVisible = String(visible);
			context.inert = !visible;
			context.tabIndex = visible ? 0 : -1;
			context.setAttribute('aria-hidden', String(!visible));
			if (visible) { syncContextImage(); contextBoard.wake(); }
		};
		const showContext = (index, nextFraction, source) => {
			contextIndex = clampIndex(index);
			contextFraction = Math.max(0, Math.min(1, loop.reducedMotion() ? chapterFraction(contextIndex) : nextFraction));
			controls.dataset.contextSource = source;
			refreshContext();
		};
		const reflectContext = () => {
			const preview = hoverIndex ?? focusIndex;
			showContext(preview ?? selectedIndex, fraction, preview !== null ? hoverIndex !== null ? 'hover' : 'focus' : dragging ? 'scrub' : scrollingUntil > performance.now() ? 'scroll' : 'current');
		};
		const pulseContext = () => {
			if (scrollTimer !== null) window.clearTimeout(scrollTimer);
			scrollingUntil = performance.now() + 1000;
			scrollTimer = window.setTimeout(() => { scrollTimer = null; scrollingUntil = 0; refreshContext(); }, 1000);
			reflectContext();
		};
		function setExpanded(value, options = {}) {
			if (options.pin !== false) pinned = Boolean(value);
			if (value) dismissed = false;
			if (expanded === Boolean(value)) return getState();
			if (!value && tray.contains(document.activeElement)) {
				dismissed = true;
				framesButton.focus({ preventScroll: true });
			}
			expanded = Boolean(value);
			controls.dataset.expanded = String(expanded);
			framesButton.setAttribute('aria-expanded', String(expanded));
			tray.inert = !expanded;
			tray.setAttribute('aria-hidden', String(!expanded));
			clearSources();
			if (expanded) { browseIntent = false; rovingIndex = selectedIndex; scrollFrame(selectedIndex); }
			syncTabStops();
			reflectContext();
			return getState();
		}
		const lockHover = () => { hoverLocked = true; pendingRailY = null; hoverIndex = hoverTime = null; focusIndex = null; };
		const previewFrame = (index, source, time = states[index].time) => {
			if (dragging || (source === 'hover' && hoverLocked)) return;
			if (source === 'hover') { if (hoverIndex === index && hoverTime === time) return; hoverIndex = index; hoverTime = time; }
			else { if (focusIndex === index) return; focusIndex = index; }
			onPreview(index, source, time);
			reflectContext();
		};
		const dismiss = () => {
			dismissed = true;
			pinned = pointerInside = focusInside = false;
			scrollingUntil = 0;
			if (scrollTimer !== null) window.clearTimeout(scrollTimer);
			scrollTimer = null;
			clearSources();
			lockHover();
			setExpanded(false, { pin: false });
			refreshContext();
		};
		const configureSpacing = () => {
			spacingDirty = false;
			const headerHeight=storyRoot.querySelector('.story-bar').getBoundingClientRect().height;
			tickGap=Math.max(1,Math.floor(Math.min(20,(window.innerWidth-160)/Math.max(1,states.length-1),(window.innerHeight-headerHeight-144)/timeIntervals)));
			controls.style.setProperty('--eu26-tick-gap',`${tickGap}px`);
			controls.style.setProperty('--eu26-page-span',`${(states.length-1)*tickGap+1}px`);
			controls.style.setProperty('--eu26-time-span',`${timeIntervals*tickGap+1}px`);
		};
		const measure = () => {
			const bounds = ruler.getBoundingClientRect();
			if(horizontal&&!pageBased) {
				const count=Math.max(1,Math.floor((bounds.width-1)/tickGap));
				if(count!==tickCount){activeTick=-1;buildTicks(count);}
			}
			rulerBounds = { top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right };
			rulerHeight = horizontal ? bounds.width : bounds.height;
			rulerTop = horizontal ? bounds.left : bounds.top;
			const controlsBounds = controls.getBoundingClientRect(), contextBounds = context.getBoundingClientRect();
			controlsTop = controlsBounds.top; controlsLeft = controlsBounds.left;
			contextHeight = contextBounds.height; contextWidth = contextBounds.width;
			if (horizontal) {
				const headerBottom = storyRoot.querySelector('.story-bar').getBoundingClientRect().bottom;
				const above = controlsTop - Math.max(0, headerBottom) - 24;
				const below = window.innerHeight - controlsBounds.bottom - 24;
				const useBelow = above < Math.min(200, below);
				controls.dataset.popupSide = useBelow ? 'below' : 'above';
				tray.style.maxBlockSize = `${Math.max(96, useBelow ? below : above)}px`;
			}
			const ratio = window.devicePixelRatio || 1;
			const spacing = tickGap;
			const inset = Math.round((rulerHeight - 1 - spacing * tickCount) * ratio / 2) / ratio;
			for (const [index, row] of tickRows.entries()) {
				row.style[horizontal ? 'left' : 'top'] = `${inset + index * spacing + 0.5}px`;
			}
			for (const label of timestampLabels.children) label.style.left = `${inset + Number(label.dataset.timelinePosition) * spacing * tickCount + 0.5}px`;
			geometryDirty = false;
		};
		const paintTicks = () => {
			const nearest = motion.nearest(tickPositions, fraction);
			if (nearest !== activeTick) {
				if (activeTick >= 0) tickLines[activeTick].classList.remove('eu26-timeline-playhead');
				activeTick = nearest;
				tickLines[activeTick].classList.add('eu26-timeline-playhead');
			}
			const translate = horizontal ? `${magnet.y.value.toFixed(3)}px ${magnet.x.value.toFixed(3)}px` : `${magnet.x.value.toFixed(3)}px ${magnet.y.value.toFixed(3)}px`;
			if (ticks.style.translate !== translate) ticks.style.translate = translate;
			for (const [index, tick] of tickLines.entries()) {
				const baseLength = horizontal && tick.dataset.intermediate === 'true' ? 8 : 14;
				const pose = motion.pose(tickPositions[index], lensCenter, rulerHeight, magnet.amount.value, index === activeTick, baseLength);
				const rowTranslate = horizontal ? `${pose.offsetY.toFixed(3)}px 0px` : `0px ${pose.offsetY.toFixed(3)}px`;
				if (tickRows[index].style.translate !== rowTranslate) tickRows[index].style.translate = rowTranslate;
				const transform = `scale${horizontal ? 'Y' : 'X'}(${pose.scale.toFixed(4)})`;
				const opacity = Math.max(0, pose.opacity - (horizontal && tick.dataset.intermediate === 'true' && index !== activeTick ? 0.24 : 0)).toFixed(4);
				if (tick.style.transform !== transform) tick.style.transform = transform;
				if (tick.style.opacity !== opacity) tick.style.opacity = opacity;
			}
		};
		const writePosition = () => {
			paintTicks();
			if (horizontal && !pageBased) {
				const position = 1 + playbackFraction * Math.max(0, rulerHeight - 2);
				videoPlayhead.style.transform = `translateX(${position}px) translateX(-50%)`;
				videoPlayhead.dataset.playbackSeconds = String(playbackSeconds);
			}
			if (!contextVisible && !horizontal) return;
			if (horizontal) {
				const minimum = 12 - controlsLeft, maximum = Math.max(minimum, innerWidth - 12 - controlsLeft - contextWidth);
				const position = Math.max(minimum, Math.min(maximum, rulerTop - controlsLeft + contextFraction * rulerHeight + magnet.y.value - contextWidth / 2));
				context.style.transform = `translateX(${position}px)`;
				return;
			}
			const minimum = 12 - controlsTop;
			const maximum = Math.max(minimum, window.innerHeight - 12 - controlsTop - contextHeight);
			const contextOffset = motion.pose({ fraction: contextFraction }, lensCenter, rulerHeight, magnet.amount.value, false).offsetY;
			contextY = Math.max(minimum, Math.min(maximum, rulerTop - controlsTop + contextFraction * rulerHeight + contextOffset + magnet.y.value - contextHeight / 2));
			context.style.transform = `translateY(${contextY}px)`;
		};
		const contextBoard = loop.register(controls, dt => {
			if(spacingDirty)configureSpacing();
			if (geometryDirty) measure();
			if (pendingRailY !== null && !dragging && !hoverLocked) {
				if(loop.reducedMotion())previewFrame(nearestChapter(pendingRailY),'hover');
				else {
					const position=Math.max(0,Math.min(1,(pendingRailY-rulerTop)/Math.max(1,rulerHeight)));
					const time=pageBased?pageTime(position*(states.length-1)):position*duration;
					const index=Math.max(0,states.findLastIndex(state=>state.time<=time+.00001));
					previewFrame(index,'hover',time);
				}
			}
			if (geometryDirty) measure();
			const target = proximityTarget(loop.reducedMotion() || document.hidden ? null : latestPoint);
			if (target.amount > 0) lensCenter = target.center;
			let moving = false;
			for (const axis of ['x', 'y', 'amount']) {
				if (loop.reducedMotion() || document.hidden) { magnet[axis].value = 0; magnet[axis].velocity = 0; }
				else moving = motion.advance(magnet[axis], target[axis], dt) || moving;
			}
			writePosition();
			return moving;
		});
		const scheduleLens = clientY => { if (clientY === null) latestPoint = null; contextBoard.wake(); };
		document.addEventListener('pointermove', event => {
			latestPoint = canHover(event) ? { x: event.clientX, y: event.clientY } : null;
			if (geometryDirty || proximityTarget(latestPoint).amount > 0 || magnet.amount.value > 0) contextBoard.wake();
		}, { passive: true });
		document.addEventListener('pointerleave', () => scheduleLens(null));
		const finishDrag = event => {
			if (pointerId !== null && event?.pointerId !== undefined && event.pointerId !== pointerId) return;
			dragging = false;
			pointerId = null;
			controls.dataset.scrubbing = 'false';
			refreshContext();
		};
		const finishGesture = event => {
			if (!gesture || (event?.pointerId !== undefined && gesture.id !== event.pointerId)) return;
			gestureActive = false;
		};
		controls.addEventListener('pointerenter', event => {
			if (!canHover(event)) return;
			pointerInside = true;
			reflectContext();
		});
		controls.addEventListener('pointerleave', event => {
			if (event.pointerType === 'touch') return;
			pointerInside = false;
			if (expanded && !pinned && !tray.contains(document.activeElement)) setExpanded(false, { pin: false });
			hoverFrameIndex = null;
			pendingRailY = null;
			dismissed = false;
			clearSource('hover');
			scheduleLens(null);
			refreshContext();
		});
		controls.addEventListener('pointermove', event => {
			if (!canHover(event)) return;
			pointerInside = true;
			const moved = !lastPointer || Math.abs(event.clientX - lastPointer.x) + Math.abs(event.clientY - lastPointer.y) > .5;
			lastPointer = { x: event.clientX, y: event.clientY };
			if (!moved) return;
			hoverLocked = false;
			if (rulerGroup.contains(event.target)) { pendingRailY = coordinate(event); scheduleLens(coordinate(event)); }
			else {
				pendingRailY = null;
				scheduleLens(null);
				const choice = event.target.closest('[data-eu26-state-index]');
				hoverFrameIndex = choice && list.contains(choice) ? Number(choice.dataset.eu26StateIndex) : null;
				if (expanded && hoverFrameIndex !== null) previewFrame(hoverFrameIndex, 'hover');
				else if (!context.contains(event.target) && !(horizontal && event.target === controls)) clearSource('hover');
			}
			refreshContext();
		});
		controls.addEventListener('pointerdown', event => {
			pointerFocus = true;
			if (event.pointerType === 'touch' && !context.contains(event.target)) { clearSources(); pulseContext(); }
		});
		controls.addEventListener('focusin', event => {
			if (contextClosing) return;
			if (pointerFocus) { pointerFocus = false; return; }
			if (dismissed) return;
			focusInside = true;
			if (!context.contains(event.target)) reflectContext();
			else refreshContext();
		});
		controls.addEventListener('focusout', event => {
			if (controls.contains(event.relatedTarget)) return;
			focusInside = false;
			dismissed = false;
			clearSource('focus');
			refreshContext();
		});
		controls.addEventListener('keydown', event => {
			pointerFocus = false;
			if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
			else if (event.key === 'ArrowUp' && event.target === framesButton) {
				event.preventDefault();
				setExpanded(true);
				stateButtons[selectedIndex].focus({ preventScroll: true });
			}
		});
		framesButton.addEventListener('pointerenter', event => { if (canHover(event)) setExpanded(true, { pin: false }); });
		framesButton.addEventListener('click', () => { if (pinned) dismiss(); else setExpanded(true); });
		context.addEventListener('click', () => { const index = contextIndex; clearSources(); lockHover(); onAction('select', index); });
		context.addEventListener('focus', () => { if (!pointerFocus && !dismissed) previewFrame(contextIndex, 'focus'); });
		context.addEventListener('blur', () => clearSource('focus'));
		for (const button of [playButton, replayButton]) button.addEventListener('click', () => {
			browseIntent = false;
			hoverFrameIndex = null;
			clearSources();
			lockHover();
			onAction(button.dataset.eu26Action);
		});
		timeline.addEventListener('pointerdown', event => {
			browseIntent = false;
			hoverFrameIndex = null;
			dragging = true;
			pointerId = event.pointerId;
			dismissed = false;
			controls.dataset.scrubbing = 'true';
			clearSources();
			lockHover();
			reflectContext();
		});
		for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) timeline.addEventListener(type, finishDrag);
		window.addEventListener('pointerup', finishDrag);
		window.addEventListener('pointercancel', finishDrag);
		window.addEventListener('pointerup', finishGesture);
		window.addEventListener('pointercancel', finishGesture);
		window.addEventListener('blur', () => { finishDrag(); finishGesture(); clearSources(); pendingRailY = null; pointerInside = false; focusInside = false; scheduleLens(null); refreshContext(); });
		const scrub = () => {
			browseIntent = false;
			hoverFrameIndex = null;
			dismissed = false;
			lockHover();
			onSeek(pageBased ? pageTime(timeline.value) : Number(timeline.value) * playbackRate);
			reflectContext();
		};
		timeline.addEventListener('input', scrub);
		timeline.addEventListener('change', scrub);
		timeline.addEventListener('keydown', event => {
			if (!pageBased || event.altKey || event.ctrlKey || event.metaKey) return;
			const direction = { ArrowUp: -1, ArrowLeft: -1, PageUp: -1, ArrowDown: 1, ArrowRight: 1, PageDown: 1 }[event.key];
			const target = event.key === 'Home' ? 0 : event.key === 'End' ? states.length - 1 : direction !== undefined ? clampIndex(selectedIndex + direction) : null;
			if (target === null) return;
			event.preventDefault();
			timeline.value = String(target);
			scrub();
		});
		list.addEventListener('pointerdown', event => {
			gestureActive = true;
			browseIntent = true;
			gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, position: horizontal ? list.scrollLeft : list.scrollTop, dragged: false };
		});
		list.addEventListener('lostpointercapture', finishGesture);
		list.addEventListener('wheel', () => { browseIntent = true; }, { passive: true });
		list.addEventListener('pointermove', event => {
			if (gesture && gesture.id === event.pointerId && Math.abs(event.clientX - gesture.x) + Math.abs(event.clientY - gesture.y) > 8) gesture.dragged = true;
		});
		list.addEventListener('scroll', () => {
			if (gesture && Math.abs((horizontal ? list.scrollLeft : list.scrollTop) - gesture.position) > 8) gesture.dragged = true;
			clearSource('hover');
			hoverLocked = true;
		}, { passive: true });
		for (const [index, choice] of stateButtons.entries()) {
			choice.addEventListener('click', event => {
				if (event.detail !== 0 && gesture?.dragged) { event.preventDefault(); return; }
				clearSources(); lockHover(); onAction('select', index);
			});
			choice.addEventListener('pointerleave', () => { hoverFrameIndex = null; clearSource('hover'); });
			choice.addEventListener('focus', () => {
				if (pointerFocus || !expanded) return;
				rovingIndex = index; syncTabStops(); scrollFrame(index); previewFrame(index, 'focus');
			});
			choice.addEventListener('blur', () => clearSource('focus'));
			choice.addEventListener('keydown', event => {
				let target;
				if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') target = Math.max(0, index - 1);
				else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') target = Math.min(states.length - 1, index + 1);
				else if (event.key === 'Home') target = 0;
				else if (event.key === 'End') target = states.length - 1;
				else return;
				event.preventDefault(); pointerFocus = false; stateButtons[target].focus({ preventScroll: true });
			});
		}
		document.addEventListener('pointerdown', event => { if (!controls.contains(event.target) && (expanded || contextVisible)) dismiss(); });
		document.addEventListener('keydown', event => {
			if (event.key === 'Escape' && (expanded || contextVisible) && !controls.contains(event.target)) { event.preventDefault(); dismiss(); }
		});
		document.addEventListener('visibilitychange', () => { if (document.hidden) { finishDrag(); finishGesture(); clearSources(); pendingRailY = null; scheduleLens(null); refreshContext(); } });
		loop.onReducedMotionChange(() => { scheduleLens(null); reflectContext(); });
		if (window.ResizeObserver) {
			const resize = new ResizeObserver(() => { geometryDirty = true; contextBoard.wake(); });
			resize.observe(ruler); resize.observe(context);
		}
		window.addEventListener('resize', () => { spacingDirty = geometryDirty = true; contextBoard.wake(); }, { passive: true });
		document.addEventListener('scroll', event => {
			if (horizontal && !controls.contains(event.target)) { geometryDirty = true; contextBoard.wake(); }
		}, { passive: true, capture: true });
		const render = ({ time, displayTime = time, selectedIndex: currentIndex, previewIndex, playAction, status }) => {
			const selectedChanged = currentIndex !== selectedIndex;
			selectedIndex = currentIndex;
			if (selectedChanged && expanded && !browsingFrames()) { rovingIndex = selectedIndex; scrollFrame(selectedIndex); syncTabStops(); }
			setIcon(playButton.querySelector('.eu26-dock-icon'), playAction === 'Pause' ? 'pause' : 'play', playAction === 'Pause' ? 'Ⅱ' : '▶');
			playButton.setAttribute('aria-label', `${playAction} ${horizontal && !pageBased ? 'video preview' : 'animation'}`);
			playButton.title = `${playAction} ${horizontal && !pageBased ? 'video preview' : 'animation'}`;
			playButton.setAttribute('aria-pressed', String(playAction === 'Pause'));
			timeline.value = String(pageBased ? pagePosition(time) : time / playbackRate);
			timeline.setAttribute('aria-valuetext', horizontal && !pageBased ? `${formatTime(time / playbackRate)} of ${formatTime(durationSeconds)}. ${states[selectedIndex].title}` : states[selectedIndex].title);
			if (horizontal && !pageBased) setText(elapsed, `${formatTime(Math.min(duration, time) / playbackRate)} / ${formatTime(durationSeconds)}`);
			setText(playbackStatus, status);
			for (const [index, choice] of stateButtons.entries()) {
				choice.setAttribute('aria-pressed', String(index === selectedIndex));
				if (index === selectedIndex) choice.setAttribute('aria-current', 'step');
				else choice.removeAttribute('aria-current');
				choice.toggleAttribute('data-preview', index === previewIndex);
			}
			fraction = pageBased ? pagePosition(displayTime) / Math.max(1, states.length - 1) : Math.max(0, Math.min(1, displayTime / duration));
			playbackFraction = Math.max(0, Math.min(1, time / duration));
			playbackSeconds = playbackFraction * durationSeconds;
			reflectContext();
			if (geometryDirty) measure();
			writePosition();
		};
		const getState = () => ({ orientation: horizontal ? 'horizontal' : 'vertical', navigation: pageBased ? 'pages' : 'time', expanded, pinned, dismissed, dragging, selectedIndex, hoverLocked, hoverIndex, focusIndex, gestureActive, browseIntent, contextVisible, contextIndex, contextFraction, contextY, activeTick, magnet: { x: magnet.x.value, y: magnet.y.value, amount: magnet.amount.value }, scrolling: scrollingUntil > performance.now() });
		const orient = () => {
			configureSpacing();
			const nextVideo = storyRoot?.dataset.storyMode === 'video';
			const nextHorizontal = nextVideo || storyRoot?.dataset.storyMode === 'slides';
			const nextPageBased = ['story', 'slides'].includes(storyRoot?.dataset.storyMode);
			controls.dataset.orientation = nextHorizontal ? 'horizontal' : 'vertical';
			controls.dataset.timelineView = storyRoot?.dataset.storyMode || 'story';
			if (horizontal === nextHorizontal && pageBased === nextPageBased) return;
			dismiss(); finishDrag(); finishGesture();
			const focused = controls.contains(document.activeElement) ? document.activeElement : null;
			const wasVideo = horizontal && !pageBased;
			horizontal = nextHorizontal;
			pageBased = nextPageBased;
			if (nextVideo && !wasVideo) {
				storyRoot.querySelector('[data-video-timeline]').append(controls);
				transport.append(replayButton); rulerGroup.append(elapsed, timestampLabels);
				playButton.dataset.videoAction = 'play'; replayButton.dataset.videoAction = 'replay'; timeline.dataset.videoProgress = '';
			} else if (!nextVideo && wasVideo) {
				home.after(controls); replayButton.remove();
				elapsed.remove(); timestampLabels.remove();
				tray.style.maxBlockSize = '';
				delete playButton.dataset.videoAction; delete replayButton.dataset.videoAction; delete timeline.dataset.videoProgress;
			}
			fullscreen.hidden = !nextVideo;
			timeline.setAttribute('aria-orientation', horizontal ? 'horizontal' : 'vertical');
			timeline.setAttribute('aria-label', nextVideo ? 'Video preview progress' : horizontal ? 'Slide navigation' : 'Chapter navigation');
			for (const state of Object.values(magnet)) { state.value = 0; state.velocity = 0; }
			latestPoint = pendingRailY = lastPointer = null; activeTick = -1; geometryDirty = true;
			buildTicks();
			dismissed = false;
			focused?.focus({ preventScroll: true }); contextBoard.wake();
		};
		storyRoot?.addEventListener('vpk:story-mode', orient);
		controls.dataset.expanded = 'false';
		controls.dataset.scrubbing = 'false';
		controls.dataset.contextVisible = 'false';
		tray.inert = true;
		tray.setAttribute('aria-hidden', 'true');
		context.inert = true;
		context.tabIndex = -1;
		context.setAttribute('aria-hidden', 'true');
		orient();
		window.__eu26Timeline = { getState, setExpanded, dismiss, showContext: () => { dismissed = false; pulseContext(); }, hideContext: dismiss };
		return { render, lockHover, stateButtons, announcement };
	};
})();
