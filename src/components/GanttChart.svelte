<script>
  import { computeLayout, FONT } from '../lib/layout.js'
  import { shiftIso, isoToDays, daysToIso } from '../lib/dates.js'
  import { store } from '../lib/stores.svelte.js'

  let svgEl = $state(null)
  const L = $derived(computeLayout(store.rows, { scale: store.scale }))
  const D = $derived(L.dims)

  export function getSvg() {
    return svgEl
  }
  export function getLayout() {
    return computeLayout(store.rows, { scale: store.scale })
  }

  // ---- drag handling ----------------------------------------------------
  let drag = null

  function beginDrag(e, index, mode) {
    e.preventDefault()
    const r = store.rows[index]
    drag = {
      index,
      mode,
      x0: e.clientX,
      orig: {
        tentativeStart: r.tentativeStart,
        start: r.start,
        end: r.end,
        tentativeEnd: r.tentativeEnd,
        milestone: r.milestone,
      },
    }
    window.addEventListener('pointermove', onDrag)
    window.addEventListener('pointerup', endDrag)
  }

  function onDrag(e) {
    if (!drag) return
    const delta = Math.round((e.clientX - drag.x0) / L.ts.dayWidth)
    const r = store.rows[drag.index]
    const o = drag.orig
    const clampMin = (iso, minIso) =>
      minIso && iso && isoToDays(iso) < isoToDays(minIso) ? minIso : iso
    const clampMax = (iso, maxIso) =>
      maxIso && iso && isoToDays(iso) > isoToDays(maxIso) ? maxIso : iso

    switch (drag.mode) {
      case 'move':
        r.tentativeStart = shiftIso(o.tentativeStart, delta)
        r.start = shiftIso(o.start, delta)
        r.end = shiftIso(o.end, delta)
        r.tentativeEnd = shiftIso(o.tentativeEnd, delta)
        r.milestone = shiftIso(o.milestone, delta)
        break
      case 'resize-start':
        r.start = clampMax(shiftIso(o.start, delta), o.end)
        break
      case 'resize-end':
        r.end = clampMin(shiftIso(o.end, delta), o.start)
        break
      case 'tent-start':
        r.tentativeStart = clampMax(shiftIso(o.tentativeStart, delta), o.start ?? o.tentativeEnd)
        break
      case 'tent-end':
        r.tentativeEnd = clampMin(shiftIso(o.tentativeEnd, delta), o.end ?? o.tentativeStart)
        break
      case 'milestone':
        r.milestone = shiftIso(o.milestone, delta)
        break
    }
  }

  function endDrag() {
    drag = null
    window.removeEventListener('pointermove', onDrag)
    window.removeEventListener('pointerup', endDrag)
  }

  const EDGE = 7 // px hit zone for resize handles
</script>

<div class="overflow-x-auto">
  <svg
    bind:this={svgEl}
    xmlns="http://www.w3.org/2000/svg"
    width={D.totalWidth}
    height={D.totalHeight}
    viewBox="0 0 {D.totalWidth} {D.totalHeight}"
    font-family={FONT}
    style="user-select: none;"
  >
    <rect width={D.totalWidth} height={D.totalHeight} fill="white" />

    <!-- header labels -->
    <text x={D.activityColX} y={D.headerTop + 26} font-size="19" font-weight="700" fill="#2B2320">Activity</text>
    {#each L.ts.months as m}
      {#if m.showLabel}
        <text x={D.chartX + m.labelX} y={D.headerTop + 26} font-size="19" font-weight="700" fill="#2B2320">{m.label}</text>
      {/if}
    {/each}

    <!-- chart frame -->
    <rect x={D.chartX} y={D.bodyTop} width={D.chartW} height={D.bodyBottom - D.bodyTop} fill="none" stroke="#2B2320" stroke-width="1" />

    <!-- dotted gridlines: weeks in month mode, days in week mode -->
    {#each L.dottedX as gx}
      <line x1={D.chartX + gx} y1={D.bodyTop} x2={D.chartX + gx} y2={D.bodyBottom} stroke="#9A948D" stroke-width="0.7" stroke-dasharray="1.5 3" />
    {/each}

    <!-- week mode: solid week boundaries + W## labels -->
    {#each L.solidWeeks as w}
      <line x1={D.chartX + w.x} y1={D.headerTop + 32} x2={D.chartX + w.x} y2={D.bodyBottom} stroke="#9A948D" stroke-width="0.8" />
    {/each}
    {#each L.weekLabels as w}
      <text x={D.chartX + w.x + 5} y={D.headerTop + 48} font-size="12" fill="#6B6058">{w.label}</text>
    {/each}

    <!-- month boundaries (solid) -->
    {#each L.ts.months as m}
      {#if m.boundaryX != null}
        <line x1={D.chartX + m.boundaryX} y1={D.headerTop + 10} x2={D.chartX + m.boundaryX} y2={D.bodyBottom} stroke="#2B2320" stroke-width="1" />
      {/if}
    {/each}

    <!-- group breaker lines + labels -->
    {#each L.groups as g, gi}
      {#if gi > 0}
        <line x1={D.groupColX} y1={g.yTop} x2={D.totalWidth - 16} y2={g.yTop} stroke="#2B2320" stroke-width="1" />
      {/if}
      {#if L.hasGroups}
        <text x={D.groupColX + D.groupColW - 16} y={g.labelY} text-anchor="end" dominant-baseline="middle" font-size="15" font-weight="700" fill="#2B2320">{g.name}</text>
      {/if}
    {/each}

    <!-- rows -->
    {#each L.items as it (it.row.id)}
      <text x={D.activityColX} y={it.labelY} dominant-baseline="middle" font-size="14" fill="#2B2320">{it.row.activity}</text>

      <!-- tentative prefix / suffix (dashed outline) -->
      {#each [it.preTentative, it.postTentative] as seg, si}
        {#if seg && seg.x1 - seg.x0 > 0}
          <g>
            <rect x={D.chartX + seg.x0} y={it.barY} width={seg.x1 - seg.x0} height={it.barH} fill="white" fill-opacity="0.01" stroke="#6B6058" stroke-width="1.3" stroke-dasharray="5 4" />
            <rect
              x={D.chartX + (si === 0 ? seg.x0 - EDGE : seg.x1 - EDGE)} y={it.barY - 3} width={EDGE * 2} height={it.barH + 6}
              fill="transparent" style="cursor: ew-resize;"
              onpointerdown={(e) => beginDrag(e, it.index, si === 0 ? 'tent-start' : 'tent-end')}
            />
          </g>
        {/if}
      {/each}

      <!-- solid bar -->
      {#if it.solid && it.solid.x1 - it.solid.x0 > 0}
        <rect x={D.chartX + it.solid.x0} y={it.barY} width={it.solid.x1 - it.solid.x0} height={it.barH} fill="#2B2320" />
        <rect
          x={D.chartX + it.solid.x0 + EDGE} y={it.barY - 3} width={Math.max(it.solid.x1 - it.solid.x0 - EDGE * 2, 2)} height={it.barH + 6}
          fill="transparent" style="cursor: grab;"
          onpointerdown={(e) => beginDrag(e, it.index, 'move')}
        />
        <rect x={D.chartX + it.solid.x0 - EDGE / 2} y={it.barY - 3} width={EDGE * 1.5} height={it.barH + 6} fill="transparent" style="cursor: ew-resize;" onpointerdown={(e) => beginDrag(e, it.index, 'resize-start')} />
        <rect x={D.chartX + it.solid.x1 - EDGE} y={it.barY - 3} width={EDGE * 1.5} height={it.barH + 6} fill="transparent" style="cursor: ew-resize;" onpointerdown={(e) => beginDrag(e, it.index, 'resize-end')} />
      {/if}

      <!-- milestone -->
      {#if it.milestoneX != null}
        <polygon
          points="{D.chartX + it.milestoneX - 7},{it.cy + 6} {D.chartX + it.milestoneX + 7},{it.cy + 6} {D.chartX + it.milestoneX},{it.cy - 6}"
          fill="#2B2320" style="cursor: grab;"
          onpointerdown={(e) => beginDrag(e, it.index, 'milestone')}
        />
        {#if it.milestoneLabelLeft}
          <text x={D.chartX + it.milestoneX - 11} y={it.cy} text-anchor="end" dominant-baseline="middle" font-size="11" fill="#6B6058">{it.milestoneLabel}</text>
        {:else}
          <text x={D.chartX + it.milestoneX + 11} y={it.cy} dominant-baseline="middle" font-size="11" fill="#6B6058">{it.milestoneLabel}</text>
        {/if}
      {/if}

      <!-- responsible -->
      {#if it.row.responsible && it.rightEdgeX != null}
        <text x={D.chartX + it.rightEdgeX + (it.milestoneX != null ? 78 : 8)} y={it.cy} dominant-baseline="middle" font-size="11" fill="#9A948D">{it.row.responsible}</text>
      {/if}
    {/each}

    <!-- dependency arrows -->
    {#each L.arrows as a}
      <polyline
        points={a.pts.map(([x, y]) => `${D.chartX + x},${y}`).join(' ')}
        fill="none" stroke="#6B6058" stroke-width="1.3" stroke-linejoin="round"
      />
      <polygon
        points="{D.chartX + a.headX - 7},{a.headY - 4.5} {D.chartX + a.headX - 7},{a.headY + 4.5} {D.chartX + a.headX},{a.headY}"
        fill="#6B6058"
      />
    {/each}

    <!-- today marker -->
    {#if L.todayX != null}
      <line x1={D.chartX + L.todayX} y1={D.headerTop + 10} x2={D.chartX + L.todayX} y2={D.bodyBottom + 6} stroke="#2B2320" stroke-width="1.6" stroke-dasharray="7 5" />
      <polygon points="{D.chartX + L.todayX - 8},{D.bodyBottom + 24} {D.chartX + L.todayX + 8},{D.bodyBottom + 24} {D.chartX + L.todayX},{D.bodyBottom + 10}" fill="#2B2320" />
      <text x={D.chartX + L.todayX} y={D.bodyBottom + 42} text-anchor="middle" font-size="14" fill="#2B2320">{L.todayLabel}</text>
    {/if}
  </svg>
</div>
