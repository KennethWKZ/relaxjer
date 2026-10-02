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
