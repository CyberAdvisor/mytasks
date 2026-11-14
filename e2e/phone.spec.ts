/**
 * The phone layout (Section 6, under 768 px), in WebKit at iPhone size: a
 * Home screen of lists, push navigation into a list with a back link, and the
 * round + button in place of the toolbar (FR-10.5).
 */
import { expect, test } from '@playwright/test';
import { connect } from './app';
import { fakeGitHub } from './fakeGitHub';

test('Home screen of lists, a list, and the + button', async ({ page, context }) => {
  await fakeGitHub(context);
  await connect(page);
  const lists = page.getByRole('navigation', { name: 'Lists' });
  await expect(page.getByRole('toolbar', { name: 'Actions' })).toBeHidden();
  // The lists fill the screen, so there is no edge to resize (Section 6).
  await expect(page.getByRole('separator', { name: 'Resize sidebar' })).toHaveCount(0);

  await lists.getByRole('link', { name: 'Inbox' }).click();
  await expect(lists).toBeHidden();
  await page.getByRole('button', { name: 'New Task' }).click();
  const field = page.getByRole('dialog', { name: 'Quick Entry' }).getByPlaceholder('New Task');
  await field.fill('Pick up keys');
  await field.press('Enter');
  await expect(page.getByText('Pick up keys')).toBeVisible();

  await page.getByRole('link', { name: 'Lists' }).click();
  await expect(lists).toBeVisible();
});
