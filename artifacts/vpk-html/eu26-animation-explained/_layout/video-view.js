(() => {
	function mountPreview() {
		const root = document.querySelector('[data-vpk-story]');
		const panel = root?.querySelector('[data-story-video]');
		const explorer = window.__eu26Explorer;
		const island = document.querySelector('[data-eu26-explorer-model]');
		if (!root || !panel || !explorer || !island || root.dataset.videoMounted) return;
		let model = null;
		try { model = JSON.parse(island.textContent || ''); } catch { return; }
		const duration = Number(model?.duration);
		if (!(duration > 0)) return;
		const active = () => root.dataset.storyMode === 'video';
		const generateButton = panel.querySelector('[data-video-action="generate"]');
		const status = panel.querySelector('[data-video-status]');
		const download = panel.querySelector('[data-video-download]');
		let exportStatus = 'idle', pollTimer = null;
		// The timeline's own aria-valuetext names the chapter, so Video shows no separate chapter line.
		const sync = () => {};
		// Export messages are announced through the screen-reader status and shown on Generate itself (label while busy,
		// tooltip otherwise), so the player keeps no status line under the timeline.
		const renderState = (message, busy = false) => {
			status.textContent = message;
			generateButton.disabled = busy;
			generateButton.setAttribute('aria-busy', String(busy));
			generateButton.textContent = busy ? 'Generating…' : 'Generate video';
			if (message && !busy) generateButton.dataset.tip = message;
			else delete generateButton.dataset.tip;
		};
		const readConfig = () => JSON.parse(document.querySelector('[data-vpk-video-export]')?.textContent || '{}');
		const generate = async () => {
			if (exportStatus === 'running') return;
			const config = readConfig();
			if (!config.endpoint) { renderState('Open the export-enabled preview to generate a video.'); return; }
			exportStatus = 'running'; download.hidden = true;
			renderState('Preparing your video…', true);
			try {
				const result = await fetch(config.endpoint, {
					method: 'POST', headers: { 'Content-Type': 'application/json', 'X-VPK-Render-Key': config.token || '' },
					body: JSON.stringify({ variant: explorer.getState().variant, theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light' }),
				});
				if (!result.ok) throw new Error('The video could not be started.');
				const job = await result.json();
				const statusUrl = new URL(job.statusUrl, config.endpoint).href;
				const poll = async () => {
					try {
						const response = await fetch(statusUrl, { headers: { 'X-VPK-Render-Key': config.token || '' } });
						if (!response.ok) throw new Error('The video status is unavailable.');
						const current = await response.json();
						if (current.status === 'complete') {
							exportStatus = 'complete';
							download.href = new URL(current.downloadUrl, config.endpoint).href;
							download.hidden = false; renderState('Your video is ready.'); return;
						}
						if (current.status === 'failed') throw new Error(current.error || 'Video generation failed.');
						renderState('Generating your video…', true);
						pollTimer = window.setTimeout(poll, 1000);
					} catch (error) { exportStatus = 'failed'; renderState(error.message); }
				};
				await poll();
			} catch { exportStatus = 'failed'; renderState('The local exporter is unavailable. Open the export-enabled preview and try again.'); }
		};
		root.querySelector('[data-video-action="fullscreen"]').addEventListener('click', () => {
			const stage = root.querySelector('.story-layout');
			if (document.fullscreenElement) document.exitFullscreen?.();
			else stage.requestFullscreen?.();
		});
		generateButton.addEventListener('click', generate);
		// Generate lives in the timeline's action row, after Fullscreen, so the player has no separate title bar.
		const fullscreenButton = root.querySelector('[data-video-action="fullscreen"]');
		if (fullscreenButton) fullscreenButton.after(generateButton, download);
		root.addEventListener('eu26:state', sync);
		root.addEventListener('vpk:story-mode', event => {
			if (event.detail.mode !== 'video') return;
			if (explorer.getState().time > duration) explorer.seek(0);
			sync();
		});
		root.dataset.videoMounted = 'true';
		window.__vpkVideoPreview = { getState: () => ({ kind: 'html', active: active(), ...explorer.getState(), exportStatus }), sync };
		window.addEventListener('pagehide', () => { if (pollTimer !== null) window.clearTimeout(pollTimer); });
		sync();
	}
	if (document.readyState === 'complete') mountPreview();
	else window.addEventListener('load', mountPreview, { once: true });
})();
