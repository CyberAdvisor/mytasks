/**
 * Collapsible areas and headings (FR-2.7): the state is saved, survives a
 * reload and reaches a second device through the gist.
 */
import { expect, test, type Page } from '@playwright/test';
import { connect, synced, watchErrors } from './app';
import { fakeGitHub, FakeGitHub } from './fakeGitHub';

/** Fill a title field that has focus and leave it. */
async function name(page: Page, label: string, text: string): Promise<void> {
  const field = page.getByLabel(label);
  await field.fill(text);
  await field.blur();
}

test('areas and headings collapse, and stay collapsed after a reload and on another device', async ({ browser }) => {
  const gh = new FakeGitHub();
  const first = await browser.newContext();
  await fakeGitHub(first, gh);
  const a = await first.newPage();
  const errors = watchErrors(a);
  await connect(a);
  const nav = a.getByRole('navigation', { name: 'Lists' });

  // An area holding a project, whose heading holds a task.
  await nav.getByRole('button', { name: 'New List' }).click();
  await a.getByRole('menuitem', { name: 'New Area' }).click();
  await name(a, 'Area title', 'Home');
  await a.getByRole('button', { name: 'More area actions' }).click();
  await a.getByRole('menuitem', { name: 'New Project' }).click();
  await name(a, 'Project title', 'Garden');
  await a.getByRole('toolbar', { name: 'Actions' }).getByRole('button', { name: 'New Heading' }).click();
  await name(a, 'Heading title', 'Spring');
  await a.getByRole('button', { name: 'Add task under heading' }).click();
  await a.getByRole('group', { name: 'Edit task' }).getByPlaceholder('New Task').fill('Plant bulbs');
  await a.keyboard.press('Escape');
  await expect(a.getByText('Plant bulbs')).toBeVisible();

  // Collapse both: the project and the task are hidden; the heading shows its count.
  await nav.getByRole('button', { name: 'Collapse Home' }).click();
  await expect(nav.getByRole('link', { name: 'Garden' })).toBeHidden();
  await a.getByRole('button', { name: 'Collapse heading' }).click();
  await expect(a.getByText('Plant bulbs')).toBeHidden();
  await expect(a.getByTitle('Open tasks under this heading')).toHaveText('1');

  await a.reload();
  await expect(a.getByRole('button', { name: 'Expand heading' })).toBeVisible();
  await expect(a.getByText('Plant bulbs')).toBeHidden();
  await expect(nav.getByRole('button', { name: 'Expand Home' })).toBeVisible();
  await synced(a);
  await expect(a.getByText('Syncing…')).toBeHidden({ timeout: 15_000 });

  // A second device gets the same state from the gist.
  const second = await browser.newContext();
  await fakeGitHub(second, gh);
  const b = await second.newPage();
  await connect(b);
  const navB = b.getByRole('navigation', { name: 'Lists' });
  await expect(navB.getByRole('button', { name: 'Expand Home' })).toBeVisible();
  await expect(navB.getByRole('link', { name: 'Garden' })).toBeHidden();

  // Expanding shows them again.
  await navB.getByRole('button', { name: 'Expand Home' }).click();
  await navB.getByRole('link', { name: 'Garden' }).click();
  await b.getByRole('button', { name: 'Expand heading' }).click();
  await expect(b.getByText('Plant bulbs')).toBeVisible();

  expect(errors).toEqual([]);
  await first.close();
  await second.close();
});
