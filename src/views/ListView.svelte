<!--
  The seven built-in lists (design doc, Section 3, List membership rules).
  Today can be grouped by Projects, Priorities or Contexts from the ⋯ after
  its title (FR-16, FR-18.7), which also has Move to Completed (FR-12.2), as
  every list's ⋯ does except Completed and Trash.
  Rows can be reordered (FR-10.3) in the Inbox, in Today (also within a
  Today group), within a day in Scheduled, and within each group of
  Unscheduled and Deferred, as in Things. Completed and Trash have no manual order.
-->
<script lang="ts">
  import Icon from '../components/Icon.svelte';
  import ProgressPie from '../components/ProgressPie.svelte';
  import TodoList from '../components/TodoList.svelte';
  import ViewHeader from '../components/ViewHeader.svelte';
  import ChoiceDialog from '../components/ChoiceDialog.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import TagBar from '../components/TagBar.svelte';
  import ListMenu from '../components/ListMenu.svelte';
  import { ui } from '../lib/state/ui.svelte';
  import { activeTag, filterByTag, projectTagIds, tagsInUse } from '../lib/model/tags';
  import { activeContext, contextsInUse, filterByContext } from '../lib/model/contexts';
  import { settings, snapshot, todayDate } from '../lib/state/live';
  import { hrefFor } from '../lib/state/route';
  import { LIST_META } from '../lib/listMeta';
  import { containerLabel } from '../lib/labels';
  import * as L from '../lib/model/lists';
  import * as repo from '../lib/db/repo';
  import { emptyTrash } from '../lib/actions';
  import type { DropZone } from '../lib/drag/drag';
  import type { Todo } from '../lib/model/types';

  let { list }: { list: L.BuiltInList } = $props();

  let meta = $derived(LIST_META[list]);
  let s = $derived($snapshot);
  let ref = $derived($todayDate);
  let label = $derived((t: Todo) => containerLabel(t, s));
  let confirmEmpty = $state(false);

  let allFlat = $derived.by((): Todo[] => {
    if (list === 'inbox') return L.inboxTodos(s);
    if (list === 'today') return L.todayTodos(s, ref);
    if (list === 'trash') return L.trashTodos(s);
    return [];
  });

  let allGroups = $derived.by((): L.TodoGroup[] => {
    if (list === 'scheduled') return L.scheduledGroups(s, ref);
    if (list === 'unscheduled') return L.unscheduledGroups(s, ref);
    if (list === 'deferred') return L.deferredGroups(s, ref);
    if (list === 'logbook') return L.logbookGroups(s, ref);
    return [];
  });

  let allProjects = $derived(
    list === 'deferred' ? L.deferredProjects(s) : list === 'logbook' ? L.loggedProjects(s) : list === 'trash' ? L.trashProjects(s) : [],
  );

  // Filter bar (FR-6.3, FR-18.5): offer the tags and contexts used here, then
  // narrow every part of the list. Projects have no context, so a context
  // filter hides the project rows.
  let allTodos = $derived([...allFlat, ...allGroups.flatMap((g) => g.todos)]);
  let offered = $derived(tagsInUse(allTodos, s));
  let offeredContexts = $derived(contextsInUse(allTodos, s));
  let tag = $derived(activeTag(ui.tagFilter, offered));
  let ctx = $derived(activeContext(ui.contextFilter, offeredContexts));
  const narrow = (todos: Todo[]) => filterByContext(filterByTag(todos, tag, s), ctx);
  let flat = $derived(narrow(allFlat));
  let groups = $derived(allGroups.map((g) => ({ ...g, todos: narrow(g.todos) })).filter((g) => g.todos.length));
  let projects = $derived(
    ctx ? [] : tag ? allProjects.filter((p) => projectTagIds(p, s).has(tag!)) : allProjects,
  );

  // Today grouping (FR-16): applied after the filter bar.
  let grouping = $derived(list === 'today' ? $settings.todayGrouping : 'none');
  let todayGroups = $derived(grouping === 'none' ? [] : L.todayGroups(flat, grouping, s, $settings.priorityLabels));

  let mode = $derived<'open' | 'logbook' | 'trash'>(list === 'logbook' ? 'logbook' : list === 'trash' ? 'trash' : 'open');
  let isEmpty = $derived(!allFlat.length && !allGroups.length && !allProjects.length);


  /** Reordering rows: Today keeps its own order; other lists use container order. */
  const zoneFor = (field: 'sortKey' | 'todaySortKey'): DropZone => ({
    type: 'todo',
    drop: (id, order) => repo.placeTodo(id, { order, field }),
  });
  const todayZone = zoneFor('todaySortKey');
  const containerZone = zoneFor('sortKey');
  let flatZone = $derived(list === 'today' ? todayZone : list === 'inbox' ? containerZone : null);

  /** Groups with a manual order: each day of Scheduled (not months), and Unscheduled and Deferred groups. */
  function groupZone(g: L.TodoGroup): DropZone | null {
    if (list === 'unscheduled' || list === 'deferred') return containerZone;
    if (list === 'scheduled' && /^\d{4}-\d{2}-\d{2}$/.test(g.key)) return containerZone;
    return null;
  }

  function onEmptyChoice(v: string | null) {
    confirmEmpty = false;
    if (v === 'empty') void emptyTrash();
  }
</script>

{#snippet listMenu()}<ListMenu {list} />{/snippet}

<ViewHeader title={meta.title} menu={list === 'logbook' || list === 'trash' ? undefined : listMenu}>
  {#snippet icon()}<Icon name={meta.icon} size={28} color={meta.color} />{/snippet}
  {#snippet actions()}
    {#if list === 'trash' && !isEmpty}
      <button type="button" class="btn-plain" onclick={() => (confirmEmpty = true)}>Empty Trash</button>
    {/if}
  {/snippet}
</ViewHeader>

<TagBar tags={offered} contexts={offeredContexts} />

{#if projects.length}
  <ul class="projects">
    {#each projects as pr (pr.id)}
      <li>
        <a href={hrefFor({ kind: 'project', id: pr.id })}>
          <ProgressPie fraction={L.projectProgress(s, pr.id)} />
          <span>{pr.title || 'New Project'}</span>
          {#if pr.status === 'canceled'}<span class="tag">Canceled</span>{/if}
        </a>
        {#if list === 'trash'}
          <button type="button" class="btn-plain" onclick={() => repo.setProjectTrashed(pr.id, false)}>Restore</button>
        {:else if list === 'logbook'}
          <button type="button" class="btn-plain" onclick={() => repo.reopenProject(pr.id)}>Reopen</button>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

{#if grouping !== 'none'}
  {#each todayGroups as g (g.key)}
    <TodoList
      todos={g.todos}
      {ref}
      title={g.title}
      subtitle={g.subtitle}
      label={grouping === 'project' ? () => '' : label}
      showPriority={grouping !== 'priority'}
      showContext={grouping !== 'context'}
      zone={todayZone}
    />
  {/each}
{:else if flat.length}
  <TodoList todos={flat} {ref} {mode} label={list === 'inbox' ? () => '' : label} zone={flatZone} />
{/if}

{#each groups as g (g.key)}
  <TodoList
    todos={g.todos}
    {ref}
    {mode}
    title={g.title}
    subtitle={g.subtitle}
    label={list === 'scheduled' || list === 'logbook' ? label : () => ''}
    starred={list === 'unscheduled' ? (t) => L.isStarred(t, ref) : () => false}
    zone={groupZone(g)}
  />
{/each}

{#if isEmpty}
  <EmptyState {list} />
{/if}

{#if confirmEmpty}
  <ChoiceDialog
    title="Empty Trash?"
    message="Everything in the Trash will be deleted permanently. This cannot be undone."
    choices={[{ label: 'Empty Trash', value: 'empty', danger: true }]}
    onchoose={onEmptyChoice}
  />
{/if}

<style>
  .projects {
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
  }
  .projects li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .projects a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    color: var(--text);
    text-decoration: none;
    font-weight: 600;
    border-radius: var(--radius);
    flex: 1;
  }
  .projects a:hover {
    background: var(--hover-bg);
  }
  .tag {
    font-size: 11px;
    font-weight: 400;
    color: var(--text-3);
  }
</style>
