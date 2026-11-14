<!--
  Project page (FR-2.1 to FR-2.4), laid out as in Things: the ⋯ menu right
  after the title holds the project actions (complete, When, tags, deadline,
  move, duplicate, Move to Completed (FR-12.2), delete). Values that are set show as chips under the title;
  clicking a chip reopens its picker.
  Drag to-dos to reorder them, to move them under another heading, or above
  the first heading to take them out of any heading; drag headings to reorder
  them, their to-dos moving with them (FR-10.3, FR-10.6, FR-10.7).
-->
<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import ProgressPie from '../components/ProgressPie.svelte';
  import TodoList from '../components/TodoList.svelte';
  import EditableTitle from '../components/EditableTitle.svelte';
  import ViewHeader from '../components/ViewHeader.svelte';
  import ChoiceDialog from '../components/ChoiceDialog.svelte';
  import Popover from '../components/Popover.svelte';
  import MoveToCompletedItem from '../components/MoveToCompletedItem.svelte';
  import WhenPicker from '../components/WhenPicker.svelte';
  import DeadlinePicker from '../components/DeadlinePicker.svelte';
  import TagPicker from '../components/TagPicker.svelte';
  import AreaPickerDialog from '../components/AreaPickerDialog.svelte';
  import { deadlineLabel, formatRelative } from '../lib/model/dates';
  import TagBar from '../components/TagBar.svelte';
  import { newHeading } from '../lib/actions';
  import { activeTag, filterByTag, tagTitles, tagsInUse } from '../lib/model/tags';
  import { activeContext, contextsInUse, filterByContext } from '../lib/model/contexts';
  import { snapshot, todayDate } from '../lib/state/live';
  import { go } from '../lib/state/route';
  import { ui } from '../lib/state/ui.svelte';
  import { bySortKey } from '../lib/model/order';
  import { isLogged, isOpen, projectProgress, projectSections } from '../lib/model/lists';
  import * as repo from '../lib/db/repo';
  import { dragItem, dropZone, type DropZone } from '../lib/drag/drag';
  import type { ID, Todo } from '../lib/model/types';

  let { id }: { id: ID } = $props();

  let s = $derived($snapshot);
  let ref = $derived($todayDate);
  let project = $derived(s.projects.find((p) => p.id === id));
  let allSections = $derived(projectSections(s, id));
  // Filter bar (FR-6.3, FR-18.5) over the project's listed to-dos.
  let listedTodos = $derived([...allSections.loose, ...allSections.headings.flatMap((h) => h.todos)]);
  let offered = $derived(tagsInUse(listedTodos, s));
  let offeredContexts = $derived(contextsInUse(listedTodos, s));
  let tag = $derived(activeTag(ui.tagFilter, offered));
  let ctx = $derived(activeContext(ui.contextFilter, offeredContexts));
  const narrow = (todos: Todo[]) => filterByContext(filterByTag(todos, tag, s), ctx);
  let sections = $derived({
    loose: narrow(allSections.loose),
    headings: allSections.headings.map((h) => ({ ...h, todos: narrow(h.todos) })),
  });
  // Moved to Completed, behind "Show N completed items"; completed to-dos
  // still waiting to move stay in their sections (FR-12.2).
  let closedTodos = $derived(bySortKey(s.todos.filter((t) => t.projectId === id && isLogged(t))));
  let openCount = $derived(listedTodos.filter(isOpen).length);
  let showLogged = $state(false);
  let askClose = $state(false);
  let headingMenu = $state<ID | null>(null);
  let moving = $state(false);

  // The ⋯ menu shows either its item list or one of the pickers.
  let menuOpen = $state(false);
  let menuPanel = $state<'menu' | 'when' | 'tags' | 'deadline'>('menu');
  $effect(() => {
    if (!menuOpen) menuPanel = 'menu';
  });

  // Chips under the title each open their own picker.
  let whenOpen = $state(false);
  let deadlineOpen = $state(false);
  let tagsOpen = $state(false);

  let hasWhen = $derived(!!project && (project.start === 'deferred' || project.startDate !== null));
  let whenText = $derived(
    !project
      ? ''
      : project.start === 'deferred'
        ? 'Deferred'
        : project.startDate === null
          ? ''
          : project.startDate <= ref
            ? 'Today'
            : formatRelative(project.startDate, ref),
  );
  let projectTags = $derived(project ? tagTitles(project.tagIds, s) : []);

  function complete() {
    menuOpen = false;
    if (openCount > 0) askClose = true;
    else void repo.closeProject(id, 'completed', 'completed');
  }

  function onCloseChoice(v: string | null) {
    askClose = false;
    if (v === 'complete') void repo.closeProject(id, 'completed', 'completed');
    if (v === 'cancel') void repo.closeProject(id, 'completed', 'canceled');
  }

  /** To-dos move freely between this project's headings. */
  const todoZone = (headingId: ID | null): DropZone => ({
    type: 'todo',
    group: `project:${id}`,
    drop: (todoId, order) => repo.placeTodo(todoId, { order, headingId }),
  });
  const looseZone = todoZone(null);
  const headingZone: DropZone = { type: 'heading', drop: (hid, order) => repo.placeHeading(hid, order) };

  async function addTodo(headingId: ID | null = null) {
    // A collapsed heading opens, so the new task shows (FR-2.7).
    if (headingId && s.headings.find((h) => h.id === headingId)?.collapsed) await repo.setHeadingCollapsed(headingId, false);
    const todoId = await repo.createTodo({ projectId: id, headingId });
    ui.open(todoId);
  }

  function addHeading() {
    menuOpen = false;
    void newHeading(id);
  }

  function reopen() {
    menuOpen = false;
    void repo.reopenProject(id);
  }

  function chooseWhen(choice: repo.WhenChoice) {
    menuOpen = whenOpen = false;
    void repo.setProjectWhen(id, choice);
  }

  function chooseDeadline(deadline: string | null) {
    menuOpen = deadlineOpen = false;
    void repo.updateProject(id, { deadline });
  }

  function startMove() {
    menuOpen = false;
    moving = true;
  }

  function onMoveChoice(areaId: ID | null | undefined) {
    moving = false;
    if (areaId !== undefined) void repo.updateProject(id, { areaId });
  }

  async function duplicate() {
    menuOpen = false;
    const copyId = await repo.duplicateProject(id);
    if (copyId) go({ kind: 'project', id: copyId });
  }

  async function headingAction(hid: ID, action: 'archive' | 'convert' | 'delete') {
    headingMenu = null;
    if (action === 'archive') await repo.archiveHeading(hid);
    if (action === 'delete') {
      await repo.deleteHeading(hid);
      ui.offerUndo('Heading deleted');
    }
    if (action === 'convert') {
      const pid = await repo.convertHeadingToProject(hid);
      if (pid) go({ kind: 'project', id: pid });
    }
  }

  async function trashProject() {
    menuOpen = false;
    await repo.setProjectTrashed(id, true);
    go({ kind: 'list', list: 'today' });
    ui.offerUndo('Moved to Trash');
  }
</script>

{#if !project}
  <p class="missing">This project no longer exists.</p>
{:else}
  {#snippet whenPanel()}
    <WhenPicker startDate={project!.startDate} deferred={project!.start === 'deferred'} {ref} onchoose={chooseWhen} />
  {/snippet}
  {#snippet deadlinePanel()}
    <DeadlinePicker deadline={project!.deadline} {ref} onchoose={chooseDeadline} />
  {/snippet}
  {#snippet tagsPanel()}
    <TagPicker
      tagIds={project!.tagIds}
      ontoggle={(tagId, on) => repo.toggleTag('projects', id, tagId, on)}
      ondone={() => (menuOpen = tagsOpen = false)}
    />
  {/snippet}

  <ViewHeader>
    {#snippet icon()}<ProgressPie fraction={projectProgress(s, id)} size={26} />{/snippet}
    {#snippet heading()}
      <EditableTitle
        fit
        value={project!.title}
        placeholder="New Project"
        label="Project title"
        autofocus={!project!.title}
        onsave={(v) => repo.updateProject(id, { title: v })}
      />
      <Popover bind:open={menuOpen} label="Project actions" align="left">
        {#snippet trigger(toggle, open)}
          <button type="button" class="more-btn" aria-label="More project actions" aria-expanded={open} onclick={toggle}>
            <Icon name="more" size={22} weight={3.5} />
          </button>
        {/snippet}
        {#if menuPanel === 'when'}
          {@render whenPanel()}
        {:else if menuPanel === 'deadline'}
          {@render deadlinePanel()}
        {:else if menuPanel === 'tags'}
          {@render tagsPanel()}
        {:else}
          <div role="menu" aria-label="Project actions">
            {#if project!.status === 'open'}
              <button type="button" class="menu-item" role="menuitem" onclick={complete}><Icon name="check" size={15} /> Complete Project</button>
            {:else}
              <button type="button" class="menu-item" role="menuitem" onclick={reopen}><Icon name="check" size={15} /> Reopen Project</button>
            {/if}
            <button type="button" class="menu-item" role="menuitem" onclick={() => (menuPanel = 'when')}><Icon name="calendar" size={15} /> When</button>
            <button type="button" class="menu-item" role="menuitem" onclick={() => (menuPanel = 'tags')}>
              <Icon name="tag" size={15} /> {project!.tagIds.length ? 'Edit Tags' : 'Add Tags'}
            </button>
            <button type="button" class="menu-item" role="menuitem" onclick={() => (menuPanel = 'deadline')}>
              <Icon name="flag" size={15} /> {project!.deadline ? 'Change Deadline' : 'Add Deadline'}
            </button>
            <hr class="menu-sep" />
            <button type="button" class="menu-item" role="menuitem" onclick={startMove}><Icon name="move" size={15} /> Move</button>
            <button type="button" class="menu-item" role="menuitem" onclick={duplicate}><Icon name="copy" size={15} /> Duplicate Project</button>
            <MoveToCompletedItem view={{ kind: 'project', id }} onchoose={() => (menuOpen = false)} />
            <button type="button" class="menu-item danger" role="menuitem" onclick={trashProject}><Icon name="trash" size={15} /> Delete Project</button>
            {#if project!.status === 'open'}
              <!-- Desktop adds headings from the bottom toolbar. -->
              <button type="button" class="menu-item phone-only" role="menuitem" onclick={addHeading}><Icon name="heading-add" size={15} /> Add Heading</button>
            {/if}
          </div>
        {/if}
      </Popover>
    {/snippet}
  </ViewHeader>

  {#if project.status !== 'open' || hasWhen || project.deadline || projectTags.length}
    <div class="title-chips">
      {#if project.status !== 'open'}
        <span class="chip status"><Icon name="check" size={12} /> {project.status === 'completed' ? 'Completed' : 'Canceled'}</span>
      {/if}
      {#if hasWhen}
        <Popover bind:open={whenOpen} label="When" align="left">
          {#snippet trigger(toggle)}
            <button type="button" class="chip" aria-label="When: {whenText}" onclick={toggle}>
              <Icon name={project!.start === 'deferred' ? 'archive' : whenText === 'Today' ? 'star' : 'calendar'} size={12} />{whenText}
            </button>
          {/snippet}
          {@render whenPanel()}
        </Popover>
      {/if}
      {#if project.deadline}
        <Popover bind:open={deadlineOpen} label="Deadline" align="left">
          {#snippet trigger(toggle)}
            <button type="button" class="chip" class:due={project!.deadline! <= ref} onclick={toggle}>
              <Icon name="flag" size={12} />Deadline: {deadlineLabel(project!.deadline!, ref)}
            </button>
          {/snippet}
          {@render deadlinePanel()}
        </Popover>
      {/if}
      {#if projectTags.length}
        <Popover bind:open={tagsOpen} label="Tags" align="left">
          {#snippet trigger(toggle)}
            <button type="button" class="tags" aria-label="Edit tags" onclick={toggle}>
              {#each projectTags as name, i (i)}<span class="tag-pill">{name}</span>{/each}
            </button>
          {/snippet}
          {@render tagsPanel()}
        </Popover>
      {/if}
    </div>
  {/if}

  <textarea
    class="notes"
    aria-label="Project notes"
    placeholder="Notes"
    rows="2"
    value={project.notes}
    onchange={(e) => repo.updateProject(id, { notes: (e.currentTarget as HTMLTextAreaElement).value })}
  ></textarea>

  <TagBar tags={offered} contexts={offeredContexts} />

  <TodoList todos={sections.loose} {ref} zone={looseZone} />

  <div use:dropZone={headingZone}>
    {#each sections.headings as { heading, todos } (heading.id)}
      <section class="heading" use:dragItem={{ type: 'heading', id: heading.id }} use:dropZone={todoZone(heading.id)}>
        <div class="heading-row">
          <button
            type="button"
            class="btn-plain disclose"
            data-no-drag
            aria-label={heading.collapsed ? 'Expand heading' : 'Collapse heading'}
            aria-expanded={!heading.collapsed}
            onclick={() => repo.setHeadingCollapsed(heading.id, !heading.collapsed)}
          >
            <Icon name={heading.collapsed ? 'chevron-right' : 'chevron-down'} size={12} />
          </button>
          <EditableTitle
            value={heading.title}
            placeholder="New Heading"
            label="Heading title"
            size={15}
            autofocus={heading.id === ui.newHeadingId}
            onsave={(v) => repo.renameHeading(heading.id, v)}
          />
          {#if heading.collapsed}
            {@const hidden = todos.filter(isOpen).length}
            {#if hidden}<span class="hidden-count" title="Open tasks under this heading">{hidden}</span>{/if}
          {/if}
          <button type="button" class="btn-plain small" aria-label="Add task under heading" onclick={() => addTodo(heading.id)}>
            <Icon name="plus" size={14} />
          </button>
          <Popover bind:open={() => headingMenu === heading.id, (v) => (headingMenu = v ? heading.id : null)} label="Heading actions">
            {#snippet trigger(toggle, open)}
              <button type="button" class="btn-plain small" aria-label="Heading actions" aria-expanded={open} onclick={toggle}>
                <Icon name="more" size={14} />
              </button>
            {/snippet}
            <div role="menu" aria-label="Heading actions">
              <button type="button" class="menu-item" role="menuitem" onclick={() => headingAction(heading.id, 'archive')}><Icon name="archive" size={15} /> Archive</button>
              <button type="button" class="menu-item" role="menuitem" onclick={() => headingAction(heading.id, 'convert')}><Icon name="project" size={15} /> Convert to Project</button>
              <hr class="menu-sep" />
              <button type="button" class="menu-item danger" role="menuitem" onclick={() => headingAction(heading.id, 'delete')}><Icon name="trash" size={15} /> Delete</button>
            </div>
          </Popover>
        </div>
        <!-- Collapsed: the section is still a drop zone, so a task dropped here goes under it. -->
        {#if !heading.collapsed}<TodoList {todos} {ref} />{/if}
      </section>
    {/each}
  </div>

  {#if closedTodos.length}
    <button type="button" class="btn-plain logged" onclick={() => (showLogged = !showLogged)}>
      {showLogged ? 'Hide' : 'Show'} {closedTodos.length} completed {closedTodos.length === 1 ? 'item' : 'items'}
    </button>
    {#if showLogged}<TodoList todos={closedTodos} {ref} mode="logbook" />{/if}
  {/if}

  {#if moving}
    <AreaPickerDialog current={project.areaId} onchoose={onMoveChoice} />
  {/if}

  {#if askClose}
    <ChoiceDialog
      title="Complete this project?"
      message={`It still has ${openCount} open ${openCount === 1 ? 'task' : 'tasks'}. Mark them as completed or canceled?`}
      choices={[
        { label: 'Cancel them', value: 'cancel' },
        { label: 'Complete them', value: 'complete' },
      ]}
      onchoose={onCloseChoice}
    />
  {/if}
{/if}

<style>
  .chip.due {
    color: var(--danger);
    font-weight: 600;
  }
  .chip.status {
    color: var(--c-logbook);
  }
  .phone-only {
    display: none;
  }
  @media (max-width: 767px) {
    .phone-only {
      display: flex;
    }
  }
  .notes {
    width: 100%;
    border: 0;
    outline: none;
    resize: vertical;
    font-size: 14px;
    color: var(--text-2);
    margin: 0 0 12px 38px;
    width: calc(100% - 38px);
    background: transparent;
  }
  .heading {
    margin-top: 22px;
  }
  .heading-row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px 4px;
    border-bottom: 1px solid var(--rule);
    color: var(--accent-text);
  }
  .heading-row :global(input) {
    color: var(--accent-text);
  }
  .disclose {
    padding: 4px 2px;
    margin-left: -6px;
    color: var(--text-2);
  }
  .hidden-count {
    font-size: 12px;
    color: var(--text-2);
    padding: 0 4px;
  }
  .small {
    padding: 4px;
  }
  .logged {
    margin-top: 16px;
    font-size: 13px;
  }
  .missing {
    color: var(--text-3);
  }
</style>
