/* ───────── the live sky (ADR-20261122-day-views) ─────────
   A world with a sky (Snow Light Path: `sky` in its .mjs) draws one: TRIP.sky picks which ('live': the day's own
   weather falling by itself; 'globe': a snow globe to shake; 'pile': snow that piles on the drift and the date tabs;
   'off'), else the world's. On a phone and a tablet the sky is the sticky header and a band at the top of each view,
   the snow behind the words; from 1024 px it's behind the whole page, the snow in the margins. Its colour blends to
   the view's own weather and day when the view changes, and what falls follows the day's forecast (core/sky.mjs).
   A Pause in the header, remembered on this phone (store `skyPaused`); under reduced motion it's still and the Pause
   is gone; it stops while the page is hidden; an older phone gets 30 frames a second. The page's other worlds keep
   their own backdrop, and a trip with no sky draws none of this. */
function skyMode() {
	return LOOK.sky || document.documentElement.dataset.sky || 'off';
}
const skyOn = () => skyMode() !== 'off';
// the sky's weather for a view: its day's forecast (the overview and the other views: today's, else the first day's)
function skyKind(id) {
	if (LOOK.wx) return LOOK.wx;
	const now = tpNow();
	const d = dayById[id] || DAYS.find((x) => x.date === now.date) || DAYS[0];
	const f = fcOf(d);
	return Sky.kindOf(f ? f.code : null, d.date === now.date && Sky.isNight(now.mins));
}
/** a view came on screen (20-views.js): its weather, its band, and the day's colour in the sky */
function skyView(id) {
	if (!document.documentElement.dataset.world) return;
	const root = document.documentElement;
	const on = skyOn();
	root.dataset.skyOn = on ? '1' : '0';
	root.dataset.skyNow = skyMode();
	const btn = $('#skyBtn');
	if (btn) btn.hidden = !on;
	if (!on) {
		skyFx.off();
		return;
	}
	const kind = skyKind(id);
	root.dataset.wx = kind;
	const d = dayById[id];
	root.style.setProperty('--sky-tint', d ? `var(--l${d.c})` : 'var(--sky-low)');
	const sec = document.getElementById(id);
	skyFx.view(sec && sec.querySelector(':scope > [data-band]'), kind);
	skyBtnSync();
}
function skyBtnSync() {
	const b = $('#skyBtn');
	if (!b) return;
	const paused = skyPaused();
	b.setAttribute('aria-pressed', String(paused));
	b.setAttribute('aria-label', paused ? Z('继续下雪', 'Let it snow') : Z('暂停下雪', 'Pause the snow'));
	b.title = b.getAttribute('aria-label');
	b.querySelector('use').setAttribute('href', paused ? '#i-play' : '#i-pause');
}
const skyPaused = () => (LOOK.snow != null ? !LOOK.snow : !!store.get('skyPaused', false));
/** the other views' band of sky (the overview and the days draw their own): the view's title moves into it, with
 *  today's weather under it during the trip */
function skyBands() {
	if (!skyOn()) return;
	const now = tpNow();
	const td = DAYS.find((d) => d.date === now.date);
	$$('#app > section.sec').forEach((s) => {
		if (s.querySelector(':scope > [data-band]')) return;
		const h = s.querySelector(':scope > .sec-title');
		s.insertAdjacentHTML('afterbegin', bandHTML(td ? wxLine(td) : ''));
		if (h) s.querySelector(':scope > [data-band] .band-col').prepend(h);
	});
}

const skyFx = (() => {
	const root = document.documentElement;
	const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');
	const deskMQ = matchMedia('(min-width: 1024px)');
	const st = { mode: 'off', kind: Sky.DEFAULT_KIND, running: false, t: 0, energy: 0, full: deskMQ.matches, ready: false };
	let barCv = null;
	let fullCv = null;
	let fullBox = null;
	const bandCv = document.createElement('canvas');
	bandCv.className = 'band-cv';
	bandCv.setAttribute('aria-hidden', 'true');
	let band = null;
	let flakes = [];
	let stars = [];
	let raf = 0;
	let last = 0;
	let work = 4;
	let half = false;
	let skip = false;
	let smoothT = 0;
	let G = null;
	let col = {};
	let sprite = null;
	const caps = { drift: null, ground: null, tabs: new Map(), cards: new Map() };
	const rand = (a, b) => a + Math.random() * (b - a);
	const driftBase = (x) => 17 + 5 * Math.sin(x * 0.013 + 0.6) + 3 * Math.sin(x * 0.037 + 2.1);
	const groundBase = (x) => 30 + 12 * Math.sin(x * 0.0042 + 1) + 6 * Math.sin(x * 0.011 + 0.3);
	const capAt = (c, x) => {
		if (!c) return 0;
		const i = Math.round((x - c.x0) / 3);
		return i >= 0 && i < c.h.length ? c.h[i] : 0;
	};
	const newCap = (x0, w, max) => ({ x0, w, max, h: new Float32Array(Math.ceil(w / 3) + 2) });
	function addCap(c, x, r) {
		const i = Math.round((x - c.x0) / 3);
		const amt = 0.3 + r * 0.16;
		for (let k = -3; k <= 3; k++) {
			const j = i + k;
			if (j >= 1 && j < c.h.length - 1) c.h[j] = Math.min(c.max, c.h[j] + amt * Math.exp(-(k * k) / 4));
		}
	}
	function smoothCap(c) {
		const h = c.h;
		for (let j = 1; j < h.length - 1; j++) h[j] = (h[j - 1] + 2 * h[j] + h[j + 1]) / 4;
		h[0] = h[h.length - 1] = 0;
	}
	const fall = () => Sky.fallFor(st.mode, st.kind);
	function readColours() {
		const cs = getComputedStyle(root);
		const g = (n) => cs.getPropertyValue(n).trim();
		col = {
			flake: g('--snow-flake'),
			rim: g('--snow-flake-rim'),
			cap: g('--snow-cap'),
			capRim: g('--snow-cap-rim'),
			star: g('--sky-star'),
			paper: g('--paper'),
			driftRim: g('--snow-drift-rim'),
		};
		const s = document.createElement('canvas');
		s.width = s.height = 32;
		const x = s.getContext('2d');
		if (!x) return;
		const rg = x.createRadialGradient(16, 16, 5, 16, 16, 11);
		rg.addColorStop(0, col.rim || 'rgba(0,0,0,0)');
		rg.addColorStop(1, 'rgba(0,0,0,0)');
		x.fillStyle = rg;
		x.fillRect(0, 0, 32, 32);
		x.shadowColor = col.flake;
		x.shadowBlur = 4;
		x.fillStyle = col.flake;
		x.beginPath();
		x.arc(16, 16, 7, 0, Math.PI * 2);
		x.fill();
		sprite = s;
	}
	function geom() {
		const W = innerWidth;
		const H = innerHeight;
		if (st.full) {
			const ground = (x) => H - groundBase(x) - capAt(caps.ground, x);
			return { W, H, top: 0, bottom: H, area: W * H, max: Sky.CAP.desk, cx: W / 2, cy: H * 0.42, ridge: ground };
		}
		const hb = $('#bar').getBoundingClientRect();
		const br = band && band.isConnected ? band.getBoundingClientRect() : null;
		const foot = br ? br.bottom : hb.bottom;
		const open = foot > hb.bottom + 2;
		const bottom = Math.max(hb.bottom, foot);
		return {
			W,
			H,
			hb,
			br,
			top: 0,
			hBottom: hb.bottom,
			bottom,
			area: W * bottom,
			max: Sky.CAP.phone,
			cx: W / 2,
			cy: bottom * 0.6,
			ridge: open ? (x) => Math.max(hb.bottom, foot - driftBase(x) - capAt(caps.drift, x)) : () => hb.bottom,
		};
	}
	function spawn(f, g, P, spread) {
		const d = Math.random();
		f.d = d;
		f.kind = P.kind;
		f.r = P.r[0] + (P.r[1] - P.r[0]) * Math.pow(d, 1.6);
		f.sp = P.v[0] + (P.v[1] - P.v[0]) * d;
		f.a = 0.5 + 0.5 * d;
		f.x = rand(-20, g.W + 20);
		f.y = spread ? rand(g.top - 10, g.bottom - 8) : -rand(6, 40);
		f.vx = P.wind;
		f.vy = f.sp;
		f.ph = rand(0, 6.28);
		f.wf = rand(0.6, 1.6);
		f.tw = rand(1.5, 4);
		f.fade = 1;
		f.extra = false;
		f.dead = false;
		f.landed = false;
		f.py = f.y;
		return f;
	}
	function makeStars(g) {
		const h = st.full ? g.H : g.bottom;
		const n = Math.max(40, Math.min(260, Math.round((g.W * h) / 1500)));
		stars = Array.from({ length: n }, () => {
			const big = Math.random() < 0.12;
			return {
				x: rand(0, g.W),
				y: rand(0, h * 0.94),
				r: big ? rand(1.6, 2.4) : rand(0.7, 1.5),
				a: big ? rand(0.75, 1) : rand(0.35, 0.85),
				tw: Math.random() < 0.25 ? rand(1, 2.4) : 0,
				ph: rand(0, 6.28),
				big,
			};
		});
	}
	function populate(spread) {
		G = geom();
		const P = fall();
		const n = Sky.flakesFor(P, G.area, G.max);
		flakes = [];
		for (let i = 0; i < n; i++) flakes.push(spawn({}, G, P, spread));
		makeStars(G);
	}
	// sky 3: the date tabs in the header, and on a desktop the rail's card and the view's card, catch snow
	function tabSurfaces() {
		if (st.full || st.mode !== 'pile') return [];
		const strip = $('#tabs').getBoundingClientRect();
		return $$('#tabs .tab')
			.map((el) => {
				const r = el.getBoundingClientRect();
				if (r.right < strip.left + 8 || r.left > strip.right - 8) return null;
				let c = caps.tabs.get(el);
				if (!c || c.w !== Math.round(r.width)) {
					c = newCap(0, Math.round(r.width), 6);
					caps.tabs.set(el, c);
				}
				return { el, c, l: r.left, r: r.right, top: r.top };
			})
			.filter(Boolean);
	}
	function cardSurfaces() {
		if (!st.full || st.mode !== 'pile') return [];
		const view = curView && document.getElementById(curView);
		const els = [$('#rail .rail-card'), view].filter(Boolean);
		return els
			.map((el) => {
				const r = el.getBoundingClientRect();
				let c = caps.cards.get(el);
				if (!c || c.w !== Math.round(r.width)) {
					c = newCap(0, Math.round(r.width), 10);
					caps.cards.set(el, c);
				}
				return { el, c, l: r.left, r: r.right, top: r.top };
			})
			.filter((s) => s.top > 0 && s.top < innerHeight);
	}
	/** dt: this frame's motion step (capped, so a slow frame never throws the flakes far); real: the time that passed */
	function step(dt, real) {
		st.t += dt;
		const g = (G = geom());
		const P = fall();
		if (!st.full && band) {
			const w = Math.round(g.W);
			if (!caps.drift || caps.drift.w !== w) caps.drift = newCap(0, w, 12);
		}
		if (st.full) {
			const w = Math.round(g.W);
			if (!caps.ground || caps.ground.w !== w) caps.ground = newCap(0, w, 14);
		}
		let inten = 1;
		if (P.gust) inten = 0.1 + 0.9 * Math.pow(Math.max(0, Math.sin(((st.t % 15) / 15) * Math.PI)), 1.5);
		const target = Math.round(Sky.flakesFor(P, g.area, g.max) * inten);
		let live = 0;
		for (const f of flakes) if (!f.extra && f.fade >= 1 && f.kind === P.kind) live++;
		if (live < target) {
			const n = Math.min(target - live, Math.ceil(target * dt * 0.9) + 1);
			for (let i = 0; i < n; i++) flakes.push(spawn({}, g, P, false));
		} else if (live > target) {
			let drop = live - target;
			for (const f of flakes) {
				if (drop <= 0) break;
				if (!f.extra && f.fade >= 1 && f.kind === P.kind) {
					f.fade = 0.999;
					drop--;
				}
			}
		}
		for (const f of flakes) if (f.kind !== P.kind && f.fade >= 1) f.fade = 0.999;
		const surfaces = [...tabSurfaces(), ...cardSurfaces()];
		const e = st.energy;
		const drag = 2.3 * (1 - Math.min(0.8, e * 0.55));
		const swirl = e * 2.4;
		for (const f of flakes) {
			f.ph += f.wf * dt;
			let tvx = P.wind * (0.6 + f.d * 0.6) + Math.sin(f.ph) * P.wob * (0.5 + f.d);
			let tvy = f.sp;
			if (e > 0.02) {
				const dx = f.x - g.cx;
				const dy = f.y - g.cy;
				const dist = Math.hypot(dx, dy) + 30;
				const vt = swirl * Math.min(dist, 220) * (1.2 - Math.min(1, dist / 600));
				tvx += (-dy / dist) * vt;
				tvy += (dx / dist) * vt;
			}
			const k = Math.min(1, drag * dt);
			f.vx += (tvx - f.vx) * k;
			f.vy += (tvy - f.vy) * k;
			f.py = f.y;
			f.x += f.vx * dt;
			f.y += f.vy * dt;
			if (f.fade < 1) {
				f.fade -= dt * 1.4;
				if (f.fade <= 0) f.dead = true;
			}
			if (f.x < -30) f.x += g.W + 60;
			else if (f.x > g.W + 30) f.x -= g.W + 60;
			if (st.mode === 'globe' && e > 0.02 && f.y < g.top + 2) {
				f.y = g.top + 2;
				f.vy = Math.abs(f.vy) * 0.5;
			} else if (f.y < -80) {
				f.y = -80;
				f.vy = Math.abs(f.vy) * 0.4;
			}
			if (f.kind === 'snow' && !f.extra && surfaces.length) {
				for (const s of surfaces) {
					if (f.x > s.l + 6 && f.x < s.r - 6) {
						const y = s.top - capAt(s.c, f.x - s.l);
						if (f.py < y && f.y >= y && Math.random() < 0.65) {
							addCap(s.c, f.x - s.l, f.r);
							f.landed = true;
							break;
						}
					}
				}
			}
			if (f.landed || f.y >= g.ridge(f.x) - f.r * 0.4) {
				if (!f.landed && st.mode === 'pile' && f.kind === 'snow' && !f.extra && f.y < g.bottom + 4) {
					const c = st.full ? caps.ground : caps.drift;
					if (c) addCap(c, f.x, f.r);
				}
				f.landed = false;
				if (f.extra || f.fade < 1) f.dead = true;
				else spawn(f, g, P, false);
			}
		}
		if (flakes.some((f) => f.dead)) flakes = flakes.filter((f) => !f.dead);
		// a shake settles over about five seconds of real time (core/sky.mjs SETTLE), even when frames come slowly
		st.energy = e * Math.exp(-real / Sky.TAU);
		if (st.energy < 0.01) st.energy = 0;
		smoothT += dt;
		if (smoothT > 0.35) {
			smoothT = 0;
			[caps.drift, caps.ground, ...caps.tabs.values(), ...caps.cards.values()].forEach((c) => c && smoothCap(c));
		}
	}
	function size(cv, w, h, d) {
		const W = Math.round(w * d);
		const H = Math.round(h * d);
		if (cv.width !== W || cv.height !== H) {
			cv.width = W;
			cv.height = H;
		}
	}
	function ridgePath(c, x0, x1, bottom, fy) {
		c.beginPath();
		c.moveTo(x0, bottom);
		for (let x = x0; x <= x1 + 4; x += 4) c.lineTo(x, fy(Math.min(x, x1)));
		c.lineTo(x1, bottom);
		c.closePath();
	}
	function rimPath(c, x0, x1, fy) {
		c.beginPath();
		for (let x = x0; x <= x1 + 4; x += 4) {
			const y = fy(Math.min(x, x1));
			if (x === x0) c.moveTo(x, y);
			else c.lineTo(x, y);
		}
	}
	function drawCap(c, s, radius) {
		const w = s.r - s.l;
		const fy = (x) => {
			const lx = x - s.l;
			const edge = Math.min(1, lx / radius, (w - lx) / radius);
			return s.top - capAt(s.c, lx) * Math.max(0, edge) + 0.5;
		};
		if (!s.c.h.some((v) => v > 0.4)) return;
		ridgePath(c, s.l, s.r, s.top + 1, fy);
		c.fillStyle = col.cap;
		c.fill();
		rimPath(c, s.l, s.r, fy);
		c.strokeStyle = col.capRim;
		c.lineWidth = 1;
		c.stroke();
	}
	function draw() {
		if (!sprite || st.mode === 'off') return;
		if (!G) G = geom();
		const g = G;
		const d = Math.min(2, devicePixelRatio || 1);
		const P = fall();
		const targets = st.full ? [[fullCv, 0, g.H]] : [[barCv, g.hb.top, g.hb.height], ...(g.br && band ? [[bandCv, g.br.top, g.br.height]] : [])];
		for (const [cv, top, h] of targets) {
			if (!cv || h <= 0) continue;
			size(cv, g.W, h, d);
			const c = cv.getContext('2d');
			if (!c) continue;
			c.setTransform(d, 0, 0, d, 0, -top * d);
			c.clearRect(0, top, g.W, h);
			const lo = cv === bandCv ? Math.max(top, g.hBottom) - 8 : top - 8;
			const hi = top + h + 8;
			if (P.stars) {
				c.fillStyle = col.star;
				for (const s of stars) {
					if (s.y < lo || s.y > hi) continue;
					c.globalAlpha = s.a * (s.tw && st.running ? 0.6 + 0.4 * Math.sin(st.t * s.tw + s.ph) : 1);
					if (s.big) c.drawImage(sprite, s.x - s.r * 1.6, s.y - s.r * 1.6, s.r * 3.2, s.r * 3.2);
					else c.fillRect(s.x - s.r / 2, s.y - s.r / 2, s.r, s.r);
				}
			}
			for (const f of flakes) {
				if (f.y < lo || f.y > hi) continue;
				let a = f.a * Math.max(0, Math.min(1, f.fade));
				if (f.kind === 'glint') a *= 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(st.t * f.tw + f.ph), 3);
				c.globalAlpha = a;
				const s = f.r * 2.3;
				c.drawImage(sprite, f.x - s, f.y - s, s * 2, s * 2);
			}
			c.globalAlpha = 1;
			// the band ends in a drift of snow the page's paper is made of; a desktop's sky in a snowy ground
			if (cv === bandCv && g.br) {
				const fy = (x) => g.br.bottom - driftBase(x) - capAt(caps.drift, x);
				ridgePath(c, 0, g.W, g.br.bottom + 1, fy);
				c.fillStyle = col.paper;
				c.fill();
				rimPath(c, 0, g.W, fy);
				c.strokeStyle = col.driftRim;
				c.lineWidth = 1.25;
				c.stroke();
			}
			if (cv === fullCv) {
				const fy = (x) => g.H - groundBase(x) - capAt(caps.ground, x);
				ridgePath(c, 0, g.W, g.H + 1, fy);
				c.fillStyle = col.paper;
				c.fill();
				rimPath(c, 0, g.W, fy);
				c.strokeStyle = col.driftRim;
				c.lineWidth = 1.25;
				c.stroke();
				for (const s of cardSurfaces()) drawCap(c, s, 22);
			}
			if (cv === barCv) for (const s of tabSurfaces()) drawCap(c, s, 10);
		}
	}
	function tick(now) {
		if (!st.running) return;
		raf = requestAnimationFrame(tick);
		if (half) {
			skip = !skip;
			if (skip) return;
		}
		const real = last ? Math.min(0.5, (now - last) / 1000) : 1 / 60;
		const dt = Math.min(half ? 0.07 : 0.05, real);
		last = now;
		const t0 = performance.now();
		step(dt, real);
		draw();
		work = work * 0.95 + (performance.now() - t0) * 0.05;
		if (!half && work > 9) half = true; // an older phone: 30 frames a second
	}
	const moving = () => st.mode !== 'off' && !skyPaused() && !reduceMQ.matches && !document.hidden;
	function start() {
		if (st.running || !moving()) return;
		st.running = true;
		root.dataset.snowing = '1';
		last = 0;
		raf = requestAnimationFrame(tick);
	}
	function stop() {
		st.running = false;
		delete root.dataset.snowing;
		cancelAnimationFrame(raf);
		raf = 0;
	}
	function still() {
		G = geom();
		draw();
	}
	function sync() {
		if (moving()) start();
		else {
			stop();
			still();
		}
	}
	function placeBand() {
		if (st.full || !band) {
			bandCv.remove();
			return;
		}
		if (bandCv.parentNode !== band) band.prepend(bandCv);
	}
	function setup() {
		if (st.ready) return;
		st.ready = true;
		barCv = document.createElement('canvas');
		barCv.className = 'bar-cv';
		barCv.setAttribute('aria-hidden', 'true');
		$('#bar').prepend(barCv);
		fullBox = document.createElement('div');
		fullBox.className = 'sky-full';
		fullBox.setAttribute('aria-hidden', 'true');
		fullCv = document.createElement('canvas');
		fullCv.className = 'full-cv';
		fullBox.append(fullCv);
		document.body.prepend(fullBox);
		readColours();
		document.addEventListener('visibilitychange', sync);
		reduceMQ.addEventListener('change', () => {
			populate(true);
			sync();
		});
		deskMQ.addEventListener('change', () => {
			st.full = deskMQ.matches;
			caps.ground = caps.drift = null;
			placeBand();
			populate(true);
			sync();
		});
		addEventListener('resize', () => {
			G = geom();
			makeStars(G);
			if (!st.running) still();
		});
		addEventListener(
			'scroll',
			() => {
				if (!st.running) still();
			},
			{ passive: true },
		);
		matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
			readColours();
			if (!st.running) still();
		});
		new MutationObserver(() => {
			readColours();
			if (!st.running) still();
		}).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
		// the snow globe: a sideways swipe across the sky whips the snow up (never device motion)
		let p = null;
		const onSky = (e) =>
			st.full
				? !e.target.closest('#app, .rail, .bar, dialog, .toc-fab, .back-pill, a, button')
				: !!e.target.closest('[data-band]') && !e.target.closest('a, button');
		addEventListener(
			'pointerdown',
			(e) => {
				if (st.mode === 'globe' && moving() && onSky(e)) p = { id: e.pointerId, x: e.clientX, t: performance.now() };
			},
			{ passive: true },
		);
		addEventListener(
			'pointermove',
			(e) => {
				if (!p || e.pointerId !== p.id) return;
				const now = performance.now();
				const dx = e.clientX - p.x;
				const vx = (dx / Math.max(8, now - p.t)) * 1000;
				for (const f of flakes) {
					const dist = Math.hypot(f.x - e.clientX, f.y - e.clientY);
					if (dist < 120) {
						const k = 1 - dist / 120;
						f.vx += vx * 0.45 * k;
						f.vy -= Math.abs(vx) * 0.25 * k;
					}
				}
				st.energy = Math.min(1.4, st.energy + Math.abs(dx) * 0.0025);
				p.x = e.clientX;
				p.t = now;
			},
			{ passive: true },
		);
		const up = (e) => {
			if (p && e.pointerId === p.id) p = null;
		};
		addEventListener('pointerup', up, { passive: true });
		addEventListener('pointercancel', up, { passive: true });
	}
	return {
		/** the view's band and weather; starts the sky the first time */
		view(el, kind) {
			const mode = skyMode();
			const fresh = !st.ready || mode !== st.mode;
			setup();
			st.mode = mode;
			st.full = deskMQ.matches;
			band = el || null;
			caps.drift = null;
			caps.cards.clear();
			placeBand();
			const was = st.kind;
			st.kind = kind;
			if (fresh || !moving()) populate(true);
			else if (Sky.FALL[was] && Sky.FALL[was].kind === Sky.FALL[kind].kind && mode !== 'globe') {
				// the same kind of fall: the flakes already there change pace and size, and the rest fade in or out
				const P = fall();
				for (const f of flakes) {
					if (f.extra) continue;
					f.sp = P.v[0] + (P.v[1] - P.v[0]) * f.d;
					f.r = P.r[0] + (P.r[1] - P.r[0]) * Math.pow(f.d, 1.6);
				}
			}
			G = geom();
			if (!stars.length) makeStars(G);
			sync();
		},
		off() {
			st.mode = 'off';
			stop();
			flakes = [];
			[barCv, bandCv, fullCv].forEach((cv) => cv && cv.getContext('2d') && cv.getContext('2d').clearRect(0, 0, cv.width, cv.height));
		},
		sync,
		colours() {
			readColours();
			if (!st.running) still();
		},
		/** the globe's Shake: the snow whirls up off the ground and settles again */
		shake() {
			if (!moving() || st.mode !== 'globe') return;
			G = G || geom();
			st.energy = Math.min(1.7, st.energy + 1);
			for (const f of flakes) {
				f.vx += rand(-220, 220);
				f.vy -= rand(60, 220);
			}
			const P = fall();
			const n = st.full ? 120 : 72;
			for (let i = 0; i < n && flakes.length < 340; i++) {
				const f = spawn({}, G, P, false);
				const x = rand(0, G.W);
				f.x = x;
				f.y = G.ridge(x) - 3;
				f.vx = rand(-200, 200);
				f.vy = -rand(140, 340);
				f.extra = true;
				flakes.push(f);
			}
		},
		/** sky 3: a tapped date tab knocks its snow off */
		puff(tab) {
			const c = caps.tabs.get(tab);
			if (!c || !moving()) return;
			const r = tab.getBoundingClientRect();
			const amount = c.h.reduce((s, v) => s + v, 0);
			const n = Math.min(26, Math.round(amount / 6));
			for (let i = 0; i < n; i++) {
				const f = spawn({}, G || geom(), Sky.FALL.light, false);
				f.x = rand(r.left + 4, r.right - 4);
				f.y = r.top - rand(0, 4);
				f.vx = rand(-90, 90);
				f.vy = -rand(40, 140);
				f.extra = true;
				f.kind = 'snow';
				f.r = rand(1, 2.2);
				flakes.push(f);
			}
			c.h.fill(0);
		},
		/** how much snow sits on a tab (tests and the preview) */
		capOn(tab) {
			const c = caps.tabs.get(tab);
			return c ? c.h.reduce((s, v) => s + v, 0) : 0;
		},
		state: () => ({ mode: st.mode, kind: st.kind, running: st.running, flakes: flakes.length, energy: st.energy, half }),
	};
})();
document.addEventListener('click', (e) => {
	const t = e.target.closest('button, a');
	if (!t) return;
	if (t.id === 'skyBtn') {
		store.set('skyPaused', !skyPaused());
		LOOK.snow = null;
		skyBtnSync();
		skyFx.sync();
		return;
	}
	if (t.matches('[data-shake]')) {
		skyFx.shake();
		return;
	}
	if (t.matches('#tabs .tab') && skyMode() === 'pile') skyFx.puff(t);
});
// for the tests and the preview panel: what the sky is doing, without reaching into it
window.RJ_SKY = { state: () => skyFx.state(), capOn: (el) => skyFx.capOn(el) };
