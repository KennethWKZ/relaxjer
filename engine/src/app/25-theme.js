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
/* a destination world's one greeting (ADR-20261117-destination-themes): the first time this phone opens the trip, a
   short moment inside the now card that the world's stylesheet draws (Snow Light Path: a little snowfall), then it's
   removed and never comes back on this phone. Pure movement, so never under reduced motion. A world that draws none
   doesn't set --world-hello, and nothing is added. */
function worldHello() {
	const root = document.documentElement;
	if (!root.dataset.world || !getComputedStyle(root).getPropertyValue('--world-hello').trim() || store.get('greeted', false)) return;
	const card = $('#now');
	if (!card || !card.offsetHeight) return;
	const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
	const box = card.getBoundingClientRect();
	if (!still && (box.bottom <= 0 || box.top >= innerHeight)) return; // opened at a day: kept for an open that starts at the top
	store.set('greeted', true);
	if (still) return;
	// laid over the card, not inside it: the card redraws itself (location, ticks) while the snow falls
	const fx = document.createElement('span');
	fx.className = 'world-hello';
	fx.setAttribute('aria-hidden', 'true');
	fx.style.cssText = `top:${card.offsetTop}px;left:${card.offsetLeft}px;width:${card.offsetWidth}px;height:${card.offsetHeight}px`;
	fx.style.setProperty('--fall', `${card.offsetHeight + 16}px`);
	fx.innerHTML = Array.from(
		{ length: 12 },
		(_, i) => `<i style="left:${4 + i * 8}%;--s:${3 + (i % 3)}px;--dx:${(i % 2 ? 1 : -1) * (6 + (i % 4) * 4)}px;--d:${(i * 290) % 700}ms"></i>`,
	).join('');
	card.after(fx);
	setTimeout(() => fx.remove(), 3300);
}

/* live refresh of now/next each minute */
setInterval(() => {
	renderNow();
	markToday();
}, 60000);
geoWatch(); // on a trip day, follow the phone if location is already allowed (never asks by itself)

const backTo = reloadSpot();
if (backTo) {
	history.scrollRestoration = 'manual'; // our restore, not the browser's pixel offset
	// and not the address's #heading either: WebKit still scrolled to it at load, after our restore
	if (location.hash.length > 1 && !/^#add=/.test(location.hash)) history.replaceState(history.state, '', location.pathname + location.search);
}
render();
if (backTo) spotRestore(backTo); // its view first, then the place (the page restores every step itself: 20-views.js)
const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
idle(worldHello, { timeout: 600 }); // once the first screen has settled
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => idle(imgLoad, { timeout: 1500 }));
else idle(imgLoad, { timeout: 1500 });
if (/^#add=/.test(location.hash))
	setTimeout(mineImportOffer, 300); // someone shared their added stops
else if (location.hash.length > 1 && !backTo) {
	const el = hashTarget();
	// its view is already on screen (viewApply); then the place in it, in its sheet if it lives in one. WebKit needs
	// holdLanding() here too (scrollToEl), or a shared link opened off target
	if (el) setTimeout(() => landOn(el), 50);
}
