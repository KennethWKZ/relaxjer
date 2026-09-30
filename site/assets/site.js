// The landing page's one motion: each step's lantern settles on its string the first time it scrolls into view.
// Without this script, or with reduced motion, the lanterns simply hang still.
(() => {
	if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
	const io = new IntersectionObserver(
		(entries) => {
			for (const e of entries) {
				if (!e.isIntersecting) continue;
				e.target.classList.add('sway');
				io.unobserve(e.target);
			}
		},
		{ rootMargin: '0px 0px -15% 0px' },
	);
	document.querySelectorAll('.step').forEach((el) => io.observe(el));
})();
