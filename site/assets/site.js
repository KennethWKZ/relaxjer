// The landing page's motion. Each demo loops only while its card is on screen, and its Pause button holds it
// (WCAG 2.2.2: anything that moves for more than five seconds can be paused). Each postcard settles once on the table
// the first time it comes into view. Without this script, or with reduced motion, the demos hold a still frame that
// shows what the feature does, and the postcards simply lie still.
(() => {
	const root = document.documentElement;
	root.classList.add('js');
	const reduce = matchMedia('(prefers-reduced-motion: reduce)');
	const demos = [...document.querySelectorAll('[data-demo]')];
	const cards = [...document.querySelectorAll('.settle')];

	if (!('IntersectionObserver' in window)) {
		// no observer: keep everything visible and still rather than half-animated
		root.classList.remove('js');
		return;
	}

	const visible = new Set();
	const sync = (demo) => {
		const run = visible.has(demo) && !demo.dataset.paused && !reduce.matches;
		if (run) demo.setAttribute('data-run', '');
		else demo.removeAttribute('data-run');
	};

	for (const demo of demos) {
		const btn = demo.querySelector('.pause');
		if (!btn) continue;
		btn.hidden = false;
		btn.addEventListener('click', () => {
			const paused = !demo.dataset.paused;
			if (paused) demo.dataset.paused = '1';
			else delete demo.dataset.paused;
			btn.toggleAttribute('data-paused', paused);
			btn.querySelector('.lbl').textContent = paused ? 'Play' : 'Pause';
			sync(demo);
		});
	}

	const seen = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (e.isIntersecting) visible.add(e.target);
				else visible.delete(e.target);
				sync(e.target);
			}
		},
		{ threshold: 0.35 },
	);
	demos.forEach((d) => seen.observe(d));

	const arrive = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (!e.isIntersecting) continue;
				e.target.classList.add('in');
				arrive.unobserve(e.target);
			}
		},
		{ rootMargin: '0px 0px -12% 0px' },
	);
	cards.forEach((c) => arrive.observe(c));

	reduce.addEventListener('change', () => demos.forEach(sync));
})();
