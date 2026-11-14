/**
 * Collapsible areas and headings (FR-2.7, v1.1.1): schema 5 adds a heading's
 * `collapsed`; both states sync, and collapsing isn't an undo step.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db, SCHEMA_VERSION } from '../src/lib/db/database';
import * as repo from '../src/lib/db/repo';
import { clearUndo, undo } from '../src/lib/db/history';
import { upgradeList } from '../src/lib/db/migrations';
import { isValidRecord } from '../src/lib/sync/validate';

beforeEach(async () => {
  await db.delete();
  await db.open();
  clearUndo();
});

/** A short pause, so a later `modifiedAt` differs. */
const tick = () => new Promise((r) => setTimeout(r, 5));

describe('schema 5', () => {
  it('upgrades a schema-4 list: headings start expanded, tombstones stay bare', () => {
    const at = '2026-11-01T00:00:00.000Z';
    const heading = { id: 'h', createdAt: at, modifiedAt: at, deletedAt: null, sortKey: 'a0', title: 'Week 1', projectId: 'p', archived: false };
    const gone = { id: 'g', deletedAt: at, modifiedAt: at };
    const old = { schema: 4, tables: { areas: [], projects: [], headings: [heading, gone], todos: [], checklistItems: [], tags: [], contexts: [], savedSearches: [] } };
    const list = upgradeList(old, SCHEMA_VERSION);
    expect(list.schema).toBe(5);
    expect(list.tables.headings[0]).toEqual({ ...heading, collapsed: false });
    expect(list.tables.headings[1]).toEqual(gone);
    expect(isValidRecord('headings', heading)).toBe(false);
    expect(isValidRecord('headings', list.tables.headings[0])).toBe(true);
  });
});

describe('collapsing (FR-2.7)', () => {
  it('saves a heading’s state as a synced change that undo leaves alone', async () => {
    const projectId = await repo.createProject({ title: 'P' });
    const id = await repo.createHeading(projectId, 'Week 1');
    const before = await db.headings.get(id);
    expect(before?.collapsed).toBe(false);
    clearUndo();
    await tick();
    await repo.setHeadingCollapsed(id, true);
    const after = await db.headings.get(id);
    expect(after?.collapsed).toBe(true);
    expect(after!.modifiedAt > before!.modifiedAt).toBe(true);
    // Collapsing alone is never an undo step.
    expect(await undo()).toBe(false);
    expect((await db.headings.get(id))?.collapsed).toBe(true);
  });

  it('saves an area’s state the same way', async () => {
    const id = await repo.createArea('Home');
    const before = await db.areas.get(id);
    await tick();
    await repo.setAreaCollapsed(id, true);
    const after = await db.areas.get(id);
    expect(after?.collapsed).toBe(true);
    expect(after!.modifiedAt > before!.modifiedAt).toBe(true);
    await repo.setAreaCollapsed(id, false);
    expect((await db.areas.get(id))?.collapsed).toBe(false);
  });
});
