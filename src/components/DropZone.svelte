<script>
  import { parseWorkbook } from '../lib/excel.js'
  import { loadRows } from '../lib/stores.svelte.js'
  import { sampleRows } from '../lib/sample.js'
  import Button from './ui/Button.svelte'

  let { compact = false } = $props()
  let dragOver = $state(false)
  let error = $state(null)
  let fileInput

  async function handleFiles(files) {
    const file = files?.[0]
    if (!file) return
    error = null
    try {
      loadRows(await parseWorkbook(file), file.name)
    } catch (e) {
      error = e.message
    }
  }
</script>

<input
  bind:this={fileInput}
  type="file"
  accept=".xlsx,.xls,.csv"
  class="hidden"
  onchange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
/>

{#if compact}
  <Button variant="outline" onclick={() => fileInput.click()}>Import</Button>
{:else}
  <div
    role="button"
    tabindex="0"
    class="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-16 text-center transition-colors {dragOver ? 'border-ring bg-accent' : 'border-border'}"
    ondragover={(e) => { e.preventDefault(); dragOver = true }}
    ondragleave={() => (dragOver = false)}
    ondrop={(e) => { e.preventDefault(); dragOver = false; handleFiles(e.dataTransfer.files) }}
    onclick={() => fileInput.click()}
    onkeydown={(e) => e.key === 'Enter' && fileInput.click()}
  >
    <div class="text-5xl">🧙</div>
    <div class="text-lg font-medium">Drop an Excel file here, or click to browse</div>
    <p class="max-w-lg text-sm text-muted-foreground">
      Columns: <b>Activity</b> (required), Group, Tentative Start, Start, End, Tentative End,
      Milestone, Responsible, Depends On. A row with only a Milestone date renders as a ▲ marker;
      Depends On (an activity name or row number) draws a dependency arrow.
    </p>
    <div class="flex gap-3" role="none" onclick={(e) => e.stopPropagation()}>
      <Button variant="secondary" onclick={() => loadRows(sampleRows(), 'sample')}>Load sample</Button>
      <Button variant="outline" onclick={() => { const a = document.createElement('a'); a.href = 'template.xlsx'; a.download = 'ganttalf-template.xlsx'; a.click() }}>Download template</Button>
    </div>
    {#if error}
      <p class="text-sm text-destructive">{error}</p>
    {/if}
  </div>
{/if}
