<script>
  import { store, addRow, deleteRow, moveRow } from '../lib/stores.svelte.js'
  import Button from './ui/Button.svelte'

  let rootEl

  // Spreadsheet-style navigation: Enter / Shift+Enter and ↑ / ↓ move focus to
  // the same column in the next/previous row. Date inputs keep plain arrows
  // for stepping the date — hold Alt to move rows there instead.
  function onCellKey(e, row, col) {
    const isDate = e.target.type === 'date'
    let dir = 0
    if (e.key === 'Enter') dir = e.shiftKey ? -1 : 1
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && (!isDate || e.altKey)) {
      dir = e.key === 'ArrowDown' ? 1 : -1
    }
    if (!dir) return
    const next = rootEl?.querySelector(`input[data-cell="${row + dir}:${col}"]`)
    if (!next) return
    e.preventDefault()
    next.focus()
    if (next.type === 'text') next.select()
  }

  const cols = [
    { key: 'group', label: 'Group', type: 'text', w: 'w-32' },
    { key: 'activity', label: 'Activity', type: 'text', w: 'min-w-64' },
    { key: 'tentativeStart', label: 'Tent. start', type: 'date', w: 'w-36' },
    { key: 'start', label: 'Start', type: 'date', w: 'w-36' },
    { key: 'end', label: 'End', type: 'date', w: 'w-36' },
    { key: 'tentativeEnd', label: 'Tent. end', type: 'date', w: 'w-36' },
    { key: 'milestone', label: 'Milestone', type: 'date', w: 'w-36' },
    { key: 'responsible', label: 'Responsible', type: 'text', w: 'w-32' },
    { key: 'dependsOn', label: 'Depends on', type: 'text', w: 'w-40' },
  ]
</script>

<div bind:this={rootEl} class="overflow-x-auto rounded-xl border border-gt-line bg-gt-paper">
  <table class="w-full caption-bottom text-sm">
    <thead>
      <tr class="border-b border-gt-line bg-gt-rail">
        {#each cols as c}
          <th class="h-10 px-3 text-left align-middle text-[10px] font-extrabold uppercase tracking-[0.1em] text-gt-ink-faint {c.w}">{c.label}</th>
        {/each}
        <th class="h-10 px-3 text-right align-middle text-[10px] font-extrabold uppercase tracking-[0.1em] text-gt-ink-faint">Row</th>
      </tr>
    </thead>
    <tbody>
      {#each store.rows as row, i (row.id)}
        <tr class="border-b border-gt-line-soft transition-colors duration-[120ms] hover:bg-gt-rail">
          {#each cols as c, ci}
            <td class="px-1 py-1 align-middle">
              {#if c.type === 'date'}
                <input
                  type="date"
                  data-cell="{i}:{ci}"
                  class="h-8 w-full rounded-[6px] border border-input bg-transparent px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={row[c.key] ?? ''}
                  onchange={(e) => (row[c.key] = e.target.value || null)}
                  onkeydown={(e) => onCellKey(e, i, ci)}
                />
              {:else}
                <input
                  type="text"
                  data-cell="{i}:{ci}"
                  class="h-8 w-full rounded-[6px] border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={row[c.key]}
                  oninput={(e) => (row[c.key] = e.target.value)}
                  onkeydown={(e) => onCellKey(e, i, ci)}
                />
              {/if}
            </td>
          {/each}
          <td class="whitespace-nowrap px-2 py-1 text-right align-middle">
            <Button variant="ghost" size="icon" title="Move up" onclick={() => moveRow(i, -1)}>↑</Button>
            <Button variant="ghost" size="icon" title="Move down" onclick={() => moveRow(i, 1)}>↓</Button>
            <Button variant="ghost" size="icon" title="Insert row below" onclick={() => addRow(i)}>＋</Button>
            <Button variant="ghost" size="icon" class="text-gt-brick-500" title="Delete row" onclick={() => deleteRow(i)}>✕</Button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
