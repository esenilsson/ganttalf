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
    class="flex w-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-gt-paper p-10 text-center transition-colors duration-[120ms] ease-out {dragOver ? 'border-gt-brick-500 bg-gt-line-soft' : 'border-gt-ink-faint/50'}"
    ondragover={(e) => { e.preventDefault(); dragOver = true }}
    ondragleave={() => (dragOver = false)}
    ondrop={(e) => { e.preventDefault(); dragOver = false; handleFiles(e.dataTransfer.files) }}
    onclick={() => fileInput.click()}
    onkeydown={(e) => e.key === 'Enter' && fileInput.click()}
  >
    <div class="font-display text-xl font-medium">Drop an Excel file here, or click to browse</div>
    <p class="max-w-lg text-[13px] leading-relaxed text-gt-ink-muted">
      Columns: <b>Activity</b> (required), plus optional Group, Start, End, Tentative Start/End,
      Milestone, Responsible, Depends On — or start from the template.
    </p>
    <div class="flex gap-3" role="none" onclick={(e) => e.stopPropagation()}>
      <Button variant="default" onclick={() => loadRows(sampleRows(), 'sample')}>Try the sample</Button>
      <Button variant="outline" onclick={() => { const a = document.createElement('a'); a.href = 'template.xlsx'; a.download = 'ganttalf-template.xlsx'; a.click() }}>Download template</Button>
    </div>
    {#if error}
      <p class="text-[13px] text-gt-brick-500">{error}</p>
    {/if}
  </div>
{/if}
