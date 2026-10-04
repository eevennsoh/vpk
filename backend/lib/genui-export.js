/**
 * GenUI export orchestrator.
 * Accepts a json-render spec and renders it to PDF, PNG, SVG, or React code.
 *
 * All renderers use their own internal catalogs/registries — the spec is first
 * mapped from the React catalog to the target format by this module's mapSpec().
 */

const { loadFonts } = require("./genui-export-fonts");

// ── Lazy imports (heavy modules, loaded on first use) ────────────

let _pdfRenderer = null;
let _imageRenderer = null;

function getPdfRenderer() {
	if (!_pdfRenderer) _pdfRenderer = require("@json-render/react-pdf");
	return _pdfRenderer;
}

function getImageRenderer() {
	if (!_imageRenderer) _imageRenderer = require("@json-render/image");
	return _imageRenderer;
}

// ── State resolution ─────────────────────────────────────────────

function getByPath(obj, pathStr) {
	if (!obj || !pathStr) return undefined;
	const segments = pathStr.replace(/^\//, "").split("/");
	let current = obj;
	for (const seg of segments) {
		if (current == null || typeof current !== "object") return undefined;
		current = current[seg];
	}
	return current;
}

function resolveValue(value, state) {
	if (value == null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map((v) => resolveValue(v, state));

	if (typeof value.$state === "string") return getByPath(state, value.$state);
	if (typeof value.$bindState === "string") return getByPath(state, value.$bindState);
	if ("$cond" in value) return undefined;

	const resolved = {};
	for (const key of Object.keys(value)) {
		resolved[key] = resolveValue(value[key], state);
	}
	return resolved;
}

function resolveProps(props, state) {
	const resolved = {};
	for (const [key, val] of Object.entries(props)) {
		resolved[key] = resolveValue(val, state);
	}
	return resolved;
}

// ── Component mapping (React catalog → target format) ────────────

const CHART_TYPES = new Set(["BarChart", "LineChart", "PieChart", "AreaChart", "RadarChart"]);
const THREE_D_TYPES = new Set(["Scene3D", "Group3D", "Box", "Sphere", "Cylinder", "Cone", "Torus", "Plane", "Ring", "AmbientLight", "PointLight", "DirectionalLight", "Stars", "Label3D"]);
const INPUT_TYPES = new Set(["TextInput", "TextArea", "SelectInput", "RadioGroup", "Checkbox", "Switch", "Slider", "Toggle", "ToggleGroup", "DatePicker", "TimePicker", "DateTimePicker", "InlineEdit", "InputOTP", "Calendar"]);

let _keyCounter = 0;
function uid(prefix = "m") { return `${prefix}_${++_keyCounter}`; }
function str(v) { return v == null ? "" : typeof v === "string" ? v : String(v); }

// ── PDF mapping ──────────────────────────────────────────────────

function mapElementForPdf(type, props, children, elements) {
	if (type === "Stack") return { type: "View", props: { style: { flexDirection: props.direction === "horizontal" ? "row" : "column", gap: props.gap === "lg" ? 16 : props.gap === "md" ? 10 : 6 } }, children };
	if (type === "Card") return { type: "View", props: { style: { border: "1pt solid #DFE1E6", borderRadius: 6, padding: 12, marginBottom: 8 } }, children };
	if (type === "Grid") {
		// Wrap each child in a View with flex:1 so they fill equal horizontal space
		const wrappedChildren = (children || []).map((childKey) => {
			const wk = uid("pgw");
			elements[wk] = { type: "View", props: { style: { flex: 1 } }, children: [childKey] };
			return wk;
		});
		return { type: "View", props: { style: { flexDirection: "row", gap: 10 } }, children: wrappedChildren };
	}
	if (type === "Heading") return { type: "Heading", props: { text: str(props.text), level: props.level || "h2" } };
	if (type === "Text") return { type: "Text", props: { text: str(props.content), style: props.muted ? { color: "#666666" } : {} } };
	if (type === "Table") {
		const columns = (props.columns || []).map((c) => ({ header: c.label || c.key, width: `${Math.floor(100 / Math.max((props.columns || []).length, 1))}%` }));
		const data = Array.isArray(props.data) ? props.data : [];
		const colKeys = (props.columns || []).map((c) => c.key);
		const rows = data.map((row) => colKeys.map((key) => str(row[key])));
		return { type: "Table", props: { columns, rows } };
	}
	if (type === "Image") return { type: "Image", props: { src: str(props.src), style: { width: props.width || 200, height: props.height || 100 } } };
	if (type === "Link") return { type: "Link", props: { href: str(props.href), text: str(props.text) } };
	if (type === "Separator") return { type: "Divider", props: {} };
	if (type === "Button") return { type: "Text", props: { text: `[${str(props.label)}]`, style: { color: "#0052CC" } } };
	if (type === "Badge" || type === "Lozenge" || type === "Tag" || type === "Code") return { type: "Text", props: { text: str(props.text), style: { fontSize: 10 } } };
	if (type === "Breadcrumb") return { type: "Text", props: { text: (props.items || []).map((i) => i.label).join(" > "), style: { fontSize: 10 } } };
	// Metric → bordered card with label + value + detail
	if (type === "Metric") {
		const metricChildren = [];
		const labelKey = uid("pm_l");
		elements[labelKey] = { type: "Text", props: { text: str(props.label), style: { fontSize: 10, color: "#626F86" } } };
		metricChildren.push(labelKey);
		const valueKey = uid("pm_v");
		elements[valueKey] = { type: "Text", props: { text: str(props.value), style: { fontSize: 18, fontWeight: "bold" } } };
		metricChildren.push(valueKey);
		if (props.detail) {
			const detailKey = uid("pm_d");
			const trendColor = props.trend === "up" ? "#216E4E" : props.trend === "down" ? "#AE2E24" : "#626F86";
			elements[detailKey] = { type: "Text", props: { text: str(props.detail), style: { fontSize: 9, color: trendColor } } };
			metricChildren.push(detailKey);
		}
		return { type: "View", props: { style: { border: "1pt solid #DFE1E6", borderRadius: 6, padding: 12, flex: 1 } }, children: metricChildren };
	}
	// Alert / SectionMessage / Callout
	if (type === "Alert" || type === "SectionMessage" || type === "Callout") {
		const alertChildren = [];
		if (props.title) {
			const tk = uid("pa_t");
			elements[tk] = { type: "Text", props: { text: str(props.title), style: { fontWeight: "bold", fontSize: 11 } } };
			alertChildren.push(tk);
		}
		const desc = str(props.description || props.content || "");
		if (desc) {
			const dk = uid("pa_d");
			elements[dk] = { type: "Text", props: { text: desc, style: { fontSize: 10 } } };
			alertChildren.push(dk);
		}
		return { type: "View", props: { style: { backgroundColor: "#DEEBFF", padding: 10, borderRadius: 4, marginBottom: 8 } }, children: alertChildren };
	}
	if (type === "Banner") {
		const bk = uid("pb_t");
		elements[bk] = { type: "Text", props: { text: str(props.text), style: { fontSize: 10 } } };
		return { type: "View", props: { style: { backgroundColor: "#FFF7D6", padding: 8 } }, children: [bk] };
	}
	// Timeline
	if (type === "Timeline") {
		const tlChildren = (props.items || []).map((item) => {
			const ek = uid("ptl");
			elements[ek] = { type: "Text", props: { text: `${str(item.title)}${item.description ? ` — ${str(item.description)}` : ""}`, style: { fontSize: 10 } } };
			return ek;
		});
		return { type: "View", props: { style: { marginBottom: 8 } }, children: tlChildren };
	}
	// Accordion
	if (type === "Accordion") {
		const accChildren = (props.items || []).flatMap((item) => {
			const tk = uid("pac_t");
			elements[tk] = { type: "Text", props: { text: str(item.title), style: { fontWeight: "bold", fontSize: 11 } } };
			const ck = uid("pac_c");
			elements[ck] = { type: "Text", props: { text: str(item.content), style: { fontSize: 10, marginBottom: 6 } } };
			return [tk, ck];
		});
		return { type: "View", props: {}, children: accChildren };
	}
	// PageHeader
	if (type === "PageHeader") {
		const phChildren = [];
		const tk = uid("pph_t");
		elements[tk] = { type: "Heading", props: { text: str(props.title), level: "h1" } };
		phChildren.push(tk);
		if (props.description) {
			const dk = uid("pph_d");
			elements[dk] = { type: "Text", props: { text: str(props.description), style: { color: "#626F86" } } };
			phChildren.push(dk);
		}
		return { type: "View", props: { style: { marginBottom: 12 } }, children: phChildren };
	}
	// Comment
	if (type === "Comment") {
		const commentChildren = [];
		const ak = uid("pcm_a");
		elements[ak] = { type: "Text", props: { text: `${str(props.author)}${props.time ? ` · ${str(props.time)}` : ""}`, style: { fontWeight: "bold", fontSize: 10 } } };
		commentChildren.push(ak);
		const bk = uid("pcm_b");
		elements[bk] = { type: "Text", props: { text: str(props.content), style: { fontSize: 10 } } };
		commentChildren.push(bk);
		return { type: "View", props: { style: { marginBottom: 8 } }, children: commentChildren };
	}
	// Progress
	if (type === "Progress" || type === "ProgressBar") return { type: "Text", props: { text: `${str(props.label || "Progress")}: ${props.value ?? 0}%`, style: { fontSize: 10 } } };
	if (type === "Pagination") return { type: "Text", props: { text: `Page ${props.currentPage ?? 1} of ${props.totalPages ?? 1}`, style: { fontSize: 10 } } };
	if (type === "Avatar") return { type: "Text", props: { text: str(props.fallback), style: { fontSize: 10, fontWeight: "bold" } } };
	if (type === "EmptyState") {
		const esChildren = [];
		const tk = uid("pes_t");
		elements[tk] = { type: "Text", props: { text: str(props.title), style: { fontWeight: "bold" } } };
		esChildren.push(tk);
		if (props.description) {
			const dk = uid("pes_d");
			elements[dk] = { type: "Text", props: { text: str(props.description), style: { color: "#626F86", fontSize: 10 } } };
			esChildren.push(dk);
		}
		return { type: "View", props: { style: { padding: 16 } }, children: esChildren };
	}
	if (type === "MapWidget") return { type: "Text", props: { text: `Map: ${(props.markers || []).map((m) => m.title).join(", ") || "No markers"}`, style: { color: "#626F86", fontSize: 10 } } };
	// Passthrough containers
	if (["Tabs", "TabContent", "ScrollArea", "AspectRatio", "Carousel", "Dialog", "Tooltip", "Collapsible", "ButtonGroup", "TagGroup", "AccordionForm"].includes(type)) return { type: "View", props: {}, children };
	if (type === "Spinner" || type === "Skeleton") return null;
	return null;
}

// ── Image mapping ────────────────────────────────────────────────
// @json-render/image uses FLAT PROPS, not CSS style objects.
// Box: padding, borderWidth, borderColor, borderRadius, backgroundColor, flex, flexDirection, alignItems, width, height
// Row: gap, alignItems, justifyContent, padding, flex, wrap
// Column: gap, alignItems, justifyContent, padding, flex
// Text: text, fontSize, color, fontWeight ("bold"), fontStyle, align, lineHeight, textDecoration
// Heading: text, level, color
// Image: src, width, height

function mapElementForImage(type, props, children, elements) {
	if (type === "Stack") return { type: props.direction === "horizontal" ? "Row" : "Column", props: { gap: props.gap === "lg" ? 16 : props.gap === "md" ? 10 : 6 }, children };
	if (type === "Card") {
		const cardChildren = [...(children || [])];
		if (props.title) {
			const tk = uid("card_t");
			elements[tk] = { type: "Text", props: { text: str(props.title), fontWeight: "bold", fontSize: 16 } };
			cardChildren.unshift(tk);
		}
		if (props.description) {
			const dk = uid("card_d");
			elements[dk] = { type: "Text", props: { text: str(props.description), color: "#626F86", fontSize: 13 } };
			cardChildren.splice(props.title ? 1 : 0, 0, dk);
		}
		return { type: "Box", props: { borderWidth: 1, borderColor: "#DFE1E6", borderRadius: 8, padding: 16, flexDirection: "column" }, children: cardChildren };
	}
	if (type === "Grid") {
		// Wrap each child in a Box with flex:1 so they fill equal horizontal space
		const wrappedChildren = (children || []).map((childKey) => {
			const wk = uid("gw");
			elements[wk] = { type: "Box", props: { flex: 1 }, children: [childKey] };
			return wk;
		});
		return { type: "Row", props: { gap: 10 }, children: wrappedChildren };
	}
	if (type === "Heading") return { type: "Heading", props: { text: str(props.text), level: props.level || "h2" } };
	if (type === "Text") return { type: "Text", props: { text: str(props.content), color: props.muted ? "#626F86" : undefined, fontSize: props.size === "xs" ? 11 : props.size === "sm" ? 13 : 14 } };
	if (type === "Image") return { type: "Image", props: { src: str(props.src), width: props.width || 200, height: props.height || 100 } };
	if (type === "Separator") return { type: "Divider", props: {} };
	if (type === "Badge") return { type: "Text", props: { text: str(props.text), fontSize: 12, color: "#0052CC", fontWeight: "bold" } };
	if (type === "Lozenge") return { type: "Text", props: { text: str(props.text), fontSize: 11, fontWeight: "bold" } };
	if (type === "Tag") return { type: "Text", props: { text: str(props.text), fontSize: 11, color: "#44546F" } };
	if (type === "Code") return { type: "Text", props: { text: str(props.text), fontSize: 12 } };
	if (type === "Kbd") return { type: "Text", props: { text: str(props.text), fontSize: 11 } };
	if (type === "Link") return { type: "Text", props: { text: str(props.text), color: "#0052CC", textDecoration: "underline", fontSize: 14 } };
	if (type === "Button") return { type: "Text", props: { text: str(props.label), color: "#0052CC", fontWeight: "bold", fontSize: 14 } };

	// Metric → bordered card with label + value + detail
	if (type === "Metric") {
		const metricChildren = [];
		const lk = uid("m_l");
		elements[lk] = { type: "Text", props: { text: str(props.label), fontSize: 12, color: "#626F86" } };
		metricChildren.push(lk);
		const vk = uid("m_v");
		elements[vk] = { type: "Text", props: { text: str(props.value), fontSize: 24, fontWeight: "bold" } };
		metricChildren.push(vk);
		if (props.detail) {
			const dk = uid("m_d");
			const trendColor = props.trend === "up" ? "#216E4E" : props.trend === "down" ? "#AE2E24" : "#626F86";
			elements[dk] = { type: "Text", props: { text: str(props.detail), fontSize: 12, color: trendColor } };
			metricChildren.push(dk);
		}
		const ik = uid("m_i");
		elements[ik] = { type: "Column", props: { gap: 2 }, children: metricChildren };
		return { type: "Box", props: { borderWidth: 1, borderColor: "#DFE1E6", borderRadius: 8, padding: 16 }, children: [ik] };
	}

	// Table → header row + data rows
	if (type === "Table") {
		const columns = props.columns || [];
		const data = Array.isArray(props.data) ? props.data : [];
		const tableChildren = [];

		// Header row — each cell in a flex:1 Box
		if (columns.length > 0) {
			const hk = uid("th");
			const hCells = columns.map((col) => {
				const tk = uid("thc_t");
				elements[tk] = { type: "Text", props: { text: str(col.label), fontSize: 12, fontWeight: "bold", color: "#44546F" } };
				const bk = uid("thc_b");
				elements[bk] = { type: "Box", props: { flex: 1, padding: 10 }, children: [tk] };
				return bk;
			});
			elements[hk] = { type: "Row", props: {}, children: hCells };
			tableChildren.push(hk);
		}

		// Data rows — each cell in a flex:1 Box
		for (let i = 0; i < Math.min(data.length, 10); i++) {
			const row = data[i];
			const rk = uid("tr");
			const cellKeys = columns.map((col) => {
				const tk = uid("td_t");
				elements[tk] = { type: "Text", props: { text: str(row[col.key]), fontSize: 13 } };
				const bk = uid("td_b");
				elements[bk] = { type: "Box", props: { flex: 1, padding: 10 }, children: [tk] };
				return bk;
			});
			elements[rk] = { type: "Row", props: {}, children: cellKeys };
			tableChildren.push(rk);
		}

		if (data.length > 10) {
			const mk = uid("more");
			elements[mk] = { type: "Text", props: { text: `… and ${data.length - 10} more rows`, fontSize: 11, color: "#626F86" } };
			tableChildren.push(mk);
		}

		return { type: "Box", props: { borderWidth: 1, borderColor: "#DFE1E6", borderRadius: 8 }, children: tableChildren };
	}

	// Alert / SectionMessage / Callout
	if (type === "Alert" || type === "SectionMessage" || type === "Callout") {
		const kids = [];
		if (props.title) {
			const tk = uid("a_t");
			elements[tk] = { type: "Text", props: { text: str(props.title), fontWeight: "bold", fontSize: 13 } };
			kids.push(tk);
		}
		const desc = str(props.description || props.content || "");
		if (desc) {
			const dk = uid("a_d");
			elements[dk] = { type: "Text", props: { text: desc, fontSize: 12 } };
			kids.push(dk);
		}
		return { type: "Box", props: { backgroundColor: "#DEEBFF", padding: 12, borderRadius: 4 }, children: kids };
	}
	if (type === "Banner") {
		const bk = uid("bn_t");
		elements[bk] = { type: "Text", props: { text: str(props.text), fontSize: 12, fontWeight: "bold" } };
		return { type: "Box", props: { backgroundColor: "#FFF7D6", padding: 10, borderRadius: 4 }, children: [bk] };
	}

	// Timeline
	if (type === "Timeline") {
		const items = props.items || [];
		const tlKids = items.map((item) => {
			const ek = uid("tl");
			const eKids = [];
			const tk = uid("tl_t");
			elements[tk] = { type: "Text", props: { text: str(item.title), fontWeight: "bold", fontSize: 13 } };
			eKids.push(tk);
			if (item.description) {
				const dk = uid("tl_d");
				elements[dk] = { type: "Text", props: { text: str(item.description), fontSize: 12, color: "#626F86" } };
				eKids.push(dk);
			}
			elements[ek] = { type: "Column", props: { gap: 2 }, children: eKids };
			return ek;
		});
		return { type: "Column", props: { gap: 10 }, children: tlKids };
	}

	// Accordion
	if (type === "Accordion") {
		const items = props.items || [];
		const accKids = items.map((item) => {
			const sk = uid("acc");
			const tk = uid("acc_t");
			elements[tk] = { type: "Text", props: { text: str(item.title), fontWeight: "bold", fontSize: 13 } };
			const ck = uid("acc_c");
			elements[ck] = { type: "Text", props: { text: str(item.content), fontSize: 12 } };
			elements[sk] = { type: "Column", props: { gap: 4 }, children: [tk, ck] };
			return sk;
		});
		return { type: "Column", props: { gap: 10 }, children: accKids };
	}

	// Comment
	if (type === "Comment") {
		const ak = uid("cm_a");
		elements[ak] = { type: "Text", props: { text: `${str(props.author)}${props.time ? ` · ${str(props.time)}` : ""}`, fontWeight: "bold", fontSize: 12 } };
		const bk = uid("cm_b");
		elements[bk] = { type: "Text", props: { text: str(props.content), fontSize: 12 } };
		return { type: "Column", props: { gap: 4 }, children: [ak, bk] };
	}

	// Breadcrumb
	if (type === "Breadcrumb") return { type: "Text", props: { text: (props.items || []).map((i) => i.label).join(" > "), fontSize: 11, color: "#626F86" } };

	// PageHeader
	if (type === "PageHeader") {
		const kids = [];
		const tk = uid("ph_t");
		elements[tk] = { type: "Heading", props: { text: str(props.title), level: "h1" } };
		kids.push(tk);
		if (props.description) {
			const dk = uid("ph_d");
			elements[dk] = { type: "Text", props: { text: str(props.description), color: "#626F86", fontSize: 14 } };
			kids.push(dk);
		}
		return { type: "Column", props: { gap: 4 }, children: kids };
	}

	// EmptyState
	if (type === "EmptyState") {
		const kids = [];
		const tk = uid("es_t");
		elements[tk] = { type: "Text", props: { text: str(props.title), fontWeight: "bold", fontSize: 14, align: "center" } };
		kids.push(tk);
		if (props.description) {
			const dk = uid("es_d");
			elements[dk] = { type: "Text", props: { text: str(props.description), color: "#626F86", fontSize: 12, align: "center" } };
			kids.push(dk);
		}
		return { type: "Column", props: { gap: 4, alignItems: "center", padding: 24 }, children: kids };
	}

	// Progress
	if (type === "Progress" || type === "ProgressBar") return { type: "Text", props: { text: `${str(props.label || "Progress")}: ${props.value ?? 0}%`, fontSize: 12 } };
	if (type === "Pagination") return { type: "Text", props: { text: `Page ${props.currentPage ?? 1} of ${props.totalPages ?? 1}`, fontSize: 11, color: "#626F86" } };
	if (type === "Avatar") return { type: "Text", props: { text: str(props.fallback), fontSize: 12, fontWeight: "bold" } };

	// Passthrough containers
	if (["Tabs", "TabContent", "ScrollArea", "AspectRatio", "Carousel", "Dialog", "Tooltip", "Collapsible", "ButtonGroup", "TagGroup", "AccordionForm"].includes(type)) {
		return { type: "Column", props: {}, children };
	}

	// MapWidget
	if (type === "MapWidget") return { type: "Text", props: { text: `Map: ${(props.markers || []).map((m) => m.title).join(", ") || "No markers"}`, color: "#626F86", fontSize: 12 } };

	// Skip
	if (type === "Spinner" || type === "Skeleton") return null;

	return null;
}

// ── Spec mapping ────────────────────────────────────────────────

function mapSpec(spec, format, externalState) {
	_keyCounter = 0;
	const state = externalState || spec.state || {};
	const elements = {};
	const sourceElementCount = Object.keys(spec.elements).length;
	const mapFn = format === "pdf" ? mapElementForPdf : mapElementForImage;

	for (const [key, element] of Object.entries(spec.elements)) {
		const { type, children } = element;
		const props = resolveProps(element.props || {}, state);

		if (THREE_D_TYPES.has(type)) continue;
		if (CHART_TYPES.has(type)) {
			elements[key] = { type: "Text", props: { text: `[${str(props.title || type)}]`, style: { color: "#666666", fontStyle: "italic" } } };
			continue;
		}
		if (INPUT_TYPES.has(type)) {
			const label = str(props.label || type);
			const value = str(props.value || props.checked || "");
			elements[key] = { type: "Text", props: { text: value ? `${label}: ${value}` : label, style: { fontSize: 10 } } };
			continue;
		}

		const mapped = mapFn(type, props, children, elements);
		if (mapped) {
			elements[key] = mapped;
		} else {
			elements[key] = { type: "Text", props: { text: `[${type}]`, style: { color: "#999999" } } };
		}
	}

	// Prune children refs to dropped elements
	const childElementKeys = new Set();
	for (const el of Object.values(elements)) {
		if (el.children) {
			el.children = el.children.filter((k) => k in elements);
			for (const childKey of el.children) {
				childElementKeys.add(childKey);
			}
		}
	}

	// Wrap in document envelope
	const rootKey = spec.root in elements ? spec.root : uid("wrap");
	if (!(spec.root in elements)) {
		const orphans = Object.keys(elements).filter((k) => !childElementKeys.has(k));
		elements[rootKey] = { type: format === "image" ? "Column" : "View", props: {}, children: orphans };
	}

	if (format === "pdf") {
		const pageKey = uid("page");
		const docKey = uid("doc");
		elements[pageKey] = { type: "Page", props: { size: "A4", style: { padding: 40, fontFamily: "Helvetica", fontSize: 12 } }, children: [rootKey] };
		elements[docKey] = { type: "Document", props: {}, children: [pageKey] };
		return { root: docKey, elements };
	}

	if (format === "image") {
		// Estimate height from source element count (not mapped count which inflates from wrappers).
		// Typical row height ~45px, plus padding. Use source count stored before mapping.
		const estimatedHeight = Math.min(Math.max(sourceElementCount * 50 + 120, 400), 2400);
		const frameKey = uid("frame");
		elements[frameKey] = { type: "Frame", props: { width: 1200, height: estimatedHeight, padding: 24, backgroundColor: "#ffffff" }, children: [rootKey] };
		return { root: frameKey, elements };
	}

	// Unsupported format for mapSpec
	throw new Error(`mapSpec does not support format: ${format}`);
}

// ── Codegen ──────────────────────────────────────────────────────

function generateReactCode(spec, componentName = "GeneratedUI") {
	const { collectUsedComponents, serializeProps } = require("@json-render/codegen");

	const usedComponents = collectUsedComponents(spec);
	const imports = Array.from(usedComponents).sort().join(", ");

	function renderElement(key, indent = 1) {
		const el = spec.elements[key];
		if (!el) return "";
		const pad = "\t".repeat(indent);
		const { type, props = {}, children = [] } = el;

		const staticProps = {};
		for (const [k, v] of Object.entries(props)) {
			if (v == null) continue;
			if (typeof v === "object" && ("$state" in v || "$bindState" in v)) continue;
			staticProps[k] = v;
		}
		const propsStr = serializeProps(staticProps).trim();
		const propsFragment = propsStr ? ` ${propsStr}` : "";

		if (children.length === 0) return `${pad}<${type}${propsFragment} />`;

		const childJsx = children.map((ck) => renderElement(ck, indent + 1)).filter(Boolean).join("\n");
		return `${pad}<${type}${propsFragment}>\n${childJsx}\n${pad}</${type}>`;
	}

	const jsx = renderElement(spec.root);

	return [
		`"use client";`,
		``,
		`import { ${imports} } from "@/components/ui";`,
		``,
		`export function ${componentName}() {`,
		`\treturn (`,
		jsx,
		`\t);`,
		`}`,
		``,
	].join("\n");
}

// ── Export formats ────────────────────────────────────────────────

const EXPORT_FORMATS = ["pdf", "png", "react-code"];

async function exportSpec(spec, format, options = {}) {
	const { title = "export", state } = options;
	const safeTitle = (title || "export").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 60);

	if (format === "react-code") {
		const code = generateReactCode(spec, options.componentName);
		return {
			contentType: "text/plain; charset=utf-8",
			filename: `${safeTitle}.tsx`,
			data: Buffer.from(code, "utf-8"),
		};
	}

	if (format === "pdf") {
		const { renderToBuffer } = getPdfRenderer();
		const mappedSpec = mapSpec(spec, "pdf", state);
		const buffer = await renderToBuffer(mappedSpec);
		return {
			contentType: "application/pdf",
			filename: `${safeTitle}.pdf`,
			data: buffer,
		};
	}

	if (format === "png") {
		const { renderToPng } = getImageRenderer();
		const mappedSpec = mapSpec(spec, "image", state);
		const fonts = await loadFonts();
		const buffer = await renderToPng(mappedSpec, { fonts });
		return {
			contentType: "image/png",
			filename: `${safeTitle}.png`,
			data: buffer,
		};
	}

	throw new Error(`Unsupported export format: ${format}. Supported: ${EXPORT_FORMATS.join(", ")}`);
}

module.exports = { exportSpec, EXPORT_FORMATS, mapSpec, generateReactCode };
