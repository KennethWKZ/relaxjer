// The host scans every page before it goes live and refuses one it thinks carries a payment card number
// ("Scan failed: payment_card"). An SVG drawn inline in the CSS, JS or HTML reaches the page as text, and a path's
// numbers separated only by spaces can read as one: the snow world's hills ("… 400 104 540 70 640 92") held
// 4001 0454 0706 4092, a Visa-shaped number that passes the Luhn check, and every publish was refused (2026-11-22).
// Commas between path numbers draw the same and break the run. Pictures the build base64-encodes (themes/*-art) aren't
// read that way by the host, so they're left out here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../support/stage.mjs';

// the issuer prefixes and lengths a card scanner knows (Visa, Mastercard, Amex, Discover, JCB, UnionPay, Diners)
const CARD = /^(4\d{12}(\d{3}){0,2}|5[1-5]\d{14}|2[2-7]\d{14}|3[47]\d{13}|6(011|5\d\d)\d{12,15}|35\d{14,17}|62\d{14,17}|3(0[0-5]|[68]\d)\d{11,16})$/;
const luhn = (d) =>
	[...d].reverse().reduce((t, c, i) => {
		let n = +c;
		if (i % 2) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
		return t + n;
	}, 0) %
		10 ===
	0;
/** numbers separated only by spaces whose digits hold a card-shaped run (13–19 digits) that passes the Luhn check */
export const cardLike = (s) =>
	[...s.matchAll(/(?<![\d.])\d+(?: \d+)+/g)]
		.map((m) => m[0])
		.filter((run) => {
			const d = run.replace(/\D/g, '');
			for (let n = 13; n <= 19; n++) for (let i = 0; i + n <= d.length; i++) if (CARD.test(d.slice(i, i + n)) && luhn(d.slice(i, i + n))) return true;
			return false;
		});

test('the check finds the run that got a page refused, and passes the same path with commas', () => {
	assert.deepEqual(cardLike("d='M0 120C60 96 130 84 200 94S320 120 400 104 540 70 640 92V200H0z'").length, 1);
	assert.deepEqual(cardLike("d='M0,120C60,96,130,84,200,94S320,120,400,104,540,70,640,92V200H0z'"), []);
});

test('nothing the engine writes into the page as text reads as a payment card number', () => {
	const src = path.join(ROOT, 'engine', 'src');
	const found = fs
		.readdirSync(src, { recursive: true })
		.filter((f) => /\.(m?js|html|css)$/.test(f))
		.flatMap((f) => {
			const s = fs.readFileSync(path.join(src, f), 'utf8');
			return [...new Set([...cardLike(s), ...cardLike(decodeURIComponent(s.replace(/%(?![0-9A-Fa-f]{2})/g, '%25')))])].map((r) => `${f}: ${r}`);
		});
	assert.deepEqual(found, [], 'use commas between the numbers of an inline SVG path (it draws the same)');
});
