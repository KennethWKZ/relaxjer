// Getting around: instant tab jumps with a landing glow, the Back pill, the Sections menu, site search, offline notice.
import { test, expect, openTrip } from '../support/fixtures.mjs';
import { settle } from '../support/page.mjs';

const top = (page, sel) => page.locator(sel).evaluate((e) => e.getBoundingClientRect().top);
// a landed section sits just under the sticky bar; the legacy suites allowed a few px of sub-pixel overshoot
const LANDED = { min: -5, max: 260 };

test('a tab jump is instant and lands with a glow that fades', async ({ page }) => {
  await openTrip(page);
  // watch from the tap: scroll positions for 600 ms, and when the landing glow comes and goes (for up to 3 s)
  const run = await page.evaluate(
    () =>
      new Promise((done) => {
        const seen = new Set();
        const glow = { on: null, off: null };
        const sec = document.getElementById('budget');
        const mo = new MutationObserver(() => {
          const lit = !!sec.querySelector('.landed');
          if (lit && glow.on == null) glow.on = performance.now() - t0;
          if (!lit && glow.on != null && glow.off == null) glow.off = performance.now() - t0;
        });
        mo.observe(sec, { subtree: true, attributes: true, attributeFilter: ['class'] });
        const t0 = performance.now();
        document.querySelector('.tab[href="#budget"]').click();
        const tick = () => {
          if (performance.now() - t0 < 600) seen.add(Math.round(scrollY));
          if (performance.now() - t0 < 3000 && glow.off == null) requestAnimationFrame(tick);
          else { mo.disconnect(); done({ positions: seen.size, ...glow }); }
        };
        requestAnimationFrame(tick);
      }),
  );
  // Instant: the first frame already lands; a few corrections follow while undrawn sections above get their real
  // height (content-visibility). A smooth scroll over this distance would show dozens of positions.
  expect(run.positions, 'distinct scroll positions during the jump').toBeLessThanOrEqual(6);
  const t = await top(page, '#budget');
  expect(t).toBeGreaterThanOrEqual(LANDED.min);
  expect(t).toBeLessThan(LANDED.max);
  expect(run.on, 'the landing glow appeared').not.toBeNull();
  expect(run.off, 'and faded').not.toBeNull();
  expect(run.off - run.on, 'glow lasts about a second').toBeLessThan(1500);
});

test('the Back pill returns to where the reader was before a jump', async ({ page }) => {
  await openTrip(page);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.3));
  await settle(page);
  const before = await page.evaluate(() => scrollY);
  await page.locator('.tab[href="#rules"]').first().click();
  await settle(page);
  const pill = page.locator('#backPill');
  await expect(pill).toHaveAttribute('data-show', '1');
  await pill.click();
  await settle(page);
  expect(Math.abs((await page.evaluate(() => scrollY)) - before)).toBeLessThan(30);
  await expect(pill).toHaveAttribute('data-show', '0');
});

test('the Sections menu jumps to a section and closes', async ({ page }) => {
  await openTrip(page);
  // the Sections button floats in once the reader has scrolled past the top
  await page.evaluate(() => window.scrollBy(0, 1200));
  await settle(page);
  await expect(page.locator('#tocBtn')).toHaveAttribute('data-show', '1');
  await page.locator('#tocBtn').click();
  const toc = page.locator('#toc');
  await expect(toc).toBeVisible();
  await toc.locator('a[href="#budget"]').first().click();
  await expect(toc).toBeHidden();
  await settle(page);
  const t = await top(page, '#budget');
  expect(t).toBeGreaterThanOrEqual(LANDED.min);
  expect(t).toBeLessThan(LANDED.max);
});

test('site search finds a stop and jumps to it @demo', async ({ page }) => {
  await openTrip(page);
  await page.locator('#searchBtn').click();
  await page.locator('#q').fill('Yehliu');
  const hit = page.locator('#results-inner .result[data-hit]').first();
  await expect(hit).toBeVisible();
  const text = (await hit.textContent()).trim();
  await hit.click();
  await settle(page);
  // Day 4 is on screen, and its title (the text that matched) sits under the sticky bar
  const d4 = await top(page, '#d4');
  expect(d4).toBeGreaterThanOrEqual(LANDED.min);
  expect(d4).toBeLessThan(await page.evaluate(() => innerHeight / 2));
  await expect(page.locator('#d4')).toContainText(text.split('→')[0].trim());
});

test('going offline shows a notice, coming back hides it', async ({ page, context }) => {
  await openTrip(page);
  const note = page.locator('#netOff');
  await expect(note).toBeHidden();
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(note).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(note).toBeHidden();
});
