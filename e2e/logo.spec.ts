/**
 * The logo (FR-V.5): the M-check monogram shows on Setup in the app's Light
 * and Dark colours, and the icon file the browser tab uses is the new one.
 */
import { expect, test } from '@playwright/test';

/** The computed fill of the logo's tile and stroke of its M. */
async function logoColours(page: import('@playwright/test').Page) {
  const logo = page.getByRole('img', { name: 'My Tasks logo' });
  await expect(logo).toBeVisible();
  return logo.evaluate((svg) => ({
    tile: getComputedStyle(svg.querySelector('rect')!).fill,
    m: getComputedStyle(svg.querySelector('path')!).stroke,
  }));
}

test('the logo follows Light and Dark, and the tab icon is the monogram', async ({ page, request }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/app/');
  expect(await logoColours(page)).toEqual({ tile: 'rgb(113, 43, 19)', m: 'rgb(245, 196, 179)' });

  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await logoColours(page)).toEqual({ tile: 'rgb(153, 60, 29)', m: 'rgb(250, 236, 231)' });

  const href = await page.locator('link[rel="icon"][type="image/svg+xml"]').getAttribute('href');
  const icon = await (await request.get(new URL(href!, page.url()).href)).text();
  expect(icon).toContain('#712B13');
});
