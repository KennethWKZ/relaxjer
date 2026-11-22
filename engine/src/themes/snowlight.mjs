// Snow Light Path: the build-time half of the `snowlight` world (its look is snowlight.css). A pack picks it with
// `export const theme = 'snowlight'` (ADR-20261117-destination-themes). Nothing here names a country or a trip.

/** the page's paper, light and dark: the browser bar's colour (theme-color) and the installed app's background */
export const paper = { light: '#f7fafd', dark: '#0a1424' };

/**
 * The sky behind the page (ADR-20261121-world-motion): scrolling down the trip is a night passing, from dusk at the top
 * through a starry night with an aurora and falling snow to dawn at the foot. The build lays one fixed layer per name
 * (snowlight.css draws and moves them, with the scroll only) and, after the footer, the closing scene: the sun coming
 * up over snowy hills.
 */
export const backdrop = { layers: ['night', 'stars', 'aurora', 'snow', 'dawn'], end: true };

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const NIGHT_TOP = [10, 22, 44];
const NIGHT_LOW = [24, 44, 80];
const GLOW = [255, 168, 60];
const SNOW = [238, 244, 251];
const SNOW_SHADE = [200, 216, 236];
const FAR_DRIFT = [150, 172, 206];
const CUP_LIGHT = [255, 222, 168];
const MOUTH = [244, 150, 56];
const FLAME = [255, 170, 48];
const FLAME_CORE = [255, 248, 220];
// six-armed snow crystals [u, v, arm length], then small round flakes [u, v, radius]
const CRYSTALS = [
	[0.2, 0.17, 0.05],
	[0.8, 0.15, 0.038],
	[0.42, 0.1, 0.024],
	[0.86, 0.4, 0.026],
];
const FLAKES = [
	[0.11, 0.38, 0.009],
	[0.31, 0.27, 0.008],
	[0.68, 0.24, 0.009],
	[0.6, 0.08, 0.007],
	[0.13, 0.55, 0.007],
];

/** distance from (u, v) to the segment a→b, and how far along it (0–1) the nearest point is */
function toSegment(u, v, ax, ay, bx, by) {
	const dx = bx - ax;
	const dy = by - ay;
	const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
	return [Math.hypot(u - (ax + t * dx), v - (ay + t * dy)), t];
}
const near = (u, v, ax, ay, bx, by, r) => toSegment(u, v, ax, ay, bx, by)[0] < r;

function crystal(u, v, [x, y, arm]) {
	const d = Math.hypot(u - x, v - y);
	if (d > arm) return false;
	if (d < arm * 0.18) return true;
	const w = Math.max(0.0045, arm * 0.12);
	for (let k = 0; k < 3; k++) {
		const a = (k * Math.PI) / 3 + Math.PI / 2;
		const [ca, sa] = [Math.cos(a), Math.sin(a)];
		if (Math.abs(-(u - x) * sa + (v - y) * ca) < w / 2) return true; // the arm through the centre
		// a pair of small branches two thirds out on each side of every arm
		for (const s of [1, -1]) {
			const bx = x + s * ca * arm * 0.6;
			const by = y + s * sa * arm * 0.6;
			for (const b of [Math.PI / 3, -Math.PI / 3]) {
				const ex = bx + s * Math.cos(a + b) * arm * 0.3;
				const ey = by + s * Math.sin(a + b) * arm * 0.3;
				if (near(u, v, bx, by, ex, ey, w / 2)) return true;
			}
		}
	}
	return false;
}

/** the near drift's edge: the group's candle stands in it, and the rider carves along it */
const bank = (u) => 0.705 + 0.03 * Math.sin(u * 5.2 + 0.8) + 0.015 * Math.sin(u * 11 + 2);

function candle(u, v, c, x, top, half) {
	const t = (v - top) / (half * 1.6);
	if (t >= 0 && t <= 1 && Math.abs(u - x) < half - half * 0.26 * t) c = mix(SNOW, CUP_LIGHT, (1 - t) * 0.6);
	if (((u - x) / (half * 0.97)) ** 2 + ((v - top) / (half * 0.24)) ** 2 < 1) c = MOUTH;
	return c;
}
function flame(u, v, c, x, top, half, flameH) {
	const baseY = top - half * 0.43;
	const r = half * 0.43;
	const inBase = Math.hypot(u - x, v - baseY) < r;
	const tipY = baseY - flameH;
	const inTip = v >= tipY && v <= baseY && Math.abs(u - x) < r * ((v - tipY) / flameH) ** 0.65;
	if (inBase || inTip) c = mix(FLAME, FLAME_CORE, Math.max(0, 1 - Math.hypot(u - x, (v - baseY + r * 0.2) * 0.8) / (r * 1.1)));
	return c;
}

// the rider: carving along the drift to the right, leaning back into the turn, arms out, throwing a spray of powder
// up and behind. Red jacket and pale trousers so the figure reads on the night and on the snow at 32 px.
const JACKET = [222, 72, 58];
const JACKET_LIT = [250, 128, 84];
const TROUSERS = [214, 228, 246];
const HELMET = [246, 249, 253];
const GOGGLES = [255, 180, 70];
const BOARD = [22, 38, 70];
const BOARD_EDGE = [255, 188, 92];
const TAIL = [0.395, 0.712];
const NOSE = [0.765, 0.66];
const HIP = [0.567, 0.528];
const SHOULDER = [0.588, 0.41];
const HEAD = [0.6, 0.338, 0.043];
// the spray: a rooster tail of powder fanning up and back from the board's tail, dense and big near the board, finer
// and fainter as it flies (fixed points, so every build is the same)
const hash = (i) => {
	const j = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
	return j - Math.floor(j);
};
const SPRAY = Array.from({ length: 140 }, (_, i) => {
	const reach = hash(i) ** 0.7; // more of it near the board
	const angle = Math.PI * (0.52 + 0.26 * hash(i + 300) + 0.1 * reach); // up and behind, opening as it flies
	const dist = 0.03 + 0.3 * reach;
	return [
		TAIL[0] + 0.02 + Math.cos(angle) * dist,
		TAIL[1] - 0.01 - Math.sin(angle) * dist + 0.07 * reach * reach,
		0.017 * (1 - reach) + 0.004,
		0.92 - 0.45 * reach,
	];
});
// the powder the board cuts through: a low wave along it that hides the board's lower edge
const boardY = (u) => TAIL[1] + ((u - TAIL[0]) / (NOSE[0] - TAIL[0])) * (NOSE[1] - TAIL[1]);

function snowboarder(u, v, c) {
	// the spray behind everything, then the far arm, legs, board, the powder over the board, body, near arm and head
	// a fine mist under the grains, along the tail's line of flight
	const [dm, tm] = toSegment(u, v, TAIL[0] + 0.02, TAIL[1] - 0.02, TAIL[0] - 0.1, TAIL[1] - 0.26);
	c = mix(c, SNOW, 0.5 * Math.exp(-((dm / (0.03 + 0.07 * tm)) ** 2)) * (1 - 0.6 * tm));
	for (const [x, y, r, a] of SPRAY) if (Math.hypot(u - x, v - y) < r) c = mix(c, SNOW, a);
	if (((u - 0.42) / 0.07) ** 2 + ((v - 0.68) / 0.04) ** 2 < 1) c = mix(c, SNOW, 0.85);
	if (near(u, v, SHOULDER[0] - 0.012, SHOULDER[1] + 0.016, 0.455, 0.468, 0.019)) c = JACKET;
	const backFoot = [0.495, 0.69];
	const frontFoot = [0.665, 0.668];
	const backKnee = [0.515, 0.6];
	const frontKnee = [0.637, 0.585];
	for (const [k, f] of [
		[backKnee, backFoot],
		[frontKnee, frontFoot],
	])
		if (near(u, v, HIP[0], HIP[1], k[0], k[1], 0.028) || near(u, v, k[0], k[1], f[0], f[1], 0.026))
			c = mix(TROUSERS, SNOW_SHADE, Math.max(0, Math.min(1, (u - HIP[0]) * 4)));
	const [db] = toSegment(u, v, TAIL[0], TAIL[1], NOSE[0], NOSE[1]);
	if (db < 0.019) c = db > 0.013 ? BOARD_EDGE : BOARD;
	const lip = boardY(u) + 0.006 - 0.01 * Math.max(0, 1 - Math.abs(u - 0.43) / 0.1);
	if (u > 0.34 && u < 0.8 && v > lip && v < bank(u) + 0.05) c = mix(SNOW, SNOW_SHADE, Math.min(1, (v - lip) / 0.08) * 0.5);
	const [dt, tt] = toSegment(u, v, HIP[0], HIP[1], SHOULDER[0], SHOULDER[1]);
	if (dt < 0.047 - 0.008 * tt) c = u < HIP[0] + (SHOULDER[0] - HIP[0]) * tt ? mix(JACKET, JACKET_LIT, 0.55) : JACKET;
	if (near(u, v, SHOULDER[0] + 0.006, SHOULDER[1] + 0.014, 0.71, 0.385, 0.018)) c = JACKET;
	if (Math.hypot(u - 0.716, v - 0.383) < 0.016 || Math.hypot(u - 0.45, v - 0.47) < 0.016) c = TROUSERS; // gloves
	const [hx, hy, hr] = HEAD;
	if (Math.hypot(u - hx, v - hy) < hr)
		c = ((u - hx - hr * 0.5) / (hr * 0.55)) ** 2 + ((v - hy - hr * 0.08) / (hr * 0.26)) ** 2 < 1 ? GOGGLES : HELMET;
	return c;
}

/** The marks this world can draw on its icon (core/motif.mjs leadMotif picks one from the days). */
export const iconMarks = ['snowboard'];

/**
 * The home-screen icon: a navy snowy night with six-armed crystals and a warm light in the middle. Plain, one candle
 * stands in a snow holder in the drift, lit. When the trip leads with an activity this world draws (`iconMarks`), the
 * activity takes the middle (a rider carving through powder, lit from behind) and the candle stands small in the
 * drift beside it. A colour for each point (u, v in 0–1 from the top left); engine/icons.mjs samples it. Everything
 * but the sky and the drifts stays inside the middle 80 %, so a phone's round or squircle mask never cuts it.
 */
export function iconPaint(u, v, mark = null) {
	const drawn = mark === 'snowboard';
	let c = mix(NIGHT_TOP, NIGHT_LOW, v);
	const dg = Math.hypot(u - 0.5, (v - 0.5) * 1.15);
	c = mix(c, GLOW, Math.exp(-((dg / 0.2) ** 2)) * 0.42);
	for (const [x, y, r] of FLAKES) if (Math.hypot(u - x, v - y) < r) c = mix(c, SNOW, 0.85);
	for (const k of CRYSTALS) if (crystal(u, v, k)) c = mix(c, SNOW, 0.9);
	// a far drift behind, then the candle's holder, then the near drift it stands in
	if (v > 0.63 + 0.04 * Math.sin(u * 3.3 + 2.2)) c = mix(FAR_DRIFT, GLOW, Math.exp(-((dg / 0.24) ** 2)) * 0.3);
	const [cx, top, half, flameH] = drawn ? [0.835, 0.652, 0.046, 0.07] : [0.5, 0.53, 0.115, 0.145];
	c = candle(u, v, c, cx, top, half);
	const b = bank(u);
	if (v > b) {
		const own = Math.exp(-((Math.hypot(u - cx, v - top) / (drawn ? 0.1 : 0.2)) ** 2)) * 0.35;
		c = mix(mix(SNOW, SNOW_SHADE, Math.min(1, (v - b) / 0.25)), CUP_LIGHT, drawn ? own + Math.exp(-((dg / 0.2) ** 2)) * 0.12 : own);
	}
	if (drawn) c = snowboarder(u, v, c);
	return flame(u, v, c, cx, top, half, flameH);
}
