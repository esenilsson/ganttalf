<script>
  import { store, addRow, deleteRow, moveRow } from '../lib/stores.svelte.js'
  import Button from './ui/Button.svelte'

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

<div class="overflow-x-auto border border-gt-line bg-gt-paper">
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
          {#each cols as c}
            <td class="px-1 py-1 align-middle">
              {#if c.type === 'date'}
                <input
                  type="date"
                  class="h-8 w-full border border-transparent bg-transparent px-2 text-[13px] tabular-nums transition-colors duration-[120ms] hover:border-gt-line"
                  value={row[c.key] ?? ''}
                  onchange={(e) => (row[c.key] = e.target.value || null)}
                />
              {:else}
                <input
                  type="text"
                  class="h-8 w-full border border-transparent bg-transparent px-2 text-[13px] transition-colors duration-[120ms] hover:border-gt-line"
                  value={row[c.key]}
                  oninput={(e) => (row[c.key] = e.target.value)}
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
