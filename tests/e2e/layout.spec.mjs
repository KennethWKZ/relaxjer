// Nothing sticks out sideways and no text is squeezed into a sliver, in both languages, with every list open.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { openAllDetails, overflow, squeezed, switchLang } from '../support/page.mjs';

for (const lang of ['en', 'zh']) {
  test(`no sideways overflow or squeezed text (${lang})`, async ({ page }) => {
    await openTrip(page);
    if (lang === 'zh') await switchLang(page, 'zh');
    expect(await overflow(page), 'closed lists').toEqual([]);
    await openAllDetails(page);
    expect(await overflow(page), 'every list open').toEqual([]);
    expect(await squeezed(page)).toEqual([]);
  });
}
