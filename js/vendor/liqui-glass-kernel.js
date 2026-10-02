/**
 * liqui-glass-kernel.js — vanilla port of the refraction kernel from
 * @liqui-design/glass v0.3.0 (MIT, https://liqui.design).
 *
 * React-only regions (theme provider, LiquiGlass component) are removed;
 * the surface layer markup lives in js/liqui.js. All algorithms — the SVG
 * filter registry, the canvas displacement-map generator, the Snell's-law
 * bezel profiles and the refraction support detection — are the library's
 * own, unchanged. See the handbook: https://liqui.design/docs/handbook/glass
 */

//#region src/filterRegistry.ts (verbatim)
/**
* Global registry of refraction filters.
*
* `backdrop-filter: url(#id)` resolves by id across the document, so filter
* defs don't have to live inside the surface that uses them. Keeping every
* filter (and its decoded feImage displacement map) in one persistent hidden
* <svg> means popups can unmount freely: the next surface with the same
* parameters references an already-decoded filter and refracts on its first
* frame — the same "pay once at page load" economics as a permanently
* mounted element, without keeping anything mounted.
*
* Only the very first surface ever rendered at a given (size, shape, optics)
* pays the one-off feImage decode, which the refract layer's fade-in masks.
*/
const SVG_NS = "http://www.w3.org/2000/svg";
const ISOLATE = {
	R: "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0",
	G: "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0",
	B: "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
};
let host = null;
const filterIds = new Map();
let nextId = 0;

const FILTER_CACHE_MAX = 256;
function ensureHost() {
	if (host && host.isConnected) return host;
	host = document.createElementNS(SVG_NS, "svg");
	host.setAttribute("width", "0");
	host.setAttribute("height", "0");
	host.setAttribute("aria-hidden", "true");
	host.style.position = "absolute";
	host.style.pointerEvents = "none";
	document.body.appendChild(host);
	return host;
}

function el(name, attrs) {
	const node = document.createElementNS(SVG_NS, name);
	for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
	return node;
}

function displacement(scale, result) {
	const node = el("feDisplacementMap", {
		in: "SourceGraphic",
		in2: "map",
		scale,
		xChannelSelector: "R",
		yChannelSelector: "B",
	});
	if (result) node.setAttribute("result", result);
	return node;
}

/**
* Returns the id of a filter implementing the given optics, creating it in
* the persistent host on first request. `cold` is true only when the filter
* was just created (its feImage still has to decode) — callers use it to
* decide whether a masking fade-in is needed at all.
*/
export function ensureFilter(params) {
	const { w, h, mapHref, refraction, dispersion } = params;
	const key = `${w}x${h}|r${refraction}|d${dispersion}|${mapHref.length}:${mapHref.slice(-24)}`;
	const existing = filterIds.get(key);
	if (existing) {
		filterIds.delete(key);
		filterIds.set(key, existing);
		return { id: existing, cold: false };
	}
	const id = `lq-refract-${nextId++}`;
	const filter = el("filter", {
		id,
		x: 0,
		y: 0,
		width: w,
		height: h,
		filterUnits: "userSpaceOnUse",
		"color-interpolation-filters": "sRGB",
	});
	const image = el("feImage", { x: 0, y: 0, width: w, height: h, result: "map" });
	image.setAttribute("href", mapHref);
	filter.appendChild(image);
	if (dispersion > 0) {
		filter.appendChild(displacement(refraction * (1 - dispersion), "dispR"));
		filter.appendChild(el("feColorMatrix", { in: "dispR", values: ISOLATE.R, result: "chR" }));
		filter.appendChild(displacement(refraction, "dispG"));
		filter.appendChild(el("feColorMatrix", { in: "dispG", values: ISOLATE.G, result: "chG" }));
		filter.appendChild(displacement(refraction * (1 + dispersion), "dispB"));
		filter.appendChild(el("feColorMatrix", { in: "dispB", values: ISOLATE.B, result: "chB" }));
		filter.appendChild(
			el("feComposite", { in: "chR", in2: "chG", operator: "arithmetic", k2: 1, k3: 1, result: "chRG" })
		);
		filter.appendChild(
			el("feComposite", { in: "chRG", in2: "chB", operator: "arithmetic", k2: 1, k3: 1 })
		);
	} else filter.appendChild(displacement(refraction));
	ensureHost().appendChild(filter);
	filterIds.set(key, id);
	if (filterIds.size > FILTER_CACHE_MAX) {
		const [oldestKey, oldestId] = filterIds.entries().next().value;
		filterIds.delete(oldestKey);
		host?.querySelector(`#${oldestId}`)?.remove();
	}
	return { id, cold: true };
}

/**
* Warm the browser image cache for a data URL (e.g. the specular PNG) and
* pin the Image object so its decoded data isn't dropped while the surface
* sits in a display:none keepMounted subtree.
*/
const pinnedImages = new Map();
export function prewarmImage(href) {
	if (pinnedImages.has(href)) return;
	const img = new Image();
	img.src = href;
	pinnedImages.set(href, img);
	if (pinnedImages.size > FILTER_CACHE_MAX) pinnedImages.delete(pinnedImages.keys().next().value);
}
//#endregion

//#region src/LiquiGlass.tsx — refraction detection + map generator (verbatim)
/**
* Refraction (backdrop-filter: url(#svg-filter)) currently only renders in
* Chromium. Safari silently drops the whole backdrop-filter value when an SVG
* reference is present; Firefox ignores it too. WebKit has an implementation
* in review (bug 245510) — when Safari ships it, raise the version gate.
*/
const SAFARI_REFRACTION_MIN = Infinity;
const FIREFOX_REFRACTION_MIN = Infinity;
export const supportsRefraction = (() => {
	if (typeof window === "undefined") return false;
	if (!CSS.supports("backdrop-filter", "blur(1px)")) return false;
	const ua = navigator.userAgent;
	const firefox = ua.match(/firefox\/(\d+)/i);
	if (firefox) return Number(firefox[1]) >= FIREFOX_REFRACTION_MIN;
	if (/^((?!chrome|chromium|edg|android).)*safari/i.test(ua)) {
		const version = ua.match(/version\/(\d+)/i);
		return Number(version?.[1] ?? 0) >= SAFARI_REFRACTION_MIN;
	}
	return true;
})();

/**
* Refraction magnitude along the bezel, indexed by normalized depth from the
* outer edge (0 = edge, 1 = inner end of the bezel). The physical profiles
* model a glass slab whose top surface follows a height function h(t): the
* surface slope gives the incident angle, Snell's law (n = 1.5) the bend, and
* the remaining glass depth the lateral shift — giving the sharp peak at the
* rim and smooth falloff of real thick glass. 'rim' is the cheap stylized
* falloff kept for comparison.
*/
const LUT_SIZE = 128;
const lutCache = new Map();
export function surfaceLUTs(profile) {
	const cached = lutCache.get(profile);
	if (cached) return cached;
	const mag = new Float32Array(LUT_SIZE);
	const slope = new Float32Array(LUT_SIZE);
	const n = 1.5;
	const T = 0.6;
	const h =
		profile === "squircle"
			? (t) => Math.pow(1 - Math.pow(1 - t, 4), 0.25)
			: profile === "convex"
				? (t) => Math.sqrt(1 - (1 - t) * (1 - t))
				: (t) => 1 - (1 - t) * (1 - t);
	const eps = 1 / 1024;
	let max = 0;
	for (let i = 0; i < LUT_SIZE; i++) {
		const t = Math.max(i / (LUT_SIZE - 1), eps);
		const hi = Math.min(t + eps, 1);
		const lo = Math.max(t - eps, 0);
		slope[i] = ((h(hi) - h(lo)) / (hi - lo)) * T;
		if (profile === "rim") mag[i] = (1 - t) * (1 - t);
		else {
			const thetaI = Math.atan(Math.abs(slope[i]));
			const delta = thetaI - Math.asin(Math.sin(thetaI) / n);
			mag[i] = h(t) * T * Math.tan(delta);
			max = Math.max(max, mag[i]);
		}
	}
	if (max > 0) for (let i = 0; i < LUT_SIZE; i++) mag[i] /= max;
	const luts = { mag, slope };
	lutCache.set(profile, luts);
	return luts;
}

/**
* Rim-light angles: key light toward the top-left corner, dim counter-light
* toward the bottom-right. Specular intensity falls off with the *positional*
* azimuth around the shape center (a normal-based falloff would light whole
* straight edges uniformly — bevel-button, not glass), shaped by a Gaussian
* band across the bezel. Tuned for the bold arcs of the reference look.
*/
const THETA_KEY = Math.atan2(-0.9, -0.45);
const THETA_COUNTER = Math.atan2(0.9, 0.5);

/**
* Displacement map for the lens effect, generated per-pixel on a canvas.
* R encodes horizontal displacement, B vertical; 128 is neutral. A
* rounded-rect signed distance field gives depth + outward normal per pixel;
* the LUT above gives the magnitude. Pixels sample toward the center
* (convex-lens edge magnification) — sampling outward would hit Chromium's
* backdrop edge-clamp and smear instead of refract.
*
* (Canvas instead of an SVG data-URI: feImage rasterizes SVG images with CSS
* features like mix-blend-mode disabled, which silently corrupts
* gradient-composited maps.)
*/
/**
* Maps are cached module-wide: popups remount at identical sizes on every
* open, so a reopen costs a Map lookup instead of a canvas render. Large
* surfaces render at half resolution — displacement vectors and the specular
* glow are smooth fields, so feImage/background stretching is invisible, and
* generation + PNG decode get ~4× cheaper (less pop-in latency).
*
* Bounded LRU: a surface that animates its box (an accordion panel expanding)
* walks through a distinct size every frame, so an unbounded cache would grow
* a PNG pair per intermediate height and never release them.
*/
const IMAGE_CACHE_MAX = 48;
const imageCache = new Map();
function cacheGet(key) {
	const hit = imageCache.get(key);
	if (!hit) return undefined;
	imageCache.delete(key);
	imageCache.set(key, hit);
	return hit;
}
function cacheSet(key, value) {
	imageCache.set(key, value);
	if (imageCache.size > IMAGE_CACHE_MAX) imageCache.delete(imageCache.keys().next().value);
}

export function glassImages(fullW, fullH, fullRadius, fullBezel, profile) {
	const key = `${fullW}x${fullH}r${fullRadius}b${fullBezel}${profile}`;
	const cached = cacheGet(key);
	if (cached) return cached;
	const scale = fullW * fullH > 32e3 ? 0.5 : 1;
	const w = Math.ceil(fullW * scale);
	const h = Math.ceil(fullH * scale);
	const radius = fullRadius * scale;
	const bezel = fullBezel * scale;
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	const image = ctx.createImageData(w, h);
	const data = image.data;
	const specCanvas = document.createElement("canvas");
	specCanvas.width = w;
	specCanvas.height = h;
	const specCtx = specCanvas.getContext("2d");
	const specImage = specCtx.createImageData(w, h);
	const spec = specImage.data;
	const { mag: lut } = surfaceLUTs(profile);
	const r = Math.min(radius, w / 2, h / 2);
	const bx = w / 2 - r;
	const by = h / 2 - r;
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const px = x + 0.5 - w / 2;
			const py = y + 0.5 - h / 2;
			const qx = Math.abs(px) - bx;
			const qy = Math.abs(py) - by;
			const ox = Math.max(qx, 0);
			const oy = Math.max(qy, 0);
			const depth = -(Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r);
			let nx = 0;
			let ny = 0;
			if (qx > 0 && qy > 0) {
				const len = Math.hypot(qx, qy) || 1;
				nx = (Math.sign(px) * qx) / len;
				ny = (Math.sign(py) * qy) / len;
			} else if (qx > qy) nx = Math.sign(px);
			else ny = Math.sign(py);
			const d = depth / bezel;
			const inRim = d < 1 && d >= 0;
			const idx = inRim ? Math.min(Math.round(d * (LUT_SIZE - 1)), LUT_SIZE - 1) : 0;
			const mag = inRim ? lut[idx] : 0;
			const i = (y * w + x) * 4;
			data[i] = Math.round(128 - nx * mag * 127);
			data[i + 1] = 128;
			data[i + 2] = Math.round(128 - ny * mag * 127);
			data[i + 3] = 255;
			if (inRim) {
				const theta = Math.atan2(py, px);
				const band = Math.exp(-(((d - 0.2) / 0.4) ** 2));
				const c1 = Math.max(Math.cos(theta - THETA_KEY), 0);
				const c2 = Math.max(Math.cos(theta - THETA_COUNTER), 0);
				const intensity = Math.min(band * (1.15 * c1 ** 3 + 0.75 * c2 ** 3.5), 1);
				spec[i] = 255;
				spec[i + 1] = 255;
				spec[i + 2] = 255;
				spec[i + 3] = Math.round(intensity * 255);
			}
		}
	ctx.putImageData(image, 0, 0);
	specCtx.putImageData(specImage, 0, 0);
	const result = { map: canvas.toDataURL(), specular: specCanvas.toDataURL() };
	cacheSet(key, result);
	return result;
}
//#endregion