<!--
  Sidebar (design doc, Section 3 "Sidebar layout"): app header, built-in
  lists with counts, collapsible Saved Searches, then areas and projects.
  Drag saved searches, areas and projects to reorder them; drag a project
  onto another area to move it there, or below the last area to take it out
  of any area (FR-10.8, FR-10.9, FR-15.5). Drop a to-do onto a project or an
  area to move it there (FR-10.11).
-->
<script lang="ts">
  import Icon from './Icon.svelte';
  import Logo from './Logo.svelte';
  import SyncStatus from './SyncStatus.svelte';
  import InstallNotice from './InstallNotice.svelte';
  import VersionLink from './VersionLink.svelte';
  import SiteLink from './SiteLink.svelte';
  import ProgressPie from './ProgressPie.svelte';
  import { snapshot, todayDate } from '../lib/state/live';
  import { route, go, hrefFor, type Route } from '../lib/state/route';
  import { areaProjects, projectProgress, sidebarCounts, type BuiltInList } from '../lib/model/lists';
  import { bySortKey } from '../lib/model/order';
  import { LIST_META } from '../lib/listMeta';
  import { openMatchCount, savedSearchesInOrder } from '../lib/model/search';
  import { ui } from '../lib/state/ui.svelte';
  import { readFlag, writeFlag } from '../lib/state/flags';
  import * as repo from '../lib/db/repo';
  import { dragItem, dropTarget, dropZone, type DropTarget, type DropZone } from '../lib/drag/drag';
  import type { ID } from '../lib/model/types';

  const SAVED_KEY = 'mytasks.savedSearchesCollapsed';

  let counts = $derived(sidebarCounts($snapshot, $todayDate));
  let areas = $derived(bySortKey($snapshot.areas));
  // Completed projects stay listed, struck through, until moved to Completed (FR-12.2).
  let looseProjects = $derived(areaProjects($snapshot, null, true));
  let saved = $derived(savedSearchesInOrder($snapshot));
  let savedCollapsed = $state(readFlag(SAVED_KEY));
  let menuOpen = $state(false);

  function toggleSaved() {
    savedCollapsed = !savedCollapsed;
    writeFlag(SAVED_KEY, savedCollapsed);
  }

  /** Is this route the one currently shown? */
  function isActive(r: Route): boolean {
    return hrefFor(r) === hrefFor($route);
  }

  async function newProject() {
    menuOpen = false;
    const id = await repo.createProject({ title: '' });
    go({ kind: 'project', id });
  }

  async function newArea() {
    menuOpen = false;
    const id = await repo.createArea('');
    go({ kind: 'area', id });
  }

  const savedZone: DropZone = { type: 'saved', drop: (id, order) => repo.placeSavedSearch(id, order) };
  const areaZone: DropZone = { type: 'area', drop: (id, order) => repo.placeArea(id, order) };
  /** Each area, and the list of projects with no area, takes projects from any other. */
  const projectZone = (areaId: ID | null): DropZone => ({
    type: 'project',
    group: 'projects',
    drop: (id, order) => repo.placeProject(id, { order, areaId }),
  });

  /**
   * A to-do dropped on a project or area moves there, at the end of its to-dos
   * with no heading, as the Move dialog does. Not offered where it already is.
   */
  const moveHere = (to: { projectId: ID } | { areaId: ID }): DropTarget => ({
    type: 'todo',
    accepts: (id) => {
      const t = $snapshot.todos.find((x) => x.id === id);
      if (!t) return false;
      return 'projectId' in to ? t.projectId !== to.projectId : t.projectId !== null || t.areaId !== to.areaId;
    },
    drop: (id) => repo.moveTodo(id, to),
  });

  const groups: BuiltInList[][] = [['inbox'], ['today', 'scheduled', 'unscheduled', 'deferred'], ['logbook', 'trash']];
</script>

<nav class="sidebar" aria-label="Lists">
  <div class="brand">
    <Logo />
    <div class="brand-text">
      <span class="brand-name">My Tasks</span>
      <span class="brand-sub">Plan. Do. Succeed.</span>
    </div>
    <!-- Phones have no toolbar, so Quick Find opens from here. -->
    <button type="button" class="find" aria-label="Quick Find" title="Quick Find" onclick={() => ui.openFind()}>
      <Icon name="search" size={20} />
    </button>
  </div>

  <div class="scroll">
    {#each groups as group, gi (gi)}
      <ul class="lists" class:gap={gi > 0}>
        {#each group as list (list)}
          {@const meta = LIST_META[list]}
          {@const r = { kind: 'list', list } as Route}
          <li>
            <a href={hrefFor(r)} class="item" class:active={isActive(r)} aria-current={isActive(r) ? 'page' : undefined}>
              <Icon name={meta.icon} color={meta.color} size={16} />
              <span class="label">{meta.title}</span>
              {#if list === 'inbox' && counts.inbox}<span class="count">{counts.inbox}</span>{/if}
              {#if list === 'today'}
                {#if counts.due}<span class="count due" title="Due or overdue">{counts.due}</span>{/if}
                {#if counts.today}<span class="count">{counts.today}</span>{/if}
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    {/each}

    <hr />
    <button type="button" class="section-label" aria-expanded={!savedCollapsed} onclick={toggleSaved}>
      <Icon name={savedCollapsed ? 'chevron-right' : 'chevron-down'} size={12} />
      Saved Searches
    </button>
    {#if !savedCollapsed}
      {#if saved.length}
        <ul class="lists" use:dropZone={savedZone}>
          {#each saved as x (x.id)}
            {@const r = { kind: 'saved', id: x.id } as Route}
            {@const count = openMatchCount($snapshot, x)}
            <li use:dragItem={{ type: 'saved', id: x.id }}>
              <a href={hrefFor(r)} class="item" class:active={isActive(r)} aria-current={isActive(r) ? 'page' : undefined}>
                <Icon name="search" color="var(--text-2)" size={16} />
                <span class="label">{x.title || 'Saved Search'}</span>
                {#if count}<span class="count">{count}</span>{/if}
              </a>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">No saved searches</p>
      {/if}
    {/if}
    <hr />

    <div use:dropZone={areaZone}>
      {#each areas as area (area.id)}
        {@const r = { kind: 'area', id: area.id } as Route}
        <div use:dragItem={{ type: 'area', id: area.id }} use:dropZone={projectZone(area.id)}>
          <div class="area-row">
            <!-- In the gutter before the area, shown on hover, and always while collapsed (FR-2.7). -->
            <button
              type="button"
              class="disclose"
              class:shut={area.collapsed}
              data-no-drag
              aria-label={area.collapsed ? `Expand ${area.title || 'New Area'}` : `Collapse ${area.title || 'New Area'}`}
              aria-expanded={!area.collapsed}
              onclick={() => repo.setAreaCollapsed(area.id, !area.collapsed)}
            >
              <Icon name={area.collapsed ? 'chevron-right' : 'chevron-down'} size={12} />
            </button>
            <a href={hrefFor(r)} class="item area" class:active={isActive(r)} use:dropTarget={moveHere({ areaId: area.id })}>
              <Icon name="area" color="var(--text-2)" size={16} />
              <span class="label">{area.title || 'New Area'}</span>
            </a>
          </div>
          <!-- Empty while collapsed; the area's row still takes dropped projects. -->
          <ul class="lists">
            {#each area.collapsed ? [] : areaProjects($snapshot, area.id, true) as project (project.id)}
              {@const pr = { kind: 'project', id: project.id } as Route}
              <li use:dragItem={{ type: 'project', id: project.id }}>
                <a href={hrefFor(pr)} class="item project" class:active={isActive(pr)} class:closed={project.status !== 'open'} use:dropTarget={project.status === 'open' ? moveHere({ projectId: project.id }) : null}>
                  <ProgressPie fraction={projectProgress($snapshot, project.id)} size={14} />
                  <span class="label">{project.title || 'New Project'}</span>
                </a>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>

    <!-- Always present, so a project can be dragged out of every area. -->
    <ul class="lists" class:gap={looseProjects.length > 0} use:dropZone={projectZone(null)}>
      {#each looseProjects as project (project.id)}
        {@const pr = { kind: 'project', id: project.id } as Route}
        <li use:dragItem={{ type: 'project', id: project.id }}>
          <a href={hrefFor(pr)} class="item" class:active={isActive(pr)} class:closed={project.status !== 'open'} use:dropTarget={project.status === 'open' ? moveHere({ projectId: project.id }) : null}>
            <ProgressPie fraction={projectProgress($snapshot, project.id)} size={14} />
            <span class="label">{project.title || 'New Project'}</span>
          </a>
        </li>
      {/each}
    </ul>
  </div>

  <InstallNotice />
  <SyncStatus><VersionLink /></SyncStatus>
  <div class="footer">
    <div class="menu-wrap">
      <button type="button" class="btn-plain" aria-haspopup="menu" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>
        <Icon name="plus" size={14} /> New List
      </button>
      {#if menuOpen}
        <div class="menu" role="menu">
          <button type="button" role="menuitem" onclick={newProject}>New Project</button>
          <button type="button" role="menuitem" onclick={newArea}>New Area</button>
        </div>
      {/if}
    </div>
    <SiteLink page="home" class="btn-plain help" title="My Tasks website: guide, limitations, privacy" aria-label="My Tasks website">
      <Icon name="help" size={16} />
    </SiteLink>
    <a
      href={hrefFor({ kind: 'settings' })}
      class="btn-plain"
      class:active={isActive({ kind: 'settings' })}
      aria-label="Settings"
      title="Settings"
      aria-current={isActive({ kind: 'settings' }) ? 'page' : undefined}
    >
      <Icon name="settings" size={16} />
    </a>
  </div>
</nav>

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--sidebar-bg);
    border-right: 1px solid var(--sidebar-border);
    /* Compact, as in Things for Mac: 13 px text on 28 px rows. */
    font-size: 13px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 18px 10px;
  }
  .brand-text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 1px;
  }
  .find {
    display: none;
    border: 0;
    background: transparent;
    padding: 10px;
    border-radius: var(--radius);
    color: var(--text-2);
  }
  @media (max-width: 767px) {
    .find {
      display: inline-flex;
    }
  }
  .brand-name {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .brand-sub {
    font-size: 12px;
    color: var(--text-3);
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
    padding: 0 10px 10px;
  }
  .lists {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .lists.gap {
    margin-top: 8px;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: var(--radius);
    color: var(--text);
    text-decoration: none;
    min-height: 28px;
  }
  .item:hover {
    background: var(--hover-bg);
  }
  .item.active {
    background: var(--selected-bg);
    font-weight: 600;
  }
  .item.area {
    font-weight: 600;
  }
  .area-row {
    position: relative;
    margin-top: 8px;
  }
  /* Sits in the sidebar's left padding, so area and list icons stay aligned. */
  .disclose {
    position: absolute;
    left: -10px;
    top: 0;
    width: 14px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--text-2);
  }
  @media (hover: hover) {
    .disclose {
      opacity: 0;
    }
    .area-row:hover .disclose,
    .disclose:focus-visible,
    .disclose.shut {
      opacity: 1;
    }
  }
  .item.project {
    padding-left: 18px;
  }
  .closed .label {
    color: var(--text-done);
    text-decoration: line-through;
  }
  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    font-size: 12px;
    color: var(--text-2);
    font-weight: 400;
  }
  .count.due {
    color: var(--on-strong);
    background: var(--danger);
    border-radius: 999px;
    padding: 0 6px;
    font-weight: 600;
  }
  hr {
    border: 0;
    height: 1px;
    background: var(--divider);
    margin: 8px 6px;
  }
  .section-label {
    display: flex;
    align-items: center;
    gap: 6px;
    border: 0;
    background: transparent;
    color: var(--text-2);
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
  }
  .empty {
    margin: 2px 0 0;
    padding: 2px 8px 2px 26px;
    font-size: 12px;
    color: var(--text-3);
  }
  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px calc(8px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--sidebar-border);
  }
  .menu-wrap {
    position: relative;
    margin-right: auto;
  }
  .menu {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    min-width: 160px;
    background: var(--surface);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
    padding: 4px;
    display: flex;
    flex-direction: column;
    z-index: 10;
  }
  .menu button {
    text-align: left;
    border: 0;
    background: transparent;
    padding: 8px 10px;
    border-radius: var(--radius);
  }
  .menu button:hover {
    background: var(--hover-bg);
  }
  .footer a.btn-plain.active {
    background: var(--selected-bg);
  }
</style>
