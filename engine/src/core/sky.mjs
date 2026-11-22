// The live sky (ADR-20261122-day-views): which sky a trip page draws, and what each day's weather looks like in it.
// Pure: no DOM, no trip globals. The canvas that draws it is engine/src/app/24-sky.js; the colours are the world's
// (engine/src/themes/<world>.css, the --wx-* tokens).

/** the skies a trip can pick (TRIP.sky): weather that falls by itself, a snow globe to shake, snow that piles up, none */
export const MODES = ['live', 'globe', 'pile', 'off'];

/** the weather a view's sky can show, from the heaviest snow to a clear night */
export const KINDS = ['heavy', 'light', 'shower', 'clear', 'night'];

/** with no forecast for a day (a trip more than 16 days away, a refresh without weather): a light snowfall */
export const DEFAULT_KIND = 'light';

/** which sky a page draws: the trip's own choice when the world has a sky, else the world's; a world without one: none */
export function modeFor(tripSky, worldSky) {
	if (!worldSky || !MODES.includes(worldSky)) return 'off';
	return MODES.includes(tripSky) ? tripSky : worldSky;
}

/**
 * A day's forecast (Open-Meteo's WMO weather code) as the sky's weather. A clear sky after dark (`night`) is a clear
 * night. Rain and drizzle in a snow world read as snow showers; cloud and fog as a light snowfall. No code: the default.
 */
export function kindOf(code, night = false) {
	if (code == null || !Number.isFinite(+code)) return DEFAULT_KIND;
	const c = +code;
	if (c <= 1) return night ? 'night' : 'clear';
	if (c <= 48) return 'light'; // partly cloudy, overcast, fog
	if (c <= 67) return 'shower'; // drizzle and rain, freezing too
	if (c === 71 || c === 77) return 'light'; // slight snow, snow grains
	if (c === 73 || c === 75) return 'heavy'; // moderate and heavy snow
	if (c <= 82) return 'shower'; // rain showers
	if (c === 85) return 'shower'; // slight snow showers
	return 'heavy'; // heavy snow showers, thunderstorms
}

/** what a forecast says, for the view's weather line: its words ([zh, en]) and its icon (the page's sprite) */
export function wordFor(code, night = false) {
	const c = +code;
	const w = (zh, en, icon) => ({ name: [zh, en], icon });
	if (code == null || !Number.isFinite(c)) return w('', '', 'cloud');
	if (c <= 1) return night ? w('晴夜', 'Clear night', 'moon') : w('晴', 'Clear', 'sun');
	if (c === 2) return w('多云', 'Partly cloudy', 'cloud');
	if (c === 3) return w('阴', 'Overcast', 'cloud');
	if (c <= 48) return w('雾', 'Fog', 'cloud');
	if (c <= 57) return w('毛毛雨', 'Drizzle', 'umbrella');
	if (c <= 67) return w('雨', 'Rain', 'umbrella');
	if (c === 71) return w('小雪', 'Light snow', 'wx-light');
	if (c === 73) return w('中雪', 'Snow', 'wx-heavy');
	if (c === 75) return w('大雪', 'Heavy snow', 'wx-heavy');
	if (c === 77) return w('雪粒', 'Snow grains', 'wx-light');
	if (c <= 82) return w('阵雨', 'Rain showers', 'umbrella');
	if (c === 85) return w('阵雪', 'Snow showers', 'wx-shower');
	if (c === 86) return w('大阵雪', 'Heavy snow showers', 'wx-heavy');
	return w('雷雨', 'Thunderstorm', 'umbrella');
}

/** after dark at the destination: from 18:00 to 06:00 (minutes after midnight) */
export const isNight = (mins) => mins >= 18 * 60 || mins < 6 * 60;

/**
 * How each weather falls. dens: flakes per 1000 px² of sky; r: radius in px; v: fall speed in px/s; wind: drift in
 * px/s; wob: sway; kind: what falls (a glint is a sunlit crystal in the air); stars: a starry sky behind.
 */
export const FALL = {
	heavy: { dens: 0.85, r: [1.4, 3.8], v: [50, 105], wind: 26, wob: 14, kind: 'snow' },
	light: { dens: 0.24, r: [1.1, 2.5], v: [20, 42], wind: 7, wob: 10, kind: 'snow' },
	shower: { dens: 0.55, r: [1.2, 3], v: [38, 84], wind: 16, wob: 12, kind: 'snow', gust: 1 },
	clear: { dens: 0.08, r: [0.8, 1.5], v: [5, 13], wind: 5, wob: 7, kind: 'glint' },
	night: { dens: 0, r: [1, 1], v: [0, 0], wind: 0, wob: 0, kind: 'none', stars: 1 },
};

/** the snow globe's own snow: slow and even whatever the weather, so a shake shows */
export const GLOBE = { dens: 0.36, r: [1.2, 3], v: [15, 32], wind: 3, wob: 12, kind: 'snow' };

/** the most flakes the page draws at once: a phone's band and header, a desktop's whole sky */
export const CAP = { phone: 110, desk: 240 };

/** a shake's swirl settles to nothing over about this many seconds (energy halves every ln 2 × TAU) */
export const SETTLE = 5;
export const TAU = 2.1;

/** what falls in a sky: the weather's own, or the globe's snow (keeping the weather's stars) */
export const fallFor = (mode, kind) =>
	mode === 'globe' ? { ...GLOBE, stars: (FALL[kind] || FALL[DEFAULT_KIND]).stars } : FALL[kind] || FALL[DEFAULT_KIND];

/** how many flakes a sky of `area` px² holds for this fall, under the cap */
export const flakesFor = (fall, area, cap) => Math.max(0, Math.min(cap, Math.round((fall.dens * area) / 1000)));
