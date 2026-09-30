// Bar-chart axes sized to the data. Pure; wrapped as `Chart` inside the page script.

/** an axis from 0 past `max` in `ticks` round steps (1, 2, 2.5, 3 or 5 × 10ⁿ): { top, marks: [0, step, …, top] } */
export function axis(max, ticks = 4) {
	const raw = Math.max(max, 1) / ticks;
	const p = 10 ** Math.floor(Math.log10(raw));
	const step = [1, 2, 2.5, 3, 5, 10].map((m) => m * p).find((s) => s >= raw);
	return { top: step * ticks, marks: Array.from({ length: ticks + 1 }, (_, i) => i * step) };
}
