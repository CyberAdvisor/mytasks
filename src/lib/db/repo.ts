/**
 * Data operations for My Tasks.
 *
 * Every user change runs in a single IndexedDB transaction (FR-DM.2) and
 * appends to the local change log (FR-DM.3); `history.ts` also records it
 * for undo (FR-1.6). UI code calls these functions; it never writes to the
 * database directly.
 */
import { db } from './database';
import { clearUndo, log, tx } from './history';
import { bury } from './bury';
import { nowIso, uuidv7 } from '../model/ids';
import { localDay, today } from '../model/dates';
import { bySortKey, keyAtEnd, keyAtStart, keyBetween, placementKeys } from '../model/order';
import { priorityRules } from '../model/priority';
import { readSettings, type AppSettings, type SettingKey } from '../model/settings';
import type {
  Area,
  BaseRecord,
  ChecklistItem,
  Context,
  EntityName,
  Heading,
  ID,
  LocalDate,
  Priority,
  Project,
  SavedSearch,
  Tag,
  Todo,
  TodoStart,
} from '../model/types';

/** Fresh base fields for a new record. */
function base(sortKey: string): BaseRecord {
  const at = nowIso();
  return { id: uuidv7(), createdAt: at, modifiedAt: at, deletedAt: null, sortKey };
}

/** Patch a record, stamp `modifiedAt` and log the changed fields. */
async function patch<T extends BaseRecord>(entity: EntityName, id: ID, changes: Partial<T>): Promise<void> {
  const fields = Object.keys(changes);
  if (!fields.length) return;
  await db.table(entity).update(id, { ...changes, modifiedAt: nowIso() });
  await log(entity, id, fields);
}

/** Sort keys of siblings matching `filter`, used to append at the end. A read helper: see `liveChecklist`. */
function siblingKeys<T extends BaseRecord>(entity: EntityName, filter: (r: T) => boolean): Promise<string[]> {
  return db
    .table(entity)
    .toArray()
    .then((rows) => (rows as T[]).filter((r) => r.deletedAt === null && filter(r)).map((r) => r.sortKey));
}

/**
 * Write the keys that put record `id` at its position in `order` (sibling ids
 * in display order), plus `extra` changes on the moved record. Usually only
 * the moved record changes (see `placementKeys`). Call inside a transaction.
 */
async function place<T extends BaseRecord>(
  entity: EntityName,
  id: ID,
  order: ID[],
  field: string,
  keyOf: (r: T) => string | null,
  extra: Partial<T> = {},
): Promise<void> {
  const rows = (await db.table(entity).bulkGet(order)) as (T | undefined)[];
  const byId = new Map(rows.filter((r): r is T => !!r).map((r) => [r.id, r]));
  const keys = placementKeys(order, id, (x) => {
    const r = byId.get(x);
    return r ? keyOf(r) : null;
  });
  for (const [x, key] of keys) {
    await patch<T>(entity, x, { [field]: key, ...(x === id ? extra : {}) } as Partial<T>);
  }
  if (!keys.has(id) && Object.keys(extra).length) await patch<T>(entity, id, extra);
}

/**
 * Sort key that moves record `id` one place up or down among the siblings
 * matching `filter`, or `null` when it is already at that end. A read helper:
 * see `liveChecklist`.
 */
function shiftedKey<T extends BaseRecord>(
  entity: EntityName,
  id: ID,
  filter: (r: T) => boolean,
  direction: 'up' | 'down',
): Promise<string | null> {
  return db
    .table(entity)
    .toArray()
    .then((all) => keyShifted(bySortKey((all as T[]).filter((r) => r.deletedAt === null && filter(r))), id, direction));
}

/** The sort key that moves `id` one place within `rows` (in order), or `null` at that end. */
function keyShifted(rows: BaseRecord[], id: ID, direction: 'up' | 'down'): string | null {
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const others = rows.filter((r) => r.id !== id);
  if (direction === 'up') {
    if (i === 0) return null;
    return keyBetween(others[i - 2]?.sortKey ?? null, others[i - 1].sortKey);
  }
  if (i === rows.length - 1) return null;
  return keyBetween(others[i].sortKey, others[i + 1]?.sortKey ?? null);
}

// ---------------------------------------------------------------------------
// Settings and automatic priority (FR-14.9 to FR-14.14)
// ---------------------------------------------------------------------------

/** Current settings, read inside the caller's transaction. A read helper: see `liveChecklist`. */
function loadSettings(): Promise<AppSettings> {
  return db.settings.toArray().then(readSettings);
}

/** Apply the automatic priority rules to one to-do after a change. */
async function applyPriorityRules(id: ID, settings?: AppSettings): Promise<void> {
  const t = await db.todos.get(id);
  if (!t) return;
  const next = priorityRules(t, today(), settings ?? (await loadSettings()));
  if (next) await patch<Todo>('todos', id, next);
}

/**
 * Run the automatic rules over every open to-do (FR-14.9, FR-3.5). Called at
 * launch, on resume and at midnight, so start dates arriving and deadlines
 * passing are picked up without background execution.
 */
export function sweepPriorities(): Promise<void> {
  return tx(async () => {
    const settings = await loadSettings();
    const todos = await db.todos.where('status').equals('open').toArray();
    for (const t of todos) await applyPriorityRules(t.id, settings);
  }, { track: false });
}

/**
 * Save one setting. Turning a rule on applies it to existing to-dos; turning
 * it off leaves the priorities it already set (FR-14.14).
 */
export async function setSetting<K extends SettingKey>(key: K, value: AppSettings[K]): Promise<void> {
  await tx(() => db.settings.put({ key, value, modifiedAt: nowIso() }), { track: false });
  if (key === 'moveToCompleted') await sweepCompleted();
  else if (value === true && (key === 'autoP1' || key === 'defaultP2')) await sweepPriorities();
}

// ---------------------------------------------------------------------------
// Moving completed items to Completed (FR-12.2)
// ---------------------------------------------------------------------------

/**
 * Status, completion time and move time for a status change. A closed item
 * goes straight to Completed when the setting is Immediately; otherwise it
 * waits in its list. Reopening clears both times.
 */
function statusFields(
  status: Todo['status'],
  at: string,
  settings: AppSettings,
): Pick<Todo, 'status' | 'completedAt' | 'loggedAt'> {
  if (status === 'open') return { status, completedAt: null, loggedAt: null };
  return { status, completedAt: at, loggedAt: settings.moveToCompleted === 'immediately' ? at : null };
}

/** Whether a waiting item is due to move under `mode`, given today's date. */
function dueToMove(item: Todo | Project, mode: AppSettings['moveToCompleted'], ref: LocalDate): boolean {
  if (item.status === 'open' || item.loggedAt !== null) return false;
  if (mode === 'immediately') return true;
  // Daily: everything completed before today (FR-3.5 rollover).
  return mode === 'daily' && item.completedAt !== null && localDay(item.completedAt) < ref;
}

/**
 * Move the waiting items the setting says are due: all of them for
 * Immediately, those completed before today for Daily, none for Manually.
 * Runs at launch, on resume, at midnight and when the setting changes. It is
 * the app's own change, so it never replaces the user's last undo step.
 */
export function sweepCompleted(): Promise<void> {
  return tx(async () => {
    const { moveToCompleted } = await loadSettings();
    if (moveToCompleted === 'manually') return;
    const ref = today();
    const at = nowIso();
    for (const t of await db.todos.where('status').anyOf('completed', 'canceled').toArray()) {
      if (dueToMove(t, moveToCompleted, ref)) await patch<Todo>('todos', t.id, { loggedAt: at });
    }
    for (const p of await db.projects.where('status').anyOf('completed', 'canceled').toArray()) {
      if (dueToMove(p, moveToCompleted, ref)) await patch<Project>('projects', p.id, { loggedAt: at });
    }
  }, { track: false });
}

/** Move to Completed (FR-12.2): move the given waiting to-dos and projects now. Undoable. */
export function moveToCompleted(ids: { todos: ID[]; projects: ID[] }): Promise<void> {
  return tx(async () => {
    const at = nowIso();
    for (const id of ids.todos) await patch<Todo>('todos', id, { loggedAt: at });
    for (const id of ids.projects) await patch<Project>('projects', id, { loggedAt: at });
  });
}

/** Set or clear a to-do's context (FR-18.3). */
export function setContext(id: ID, contextId: ID | null): Promise<void> {
  return tx(() => patch<Todo>('todos', id, { contextId }));
}

/** Set or clear a to-do's priority as the user's own choice (FR-14.2). */
export function setPriority(id: ID, priority: Priority | null): Promise<void> {
  return tx(() =>
    patch<Todo>('todos', id, { priority, prioritySource: 'user', priorityBeforeAuto: null }),
  );
}

// ---------------------------------------------------------------------------
// To-do invariants
// ---------------------------------------------------------------------------

/**
 * Keep `start` consistent with a to-do's container and When date:
 * a to-do leaves the Inbox once it gets a container or a When date.
 * (A to-do may be Unscheduled with no container, as in Things' Anytime.)
 */
export function normalizeStart(t: Pick<Todo, 'start' | 'startDate' | 'areaId' | 'projectId'>): TodoStart {
  const contained = t.areaId !== null || t.projectId !== null;
  if (t.start === 'inbox' && (contained || t.startDate !== null)) return 'unscheduled';
  return t.start;
}

/** Where a new or moved to-do goes. `null` everywhere means the Inbox. */
export interface TodoPlacement {
  areaId?: ID | null;
  projectId?: ID | null;
  headingId?: ID | null;
}

// ---------------------------------------------------------------------------
// To-dos
// ---------------------------------------------------------------------------

/** Options for a new to-do. */
export interface NewTodo extends TodoPlacement {
  title?: string;
  /** Start state for a to-do with no container; defaults to the Inbox. */
  start?: TodoStart;
  startDate?: LocalDate | null;
  deferred?: boolean;
  /** Put the new to-do at the top of its container instead of the bottom. */
  atStart?: boolean;
  /** Fields filled in Quick Entry (FR-8.1). */
  notes?: string;
  deadline?: LocalDate | null;
  tagIds?: ID[];
  /** A priority the user chose; `null` means they chose None. Omit for no choice. */
  priority?: Priority | null;
  contextId?: ID | null;
  checklist?: { title: string; completed: boolean }[];
}

/**
 * Create a to-do with everything set in one transaction and return its id
 * (FR-1.1, FR-8.1). The automatic priority rules then run as for any change.
 */
export async function createTodo(opts: NewTodo = {}): Promise<ID> {
  return tx(async () => {
    const projectId = opts.projectId ?? null;
    const project = projectId ? await db.projects.get(projectId) : undefined;
    const areaId = projectId ? null : (opts.areaId ?? null);
    const headingId = projectId ? (opts.headingId ?? null) : null;
    const keys = await siblingKeys<Todo>('todos', (t) =>
      projectId ? t.projectId === projectId : areaId ? t.areaId === areaId && !t.projectId : !t.projectId && !t.areaId,
    );
    const startDate = opts.deferred ? null : (opts.startDate ?? null);
    const todo: Todo = {
      ...base(opts.atStart ? keyAtStart(keys) : keyAtEnd(keys)),
      title: opts.title ?? '',
      notes: opts.notes ?? '',
      status: 'open',
      start: normalizeStart({
        start: opts.deferred ? 'deferred' : (opts.start ?? 'inbox'),
        startDate,
        areaId,
        projectId,
      }),
      startDate,
      todaySortKey: null,
      deadline: opts.deadline ?? null,
      priority: opts.priority ?? null,
      prioritySource: opts.priority === undefined ? null : 'user',
      priorityBeforeAuto: null,
      tagIds: opts.tagIds ?? [],
      contextId: opts.contextId ?? null,
      areaId,
      projectId: project ? projectId : null,
      headingId,
      completedAt: null,
      loggedAt: null,
      trashedAt: null,
    };
    await db.todos.add(todo);
    await log('todos', todo.id, ['*']);
    let key: string | null = null;
    for (const c of opts.checklist ?? []) {
      key = keyBetween(key, null);
      const item: ChecklistItem = { ...base(key), todoId: todo.id, title: c.title, completed: c.completed };
      await db.checklistItems.add(item);
      await log('checklistItems', item.id, ['*']);
    }
    await applyPriorityRules(todo.id);
    return todo.id;
  });
}

/** Edit title or notes. */
export function updateTodoText(id: ID, changes: Partial<Pick<Todo, 'title' | 'notes'>>): Promise<void> {
  return tx(() => patch<Todo>('todos', id, changes));
}

/** When choices from the When picker (FR-3.1). */
export type WhenChoice =
  | { kind: 'today' }
  | { kind: 'date'; date: LocalDate }
  | { kind: 'deferred' }
  /** Available with no date (Things' Anytime), even for an unfiled to-do. */
  | { kind: 'unscheduled' }
  | { kind: 'clear' };

/** Apply a When choice to a to-do. */
export function setWhen(id: ID, choice: WhenChoice): Promise<void> {
  return tx(async () => {
    const t = await db.todos.get(id);
    if (!t) return;
    let start: TodoStart = t.start === 'deferred' ? 'unscheduled' : t.start;
    let startDate: LocalDate | null = null;
    if (choice.kind === 'today') startDate = today();
    else if (choice.kind === 'date') startDate = choice.date;
    else if (choice.kind === 'deferred') start = 'deferred';
    else if (choice.kind === 'unscheduled') start = 'unscheduled';
    // Clearing returns an unfiled to-do to the Inbox for processing.
    else start = t.areaId || t.projectId ? 'unscheduled' : 'inbox';
    start = normalizeStart({ start, startDate, areaId: t.areaId, projectId: t.projectId });
    await patch<Todo>('todos', id, { start, startDate });
    await applyPriorityRules(id);
  });
}

/** Set or clear a deadline (FR-3.3). */
export function setDeadline(id: ID, deadline: LocalDate | null): Promise<void> {
  return tx(async () => {
    await patch<Todo>('todos', id, { deadline });
    await applyPriorityRules(id);
  });
}

/** Complete, cancel or reopen a to-do (FR-1.3, FR-1.4, FR-12.1). */
export function setTodoStatus(id: ID, status: Todo['status']): Promise<void> {
  return tx(async () => {
    const settings = await loadSettings();
    await patch<Todo>('todos', id, statusFields(status, nowIso(), settings));
    // Closed to-dos keep their priority (FR-14.12); a reopened one is checked again.
    if (status === 'open') await applyPriorityRules(id);
  });
}

/** Move a to-do to Trash, or restore it (FR-1.5, FR-12.3). */
export function setTodoTrashed(id: ID, trashed: boolean): Promise<void> {
  return tx(() => patch<Todo>('todos', id, { trashedAt: trashed ? nowIso() : null }));
}

/** Duplicate a to-do just after the original (FR-1.5). */
export async function duplicateTodo(id: ID): Promise<ID | undefined> {
  return tx(async () => {
    const t = await db.todos.get(id);
    if (!t) return undefined;
    // Place the copy between the original and its next sibling.
    const keys = await siblingKeys<Todo>(
      'todos',
      (x) => x.projectId === t.projectId && x.areaId === t.areaId && x.sortKey > t.sortKey,
    );
    const next = keys.length ? keys.sort()[0] : null;
    const copy: Todo = {
      ...t,
      ...base(keyBetween(t.sortKey, next)),
      status: 'open',
      completedAt: null,
      loggedAt: null,
      trashedAt: null,
    };
    await db.todos.add(copy);
    await log('todos', copy.id, ['*']);
    await copyChecklist(id, copy.id);
    return copy.id;
  });
}

/** Move a to-do into a project, heading, area, or the Inbox (FR-1.5). */
export function moveTodo(id: ID, to: TodoPlacement): Promise<void> {
  return tx(async () => {
    const t = await db.todos.get(id);
    if (!t) return;
    const projectId = to.projectId ?? null;
    const areaId = projectId ? null : (to.areaId ?? null);
    const headingId = projectId ? (to.headingId ?? null) : null;
    const keys = await siblingKeys<Todo>('todos', (x) =>
      x.id !== id &&
      (projectId ? x.projectId === projectId : areaId ? x.areaId === areaId && !x.projectId : !x.projectId && !x.areaId),
    );
    // Moving to "Inbox" (no container) files an undated, active to-do back there.
    const toInbox = !projectId && !areaId && t.start !== 'deferred' && t.startDate === null;
    const start = toInbox ? 'inbox' : normalizeStart({ start: t.start, startDate: t.startDate, areaId, projectId });
    await patch<Todo>('todos', id, { projectId, areaId, headingId, start, sortKey: keyAtEnd(keys) });
  });
}

/**
 * Place a to-do at its position in `order`, the ids of its siblings in display
 * order after a drag or a keyboard move (FR-10.3, FR-10.6). Today orders by
 * `todaySortKey`; every other list by `sortKey`. Giving `headingId` also moves
 * the to-do under that heading (null: no heading).
 */
export function placeTodo(
  id: ID,
  opts: { order: ID[]; field?: 'sortKey' | 'todaySortKey'; headingId?: ID | null },
): Promise<void> {
  const field = opts.field ?? 'sortKey';
  const extra: Partial<Todo> = opts.headingId === undefined ? {} : { headingId: opts.headingId };
  const keyOf = (t: Todo) => (field === 'todaySortKey' ? (t.todaySortKey ?? t.sortKey) : t.sortKey);
  return tx(() => place<Todo>('todos', id, opts.order, field, keyOf, extra));
}

/** Turn a to-do into a project with the same title, notes and dates (FR-1.5). */
export function convertTodoToProject(id: ID): Promise<ID | undefined> {
  return tx(async () => {
    const t = await db.todos.get(id);
    if (!t) return undefined;
    const areaId = t.projectId ? ((await db.projects.get(t.projectId))?.areaId ?? null) : t.areaId;
    const projectId = await insertProject({
      title: t.title,
      notes: t.notes,
      areaId,
      startDate: t.startDate,
      deadline: t.deadline,
      deferred: t.start === 'deferred',
      tagIds: t.tagIds,
    });
    // As in Things, checklist items become the new project's to-dos.
    const at = nowIso();
    let prev: string | null = null;
    for (const item of await liveChecklist(id)) {
      prev = keyBetween(prev, null);
      const todo: Todo = {
        ...t,
        ...base(prev),
        title: item.title,
        notes: '',
        status: item.completed ? 'completed' : 'open',
        completedAt: item.completed ? at : null,
        // Never shown as an open to-do, so it goes straight to Completed.
        loggedAt: item.completed ? at : null,
        start: 'unscheduled',
        startDate: null,
        deadline: null,
        todaySortKey: null,
        priority: null,
        prioritySource: null,
        priorityBeforeAuto: null,
        tagIds: [],
        areaId: null,
        projectId,
        headingId: null,
        trashedAt: null,
      };
      await db.todos.add(todo);
      await log('todos', todo.id, ['*']);
      await bury('checklistItems', [item.id], at);
    }
    await bury('todos', [id], at);
    return projectId;
  });
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/** Options for a new project. */
export interface NewProject {
  title?: string;
  notes?: string;
  areaId?: ID | null;
  startDate?: LocalDate | null;
  deadline?: LocalDate | null;
  deferred?: boolean;
  tagIds?: ID[];
}

/** Insert a project; caller must already be inside a transaction. */
async function insertProject(opts: NewProject): Promise<ID> {
  const areaId = opts.areaId ?? null;
  const keys = await siblingKeys<Project>('projects', (p) => (p.areaId ?? null) === areaId);
  const project: Project = {
    ...base(keyAtEnd(keys)),
    title: opts.title ?? '',
    notes: opts.notes ?? '',
    status: 'open',
    start: opts.deferred ? 'deferred' : 'unscheduled',
    startDate: opts.deferred ? null : (opts.startDate ?? null),
    deadline: opts.deadline ?? null,
    tagIds: opts.tagIds ? [...opts.tagIds] : [],
    areaId,
    completedAt: null,
    loggedAt: null,
    trashedAt: null,
  };
  await db.projects.add(project);
  await log('projects', project.id, ['*']);
  return project.id;
}

/** Create a project (FR-2.1). */
export function createProject(opts: NewProject = {}): Promise<ID> {
  return tx(() => insertProject(opts));
}

/** Edit project fields. */
export function updateProject(
  id: ID,
  changes: Partial<Pick<Project, 'title' | 'notes' | 'deadline' | 'startDate' | 'start' | 'areaId'>>,
): Promise<void> {
  return tx(() => patch<Project>('projects', id, changes));
}

/**
 * Place a project at its position in `order` (its sibling projects in display
 * order) inside area `areaId`, or with no area when null. Moving it to another
 * area takes its headings and to-dos along (FR-10.8, FR-10.9).
 */
export function placeProject(id: ID, opts: { order: ID[]; areaId: ID | null }): Promise<void> {
  return tx(async () => {
    const p = await db.projects.get(id);
    const extra: Partial<Project> = p && (p.areaId ?? null) !== opts.areaId ? { areaId: opts.areaId } : {};
    await place<Project>('projects', id, opts.order, 'sortKey', (x) => x.sortKey, extra);
  });
}

/** Apply a When choice to a project (FR-2.1), using the same picker as to-dos. */
export function setProjectWhen(id: ID, choice: WhenChoice): Promise<void> {
  const changes: Pick<Project, 'start' | 'startDate'> =
    choice.kind === 'deferred'
      ? { start: 'deferred', startDate: null }
      : { start: 'unscheduled', startDate: choice.kind === 'today' ? today() : choice.kind === 'date' ? choice.date : null };
  return tx(() => patch<Project>('projects', id, changes));
}

/**
 * Complete or cancel a project (FR-2.3). Open to-dos inside are completed or
 * canceled according to `openTodos`.
 */
export function closeProject(id: ID, status: 'completed' | 'canceled', openTodos: 'completed' | 'canceled'): Promise<void> {
  return tx(async () => {
    const at = nowIso();
    const settings = await loadSettings();
    const todos = await db.todos.where('projectId').equals(id).toArray();
    for (const t of todos.filter((x) => x.status === 'open' && x.deletedAt === null && x.trashedAt === null)) {
      await patch<Todo>('todos', t.id, statusFields(openTodos, at, settings));
    }
    await patch<Project>('projects', id, statusFields(status, at, settings));
  });
}

/**
 * Duplicate a project with its headings, open to-dos and their checklists.
 * The copy is placed right after the original. Returns the new project's id.
 */
export function duplicateProject(id: ID): Promise<ID | undefined> {
  return tx(async () => {
    const p = await db.projects.get(id);
    if (!p) return undefined;
    const siblings = bySortKey(
      (await db.projects.toArray()).filter((x) => x.deletedAt === null && (x.areaId ?? null) === (p.areaId ?? null)),
    );
    const next = siblings[siblings.findIndex((x) => x.id === id) + 1];
    const copy: Project = {
      ...p,
      ...base(keyBetween(p.sortKey, next?.sortKey ?? null)),
      tagIds: [...p.tagIds],
      status: 'open',
      completedAt: null,
      loggedAt: null,
      trashedAt: null,
    };
    await db.projects.add(copy);
    await log('projects', copy.id, ['*']);

    const headingIds = new Map<ID, ID>();
    for (const h of (await db.headings.where('projectId').equals(id).toArray()).filter((x) => x.deletedAt === null)) {
      const hc: Heading = { ...h, ...base(h.sortKey), projectId: copy.id };
      headingIds.set(h.id, hc.id);
      await db.headings.add(hc);
      await log('headings', hc.id, ['*']);
    }

    const todos = (await db.todos.where('projectId').equals(id).toArray()).filter(
      (t) => t.deletedAt === null && t.trashedAt === null && t.status === 'open',
    );
    for (const t of todos) {
      const tc: Todo = {
        ...t,
        ...base(t.sortKey),
        tagIds: [...t.tagIds],
        projectId: copy.id,
        headingId: t.headingId ? (headingIds.get(t.headingId) ?? null) : null,
        todaySortKey: null,
      };
      await db.todos.add(tc);
      await log('todos', tc.id, ['*']);
      await copyChecklist(t.id, tc.id);
    }
    return copy.id;
  });
}

/** Reopen a closed project. */
export function reopenProject(id: ID): Promise<void> {
  return tx(() => patch<Project>('projects', id, { status: 'open', completedAt: null, loggedAt: null }));
}

/** Move a project (and its to-dos) to Trash, or restore it. */
export function setProjectTrashed(id: ID, trashed: boolean): Promise<void> {
  return tx(() => patch<Project>('projects', id, { trashedAt: trashed ? nowIso() : null }));
}

// ---------------------------------------------------------------------------
// Headings
// ---------------------------------------------------------------------------

/** Add a heading at the end of a project (FR-2.4). */
export function createHeading(projectId: ID, title = ''): Promise<ID> {
  return tx(async () => {
    const keys = await siblingKeys<Heading>('headings', (h) => h.projectId === projectId);
    const heading: Heading = { ...base(keyAtEnd(keys)), title, projectId, archived: false, collapsed: false };
    await db.headings.add(heading);
    await log('headings', heading.id, ['*']);
    return heading.id;
  });
}

export function renameHeading(id: ID, title: string): Promise<void> {
  return tx(() => patch<Heading>('headings', id, { title }));
}

/**
 * Collapse or expand a heading on its project page (FR-2.7). It syncs like
 * any change, but isn't an undo step: it changes the view, not the tasks.
 */
export function setHeadingCollapsed(id: ID, collapsed: boolean): Promise<void> {
  return tx(() => patch<Heading>('headings', id, { collapsed }), { track: false });
}

/** Place a heading at its position in `order`; its to-dos move with it (FR-10.7). */
export function placeHeading(id: ID, order: ID[]): Promise<void> {
  return tx(() => place<Heading>('headings', id, order, 'sortKey', (h) => h.sortKey));
}

/**
 * Archive a heading; its to-dos are completed with it, as in Things, and go
 * straight to Completed, since the heading they would wait under is hidden.
 */
export function archiveHeading(id: ID): Promise<void> {
  return tx(async () => {
    const at = nowIso();
    const todos = await db.todos.where('headingId').equals(id).toArray();
    for (const t of todos.filter((x) => x.status === 'open')) {
      await patch<Todo>('todos', t.id, { status: 'completed', completedAt: at, loggedAt: at });
    }
    await patch<Heading>('headings', id, { archived: true });
  });
}

/** Delete a heading; its to-dos stay in the project without a heading. */
export function deleteHeading(id: ID): Promise<void> {
  return tx(async () => {
    const todos = await db.todos.where('headingId').equals(id).toArray();
    for (const t of todos) await patch<Todo>('todos', t.id, { headingId: null });
    await bury('headings', [id], nowIso());
  });
}

/** Turn a heading into a new project holding its to-dos (FR-2.4). */
export function convertHeadingToProject(id: ID): Promise<ID | undefined> {
  return tx(async () => {
    const h = await db.headings.get(id);
    if (!h) return undefined;
    const parent = await db.projects.get(h.projectId);
    const projectId = await insertProject({ title: h.title, areaId: parent?.areaId ?? null });
    const todos = await db.todos.where('headingId').equals(id).toArray();
    for (const t of todos) await patch<Todo>('todos', t.id, { projectId, headingId: null });
    await bury('headings', [id], nowIso());
    return projectId;
  });
}

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

/** Create an area at the end of the sidebar (FR-2.5). */
export function createArea(title = ''): Promise<ID> {
  return tx(async () => {
    const keys = await siblingKeys<Area>('areas', () => true);
    const area: Area = { ...base(keyAtEnd(keys)), title, tagIds: [], collapsed: false };
    await db.areas.add(area);
    await log('areas', area.id, ['*']);
    return area.id;
  });
}

export function renameArea(id: ID, title: string): Promise<void> {
  return tx(() => patch<Area>('areas', id, { title }));
}

/** Collapse or expand an area in the sidebar (FR-2.7); synced, not an undo step. */
export function setAreaCollapsed(id: ID, collapsed: boolean): Promise<void> {
  return tx(() => patch<Area>('areas', id, { collapsed }), { track: false });
}

/** Place an area at its position in the sidebar `order` (FR-10.8). */
export function placeArea(id: ID, order: ID[]): Promise<void> {
  return tx(() => place<Area>('areas', id, order, 'sortKey', (a) => a.sortKey));
}

/**
 * Delete an area (FR-2.5). `contents` decides what happens to its projects
 * and to-dos: `keep` moves them out of the area, `trash` moves them to Trash.
 */
export function deleteArea(id: ID, contents: 'keep' | 'trash'): Promise<void> {
  return tx(async () => {
    const at = nowIso();
    const projects = await db.projects.where('areaId').equals(id).toArray();
    const todos = await db.todos.where('areaId').equals(id).toArray();
    for (const p of projects) {
      await patch<Project>('projects', p.id, contents === 'trash' ? { trashedAt: at, areaId: null } : { areaId: null });
    }
    for (const t of todos) {
      const start = normalizeStart({ start: t.start, startDate: t.startDate, areaId: null, projectId: t.projectId });
      await patch<Todo>('todos', t.id, contents === 'trash' ? { trashedAt: at, areaId: null } : { areaId: null, start });
    }
    await bury('areas', [id], at);
  });
}

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------

/**
 * Permanently delete everything in Trash (FR-12.3), with the headings of
 * emptied projects. Only tombstones stay, for sync (model/tombstone.ts).
 * It cannot be undone, as in Things: the change is not tracked and the undo
 * step is cleared, so undoing an earlier change (such as a move to Trash)
 * cannot bring the items back either.
 */
export async function emptyTrash(): Promise<void> {
  await tx(
    async () => {
      // Read everything first, then write with bulk calls. Awaiting the
      // nested per-record helpers in a loop here made Dexie commit the
      // transaction too early (PrematureCommitError) with several items.
      const at = nowIso();
      const projects = (await db.projects.toArray()).filter((p) => p.trashedAt && !p.deletedAt);
      const inTrashedProject = new Set(projects.map((p) => p.id));
      const todos = (await db.todos.toArray()).filter(
        (t) => !t.deletedAt && (t.trashedAt || (t.projectId && inTrashedProject.has(t.projectId))),
      );
      const todoIds = new Set(todos.map((t) => t.id));
      const items = (await db.checklistItems.toArray()).filter((c) => !c.deletedAt && todoIds.has(c.todoId));
      const headings = (await db.headings.toArray()).filter((h) => !h.deletedAt && inTrashedProject.has(h.projectId));
      const ids = (rows: { id: ID }[]) => rows.map((r) => r.id);
      await bury('projects', ids(projects), at);
      await bury('headings', ids(headings), at);
      await bury('todos', ids(todos), at);
      await bury('checklistItems', ids(items), at);
    },
    { track: false },
  );
  clearUndo();
}

/** Mark a to-do and its checklist deleted (tombstones, so the deletion syncs). Call inside a transaction. */
async function deleteTodoRecords(todoId: ID, at: string): Promise<void> {
  await bury('todos', [todoId], at);
  await bury('checklistItems', (await liveChecklist(todoId)).map((c) => c.id), at);
}

/**
 * Delete one to-do in the Trash permanently (Delete Immediately, FR-1.7).
 * It asks first and cannot be undone: the undo step is cleared too, so
 * undoing an earlier change (such as the move to Trash) cannot restore it.
 */
export async function deleteTodoForever(id: ID): Promise<void> {
  await tx(() => deleteTodoRecords(id, nowIso()), { track: false });
  clearUndo();
}

// ---------------------------------------------------------------------------
// Tags (FR-6.1, FR-6.2)
// ---------------------------------------------------------------------------

/** Create a tag at the end of the Manage Tags list. */
export function createTag(title: string): Promise<ID> {
  return tx(async () => {
    const keys = await siblingKeys<Tag>('tags', () => true);
    const tag: Tag = { ...base(keyAtEnd(keys)), title: title.trim(), shortcut: null, parentTagId: null };
    await db.tags.add(tag);
    await log('tags', tag.id, ['*']);
    return tag.id;
  });
}

export function renameTag(id: ID, title: string): Promise<void> {
  return tx(() => patch<Tag>('tags', id, { title: title.trim() }));
}

/** Move a tag one place up or down in Manage Tags. */
export function moveTag(id: ID, direction: 'up' | 'down'): Promise<void> {
  return tx(async () => {
    const key = await shiftedKey<Tag>('tags', id, () => true, direction);
    if (key) await patch<Tag>('tags', id, { sortKey: key });
  });
}

/** Delete a tag and remove it from every to-do, project, area and saved search. */
export function deleteTag(id: ID): Promise<void> {
  return tx(async () => {
    for (const entity of ['todos', 'projects', 'areas', 'savedSearches'] as const) {
      const rows = (await db.table(entity).toArray()) as (Todo | Project | Area | SavedSearch)[];
      // Deleted records keep no tagIds (model/tombstone.ts).
      for (const r of rows.filter((x) => !x.deletedAt && x.tagIds.includes(id))) {
        await patch<Todo | Project | Area | SavedSearch>(entity, r.id, { tagIds: r.tagIds.filter((t) => t !== id) });
      }
    }
    await bury('tags', [id], nowIso());
  });
}

/**
 * Add or remove one tag on a to-do, project or area. Reads the record inside
 * the transaction, so quick successive changes never overwrite each other.
 */
export function toggleTag(entity: 'todos' | 'projects' | 'areas', id: ID, tagId: ID, on: boolean): Promise<void> {
  return tx(async () => {
    const r = (await db.table(entity).get(id)) as Todo | Project | Area | undefined;
    if (!r || r.tagIds.includes(tagId) === on) return;
    const tagIds = on ? [...r.tagIds, tagId] : r.tagIds.filter((t) => t !== tagId);
    await patch<Todo | Project | Area>(entity, id, { tagIds });
  });
}

// ---------------------------------------------------------------------------
// Contexts (FR-18.2)
// ---------------------------------------------------------------------------

/** Create a context at the end of the Settings list. */
export function createContext(title: string): Promise<ID> {
  return tx(async () => {
    const keys = await siblingKeys<Context>('contexts', () => true);
    const context: Context = { ...base(keyAtEnd(keys)), title: title.trim() };
    await db.contexts.add(context);
    await log('contexts', context.id, ['*']);
    return context.id;
  });
}

export function renameContext(id: ID, title: string): Promise<void> {
  return tx(() => patch<Context>('contexts', id, { title: title.trim() }));
}

/** Move a context one place up or down in Settings. */
export function moveContext(id: ID, direction: 'up' | 'down'): Promise<void> {
  return tx(async () => {
    const key = await shiftedKey<Context>('contexts', id, () => true, direction);
    if (key) await patch<Context>('contexts', id, { sortKey: key });
  });
}

/** Delete a context and clear it from every to-do and saved search; one undo step. */
export function deleteContext(id: ID): Promise<void> {
  return tx(async () => {
    for (const entity of ['todos', 'savedSearches'] as const) {
      const rows = (await db.table(entity).filter((r: Todo | SavedSearch) => r.contextId === id).toArray()) as (
        | Todo
        | SavedSearch
      )[];
      for (const r of rows) await patch<Todo | SavedSearch>(entity, r.id, { contextId: null });
    }
    await bury('contexts', [id], nowIso());
  });
}

// ---------------------------------------------------------------------------
// Checklists (FR-7.1, FR-7.2)
// ---------------------------------------------------------------------------

/** Copy a to-do's checklist onto another to-do; caller is inside a transaction. */
async function copyChecklist(fromTodoId: ID, toTodoId: ID): Promise<void> {
  for (const item of await liveChecklist(fromTodoId)) {
    const c: ChecklistItem = { ...item, ...base(item.sortKey), todoId: toTodoId };
    await db.checklistItems.add(c);
    await log('checklistItems', c.id, ['*']);
  }
}

/**
 * A to-do's live checklist items in order.
 *
 * Read helpers like this one return Dexie's own promise (`then`) instead of
 * being `async`. Inside a transaction, a read awaited through two levels of
 * `async` helpers more than once (here: `copyChecklist` in a loop) makes Dexie
 * commit the transaction too early (PrematureCommitError).
 */
function liveChecklist(todoId: ID): Promise<ChecklistItem[]> {
  return db.checklistItems
    .where('todoId')
    .equals(todoId)
    .toArray()
    .then((rows) => bySortKey(rows.filter((c) => c.deletedAt === null)));
}

/**
 * Add checklist items after `afterId` (or at the end when null), in order.
 * Returns the new ids. Several titles come from a multi-line paste (FR-7.2).
 */
export function addChecklistItems(todoId: ID, titles: string[], afterId: ID | null = null): Promise<ID[]> {
  return tx(async () => {
    const items = await liveChecklist(todoId);
    const i = afterId ? items.findIndex((c) => c.id === afterId) : items.length - 1;
    let before = i >= 0 ? items[i].sortKey : null;
    const after = items[i + 1]?.sortKey ?? null;
    const ids: ID[] = [];
    for (const title of titles) {
      before = keyBetween(before, after);
      const item: ChecklistItem = { ...base(before), todoId, title, completed: false };
      await db.checklistItems.add(item);
      await log('checklistItems', item.id, ['*']);
      ids.push(item.id);
    }
    return ids;
  });
}

export function updateChecklistItem(id: ID, changes: Partial<Pick<ChecklistItem, 'title' | 'completed'>>): Promise<void> {
  return tx(() => patch<ChecklistItem>('checklistItems', id, changes));
}

export function deleteChecklistItem(id: ID): Promise<void> {
  return tx(() => bury('checklistItems', [id], nowIso()).then(() => undefined));
}

/** Move a checklist item one place up or down. */
export function moveChecklistItem(id: ID, direction: 'up' | 'down'): Promise<void> {
  return tx(async () => {
    const item = await db.checklistItems.get(id);
    if (!item) return;
    const key = await shiftedKey<ChecklistItem>('checklistItems', id, (c) => c.todoId === item.todoId, direction);
    if (key) await patch<ChecklistItem>('checklistItems', id, { sortKey: key });
  });
}

// ---------------------------------------------------------------------------
// Saved searches (FR-15)
// ---------------------------------------------------------------------------

/** The editable fields of a saved search. */
export type SavedSearchFields = Pick<SavedSearch, 'title' | 'query' | 'tagIds'> & { contextId?: ID | null };

/** Save a search at the end of the sidebar section and return its id (FR-15.1). */
export function createSavedSearch(fields: SavedSearchFields): Promise<ID> {
  return tx(async () => {
    const keys = await siblingKeys<SavedSearch>('savedSearches', () => true);
    const saved: SavedSearch = {
      ...base(keyAtEnd(keys)),
      title: fields.title.trim(),
      query: fields.query.trim(),
      tagIds: [...fields.tagIds],
      contextId: fields.contextId ?? null,
    };
    await db.savedSearches.add(saved);
    await log('savedSearches', saved.id, ['*']);
    return saved.id;
  });
}

/** Rename a saved search or change its search text or tags (FR-15.5). */
export function updateSavedSearch(id: ID, fields: Partial<SavedSearchFields>): Promise<void> {
  const changes: Partial<SavedSearch> = { ...fields };
  if (fields.title !== undefined) changes.title = fields.title.trim();
  if (fields.query !== undefined) changes.query = fields.query.trim();
  // A plain copy: IndexedDB cannot store reactive proxies.
  if (fields.tagIds !== undefined) changes.tagIds = [...fields.tagIds];
  return tx(() => patch<SavedSearch>('savedSearches', id, changes));
}

/** Place a saved search at its position in the sidebar `order` (FR-15.5). */
export function placeSavedSearch(id: ID, order: ID[]): Promise<void> {
  return tx(() => place<SavedSearch>('savedSearches', id, order, 'sortKey', (x) => x.sortKey));
}

/** Delete a saved search. To-dos are never affected (FR-15.5). */
export function deleteSavedSearch(id: ID): Promise<void> {
  return tx(() => bury('savedSearches', [id], nowIso()).then(() => undefined));
}
