/**
 * Core data types for My Tasks (design doc, Section 4: Data model).
 *
 * Every record carries the sync-ready fields from BaseRecord so a future
 * sync release can merge changes without a schema rewrite.
 */

/** Stable record identity: a UUID v7 string (time-ordered). */
export type ID = string;

/** A calendar date with no time, stored as local `YYYY-MM-DD`. */
export type LocalDate = string;

/** An ISO-8601 timestamp, e.g. `2026-11-09T15:04:05.000Z`. */
export type Timestamp = string;

/** Lifecycle of a to-do or project. */
export type Status = 'open' | 'completed' | 'canceled';

/**
 * Where a to-do sits before dates are considered.
 * - `inbox`: captured, not yet organized (no container, no When date)
 * - `unscheduled`: active and available (may also carry a When date)
 * - `deferred`: parked until the user promotes it
 */
export type TodoStart = 'inbox' | 'unscheduled' | 'deferred';

/** Projects are never in the Inbox. */
export type ProjectStart = 'unscheduled' | 'deferred';

/** Priority 1 (highest) to 5. */
export type Priority = 1 | 2 | 3 | 4 | 5;

/**
 * Who set a to-do's priority (FR-14.1). `user` with no priority means the
 * user chose "None", which the automatic rules respect.
 */
export type PrioritySource = 'user' | 'auto';

/** Fields shared by every stored entity. */
export interface BaseRecord {
  id: ID;
  createdAt: Timestamp;
  modifiedAt: Timestamp;
  /** Tombstone set when a record is permanently deleted (after Trash is emptied). */
  deletedAt: Timestamp | null;
  /** Fractional index giving manual order within the parent. */
  sortKey: string;
}

export interface Area extends BaseRecord {
  title: string;
  tagIds: ID[];
  collapsed: boolean;
}

export interface Project extends BaseRecord {
  title: string;
  notes: string;
  status: Status;
  start: ProjectStart;
  startDate: LocalDate | null;
  deadline: LocalDate | null;
  tagIds: ID[];
  areaId: ID | null;
  completedAt: Timestamp | null;
  /** When it was moved to Completed (FR-12.2); null while open or still waiting in its list. */
  loggedAt: Timestamp | null;
  trashedAt: Timestamp | null;
}

export interface Heading extends BaseRecord {
  title: string;
  projectId: ID;
  archived: boolean;
  /** Its tasks hidden on the project page (FR-2.7); synced, like an area's. */
  collapsed: boolean;
}

export interface Todo extends BaseRecord {
  title: string;
  notes: string;
  status: Status;
  start: TodoStart;
  startDate: LocalDate | null;
  /** Manual order inside the Today list (separate from container order). */
  todaySortKey: string | null;
  deadline: LocalDate | null;
  priority: Priority | null;
  prioritySource: PrioritySource | null;
  /** Automatic value held before an automatic P1, restored by FR-14.11. */
  priorityBeforeAuto: Priority | null;
  tagIds: ID[];
  /** The to-do's context, one of those defined in Settings (FR-18.1). */
  contextId: ID | null;
  areaId: ID | null;
  projectId: ID | null;
  headingId: ID | null;
  completedAt: Timestamp | null;
  /** When it was moved to Completed (FR-12.2); null while open or still waiting in its list. */
  loggedAt: Timestamp | null;
  trashedAt: Timestamp | null;
}

export interface ChecklistItem extends BaseRecord {
  todoId: ID;
  title: string;
  completed: boolean;
}

export interface Tag extends BaseRecord {
  title: string;
  shortcut: string | null;
  parentTagId: ID | null;
}

/**
 * A context a to-do can be in, e.g. Home or Phone (FR-18). Defined in
 * Settings; to-dos point to it by id, so renaming never touches them.
 */
export interface Context extends BaseRecord {
  title: string;
}

export interface SavedSearch extends BaseRecord {
  title: string;
  query: string;
  tagIds: ID[];
  /** Only to-dos in this context; null for any (FR-18.6). */
  contextId: ID | null;
}

/** Entity names, used by the change log (FR-DM.3). */
export type EntityName =
  | 'areas'
  | 'projects'
  | 'headings'
  | 'todos'
  | 'checklistItems'
  | 'tags'
  | 'contexts'
  | 'savedSearches';

/** One row of the local change log, kept for the future sync release. */
export interface ChangeLogEntry {
  seq?: number;
  entity: EntityName;
  entityId: ID;
  /** Changed field names; `*` for create or delete. */
  fields: string[];
  at: Timestamp;
}

/** Key/value settings record. */
export interface SettingEntry {
  key: string;
  value: unknown;
  /** When it was last changed, so settings merge like records when synced (FR-19.4). */
  modifiedAt?: Timestamp;
}
