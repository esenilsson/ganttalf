<script>
  // The ganttalf mark (option 9a): four Gantt bars stacked into a wizard hat,
  // brick ramp lightest at the tip. Geometry is exact per the brand handoff —
  // no shadows, no radius, no rotation, no re-colouring.
  let { size = 26, class: className = '' } = $props()
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 100 100"
  width={size}
  height={size}
  class={className}
  aria-hidden="true"
>
  <rect x="42" y="16" width="16" height="13" fill="#DDA893" />
  <rect x="28" y="36" width="44" height="13" fill="#C9705C" />
  <rect x="14" y="56" width="72" height="13" fill="#B23A26" />
  <rect x="0" y="76" width="100" height="13" fill="#7A2618" />
</svg>
