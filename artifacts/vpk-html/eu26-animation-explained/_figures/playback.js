(() => {
	const loop = window.vpkFrameLoop;
	const models = JSON.parse(document.querySelector('[data-eu26-playback-model]').textContent);
	const players = new Map();
	const timeText = time => `${Math.floor(time / 60)}:${(time % 60).toFixed(1).padStart(4, '0')}`;
	const observer = new IntersectionObserver(entries => {
		for (const entry of entries) {
			const player = players.get(entry.target);
			player.visible = entry.isIntersecting && entry.intersectionRatio >= 0.35;
			if (player.visible && !player.manual && !loop.reducedMotion()) {
				if (player.time >= player.model.duration) player.seek(0);
				player.wantsPlay = true;
			}
			player.wake();
		}
	}, { threshold: [0, 0.35] });
	for (const model of models) {
		const figure = document.querySelector(`[data-vpk-figure="${model.id}"]`);
		const stage = figure.querySelector('[data-vpk-iso-stage]');
		const svg = figure.querySelector('svg');
		const restViewBox = svg.getAttribute('viewBox');
		figure.setAttribute('data-vpkh-no-lightbox', '');
		figure.classList.remove('vpkh-zoomable');
		svg.setAttribute('viewBox', model.viewBox.join(' '));
		const controls = document.querySelector(`[data-eu26-controls="${model.id}"]`);
		const button = controls.querySelector('button');
		const slider = controls.querySelector('input');
		const time = controls.querySelector('output');
		const status = controls.querySelector('[data-playback-status]');
		const readout = figure.querySelector('[data-vpk-iso-readout]');
		const animations = [];
		const easing = getComputedStyle(document.documentElement).getPropertyValue('--ease-in-out').trim() || 'ease-in-out';
		for (const track of model.tracks) {
			for (const element of svg.querySelectorAll(track.selector)) {
				element.style.transformOrigin = track.origin || '0px 0px';
				const animation = element.animate(track.frames.map(frame => ({ ...frame, easing: frame.easing || easing })), { duration: model.duration * 1000, fill: 'both' });
				animation.pause();
				animations.push(animation);
			}
		}
		const player = {
			model, time: loop.reducedMotion() ? model.duration : 0, visible: false,
			wantsPlay: false, manual: false, scrubbing: false, printing: false,
			seek(seconds) {
				this.time = Math.max(0, Math.min(model.duration, seconds));
				for (const animation of animations) animation.currentTime = this.time * 1000;
				slider.value = String(this.time);
				slider.setAttribute('aria-valuetext', `${timeText(this.time)} of ${timeText(model.duration)}`);
				time.textContent = `${timeText(this.time)} / ${timeText(model.duration)}`;
				const beat = model.beats.findLast(beat => beat.at <= this.time);
				status.textContent = beat.text;
				if (readout) readout.textContent = beat.text;
				figure.dataset.playbackTime = this.time.toFixed(3);
				this.sync();
			},
			sync() {
				const running = this.wantsPlay && this.visible && !document.hidden && !this.printing && !this.scrubbing && this.time < model.duration;
				figure.dataset.playbackState = running ? 'playing' : this.time >= model.duration ? 'ended' : 'paused';
				const action = running ? 'Pause' : this.time >= model.duration ? 'Replay' : 'Play';
				button.textContent = action;
				button.setAttribute('aria-label', `${action} ${model.title}`);
				return running;
			},
			wake() { this.sync(); board.wake(); },
		};
		const board = loop.register(stage, dt => {
			if (!player.sync()) return false;
			player.seek(player.time + dt);
			if (player.time >= model.duration) player.wantsPlay = false;
			return player.sync();
		}, { rest: () => {
			player.printing = true;
			svg.setAttribute('viewBox', restViewBox);
			for (const animation of animations) animation.cancel();
		} });
		button.addEventListener('click', () => {
			player.manual = true;
			if (player.time >= model.duration) player.seek(0);
			player.wantsPlay = !player.wantsPlay;
			player.wake();
		});
		const scrub = () => {
			player.manual = true;
			player.wantsPlay = false;
			player.seek(Number(slider.value));
		};
		slider.addEventListener('input', scrub);
		slider.addEventListener('change', scrub);
		slider.addEventListener('pointerdown', () => { player.scrubbing = true; player.wantsPlay = false; player.sync(); });
		const release = () => { player.scrubbing = false; player.sync(); };
		slider.addEventListener('pointerup', release);
		slider.addEventListener('pointercancel', release);
		slider.addEventListener('blur', release);
		controls.addEventListener('keydown', event => {
			if (event.target !== slider || event.key !== 'Escape') return;
			player.manual = true;
			player.wantsPlay = false;
			player.seek(0);
		});
		players.set(stage, player);
		player.restoreViewBox = () => svg.setAttribute('viewBox', model.viewBox.join(' '));
		observer.observe(stage);
		player.seek(player.time);
	}
	loop.onReducedMotionChange(reduced => {
		for (const player of players.values()) {
			player.wantsPlay = false;
			if (reduced) player.seek(player.model.duration);
			player.wake();
		}
	});
	document.addEventListener('visibilitychange', () => {
		for (const player of players.values()) player.wake();
	});
	window.addEventListener('afterprint', () => {
		for (const player of players.values()) {
			player.printing = false;
			player.restoreViewBox();
			player.seek(player.time);
			player.wake();
		}
	});
})();
