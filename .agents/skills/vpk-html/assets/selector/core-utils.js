(function () {
	"use strict";

	var SHARED_START = "/* vpk-shared:start */";
	var SHARED_END = "/* vpk-shared:end */";
	var ORIGIN_PRECEDENCE = {
		"design-system": 1,
		"page-local": 2,
		inline: 3,
	};

	function normalizeIdentifier(value) {
		return String(value == null ? "" : value).trim();
	}

	function escapeIdentifier(value) {
		var raw = normalizeIdentifier(value);
		if (!raw) {
			return "";
		}

		if (typeof CSS !== "undefined" && CSS.escape) {
			return CSS.escape(raw);
		}

		return raw.replace(/(^-?\d)|[^a-zA-Z0-9_-]/g, function (match, leadingDigit) {
			if (leadingDigit) {
				return "\\" + leadingDigit;
			}
			return "\\" + match;
		});
	}

	function getTagName(element) {
		return normalizeIdentifier(element && (element.localName || element.tagName || element.nodeName))
			.toLowerCase() || "element";
	}

	function getClassNames(element) {
		if (!element) {
			return [];
		}

		if (element.classList && typeof element.classList.length === "number") {
			var classes = [];
			for (var index = 0; index < element.classList.length; index += 1) {
				var className = normalizeIdentifier(element.classList[index]);
				if (className) {
					classes.push(className);
				}
			}
			return classes;
		}

		if (Array.isArray(element.classes)) {
			return element.classes.map(normalizeIdentifier).filter(Boolean);
		}

		if (typeof element.className === "string") {
			return element.className.split(/\s+/u).map(normalizeIdentifier).filter(Boolean);
		}

		return [];
	}

	function getOwnerDocument(element) {
		if (element && element.ownerDocument) {
			return element.ownerDocument;
		}
		if (typeof document !== "undefined") {
			return document;
		}
		return null;
	}

	function isUniqueSelector(element, selector) {
		var ownerDocument = getOwnerDocument(element);
		if (!ownerDocument || typeof ownerDocument.querySelectorAll !== "function") {
			return false;
		}

		try {
			var matches = ownerDocument.querySelectorAll(selector);
			return matches.length === 1 && matches[0] === element;
		} catch {
			return false;
		}
	}

	function getUniqueSelector(element) {
		var id = normalizeIdentifier(element && element.id);
		if (id) {
			var idSelector = "#" + escapeIdentifier(id);
			if (isUniqueSelector(element, idSelector)) {
				return idSelector;
			}
		}

		var classNames = getClassNames(element);
		if (classNames.length > 0) {
			var classSelector = getTagName(element) + classNames.map(function (className) {
				return "." + escapeIdentifier(className);
			}).join("");
			if (isUniqueSelector(element, classSelector)) {
				return classSelector;
			}
		}

		return null;
	}

	function getElementChildren(parent) {
		var rawChildren = parent && (parent.children || parent.childNodes);
		if (!rawChildren) {
			return [];
		}

		return Array.prototype.slice.call(rawChildren).filter(function (node) {
			return !node.nodeType || node.nodeType === 1;
		});
	}

	function getNthOfType(element) {
		var parent = element && (element.parentElement || element.parentNode);
		if (!parent) {
			return 1;
		}

		var tagName = getTagName(element);
		var sameTypeIndex = 0;
		var children = getElementChildren(parent);
		for (var index = 0; index < children.length; index += 1) {
			if (getTagName(children[index]) === tagName) {
				sameTypeIndex += 1;
			}
			if (children[index] === element) {
				return sameTypeIndex;
			}
		}

		return 1;
	}

	function buildSelectorPath(element) {
		if (!element) {
			return "";
		}

		var directUniqueSelector = getUniqueSelector(element);
		if (directUniqueSelector) {
			return directUniqueSelector;
		}

		var segments = [];
		var node = element;
		while (node && (!node.nodeType || node.nodeType === 1)) {
			var uniqueSelector = getUniqueSelector(node);
			if (uniqueSelector) {
				segments.unshift(uniqueSelector);
				break;
			}

			var tagName = getTagName(node);
			segments.unshift(tagName + ":nth-of-type(" + getNthOfType(node) + ")");
			if (tagName === "html") {
				break;
			}

			node = node.parentElement || node.parentNode || null;
		}

		return segments.join(" > ");
	}

	function splitSharedAndLocalCss(cssText) {
		var text = String(cssText == null ? "" : cssText);
		var startIndex = text.indexOf(SHARED_START);
		var endIndex = text.indexOf(SHARED_END);
		if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
			return {
				shared: "",
				local: text,
				hasSharedBlock: false,
			};
		}

		var sharedContentStart = startIndex + SHARED_START.length;
		var localBefore = text.slice(0, startIndex);
		var shared = text.slice(sharedContentStart, endIndex);
		var localAfter = text.slice(endIndex + SHARED_END.length);
		return {
			shared: shared,
			local: localBefore + localAfter,
			hasSharedBlock: true,
		};
	}

	function getPropertyValue(name, propMap) {
		if (!propMap) {
			return "";
		}
		if (typeof propMap.get === "function") {
			return propMap.get(name) || "";
		}
		return propMap[name] || "";
	}

	function normalizeVarName(name) {
		var normalized = normalizeIdentifier(name);
		return normalized.startsWith("--") ? normalized : "--" + normalized;
	}

	function resolveVarChain(name, propMap) {
		var chain = [];
		var currentName = normalizeVarName(name);
		var seen = new Set();

		for (var depth = 0; depth < 20; depth += 1) {
			if (!currentName || seen.has(currentName)) {
				break;
			}
			seen.add(currentName);

			var value = normalizeIdentifier(getPropertyValue(currentName, propMap));
			chain.push({ name: currentName, value: value });
			var nested = value.match(/var\(\s*(--[a-zA-Z0-9_-]+)/u);
			if (!nested) {
				break;
			}
			currentName = nested[1];
		}

		return chain;
	}

	function toSpecificityScore(specificity) {
		if (Array.isArray(specificity)) {
			return (specificity[0] || 0) * 10000 + (specificity[1] || 0) * 100 + (specificity[2] || 0);
		}
		if (typeof specificity === "number" && Number.isFinite(specificity)) {
			return specificity;
		}
		return 0;
	}

	function compareDeclarations(left, right) {
		if (Boolean(left.important) !== Boolean(right.important)) {
			return left.important ? 1 : -1;
		}

		var leftOrigin = ORIGIN_PRECEDENCE[left.origin] || 0;
		var rightOrigin = ORIGIN_PRECEDENCE[right.origin] || 0;
		if (leftOrigin !== rightOrigin) {
			return leftOrigin - rightOrigin;
		}

		var leftSpecificity = toSpecificityScore(left.specificity);
		var rightSpecificity = toSpecificityScore(right.specificity);
		if (leftSpecificity !== rightSpecificity) {
			return leftSpecificity - rightSpecificity;
		}

		return (left.sourceOrder || 0) - (right.sourceOrder || 0);
	}

	function classifyDeclarations(declarations) {
		var groups = new Map();
		var normalized = (Array.isArray(declarations) ? declarations : []).map(function (declaration, index) {
			return {
				origin: declaration.origin || "page-local",
				property: normalizeIdentifier(declaration.property),
				value: declaration.value == null ? "" : String(declaration.value),
				selector: declaration.selector || "",
				specificity: declaration.specificity || 0,
				sourceOrder: typeof declaration.sourceOrder === "number" ? declaration.sourceOrder : index,
				important: Boolean(declaration.important),
				varChain: declaration.varChain || null,
			};
		}).filter(function (declaration) {
			return declaration.property.length > 0;
		});

		for (var index = 0; index < normalized.length; index += 1) {
			var declaration = normalized[index];
			var existingGroup = groups.get(declaration.property) || [];
			existingGroup.push(declaration);
			groups.set(declaration.property, existingGroup);
		}

		var winners = {};
		var annotated = [];
		groups.forEach(function (group, property) {
			var winner = group[0];
			for (var index = 1; index < group.length; index += 1) {
				if (compareDeclarations(winner, group[index]) <= 0) {
					winner = group[index];
				}
			}

			var hasDesignSystemDeclaration = group.some(function (declaration) {
				return declaration.origin === "design-system";
			});
			winners[property] = winner;

			for (var itemIndex = 0; itemIndex < group.length; itemIndex += 1) {
				var item = group[itemIndex];
				var isWinner = item === winner;
				var shadowsDesignSystem = isWinner
					&& hasDesignSystemDeclaration
					&& (item.origin === "page-local" || item.origin === "inline");
				annotated.push(Object.assign({}, item, {
					winner: isWinner,
					overridden: !isWinner,
					override: shadowsDesignSystem,
					tokenOverride: shadowsDesignSystem && item.property.startsWith("--"),
				}));
			}
		});

		return {
			declarations: annotated.sort(function (left, right) {
				return (left.sourceOrder || 0) - (right.sourceOrder || 0);
			}),
			winners: winners,
		};
	}

	function truncateOuterHtml(element, maxChars) {
		var limit = Number.isFinite(maxChars) ? Math.max(0, Math.floor(maxChars)) : 500;
		var html = element && typeof element.outerHTML === "string"
			? element.outerHTML
			: String(element == null ? "" : element);
		if (html.length <= limit) {
			return html;
		}
		if (limit <= 3) {
			return html.slice(0, limit);
		}
		return html.slice(0, limit - 3) + "...";
	}

	function summarizeAncestryNode(element) {
		var tagName = getTagName(element);
		var id = normalizeIdentifier(element && element.id);
		var classes = getClassNames(element).slice(0, 2);
		return tagName + (id ? "#" + id : "") + (classes.length ? "." + classes.join(".") : "");
	}

	function buildAncestryChain(element, maxDepth) {
		var limit = Number.isFinite(maxDepth) ? Math.max(1, Math.floor(maxDepth)) : 7;
		var chain = [];
		var node = element;
		while (node && (!node.nodeType || node.nodeType === 1)) {
			chain.unshift({
				element: node,
				selector: buildSelectorPath(node),
				tagSummary: summarizeAncestryNode(node),
			});
			node = node.parentElement || node.parentNode || null;
		}
		if (chain.length > limit) {
			return chain.slice(chain.length - limit);
		}
		return chain;
	}

	// SELECTOR_ICONS:start
	var SELECTOR_ICONS = {
		chevronUp: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"12\" height=\"12\" fill=\"currentColor\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentcolor\" d=\"m14.53 9.97-6-6a.75.75 0 0 0-1.004-.052l-.056.052-6 6 1.06 1.06L8 5.56l5.47 5.47z\"/></svg>",
		chevronDown: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"12\" height=\"12\" fill=\"currentColor\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentcolor\" d=\"m14.53 6.03-6 6a.75.75 0 0 1-1.004.052l-.056-.052-6-6 1.06-1.06L8 10.44l5.47-5.47z\"/></svg>",
		comment: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"12\" height=\"12\" fill=\"currentColor\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentcolor\" fill-rule=\"evenodd\" d=\"M0 3.125A2.625 2.625 0 0 1 2.625.5h10.75A2.625 2.625 0 0 1 16 3.125v8.25A2.625 2.625 0 0 1 13.375 14H4.449l-3.327 1.901A.75.75 0 0 1 0 15.25zM2.625 2C2.004 2 1.5 2.504 1.5 3.125v10.833L4.05 12.5h9.325c.621 0 1.125-.504 1.125-1.125v-8.25C14.5 2.504 13.996 2 13.375 2zM12 6.5H4V5h8zm-3 3H4V8h5z\" clip-rule=\"evenodd\"/></svg>",
		copy: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"12\" height=\"12\" fill=\"currentColor\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentcolor\" fill-rule=\"evenodd\" d=\"M1 3a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2zm2-.5a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V3a.5.5 0 0 0-.5-.5zM16 6v6.75A3.25 3.25 0 0 1 12.75 16H6v-1.5h6.75a1.75 1.75 0 0 0 1.75-1.75V6z\" clip-rule=\"evenodd\"/></svg>",
		cursor: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"12\" height=\"12\" fill=\"currentColor\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentcolor\" fill-rule=\"evenodd\" d=\"M2.827 2.827 6.914 13.23l1.272-4.134c.134-.436.474-.776.91-.91l4.134-1.272zm-1.5.282C.886 1.99 1.99.887 3.108 1.326L14.11 5.648c1.21.476 1.145 2.212-.099 2.594L9.6 9.6l-1.358 4.412c-.382 1.244-2.118 1.31-2.594.099z\" clip-rule=\"evenodd\"/></svg>",
		send: "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" width=\"12\" height=\"12\" fill=\"currentColor\" aria-hidden=\"true\" focusable=\"false\"><path fill=\"currentcolor\" fill-rule=\"evenodd\" d=\"M14.78 1.22a.75.75 0 0 1 .173.79l-5 13.5a.75.75 0 0 1-1.361.1l-2.895-5.307L.391 7.408A.75.75 0 0 1 .49 6.047l13.5-5a.75.75 0 0 1 .79.173M7.177 9.884l1.942 3.56 3.237-8.74zm4.118-6.24L2.556 6.881l3.56 1.942z\" clip-rule=\"evenodd\"/></svg>",
	};
	// SELECTOR_ICONS:end

	function getRect(element) {
		var rect = element.getBoundingClientRect();
		return {
			bottom: Math.round(rect.bottom),
			height: Math.round(rect.height),
			left: Math.round(rect.left),
			right: Math.round(rect.right),
			top: Math.round(rect.top),
			width: Math.round(rect.width),
		};
	}

	function summarizeTag(element) {
		var tagName = (element.localName || element.tagName || "element").toLowerCase();
		var id = element.id ? "#" + element.id : "";
		var classes = Array.prototype.slice.call(element.classList || []).slice(0, 3);
		return tagName + id + (classes.length ? "." + classes.join(".") : "");
	}

	function matchesShortcut(shortcut, event) {
		if (!shortcut || !shortcut.key) {
			return false;
		}
		if (String(shortcut.key).toLowerCase() !== String(event.key).toLowerCase()) {
			return false;
		}
		if (shortcut.metaOrCtrl !== undefined && Boolean(event.metaKey || event.ctrlKey) !== Boolean(shortcut.metaOrCtrl)) {
			return false;
		}
		if (shortcut.shift !== undefined && Boolean(event.shiftKey) !== Boolean(shortcut.shift)) {
			return false;
		}
		if (shortcut.alt !== undefined && Boolean(event.altKey) !== Boolean(shortcut.alt)) {
			return false;
		}
		return true;
	}

	// The element an event really started on. Events from a shadow root (the vpk-review UI)
	// retarget to their host, so capture-phase document handlers read composedPath()[0].
	function getComposedTarget(event) {
		var path = event && typeof event.composedPath === "function" ? event.composedPath() : [];
		var first = path && path.length ? path[0] : null;
		if (first && first.nodeType === 1) {
			return first;
		}
		return event ? event.target : null;
	}

	// True when the event passed through the vpk-review UI host ([data-vpk-review-ui]).
	function isReviewUiEvent(event) {
		var path = event && typeof event.composedPath === "function" ? event.composedPath() : [];
		for (var index = 0; path && index < path.length; index++) {
			var node = path[index];
			if (node && node.nodeType === 1 && typeof node.hasAttribute === "function" && node.hasAttribute("data-vpk-review-ui")) {
				return true;
			}
		}
		return false;
	}

	var api = {
		getComposedTarget: getComposedTarget,
		isReviewUiEvent: isReviewUiEvent,
		selectorIcons: SELECTOR_ICONS,
		getRect: getRect,
		summarizeTag: summarizeTag,
		matchesShortcut: matchesShortcut,
		buildAncestryChain: buildAncestryChain,
		buildSelectorPath: buildSelectorPath,
		classifyDeclarations: classifyDeclarations,
		resolveVarChain: resolveVarChain,
		splitSharedAndLocalCss: splitSharedAndLocalCss,
		truncateOuterHtml: truncateOuterHtml,
	};

	if (typeof window !== "undefined") {
		window.__VPK_HTML_SELECTOR_UTILS__ = api;
	}
	if (typeof module !== "undefined" && module.exports) {
		module.exports = api;
	}
})();
