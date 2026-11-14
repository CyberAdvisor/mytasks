<!--
  App shell: sidebar plus the current view (design doc, Section 6, Layout).
  Desktop has a bottom toolbar; under 768 px it becomes a single pane (the
  Home screen of lists, or one view) with a round + button instead.
  Also hosts Quick Find, Quick Entry, Keyboard Help, the Undo toast and the
  app-wide keyboard handler (Section 7).
  Until this device is connected to a GitHub Gist, only Setup shows (FR-19.1).
-->
<script lang="ts">
  import Sidebar from './components/Sidebar.svelte';
  import ResizeHandle from './components/ResizeHandle.svelte';
  import MoveDialog from './components/MoveDialog.svelte';
  import Icon from './components/Icon.svelte';
  import Toolbar from './components/Toolbar.svelte';
  import QuickFind from './components/QuickFind.svelte';
  import QuickEntry from './components/QuickEntry.svelte';
  import KeyboardHelp from './components/KeyboardHelp.svelte';
  import UndoToast from './components/UndoToast.svelte';
  import UpdateBanner from './components/UpdateBanner.svelte';
  import InstallGuide from './components/InstallGuide.svelte';
  import ListView from './views/ListView.svelte';
  import ProjectView from './views/ProjectView.svelte';
  import AreaView from './views/AreaView.svelte';
  import SettingsView from './views/SettingsView.svelte';
  import SearchView from './views/SearchView.svelte';
  import FilterView from './views/FilterView.svelte';
  import Setup from './components/Setup.svelte';
  import RowMenu from './components/RowMenu.svelte';
  import { sync } from './lib/sync/sync.svelte';
  import { route, go, hrefFor } from './lib/state/route';
  import { settings, todayDate } from './lib/state/live';
  import { applyTheme } from './lib/theme';
  import { ui } from './lib/state/ui.svelte';
  import { canAddHere, draftStartFor, openQuickEntry } from './lib/actions';
  import { runCommand } from './lib/commands';
  import { KeyResolver, focusKind, isMac, typeAheadKey } from './lib/shortcuts';
  import { install } from './lib/pwa/install.svelte';
  import { update } from './lib/pwa/update.svelte';
  import { readSidebarWidth } from './lib/sidebarWidth';

  const phoneQuery = window.matchMedia('(max-width: 767px)');
  let isPhone = $state(phoneQuery.matches);
  // This device's sidebar width; phones show the sidebar full width instead.
  let sidebarWidth = $state(readSidebarWidth());

  $effect(() => {
    const onChange = () => (isPhone = phoneQuery.matches);
    phoneQuery.addEventListener('change', onChange);
    return () => phoneQuery.removeEventListener('change', onChange);
  });

  // Light, dark or system theme (FR-V.3).
  $effect(() => applyTheme($settings.theme));

  // On wider screens there is no Home screen: open Today instead.
  $effect(() => {
    if (!isPhone && $route.kind === 'home') go({ kind: 'list', list: 'today' });
  });

  // Reset the card, selection and tag filter when the view changes, then
  // select any to-do Quick Find asked to show.
  $effect(() => {
    void $route;
    ui.enterView();
  });

  // App-wide keys. Keys a component already handled (defaultPrevented) and
  // keys pressed while a dialog, Quick Find or Quick Entry is open are left alone.
  // Right after New To-Do, until its title has focus, every key is held for
  // the title instead (FR-1.1); this listener runs first, in the capture phase.
  $effect(() => {
    const resolver = new KeyResolver();
    const mac = isMac();
    const onTypeAhead = (e: KeyboardEvent) => {
      if (ui.typeAhead === null || e.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      ui.typeAhead = typeAheadKey(ui.typeAhead, e);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || !sync.config) return;
      if (ui.findOpen || ui.draft !== null || document.querySelector('dialog[open]')) return;
      const ctx = { focus: focusKind(document.activeElement), standalone: install.standalone, mac, now: Date.now() };
      const result = resolver.resolve(e, ctx);
      if (!result) return;
      if ('pending' in result) e.preventDefault();
      else if ('find' in result) {
        e.preventDefault();
        ui.openFind(result.find);
      } else if (runCommand(result.command)) e.preventDefault();
    };
    window.addEventListener('keydown', onTypeAhead, true);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onTypeAhead, true);
      document.removeEventListener('keydown', onKey);
    };
  });

  let showSidebar = $derived(isPhone ? $route.kind === 'home' : !ui.sidebarHidden);
  let showMain = $derived(!isPhone || $route.kind !== 'home');
</script>

{#if !sync.ready}
  <!-- Reading this device's sync settings: a moment, so nothing flashes. -->
{:else if !sync.config}
  <Setup />
{:else}
  <div class="app">
    {#if showSidebar}
      <div class="side" style:width={isPhone ? null : `${sidebarWidth}px`}>
        <Sidebar />
        {#if !isPhone}<ResizeHandle bind:width={sidebarWidth} />{/if}
      </div>
    {/if}

    {#if showMain}
      <main>
        <div class="scroll">
          <div class="column">
            {#if $route.kind === 'list'}
              {#key $route.list}<ListView list={$route.list} />{/key}
            {:else if $route.kind === 'project'}
              {#key $route.id}<ProjectView id={$route.id} />{/key}
            {:else if $route.kind === 'area'}
              {#key $route.id}<AreaView id={$route.id} />{/key}
            {:else if $route.kind === 'settings'}
              <SettingsView />
            {:else if $route.kind === 'search'}
              {#key hrefFor($route)}<SearchView query={$route.query} tagIds={$route.tagIds} />{/key}
            {:else if $route.kind === 'saved'}
              {#key $route.id}<SearchView savedId={$route.id} />{/key}
            {:else if $route.kind === 'filter'}
              {#key $route.filter}<FilterView filter={$route.filter} />{/key}
            {/if}
          </div>
        </div>

        {#if isPhone}
          {#if canAddHere($route)}
            <button type="button" class="plus" aria-label="New Task" onclick={() => openQuickEntry(draftStartFor($route, $todayDate))}>
              <Icon name="plus" size={22} color="#fff" />
            </button>
          {/if}
        {:else if $route.kind !== 'settings'}
          <Toolbar />
        {/if}
      </main>
    {/if}
  </div>

  <RowMenu />

  {#if ui.movingId}
    <MoveDialog todoId={ui.movingId} />
  {/if}

  {#if ui.findOpen}
    <QuickFind />
  {/if}

  {#if ui.draft}
    {#key ui.draft}<QuickEntry draft={ui.draft} />{/key}
  {/if}

  {#if ui.helpOpen}
    <KeyboardHelp />
  {/if}

  {#if ui.toast}
    <UndoToast message={ui.toast.message} />
  {:else if update.available && !update.dismissed}
    <!-- Shares the toast's place, so it waits while an Undo toast shows. -->
    <UpdateBanner />
  {/if}
{/if}

{#if install.guideOpen}
  <InstallGuide />
{/if}

<style>
  .app {
    display: flex;
    height: 100%;
  }
  .side {
    position: relative;
    flex: none;
    height: 100%;
  }
  main {
    flex: 1;
    min-width: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  .scroll {
    flex: 1;
    overflow-y: auto;
    padding: 40px 48px 80px;
  }
  .column {
    max-width: 680px;
    margin: 0 auto;
  }
  /* Phone only: round New Task button. */
  .plus {
    position: fixed;
    right: 28px;
    bottom: calc(28px + env(safe-area-inset-bottom));
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 0;
    background: var(--accent);
    box-shadow: 0 4px 12px rgba(47, 111, 219, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  @media (max-width: 767px) {
    .side {
      width: 100%;
    }
    .scroll {
      padding: calc(12px + env(safe-area-inset-top)) 18px 120px;
    }
    .plus {
      width: 56px;
      height: 56px;
    }
  }
</style>
