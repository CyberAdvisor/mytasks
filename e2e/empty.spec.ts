/** Empty states (Section 6): an empty list shows its drawing and line; a task replaces them. */
import { expect, test } from '@playwright/test';
import { addTask, connect, openList } from './app';
import { fakeGitHub } from './fakeGitHub';

test('empty lists show their drawing and line, which go once a task is added', async ({ page, context }) => {
  await fakeGitHub(context);
  await connect(page);

  await openList(page, 'Inbox');
  await expect(page.getByRole('img', { name: 'Empty Inbox' })).toBeVisible();
  await expect(page.getByText('Your Inbox is clear. New tasks land here.')).toBeVisible();

  await addTask(page, 'First task');
  await expect(page.getByRole('img', { name: 'Empty Inbox' })).toHaveCount(0);

  await openList(page, 'Completed');
  await expect(page.getByRole('img', { name: 'Empty Completed' })).toBeVisible();
  await expect(page.getByText('Completed tasks appear here.')).toBeVisible();
});
