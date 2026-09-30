/* ───────── scroll spy + bar colour ───────── */

// which tab is lit: the last section whose top has passed just under the sticky header (live positions, so jumps are right)
let spyRAF = 0;
let spyHold = 0;
let spyOn = false;
function spyNow() {
	spyRAF = 0;
	if (performance.now() < spyHold) return;
	const secs = $$('[data-sec]');
	if (!secs.length) return;
	const line = barH + Math.min(140, innerHeight * 0.22);
	let best = secs[0];
	for (const s of secs) {
		if (s.getBoundingClientRect().top <= line) best = s;
		else break;
	}
	const last = secs[secs.length - 1]; // the last short section can't reach the line: light it once you're at the very bottom
	if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4 && last.getBoundingClientRect().top < innerHeight * 0.6) best = last;
	setActive(best.id);
}
function observeSections() {
	if (!spyOn) {
		spyOn = true;
		addEventListener(
			'scroll',
			() => {
				if (!spyRAF) spyRAF = requestAnimationFrame(spyNow);
			},
			{ passive: true },
		);
		addEventListener('resize', () => spyNow());
	}
	spyNow();
}
let barSpy;
function observeLanterns() {
	if (barSpy) barSpy.disconnect();
	barSpy = new IntersectionObserver(
		(ents) =>
			ents.forEach((e) => {
				const bar = e.target.closest('.day').querySelector('.day-bar');
				bar.classList.toggle('shown', !e.isIntersecting && e.boundingClientRect.top < barH + 40);
			}),
		{ rootMargin: `-${barH + 40}px 0px 0px 0px`, threshold: 0 },
	);
	$$('.day .lantern').forEach((l) => barSpy.observe(l));
}
let active = '';
function setActive(id) {
	if (id === active) return;
	active = id;
	$$('.tab').forEach((t) => t.setAttribute('aria-current', String(t.dataset.tab === id)));
	const d = dayById[id];
	const bar = $('#bar');
	bar.style.setProperty('--now', d ? `var(--l${d.c})` : 'var(--rule)');
	const tab = $(`.tab[data-tab="${id}"]`);
	const strip = $('#tabs');
	if (tab && strip) {
		const tr = tab.getBoundingClientRect(),
			sr = strip.getBoundingClientRect();
		strip.scrollBy({
			left: tr.left - sr.left - sr.width / 2 + tr.width / 2,
			behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
		});
	}
}
let barH = 100;
/* offline: the plan, lists, costs and MRT hints all live in this file and keep working; the map, Google search and live bike-share counts need a connection */
function netSync() {
	const el = $('#netOff');
	if (!el) return;
	const off = navigator.onLine === false;
	const was = !el.hidden;
	el.hidden = !off;
	el.innerHTML = off
		? `${icon('alert')}<span><b>${Z('没有网络', 'Offline')}</b> · ${Z(`行程、清单照常看；地图、Google 搜索、${BIKES[0]} 车数等有网络再用。别刷新页面。`, `Plans and lists still work; map, Google search and live ${BIKES[1]} wait for a connection. Don’t reload the page.`)}</span>`
		: '';
	if (was !== off) measureBar();
}
/* a new version: the host serves one file with no service worker, so a home-screen app that was only paused keeps the
   copy it loaded. Back in front and online, read the start of the live copy (its build id sits in the first bytes; the
   rest of the download is cancelled) and offer a reload only when it differs, so nobody reloads into a blank offline page */
const BUILD = ($('meta[name="relaxjer-build"]') || {}).content || '';
let updAt = 0;
let updNew = false;
async function updCheck() {
	if (!BUILD || updNew || document.hidden || navigator.onLine === false || !/^https?:$/.test(location.protocol)) return;
	if (Date.now() - updAt < 10 * 60000) return;
	updAt = Date.now();
	const ctl = new AbortController();
	const stop = setTimeout(() => ctl.abort(), 20000);
	try {
		const r = await fetch(location.href.split('#')[0], { cache: 'no-store', credentials: 'same-origin', signal: ctl.signal });
		if (!r.ok || !r.body) return; // the host's password page after 24 h: nothing to compare
		const rd = r.body.getReader();
		const dec = new TextDecoder();
		let head = '';
		let m = null;
		while (!m && head.length < 8192) {
			const { done, value } = await rd.read();
			if (done) break;
			head += dec.decode(value, { stream: true });
			m = /<meta name="relaxjer-build" content="([^"]+)"/.exec(head);
		}
		if (m && m[1] !== BUILD) {
			updNew = true;
			updSync();
		}
	} catch {
		/* offline, slow or blocked: try again next time */
	} finally {
		clearTimeout(stop);
		ctl.abort();
	}
}
function updSync() {
	const el = $('#updBar');
	if (!el) return;
	const was = !el.hidden;
	el.hidden = !updNew;
	el.innerHTML = updNew
		? `${icon('install')}<span><b>${Z('有新版本', 'New version')}</b> · ${Z('行程有更新', 'the plan changed')}</span><button type="button" class="text-btn" data-upd>${Z('更新', 'Update')}</button>`
		: '';
	if (was !== updNew) measureBar();
}
document.addEventListener('visibilitychange', updCheck);
window.addEventListener('online', updCheck);
setTimeout(updCheck, 4000);
window.addEventListener('offline', netSync);
window.addEventListener('online', () => {
	netSync();
	if (liveFailed && GEO && !live && !gmap) {
		liveArmed = true;
		startLiveMap();
	}
});
/* home screen: this host serves one file, so the manifest and icons travel inside it as data: URLs.
     Android Chrome can install from our own button (beforeinstallprompt); iPhone only lets people add a page by hand (Share → Add to Home Screen), so the button shows the steps. */
(function homeManifest() {
	const ic = window.APP_ICONS;
	if (!ic || !ic[512] || !/^https?:$/.test(location.protocol)) return;
	const here = location.origin + location.pathname;
	const m = {
		name: `${BRAND} ${TRIP.start.slice(0, 4)}`,
		short_name: BRAND,
		lang: 'zh-Hans',
		start_url: here,
		scope: here.replace(/[^/]*$/, ''),
		display: 'standalone',
		background_color: '#ffffff',
		theme_color: '#ffffff',
		icons: [
			{ src: ic[192], sizes: '192x192', type: 'image/png', purpose: 'any' },
			{ src: ic[512], sizes: '512x512', type: 'image/png', purpose: 'any' },
			{ src: ic[512], sizes: '512x512', type: 'image/png', purpose: 'maskable' },
		],
	};
	const l = document.createElement('link');
	l.rel = 'manifest';
	l.href = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(m))}`;
	document.head.appendChild(l);
})();
let installEv = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = () => /Android/.test(navigator.userAgent);
const canHome = () => !isStandalone() && (installEv || isIOS() || isAndroid());
const homeBtn = () =>
	canHome()
		? `<button type="button" class="mlink home-btn" data-home>${icon('plus')}${Z('加到手机主画面（像 App 一样打开）', 'Add to the home screen (opens like an app)')}</button>`
		: '';
// the header's install button: shown until the page runs from the home screen
const homeSync = () => {
	const b = $('#homeBtn');
	if (!b) return;
	b.hidden = !canHome();
	$('.home-lab', b).textContent = Z('安装', 'Install');
	b.setAttribute('aria-label', Z('加到手机主画面（像 App 一样打开）', 'Add to the home screen (opens like an app)'));
	b.title = Z('加到手机主画面', 'Add to the home screen');
};
window.addEventListener('beforeinstallprompt', (e) => {
	e.preventDefault();
	installEv = e;
	homeSync();
});
window.addEventListener('appinstalled', () => {
	installEv = null;
	homeSync();
	toast(Z('已加到主画面', 'Added to the home screen'));
});
function homeGuide() {
	const ios = isIOS();
	const steps = ios
		? [
				Z(
					'点 Safari 的<b>分享</b>按钮（方框加向上箭头；在底部，或网址栏旁的「⋯」里面）',
					'Tap Safari’s <b>Share</b> button (a box with an arrow; at the bottom, or inside the “⋯” by the address bar)',
				),
				Z('往下滑，选<b>「加入主画面」</b>', 'Scroll down and pick <b>Add to Home Screen</b>'),
				Z('右上角点<b>「加入」</b>', 'Tap <b>Add</b> (top right)'),
			]
		: [
				Z('点 Chrome 右上角的<b>「⋮」</b>', 'Tap <b>⋮</b> at the top right of Chrome'),
				Z('选<b>「加到主画面」</b>或<b>「安装应用」</b>', 'Pick <b>Add to home screen</b> or <b>Install app</b>'),
				Z('再点<b>「安装」/「加入」</b>', 'Tap <b>Install</b> / <b>Add</b>'),
			];
	openSheet(`<div class="home-guide"><p class="pop-name">${icon('plus')}${Z('加到手机主画面', 'Add to the home screen')}</p>
      <ol class="home-steps">${steps.map((x) => `<li>${x}</li>`).join('')}</ol>
      <p class="small">${Z(`以后点主画面的「${BRAND}」图标打开，全屏像 App。`, `Then open it from the ${BRAND} icon: full screen, like an app.`)}</p>
      <ul class="home-notes">
        ${ios ? `<li>${Z('图标版和 Safari <b>分开保存</b>：在 Safari 加的站、打的勾不会带过去。之后只用图标打开就好（加的站可以用「把我加的分享给大家」链接带过去）。', 'The icon version <b>saves separately</b> from Safari: stops and ticks added in Safari don’t carry over. Just use the icon from now on (added stops can move over with the “Share my added stops” link).')}</li>` : ''}
        ${ios ? `<li>${Z('装好后打开<b>「设置」→「App」→「Safari 浏览器」→「位置」</b>，选<b>「允许」</b>：以后用定位就不会每次都问。', 'Once added, open <b>Settings → Apps → Safari → Location</b> and pick <b>Allow</b>, so the page stops asking for location every time.')}</li>` : ''}
        <li>${Z('密码每 24 小时要再输入一次（网站规定）。', 'The password is asked again every 24 hours (the host’s rule).')}</li>
        <li>${Z('没有网络时打不开；打开后断网，行程照常看，别刷新。', 'It won’t open without internet; once open, plans keep working offline. Don’t reload.')}</li>
      </ul></div>`);
}
async function homeAdd() {
	if (installEv) {
		const e = installEv;
		installEv = null;
		try {
			await e.prompt();
			await e.userChoice;
		} catch {
			homeGuide();
		}
		homeSync();
		return;
	}
	homeGuide();
}
function measureBar() {
	barH = Math.round($('#bar').getBoundingClientRect().height);
	document.documentElement.style.setProperty('--bar-h', barH + 'px');
}
