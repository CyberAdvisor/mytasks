<!-- The app logo, the M-check monogram (design doc Section 6: FR-V.5): an M
     whose last stroke rises into a check. The same drawing as
     public/favicon.svg, which every app icon is made from; here its colours
     follow the app's Light or Dark setting (--logo-bg, --logo-fg). -->
<script lang="ts">
  let { size = 32 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="My Tasks logo">
  <rect width="120" height="120" rx="27" fill="var(--logo-bg)" />
  <g fill="none" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
    <path d="M26 86V40l20 24 20-24v22" stroke="var(--logo-fg)" />
    <path d="M62 70l12 12 22-34" stroke="#fff" />
  </g>
</svg>
