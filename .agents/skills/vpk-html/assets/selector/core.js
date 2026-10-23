(function () {
	"use strict";

	var VERSION = "0.2.0";
	var utils = window.__VPK_HTML_SELECTOR_UTILS__;
	var uiFactory = window.__VPK_HTML_SELECTOR_UI__;
	var inspectApi = window.__VPK_HTML_SELECTOR_INSPECT__;
	var ICONS = utils.selectorIcons;
	var getRect = utils.getRect;
	var summarizeTag = utils.summarizeTag;
	var matchesShortcut = utils.matchesShortcut;
	var getComposedTarget = utils.getComposedTarget;
	var isReviewUiEvent = utils.isReviewUiEvent;
	if (!utils || !inspectApi) {
		return;
	}

	var DEFAULT_META = {
		agent: "codex",
		otherPagesCount: 0,
		otherPagesPinCount: 0,
	};
	var state = {
		active: false,
		activationMode: "toggle",
		agent: "codex",
		ancestryChain: [],
		ancestryIndex: -1,
		callbacks: {},
		commentElement: null,
		commentPin: null,
		configured: false,
		enabled: false,
		hoveredElement: null,
		mode: "idle",
			pagePath: "",
			pins: [],
			pinsMeta: DEFAULT_META,
			popoverReturnToContext: false,
			selectedElement: null,
			shortcuts: {},
			styleElement: null,
			styleReport: null,
		};
		var ui = null;
		var repositionFrame = 0;
		var commentsListOpen = false;
		var semanticTokensAttempted = false;
		var semanticTokensLoading = false;

	function callCallback(name, payload) {
		var callback = state.callbacks && state.callbacks[name];
		if (typeof callback !== "function") {
			return undefined;
		}
		try {
			return callback(payload);
		} catch {
			return undefined;
		}
	}

	function emitStateChange() {
		callCallback("onStateChange", {
			active: state.active,
			activationMode: state.activationMode,
			enabled: state.enabled,
			hoveredSelector: state.hoveredElement ? utils.buildSelectorPath(state.hoveredElement) : null,
		});
	}

	function ensureUI() {
		if (ui) {
			return ui;
		}
		if (!uiFactory || typeof uiFactory.createController !== "function") {
			return null;
		}
		ui = uiFactory.createController({
			icons: ICONS,
				callbacks: {
					onAgentChange: setAgent,
					onCommentRemove: removePin,
					onCommentSave: saveComment,
					onContextComment: function () {
						openCommentForActionElement("context");
					},
					onContextCopy: copyActionElement,
					onContextStyle: function () {
						openStyleForActionElement("context");
					},
					onCopyAll: requestCopyAll,
					onOpenPin: openPinComment,
					onPinClick: openPinComment,
				onSend: requestSend,
				onStyleEdit: applyStyleEdit,
				onStylePreview: previewStyleEdit,
				onToggleComments: toggleCommentsList,
				onToggleInspect: function () {
					state.active ? deactivate() : activate();
				},
				onTreePick: retargetAncestry,
			},
		});
		return ui;
	}

	function renderBar() {
		var controller = ensureUI();
		if (!controller) {
			return;
		}
		controller.renderBar({
			active: state.active,
			agent: state.agent,
			enabled: state.enabled,
			pinCount: state.pins.length,
		});
	}

	function renderAll() {
		renderBar();
		renderPins();
		if (commentsListOpen && ui) {
			ui.showCommentsList({ meta: state.pinsMeta, pins: state.pins });
		}
	}

	function isSelectorChrome(element) {
		var node = element;
		while (node && node !== document.body) {
			if (node.classList) {
				for (var index = 0; index < node.classList.length; index += 1) {
					if (String(node.classList[index]).startsWith("vpkhs-")) {
						return true;
					}
				}
			}
			node = node.parentElement;
		}
		return false;
	}

	function isInspectableElement(element) {
		if (!element || element === document.documentElement) {
			return false;
		}
		if (["SCRIPT", "STYLE", "LINK", "META", "TITLE"].indexOf(element.tagName) !== -1) {
			return false;
		}
		return !isSelectorChrome(element);
	}

	function findInspectableElement(pointX, pointY) {
		var disabled = [];
		var element = document.elementFromPoint(pointX, pointY);
		while (element && isSelectorChrome(element)) {
			disabled.push({ element: element, pointerEvents: element.style.pointerEvents });
			element.style.pointerEvents = "none";
			element = document.elementFromPoint(pointX, pointY);
		}
		for (var index = 0; index < disabled.length; index += 1) {
			disabled[index].element.style.pointerEvents = disabled[index].pointerEvents;
		}
		return isInspectableElement(element) ? element : null;
	}

	function createElementContext(element) {
		var selector = utils.buildSelectorPath(element);
		return {
			outerHtmlSnippet: utils.truncateOuterHtml(element, 500),
			pagePath: state.pagePath,
			rect: getRect(element),
			selector: selector,
			tagSummary: summarizeTag(element),
		};
	}

	function findPinBySelector(selector) {
		return state.pins.find(function (pin) {
			return pin.selector === selector;
		}) || null;
	}

	function queryPinTarget(pin) {
		try {
			return pin && pin.selector ? document.querySelector(pin.selector) : null;
		} catch {
			return null;
		}
	}

	function upsertLocalPin(pin, fallbackPayload) {
		if (!pin || !pin.id) {
			return;
		}
		var replaced = false;
		state.pins = state.pins.map(function (candidate) {
			if (candidate.id === pin.id || candidate.selector === pin.selector) {
				replaced = true;
				return Object.assign({}, candidate, pin);
			}
			return candidate;
		});
		if (!replaced) {
			state.pins = state.pins.concat([Object.assign({
				comment: "",
				createdAt: new Date().toISOString(),
				scope: "element",
			}, fallbackPayload || {}, pin)]);
		}
		renderAll();
	}

	function setHoverElement(element) {
		state.selectedElement = null;
		state.hoveredElement = element;
		state.ancestryChain = element ? utils.buildAncestryChain(element, 7) : [];
		state.ancestryIndex = state.ancestryChain.length - 1;
		updateTargetChrome(getActiveAncestryElement());
		emitStateChange();
	}

	function getActiveAncestryElement() {
		var entry = state.ancestryChain[state.ancestryIndex];
		return entry ? entry.element : state.hoveredElement;
	}

	function updateTargetChrome(element) {
		var controller = ensureUI();
		if (!controller) {
			return;
		}
		if (!element || !state.active || !state.enabled) {
			controller.setOverlay({ visible: false });
			controller.hideTree();
			return;
		}
		var rect = getRect(element);
		controller.setOverlay({
			label: summarizeTag(element) + "  " + utils.buildSelectorPath(element),
			rect: rect,
			visible: true,
		});
		if (state.mode === "cursor") {
			controller.showTree(state.ancestryChain.map(function (entry) {
				return {
					selector: entry.selector,
					tagSummary: entry.tagSummary,
				};
			}), state.ancestryIndex, rect);
		}
	}

	function retargetAncestry(index) {
		if (!state.ancestryChain[index]) {
			return;
		}
		state.ancestryIndex = index;
		state.hoveredElement = state.ancestryChain[index].element;
		updateTargetChrome(state.hoveredElement);
		emitStateChange();
	}

	function schedulePinRender() {
		if (repositionFrame) {
			return;
		}
		repositionFrame = window.requestAnimationFrame(function () {
			repositionFrame = 0;
			renderPins();
			updateTargetChrome(getActionElement());
		});
	}

	function renderPins() {
		var controller = ensureUI();
		if (!controller) {
			return;
		}
		var items = [];
		for (var index = 0; index < state.pins.length; index += 1) {
			var pin = state.pins[index];
			var target = queryPinTarget(pin);
			if (!target) {
				continue;
			}
			items.push({
				comment: pin.comment,
				id: pin.id,
				index: index,
				rect: getRect(target),
				selector: pin.selector,
				stale: pin.stale,
			});
		}
		controller.renderPins(items);
	}

		function isEditableTarget(target) {
		if (!target || !target.closest) {
			return false;
		}
		if (target.closest(".vpkhs-field")) {
			return true;
		}
			var editable = target.closest("input, textarea, select, [contenteditable='true']");
			return Boolean(editable);
		}

		function getVisibleLayerForTarget(target) {
			var node = target && target.nodeType === 1 ? target : target && target.parentElement;
			if (!node || typeof node.closest !== "function") {
				return null;
			}
			return node.closest(".vpkhs-popover.vpkhs-visible, .vpkhs-tree.vpkhs-visible");
		}

		function focusLayer(layer) {
			if (!layer || typeof layer.focus !== "function") {
				return;
			}
			try {
				layer.focus({ preventScroll: true });
			} catch {
				layer.focus();
			}
		}

		function blurEditableLayerTarget(target) {
			if (!isEditableTarget(target)) {
				return false;
			}
			var layer = getVisibleLayerForTarget(target);
			if (!layer) {
				return false;
			}
			if (typeof target.blur === "function") {
				target.blur();
			}
			focusLayer(layer);
			return true;
		}

		function getOpenLayers() {
			if (!ui || typeof ui.getOpenLayers !== "function") {
				return {};
			}
			return ui.getOpenLayers();
		}

		function clearPopoverState() {
			state.commentElement = null;
			state.commentPin = null;
			state.popoverReturnToContext = false;
			state.styleElement = null;
			state.styleReport = null;
		}

		function returnToCursorMode() {
			var element = getActionElement();
			state.selectedElement = null;
			state.mode = state.active ? "cursor" : "idle";
			clearPopoverState();
			updateTargetChrome(element);
			emitStateChange();
		}

		function returnToContextMenu(element) {
			if (!element || !ui) {
				returnToCursorMode();
				return;
			}
			clearPopoverState();
			state.hoveredElement = element;
			state.selectedElement = element;
			state.mode = "context";
			ui.showContextMenu({
				rect: getRect(element),
				summary: summarizeTag(element),
			});
			updateTargetChrome(element);
			emitStateChange();
		}

		function closeStylePopoverFromEscape() {
			var element = state.styleElement || state.selectedElement || getActionElement();
			if (ui) {
				ui.hideStylePopover();
			}
			if (state.popoverReturnToContext && element) {
				returnToContextMenu(element);
				return;
			}
			returnToCursorMode();
		}

		function closeCommentPopoverFromEscape() {
			var element = state.commentElement || state.selectedElement || getActionElement();
			if (ui) {
				ui.hideCommentPopover();
			}
			if (state.popoverReturnToContext && element) {
				returnToContextMenu(element);
				return;
			}
			returnToCursorMode();
		}

		function handleEscapeKey(event) {
			if (blurEditableLayerTarget(event.target)) {
				return true;
			}
			var layers = getOpenLayers();
			if (layers.agentPopover && ui) {
				ui.hideAgentPopover();
				return true;
			}
			if (layers.tree && ui) {
				ui.hideTree();
				return true;
			}
			if (layers.stylePopover) {
				closeStylePopoverFromEscape();
				return true;
			}
			if (layers.commentPopover) {
				closeCommentPopoverFromEscape();
				return true;
			}
			if (layers.contextMenu && ui) {
				ui.hideContextMenu();
				returnToCursorMode();
				return true;
			}
			if ((layers.commentsList || commentsListOpen) && ui) {
				ui.hideCommentsList();
				commentsListOpen = false;
				return true;
			}
			if (state.active) {
				deactivate();
				return true;
			}
			return false;
		}

	function handlePointerMove(event) {
		if (!state.configured || !state.enabled || !state.active || state.mode !== "cursor") {
			return;
		}
		if (isReviewUiEvent(event)) {
			return;
		}
		if (isSelectorChrome(event.target)) {
			return;
		}
		var element = findInspectableElement(event.clientX, event.clientY);
		if (element !== state.hoveredElement) {
			setHoverElement(element);
		}
	}

	function handleClick(event) {
		if (!state.configured || !state.enabled || !state.active || state.mode !== "cursor") {
			return;
		}
		if (isReviewUiEvent(event)) {
			return;
		}
		if (isSelectorChrome(event.target)) {
			return;
		}
		var target = findInspectableElement(event.clientX, event.clientY);
		if (!target) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		selectElement(target);
	}

	function handleKeyDown(event) {
		if (!state.configured) {
			return;
		}
		if (isReviewUiEvent(event)) {
			return;
		}

			if (event.key === "Escape") {
				if (handleEscapeKey(event)) {
					event.preventDefault();
					event.stopPropagation();
				}
				return;
			}

		if (isEditableTarget(getComposedTarget(event))) {
			return;
		}

		if (matchesShortcut(state.shortcuts.activate, event)) {
			event.preventDefault();
			if (state.activationMode === "hold") {
				activate();
			} else if (!event.repeat) {
				state.active ? deactivate() : activate();
			}
			return;
		}

		if (!state.enabled || !state.active) {
			return;
		}

		if (matchesShortcut(state.shortcuts.copyAll, event)) {
			event.preventDefault();
			requestCopyAll();
			return;
		}
		if (matchesShortcut(state.shortcuts.send, event)) {
			event.preventDefault();
			requestSend();
			return;
		}
		if (event.key === "ArrowUp" && state.ancestryIndex > 0) {
			event.preventDefault();
			retargetAncestry(state.ancestryIndex - 1);
			return;
		}
		if (event.key === "ArrowDown" && state.ancestryIndex < state.ancestryChain.length - 1) {
			event.preventDefault();
			retargetAncestry(state.ancestryIndex + 1);
			return;
		}
		if (event.key === "Enter" && state.mode === "cursor" && getActionElement()) {
			event.preventDefault();
			selectElement(getActionElement());
			return;
		}
			if (event.key === "Enter" && state.mode === "context" && getActionElement()) {
				event.preventDefault();
				openCommentForActionElement("context");
				return;
			}

		if (!getActionElement()) {
			return;
		}
		if (matchesShortcut(state.shortcuts.copyElement, event)) {
			event.preventDefault();
			copyActionElement();
			return;
		}
			if (matchesShortcut(state.shortcuts.comment, event)) {
				event.preventDefault();
				openCommentForActionElement(state.mode === "context" ? "context" : "shortcut");
				return;
			}
			if (matchesShortcut(state.shortcuts.styles, event)) {
				event.preventDefault();
				openStyleForActionElement(state.mode === "context" ? "context" : "shortcut");
			}
		}

	function handleKeyUp(event) {
		if (isReviewUiEvent(event)) {
			return;
		}
		if (
			state.configured
			&& state.activationMode === "hold"
			&& matchesShortcut(state.shortcuts.activate, event)
		) {
			event.preventDefault();
			deactivate();
		}
	}

	function getActionElement() {
		return state.selectedElement || getActiveAncestryElement() || state.hoveredElement;
	}

	function selectElement(element) {
		state.selectedElement = element;
		state.hoveredElement = element;
		state.mode = "context";
		if (ui) {
			ui.hideTree();
			ui.showContextMenu({
				rect: getRect(element),
				summary: summarizeTag(element),
			});
		}
		updateTargetChrome(element);
		emitStateChange();
	}

	function copyActionElement() {
		var element = getActionElement();
		if (!element) {
			return;
		}
		callCallback("onElementContextCopied", createElementContext(element));
	}

	function requestCopyAll() {
		callCallback("onCopyAllRequested", { pagePath: state.pagePath });
	}

	function requestSend() {
		callCallback("onSendRequested", { pagePath: state.pagePath });
	}

	function refreshStylePopover() {
		if (!ui || !state.styleElement || state.mode !== "style") {
			return;
		}
		var layers = getOpenLayers();
		if (!layers.stylePopover) {
			return;
		}
		var selector = utils.buildSelectorPath(state.styleElement);
		state.styleReport = state.styleReport || inspect(selector);
		ui.showStylePopover({
			rect: getRect(state.styleElement),
			rows: inspectApi.buildStyleRows(state.styleElement, state.styleReport),
			summary: summarizeTag(state.styleElement),
		});
	}

	function loadSemanticTokensForStylePopover() {
		if (semanticTokensAttempted || semanticTokensLoading) {
			return;
		}
		semanticTokensAttempted = true;
		if (typeof fetch !== "function" || !inspectApi || typeof inspectApi.setSemanticTokens !== "function") {
			return;
		}
		semanticTokensLoading = true;
		fetch("/api/html-selector/tokens", { cache: "no-store" })
			.then(function (response) {
				if (!response || !response.ok) {
					throw new Error("Token lookup failed");
				}
				return response.json();
			})
			.then(function (tokens) {
				semanticTokensLoading = false;
				inspectApi.setSemanticTokens(tokens);
				refreshStylePopover();
			})
			.catch(function () {
				semanticTokensLoading = false;
			});
	}

	function setAgent(agent) {
		if (["claude", "codex", "cursor", "rovo"].indexOf(agent) === -1) {
			return;
		}
		state.agent = agent;
		state.pinsMeta = Object.assign({}, state.pinsMeta, { agent: agent });
		callCallback("onAgentChange", { agent: agent });
		renderAll();
	}

	function openCommentForActionElement(source) {
		var element = getActionElement();
		if (element) {
			openCommentPopover(element, findPinBySelector(utils.buildSelectorPath(element)), source);
		}
	}

	function openPinComment(pinId) {
		var pin = state.pins.find(function (candidate) {
			return candidate.id === pinId;
		});
		var target = queryPinTarget(pin);
		if (!pin || !target) {
			notify({ type: "error", message: "Pinned element no longer exists on this page." });
			return;
		}
		openCommentPopover(target, pin, "pin");
	}

	function openCommentPopover(element, pin, source) {
		var returnToContext = source === "context" || (!source && state.mode === "context");
		state.commentElement = element;
		state.commentPin = pin || null;
		state.popoverReturnToContext = returnToContext;
		state.selectedElement = element;
		state.mode = "comment";
		if (ui) {
			ui.showCommentPopover({
				pin: pin,
				rect: getRect(element),
				summary: summarizeTag(element),
			});
		}
		updateTargetChrome(element);
	}

	function saveComment(payload) {
		if (!state.commentElement) {
			return;
		}
		var context = createElementContext(state.commentElement);
		var saved = callCallback("onPinSaved", Object.assign({}, context, {
			comment: payload.comment,
			scope: payload.scope,
		}));
		upsertLocalPin(saved, Object.assign({}, context, {
			comment: payload.comment,
			scope: payload.scope,
		}));
		if (ui) {
			ui.hideCommentPopover();
		}
		clearPopoverState();
		state.mode = state.active ? "cursor" : "idle";
	}

	function removePin(pinId) {
		callCallback("onPinRemoved", { id: pinId });
		state.pins = state.pins.filter(function (pin) {
			return pin.id !== pinId;
		});
		if (ui) {
			ui.closePopovers();
		}
		commentsListOpen = false;
		clearPopoverState();
		state.mode = state.active ? "cursor" : "idle";
		renderAll();
	}

	function openStyleForActionElement(source) {
		var element = getActionElement();
		if (!element) {
			return;
		}
		var report = inspect(utils.buildSelectorPath(element));
		var returnToContext = source === "context" || (!source && state.mode === "context");
		state.styleElement = element;
		state.styleReport = report;
		state.popoverReturnToContext = returnToContext;
		state.selectedElement = element;
		state.mode = "style";
		if (ui) {
			ui.showStylePopover({
				rect: getRect(element),
				rows: inspectApi.buildStyleRows(element, report),
				summary: summarizeTag(element),
			});
		}
		loadSemanticTokensForStylePopover();
		updateTargetChrome(element);
	}

	function previewStyleEdit(row, nextValue) {
		if (!state.styleElement) {
			return;
		}
		var value = String(nextValue);
		for (var index = 0; index < row.style.length; index += 1) {
			state.styleElement.style[row.style[index]] = value;
		}
		updateTargetChrome(state.styleElement);
	}

	function applyStyleEdit(row, nextValue) {
		if (!state.styleElement) {
			return;
		}
		var value = String(nextValue);
		previewStyleEdit(row, value);
		if (value === row.previousValue) {
			return;
		}
		var context = createElementContext(state.styleElement);
		var report = state.styleReport || inspect(context.selector);
		var saved = callCallback("onPinSaved", Object.assign({}, context, {
			styleEdits: [{
				nextValue: value,
				previousValue: row.previousValue || "",
				property: row.property,
			}],
			styleFindings: report,
		}));
		upsertLocalPin(saved, context);
		renderPins();
		updateTargetChrome(state.styleElement);
	}

	function toggleCommentsList() {
		var controller = ensureUI();
		if (!controller) {
			return;
		}
		if (commentsListOpen) {
			controller.hideCommentsList();
			commentsListOpen = false;
			return;
		}
		controller.showCommentsList({ meta: state.pinsMeta, pins: state.pins });
		commentsListOpen = true;
	}

	function inspect(pinIdOrSelector) {
		if (!state.configured) {
			return null;
		}
		var pin = state.pins.find(function (candidate) {
			return candidate.id === pinIdOrSelector || candidate.selector === pinIdOrSelector;
		});
		var selector = pin ? pin.selector : pinIdOrSelector;
		var element = null;
		try {
			element = selector ? document.querySelector(selector) : null;
		} catch {
			element = null;
		}
		if (!element) {
			return null;
		}
		var computed = window.getComputedStyle(element);
		var rect = getRect(element);
		return {
			computed: {
				box: {
					border: computed.borderTopWidth + " " + computed.borderRightWidth + " " + computed.borderBottomWidth + " " + computed.borderLeftWidth,
					margin: computed.marginTop + " " + computed.marginRight + " " + computed.marginBottom + " " + computed.marginLeft,
					padding: computed.paddingTop + " " + computed.paddingRight + " " + computed.paddingBottom + " " + computed.paddingLeft,
					size: rect.width + "x" + rect.height,
				},
				colors: {
					background: computed.backgroundColor,
					color: computed.color,
				},
				typography: {
					fontFamily: computed.fontFamily,
					fontSize: computed.fontSize,
					fontWeight: computed.fontWeight,
					lineHeight: computed.lineHeight,
				},
			},
			matchedRules: inspectApi.collectMatchedDeclarations(element),
			outerHtmlSnippet: utils.truncateOuterHtml(element, 500),
			pagePath: state.pagePath,
			rect: rect,
			selector: selector,
			tagSummary: summarizeTag(element),
		};
	}

	function configure(options) {
		state.configured = true;
		state.pagePath = options && options.pagePath ? String(options.pagePath) : "";
		state.shortcuts = options && options.shortcuts ? options.shortcuts : {};
		state.callbacks = options && options.callbacks ? options.callbacks : {};
		state.agent = options && options.agent ? options.agent : state.agent;
		state.pinsMeta = Object.assign({}, state.pinsMeta, { agent: state.agent });
		ensureUI();
		renderAll();
		emitStateChange();
	}

	function setEnabled(enabled) {
		if (!state.configured) {
			return;
		}
		state.enabled = Boolean(enabled);
			if (!state.enabled) {
				state.active = false;
				state.mode = "idle";
				state.hoveredElement = null;
				state.selectedElement = null;
				clearPopoverState();
				if (ui) {
					ui.closePopovers();
					ui.hideTree();
				ui.setOverlay({ visible: false });
			}
		}
		renderBar();
		emitStateChange();
	}

	function activate() {
		if (!state.configured || !state.enabled) {
			return;
		}
		state.active = true;
		state.mode = "cursor";
		renderBar();
		emitStateChange();
	}

	function deactivate() {
		if (!state.configured) {
			return;
		}
		state.active = false;
		state.mode = "idle";
			state.hoveredElement = null;
			state.selectedElement = null;
			state.ancestryChain = [];
			state.ancestryIndex = -1;
			clearPopoverState();
			if (ui) {
				ui.closePopovers();
				ui.hideTree();
			ui.setOverlay({ visible: false });
		}
		commentsListOpen = false;
		renderBar();
		emitStateChange();
	}

	function setActivationMode(mode) {
		if (!state.configured || ["toggle", "hold"].indexOf(mode) === -1) {
			return;
		}
		state.activationMode = mode;
		emitStateChange();
	}

	function setPins(pins, meta) {
		if (!state.configured) {
			return;
		}
		state.pins = Array.isArray(pins) ? pins.slice() : [];
		state.pinsMeta = Object.assign({}, DEFAULT_META, meta || {});
		state.agent = state.pinsMeta.agent || state.agent;
		renderAll();
	}

	function notify(notification) {
		if (!state.configured) {
			return;
		}
		var controller = ensureUI();
		if (controller) {
			controller.notify(notification || { type: "success", message: "" });
		}
	}

	function destroy() {
		state.active = false;
		state.enabled = false;
		state.configured = false;
			state.pins = [];
			state.hoveredElement = null;
			state.selectedElement = null;
			state.ancestryChain = [];
			state.ancestryIndex = -1;
			clearPopoverState();
			commentsListOpen = false;
		if (ui) {
			ui.destroy();
		}
		ui = null;
	}

	document.addEventListener("pointermove", handlePointerMove, true);
	document.addEventListener("click", handleClick, true);
	document.addEventListener("keydown", handleKeyDown, true);
	document.addEventListener("keyup", handleKeyUp, true);
	window.addEventListener("scroll", schedulePinRender, true);
	window.addEventListener("resize", schedulePinRender);

	window.__VPK_HTML_SELECTOR__ = {
		activate: activate,
		configure: configure,
		deactivate: deactivate,
		destroy: destroy,
		inspect: inspect,
		notify: notify,
		setActivationMode: setActivationMode,
		setEnabled: setEnabled,
		setPins: setPins,
		version: VERSION,
	};
})();
