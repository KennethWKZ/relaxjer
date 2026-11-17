// The landing page's theme: day or night. It starts from the system's; the sun/moon button in the bar switches it, and
// this browser remembers a choice that differs from the system (picking the system's own theme again forgets it, so the
// page follows the system once more). Loaded in <head>, before the body, so a remembered night paints from the first
// frame. Without this script the page simply follows the system, and the button stays hidden.
(() => {
	const KEY = 'relaxjer-site-theme';
	const root = document.documentElement;
	const system = matchMedia('(prefers-color-scheme: dark)');
	let chosen = null;
	try {
		const v = localStorage.getItem(KEY);
		if (v === 'light' || v === 'dark') chosen = v;
	} catch {
		/* storage blocked: follow the system */
	}
	const current = () => chosen || (system.matches ? 'dark' : 'light');
	// the pictures and the browser bar pick their variant by media query, so a choice rewrites the query they test
	const query = (scheme) => (chosen ? (chosen === scheme ? 'all' : 'not all') : `(prefers-color-scheme: ${scheme})`);

	const apply = () => {
		if (chosen) root.dataset.theme = chosen;
		else delete root.dataset.theme;
		for (const source of document.querySelectorAll('source[data-dark]')) source.media = query('dark');
		for (const meta of document.querySelectorAll('meta[name="theme-color"][data-scheme]')) meta.media = query(meta.dataset.scheme);
		const btn = document.querySelector('.nav-theme');
		if (!btn) return;
		const night = current() === 'dark';
		const label = night ? 'Switch to day' : 'Switch to night';
		btn.setAttribute('aria-label', label);
		btn.title = label;
		btn.querySelector('use').setAttribute('href', night ? '#i-sun' : '#i-moon');
	};

	apply(); // in <head>: the root and the browser bar's colour; the rest waits for the body
	document.addEventListener('DOMContentLoaded', () => {
		const btn = document.querySelector('.nav-theme');
		if (btn) {
			btn.hidden = false;
			btn.addEventListener('click', () => {
				const next = current() === 'dark' ? 'light' : 'dark';
				chosen = next === (system.matches ? 'dark' : 'light') ? null : next;
				try {
					if (chosen) localStorage.setItem(KEY, chosen);
					else localStorage.removeItem(KEY);
				} catch {
					/* storage blocked: the choice lasts until the page closes */
				}
				apply();
			});
		}
		apply();
	});
	system.addEventListener('change', apply);
})();

// The landing page's world: Lanterns (the page as it was) or Snow (Snow Light Path, a winter day in Hokkaido). With no
// choice, December to February opens in Snow and the other months in Lanterns, by this visitor's own clock. The bar's
// world button switches it. This browser remembers a choice that differs from the season's, and picking the season's
// own world again forgets it, the same as the day/night button. Lanterns is the attribute's absence, so without this
// script the page is Lanterns.
(() => {
	const KEY = 'relaxjer-site-world';
	const root = document.documentElement;
	let chosen = null;
	try {
		const v = localStorage.getItem(KEY);
		if (v === 'lanterns' || v === 'snow') chosen = v;
	} catch {
		/* storage blocked: the season picks the world */
	}
	const seasonal = () => ([11, 0, 1].includes(new Date().getMonth()) ? 'snow' : 'lanterns');
	const current = () => chosen || seasonal();
	// the browser bar's colour follows the world too: each theme-color keeps its Lanterns value and names its Snow one
	const metas = [...document.querySelectorAll('meta[name="theme-color"][data-scheme]')];
	const lanterns = new Map(metas.map((meta) => [meta, meta.getAttribute('content')]));

	const apply = () => {
		const snow = current() === 'snow';
		if (snow) root.dataset.world = 'snow';
		else delete root.dataset.world;
		for (const meta of metas) meta.setAttribute('content', snow ? meta.dataset.snow : lanterns.get(meta));
		const btn = document.querySelector('.nav-world');
		if (!btn) return;
		const label = snow ? 'Switch to Lanterns' : 'Switch to Snow';
		btn.setAttribute('aria-label', label);
		btn.title = label;
		btn.querySelector('use').setAttribute('href', snow ? '#i-lantern' : '#i-snow');
	};

	apply(); // in <head>: the attribute paints with the first frame; the button waits for the body
	document.addEventListener('DOMContentLoaded', () => {
		const btn = document.querySelector('.nav-world');
		if (btn) {
			btn.hidden = false;
			btn.addEventListener('click', () => {
				const next = current() === 'snow' ? 'lanterns' : 'snow';
				chosen = next === seasonal() ? null : next;
				try {
					if (chosen) localStorage.setItem(KEY, chosen);
					else localStorage.removeItem(KEY);
				} catch {
					/* storage blocked: the choice lasts until the page closes */
				}
				apply();
			});
		}
		apply();
	});
})();
