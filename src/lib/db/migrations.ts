/**
 * Schema upgrades, one record at a time (design doc, Section 4, Rules).
 *
 * The same steps upgrade this device's database (database.ts, Dexie's
 * upgrade blocks) and a list read from elsewhere: a gist last written by an
 * older version, or a backup file (FR-12.8). Each step changes a record in
 * place and is safe to run on a record that already has the field.
 *
 * Adding a schema version: add its step here, call it from a new
 * `this.version(n)` block in database.ts, add it to `STEPS`, and raise
 * SCHEMA_VERSION.
 */
import { tombstone } from '../model/tombstone';

/** A record as stored, before it is checked. */
type Row = Record<string, unknown>;

/** Version 2: tasks and saved searches gain a context (FR-18); existing ones have none. */
export function addContext(row: Row): void {
  row.contextId ??= null;
}

/**
 * Version 3: completed items wait in their list until moved to Completed
 * (FR-12.2). Tasks and projects already completed or canceled count as moved.
 */
export function markMoved(row: Row): void {
  row.loggedAt ??= row.status === 'open' ? null : (row.completedAt ?? row.modifiedAt);
}

/** Version 4: a deleted record keeps only `id`, `deletedAt` and `modifiedAt`. */
export function stripDeleted(row: Row): Row {
  return row.deletedAt ? tombstone(row as never) : row;
}

/**
 * Version 5: headings can be collapsed (FR-2.7); existing ones start
 * expanded. Deleted records stay tombstones, with no other fields.
 */
export function addCollapsed(row: Row): void {
  if (!row.deletedAt) row.collapsed ??= false;
}

/** Synced tables, as named in a list. */
const ALL_TABLES = ['areas', 'projects', 'headings', 'todos', 'checklistItems', 'tags', 'contexts', 'savedSearches'];

/** The step that brings a list from version n − 1 to n, keyed by n. */
const STEPS: Record<number, (tables: Record<string, Row[]>) => void> = {
  2: (t) => {
    t.contexts ??= [];
    t.todos.forEach(addContext);
    t.savedSearches.forEach(addContext);
  },
  3: (t) => {
    t.todos.forEach(markMoved);
    t.projects.forEach(markMoved);
  },
  4: (t) => {
    for (const name of ALL_TABLES) t[name] = t[name].map(stripDeleted);
  },
  5: (t) => {
    t.headings.forEach(addCollapsed);
  },
};

/**
 * A list saved at an older schema, brought up to `target` with the steps
 * above, as a new object (the input is not changed). Anything that isn't a
 * list at an older schema is returned as it is, for the checks to judge.
 * Version 1 lists have no `contexts` table; it is added, empty.
 */
export function upgradeList<T>(list: T, target: number): T {
  const l = list as { schema?: unknown; tables?: unknown } | null;
  if (!l || typeof l !== 'object' || !Number.isInteger(l.schema) || (l.schema as number) < 1) return list;
  if ((l.schema as number) >= target || !l.tables || typeof l.tables !== 'object') return list;
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(l.tables as Record<string, unknown>)) {
    // Rows that aren't objects are left for the checks to refuse.
    if (!Array.isArray(rows) || !rows.every((r) => r && typeof r === 'object' && !Array.isArray(r))) return list;
    tables[name] = (rows as Row[]).map((r) => ({ ...r }));
  }
  if (!ALL_TABLES.every((n) => n === 'contexts' || Array.isArray(tables[n]))) return list;
  for (let v = (l.schema as number) + 1; v <= target; v++) STEPS[v](tables);
  return { ...list, schema: target, tables };
}
