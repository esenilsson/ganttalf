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

<div class="overflow-x-auto rounded-lg border border-border">
  <table class="w-full caption-bottom text-sm">
    <thead>
      <tr class="border-b border-border bg-muted/50">
        {#each cols as c}
          <th class="h-10 px-2 text-left align-middle font-medium text-muted-foreground {c.w}">{c.label}</th>
        {/each}
        <th class="h-10 px-2 text-right font-medium text-muted-foreground">Row</th>
      </tr>
    </thead>
    <tbody>
      {#each store.rows as row, i (row.id)}
        <tr class="border-b border-border transition-colors hover:bg-muted/30">
          {#each cols as c}
            <td class="px-1 py-1 align-middle">
              {#if c.type === 'date'}
                <input
                  type="date"
                  class="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={row[c.key] ?? ''}
                  onchange={(e) => (row[c.key] = e.target.value || null)}
                />
              {:else}
                <input
                  type="text"
                  class="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
            <Button variant="ghost" size="icon" class="text-destructive" title="Delete row" onclick={() => deleteRow(i)}>✕</Button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
