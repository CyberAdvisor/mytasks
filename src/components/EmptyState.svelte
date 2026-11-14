<!--
  What an empty built-in list shows (design doc, Section 6, Empty states):
  a small original line drawing in the list's colour, centred in the pane,
  with one line of text. Inline SVG, so nothing extra is loaded (NFR-11).
  Shown only when the list itself is empty, not when a filter hides its tasks.
-->
<script lang="ts">
  import type { BuiltInList } from '../lib/model/lists';

  let { list }: { list: BuiltInList } = $props();

  /** The line under each drawing. */
  const TEXT: Record<BuiltInList, string> = {
    inbox: 'Your Inbox is clear. New tasks land here.',
    today: 'Nothing planned for today.',
    scheduled: 'Nothing scheduled for later.',
    unscheduled: 'No open tasks.',
    deferred: 'Nothing deferred.',
    logbook: 'Completed tasks appear here.',
    trash: 'Trash is empty.',
  };

  /**
   * Each drawing on a 72 × 72 grid: `fill` shapes get a light wash of the
   * list's colour, `line` shapes are strokes only, and `cut` shapes are
   * filled with the page background to hide the lines behind them.
   */
  const ART: Record<BuiltInList, { fill?: string[]; line?: string[]; cut?: string[] }> = {
    inbox: {
      fill: ['M10 44l8-16h36l8 16v14a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2z', 'M28 18l20-8-6 18-5-6z'],
      line: ['M10 44h16l3 5h14l3-5h16'],
    },
    today: {
      fill: ['M8 54c10-8 20-10 28-10s18 2 28 10', 'M36 14l4 9 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1z'],
      line: ['M14 22l4 2M58 22l-4 2M36 6v3'],
    },
    scheduled: {
      fill: ['M16 16h32a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V20a4 4 0 0 1 4-4z'],
      line: ['M12 26h40M22 12v8M42 12v8'],
      cut: ['M39 50a11 11 0 1 0 22 0a11 11 0 1 0-22 0'],
    },
    unscheduled: {
      fill: ['M36 14l24 12-24 12-24-12z'],
      line: ['M12 36l24 12 24-12M12 46l24 12 24-12'],
    },
    deferred: {
      fill: ['M14 26h44a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z'],
      line: ['M15 36v18a2 2 0 0 0 2 2h38a2 2 0 0 0 2-2V36M30 44h12', 'M48 10h8l-8 8h8M40 18h5l-5 5h5'],
    },
    logbook: {
      fill: ['M20 14h32a4 4 0 0 1 4 4v38a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4z'],
      line: ['M26 38l7 7 14-14'],
      cut: ['M28 10h16v8H28z'],
    },
    trash: {
      fill: ['M20 24h32l-3 32a3 3 0 0 1-3 3H26a3 3 0 0 1-3-3z'],
      line: ['M14 24h44M30 24v-6h12v6M31 34v16M41 34v16'],
    },
  };

  /** The scheduled clock's hands, drawn over its cut-out face. */
  const OVER: Partial<Record<BuiltInList, string>> = { scheduled: 'M50 44v6l4 3' };

  let art = $derived(ART[list]);
  /** The list's name as the sidebar shows it (Completed is `logbook` in the code). */
  let name = $derived(list === 'logbook' ? 'Completed' : list[0].toUpperCase() + list.slice(1));
</script>

<div class="empty-state" style:--c={`var(--c-${list})`}>
  <svg width="96" height="96" viewBox="0 0 72 72" role="img" aria-label="Empty {name}">
    {#each art.fill ?? [] as d}<path {d} class="fill" />{/each}
    {#each art.line ?? [] as d}<path {d} />{/each}
    {#each art.cut ?? [] as d}<path {d} class="cut" />{/each}
    {#if OVER[list]}<path d={OVER[list]} />{/if}
  </svg>
  <p>{TEXT[list]}</p>
</div>

<style>
  .empty-state {
    min-height: 55vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  svg path {
    fill: none;
    stroke: var(--c);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  svg .fill {
    fill: color-mix(in srgb, var(--c) 14%, transparent);
  }
  svg .cut {
    fill: var(--bg);
  }
  p {
    margin: 0;
    color: var(--text-3);
    font-size: 14px;
    text-align: center;
  }
</style>
