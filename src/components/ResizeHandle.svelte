<!--
  The sidebar's right edge: drag it to change the sidebar's width, double-
  click it to reset (design doc, Section 6). Pointer events, so a mouse, a
  trackpad and touch on iPad all work. The width is saved when the drag ends.
-->
<script lang="ts">
  import { SIDEBAR_DEFAULT, SIDEBAR_MAX, SIDEBAR_MIN, clampWidth, saveSidebarWidth } from '../lib/sidebarWidth';

  let { width = $bindable() }: { width: number } = $props();

  /** Where the drag started: the pointer's x and the width then. */
  let start: { x: number; width: number } | null = $state(null);

  function down(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault(); // no text selection while dragging
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start = { x: e.clientX, width };
  }

  function move(e: PointerEvent) {
    if (start) width = clampWidth(start.width + e.clientX - start.x);
  }

  function up() {
    if (!start) return;
    start = null;
    saveSidebarWidth(width);
  }

  function reset() {
    width = SIDEBAR_DEFAULT;
    saveSidebarWidth(width);
  }
</script>

<div
  class="handle"
  class:dragging={start !== null}
  role="separator"
  aria-orientation="vertical"
  aria-label="Resize sidebar"
  aria-valuenow={width}
  aria-valuemin={SIDEBAR_MIN}
  aria-valuemax={SIDEBAR_MAX}
  title="Drag to resize; double-click to reset"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  ondblclick={reset}
></div>

<style>
  .handle {
    position: absolute;
    top: 0;
    right: -4px;
    width: 8px;
    height: 100%;
    cursor: col-resize;
    touch-action: none;
    z-index: 2;
  }
  /* A thin line over the sidebar's border while pointed at or dragged. */
  .handle::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 3px;
    width: 2px;
    background: var(--accent);
    opacity: 0;
    transition: opacity 0.15s;
  }
  .handle:hover::after,
  .handle.dragging::after {
    opacity: 0.6;
  }
</style>
