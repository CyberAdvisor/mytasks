/** The resizable sidebar (Section 6): drag its edge, kept after a reload, double-click resets. */
import { expect, test, type Page } from '@playwright/test';
import { connect } from './app';
import { fakeGitHub } from './fakeGitHub';

/** The sidebar's width, read from where its edge is. */
async function width(page: Page): Promise<number> {
  const box = await page.getByRole('separator', { name: 'Resize sidebar' }).boundingBox();
  return Math.round(box!.x + box!.width / 2);
}

/** Drag the sidebar's edge by dx pixels. */
async function drag(page: Page, dx: number): Promise<void> {
  const box = (await page.getByRole('separator', { name: 'Resize sidebar' }).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + 200;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y);
  await page.mouse.move(x + dx, y);
  await page.mouse.up();
}

test('the sidebar resizes, keeps its width after a reload, and resets on double-click', async ({ page, context }) => {
  await fakeGitHub(context);
  await connect(page);
  expect(await width(page)).toBe(260);

  await drag(page, 80);
  expect(await width(page)).toBe(340);
  await drag(page, 500);
  expect(await width(page)).toBe(400);

  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Lists' })).toBeVisible();
  expect(await width(page)).toBe(400);

  await drag(page, -500);
  expect(await width(page)).toBe(200);
  await page.getByRole('separator', { name: 'Resize sidebar' }).dblclick();
  expect(await width(page)).toBe(260);
});
