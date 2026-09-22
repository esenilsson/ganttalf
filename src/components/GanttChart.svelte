<script>
  import { computeLayout, FONT } from '../lib/layout.js'
  import { shiftIso, isoToDays, daysToIso } from '../lib/dates.js'
  import { store, reorderRow } from '../lib/stores.svelte.js'

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

  // ---- inline text editing (activity / group / responsible) ---------------
  // editing is { kind, index }: for 'activity'/'responsible' index is a row
  // index; for 'group' it's an index into L.groups (one label spans a run of
  // rows, so committing renames every row in that run).
  let editing = $state(null)
  let editText = $state('')
  let editCancelled = false

  function currentValue(kind, index) {
    if (kind === 'group') return store.rows[L.groups[index].startIdx].group ?? ''
    return store.rows[index][kind] ?? ''
  }

  function beginEdit(kind, index) {
    editing = { kind, index }
    editText = currentValue(kind, index)
    editCancelled = false
  }

  function finishEdit() {
    if (!editing) return
    if (!editCancelled) {
      const { kind, index } = editing
      if (kind === 'group') {
        const g = L.groups[index]
        for (let i = g.startIdx; i <= g.endIdx; i++) store.rows[i].group = editText
      } else {
        store.rows[index][kind] = editText
      }
    }
    editing = null
    editCancelled = false
  }

  function onEditKey(e) {
    if (e.key === 'Enter') e.currentTarget.blur()
    else if (e.key === 'Escape') {
      editCancelled = true
      e.currentTarget.blur()
    }
  }

  function focusAndSelect(el) {
    el.focus()
    el.select()
  }

  function inputStyle(size, weight = 400) {
    return `width: 100%; height: 22px; box-sizing: border-box; font-family: ${FONT}; font-size: ${size}px; font-weight: ${weight}; color: #2B2320; background: #fff; border: 1px solid #9A948D; border-radius: 5px; padding: 0 6px; outline: none; box-shadow: 0 0 0 2px rgba(43, 35, 32, 0.25);`
  }

  // ---- vertical drag to reorder rows (and re-home them into a group) -------
  // Dragging an activity label past a small threshold picks the row up; the
  // slot the pointer hovers becomes the drop target, and the row adopts the
  // group it lands among. The threshold keeps double-click-to-rename working.
  let rowDrag = $state(null) // { index, startClientY, slot, armed } | null
  const ROW_DRAG_ARM = 4 // px of travel before a press becomes a drag

  function beginRowDrag(e, index) {
    if (e.button && e.button !== 0) return
    rowDrag = { index, startClientY: e.clientY, slot: index, armed: false }
    window.addEventListener('pointermove', onRowDrag)
    window.addEventListener('pointerup', endRowDrag)
    window.addEventListener('keydown', onRowDragKey)
  }

  function clientYToSlot(clientY) {
    const rect = svgEl.getBoundingClientRect()
    const svgY = (clientY - rect.top) * (D.totalHeight / rect.height)
    const slot = Math.round((svgY - D.bodyTop) / D.rowH)
    return Math.max(0, Math.min(store.rows.length, slot))
  }

  function onRowDrag(e) {
    if (!rowDrag) return
    if (!rowDrag.armed) {
      if (Math.abs(e.clientY - rowDrag.startClientY) < ROW_DRAG_ARM) return
      rowDrag.armed = true
    }
    rowDrag.slot = clientYToSlot(e.clientY)
  }

  function onRowDragKey(e) {
    if (e.key === 'Escape') { rowDrag = null; stopRowDrag() }
  }

  function stopRowDrag() {
    window.removeEventListener('pointermove', onRowDrag)
    window.removeEventListener('pointerup', endRowDrag)
    window.removeEventListener('keydown', onRowDragKey)
  }

  function endRowDrag() {
    const rd = rowDrag
    stopRowDrag()
    rowDrag = null
    if (!rd || !rd.armed) return
    const from = rd.index
    const to = rd.slot > from ? rd.slot - 1 : rd.slot
    if (to === from) return
    // Adopt the group of the drop's new neighbours (prefer the row above).
    const reduced = store.rows.filter((_, i) => i !== from)
    const group = reduced[to - 1]?.group ?? reduced[to]?.group ?? ''
    reorderRow(from, to, group)
  }

  function endDrag() {
    drag = null
    window.removeEventListener('pointermove', onDrag)
    window.removeEventListener('pointerup', endDrag)
  }

  const EDGE = 7 // px hit zone for resize handles
</script>

<div class="overflow-x-auto p-2 sm:p-4">
  <svg
    bind:this={svgEl}
    xmlns="http://www.w3.org/2000/svg"
    width={D.totalWidth}
    height={D.totalHeight}
    viewBox="0 0 {D.totalWidth} {D.totalHeight}"
    font-family={FONT}
    style="user-select: none;{rowDrag?.armed ? ' cursor: grabbing;' : ''}"
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
        {#if editing?.kind === 'group' && editing.index === gi}
          {@render editBox(D.groupColX - 4, g.labelY - 11, D.groupColW, inputStyle(15, 700))}
        {:else}
          <text x={D.groupColX + D.groupColW - 16} y={g.labelY} text-anchor="end" dominant-baseline="middle" font-size="15" font-weight="700" fill="#2B2320" style="cursor: text;" ondblclick={() => beginEdit('group', gi)}>{g.name}</text>
        {/if}
      {/if}
    {/each}

    <!-- inline edit input, shared by activity / group / responsible -->
    {#snippet editBox(x, y, w, style)}
      <foreignObject {x} {y} width={w} height={22}>
        <div xmlns="http://www.w3.org/1999/xhtml" style="height: 100%; display: flex; align-items: center;">
          <input use:focusAndSelect bind:value={editText} onblur={finishEdit} onkeydown={onEditKey} {style} />
        </div>
      </foreignObject>
    {/snippet}

    <!-- rows -->
    {#each L.items as it (it.row.id)}
      {#if editing?.kind === 'activity' && editing.index === it.index}
        {@render editBox(D.activityColX - 7, it.labelY - 11, D.activityColW + 14, inputStyle(14))}
      {:else}
        <text x={D.activityColX} y={it.labelY} dominant-baseline="middle" font-size="14" fill="#2B2320" style="cursor: grab;" onpointerdown={(e) => beginRowDrag(e, it.index)} ondblclick={() => beginEdit('activity', it.index)}>{it.row.activity}</text>
      {/if}

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
      {#if it.rightEdgeX != null}
        {@const rx = D.chartX + it.rightEdgeX + (it.milestoneX != null ? 78 : 8)}
        {#if editing?.kind === 'responsible' && editing.index === it.index}
          {@render editBox(rx - 4, it.cy - 11, 140, inputStyle(11))}
        {:else if it.row.responsible}
          <text x={rx} y={it.cy} dominant-baseline="middle" font-size="11" fill="#9A948D" style="cursor: text;" ondblclick={() => beginEdit('responsible', it.index)}>{it.row.responsible}</text>
        {/if}
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

    <!-- row reorder feedback: highlight the picked-up row + show the drop line -->
    {#if rowDrag?.armed}
      <rect x={D.groupColX} y={D.bodyTop + rowDrag.index * D.rowH} width={D.totalWidth - D.groupColX - 16} height={D.rowH} fill="#2B2320" opacity="0.06" />
      <line x1={D.groupColX} y1={D.bodyTop + rowDrag.slot * D.rowH} x2={D.totalWidth - 16} y2={D.bodyTop + rowDrag.slot * D.rowH} stroke="#2B2320" stroke-width="2.5" stroke-linecap="round" />
    {/if}
  </svg>
</div>
