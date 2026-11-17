// Japan: what the page knows about travelling there, whatever the region. Pure (no imports, no DOM, no trip globals):
// engine/build.mjs inlines it, merged with the region's pack, as the page's `Pack` when TRIP.destination is 'jp'.
// Amounts are in yen; the trip's own currency settings stay in TRIP.currency. Facts and sources: knowledge.md.

export const country = ['日本', 'Japan'];
export const sym = '¥';

/**
 * the native layer: the group reads Chinese or English, so stops and places also show their Japanese, one tap to copy;
 * `ask` is "please take us here" on the driver card
 */
export const native = { lang: 'ja', name: ['日文', 'Japanese'], ask: 'この場所までお願いします。' };

/** tourist tax-free (the refund method since 2026-11-01): at least this much, before tax, in one shop on one day */
export const taxRefund = { min: 5000 };
