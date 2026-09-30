/* ───────── theme ───────── */
const THEME_NEXT = { light: 'dark', dark: 'system', system: 'light' };
const themeName = (t) => ({ system: Z('跟随系统', 'Match system'), light: Z('浅色', 'Light'), dark: Z('深色', 'Dark') })[t];
function applyTheme() {
	const root = document.documentElement;
	if (themePref === 'system') delete root.dataset.theme;
	else root.dataset.theme = themePref;
	const b = $('#themeBtn');
	if (b) {
		b.querySelector('use').setAttribute('href', themePref === 'light' ? '#i-sun' : themePref === 'dark' ? '#i-moon' : '#i-auto');
		const lab = `${Z('主题', 'Theme')}: ${themeName(themePref)}`;
		b.setAttribute('aria-label', lab);
		b.title = lab;
	}
	const bg = getComputedStyle(root).getPropertyValue('--paper').trim();
	$$('meta[name="theme-color"]').forEach((m) => {
		if (m.dataset.orig == null) m.dataset.orig = m.content;
		m.content = themePref === 'system' ? m.dataset.orig : bg;
	});
	restyleLive();
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
	if (themePref === 'system') restyleLive();
});

/* live refresh of now/next each minute */
setInterval(() => {
	renderNow();
	markToday();
}, 60000);
geoWatch(); // on a trip day, follow the phone if location is already allowed (never asks by itself)

render();
const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => idle(imgLoad, { timeout: 1500 }));
else idle(imgLoad, { timeout: 1500 });
if (/^#add=/.test(location.hash))
	setTimeout(mineImportOffer, 300); // someone shared their added stops
else if (location.hash.length > 1) {
	const el = lazyFor(location.hash.slice(1));
	// the same landing as a tab jump: WebKit needs holdLanding() here too, or a shared #entry link opened ~3,800 px off
	if (el) setTimeout(() => scrollToEl(el, 'start'), 50);
}
