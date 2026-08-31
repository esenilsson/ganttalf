<script>
  import { onMount } from 'svelte'
  import { store, loadRows, loadChart, loadSharedChart, serializeChart } from './lib/stores.svelte.js'
  import { saveLocal, loadLocal, clearLocal } from './lib/autosave.js'
  import { getChart, getSharedChart, createChart, updateChart, ensureShareToken, revokeShareToken } from './lib/api.js'
  import { auth, authReady, signIn } from './lib/auth.svelte.js'
  import { encodeRows, decodeRows } from './lib/share.js'
  import { exportWorkbook } from './lib/excel.js'
  import { exportPng } from './lib/exporters/png.js'
  import { exportSvg } from './lib/exporters/svg.js'
  import { exportPptx } from './lib/exporters/pptx.js'
  import { sampleRows } from './lib/sample.js'
  import GanttChart from './components/GanttChart.svelte'
  import RowTable from './components/RowTable.svelte'
  import DropZone from './components/DropZone.svelte'
  import Landing from './components/Landing.svelte'
  import SaveMenu from './components/SaveMenu.svelte'
  import ExportMenu from './components/ExportMenu.svelte'
  import UserMenu from './components/UserMenu.svelte'
  import Button from './components/ui/Button.svelte'

  let chart = $state(null)
  let shareState = $state(null) // snapshot link: null | 'copied' | 'ready'
  let liveState = $state(null) // live link: null | 'copied' | 'error'
  let hashError = $state(false)
  let chartNotFound = $state(false)
  let sharedNotFound = $state(false)
  let booted = false
  const hasRows = $derived(store.rows.length > 0)
  const baseName = $derived((store.fileName ?? 'ganttalf').replace(/\.(xlsx|xls|csv)$/i, ''))

  // Accept a dropped .xlsx anywhere on the page
  function onWindowDrop(e) {
    e.preventDefault()
  }

  // Boot precedence: /s/<token> shared chart → /c/<id> saved chart →
  // '#g=' fragment (lib/share.js) → localStorage autosave → empty state
  onMount(async () => {
    try {
      // The OAuth redirect lands here with ?code=…; supabase-js completes the
      // PKCE exchange during authReady. Querying before that would run as anon
      // and make the user's own charts look like they don't exist.
      await authReady
      const sm = location.pathname.match(/^\/s\/([A-Za-z0-9_-]{16,})$/)
      if (sm) {
        try {
          const c = await getSharedChart(sm[1])
          loadSharedChart(c.name, c.data)
          return
        } catch {
          sharedNotFound = true
          history.replaceState(null, '', '/')
          // fall through to autosave restore
        }
      }
      const pm = location.pathname.match(/^\/c\/([A-Za-z0-9_-]+)$/)
      if (pm) {
        try {
          const c = await getChart(pm[1])
          loadChart(c.id, c.name, c.data, c.share_token)
          return
        } catch {
          chartNotFound = true
          history.replaceState(null, '', '/')
          // fall through to autosave restore
        }
      } else if (!sm) {
        const m = location.hash.match(/^#g=(.+)$/)
        if (m) {
          try {
            loadRows(await decodeRows(m[1]), 'shared')
          } catch {
            hashError = true
          }
          return
        }
      }
      const saved = loadLocal()
      if (saved) {
        loadChart(saved.chartId, saved.chartName, saved)
        store.fileName = saved.fileName
        if (saved.chartId) history.replaceState(null, '', `/c/${saved.chartId}`)
      }
    } finally {
      booted = true
    }
  })

  // Invisible autosave: any edit lands in localStorage after a 500 ms debounce
  let autosaveTimer
  $effect(() => {
    if (store.readonly) return // viewing a shared chart must never touch the visitor's own autosave
    const data = serializeChart()
    const meta = { fileName: store.fileName, chartId: store.chartId, chartName: store.chartName }
    if (!booted) return
    clearTimeout(autosaveTimer)
    if (data.rows.length === 0) {
      clearLocal() // Clear pressed — a reload shouldn't resurrect the chart
      return
    }
    autosaveTimer = setTimeout(() => saveLocal({ ...data, ...meta }), 500)
  })

  async function shareLink() {
    const enc = await encodeRows($state.snapshot(store.rows))
    // Always a root-relative URL: copied from /c/<id> or /s/<token>, the
    // pathname would win over the fragment on the recipient's boot.
    const url = location.origin + '/#g=' + enc
    try {
      await navigator.clipboard.writeText(url)
      shareState = 'copied'
    } catch {
      // clipboard blocked (e.g. plain http) — put the URL in the address bar instead
      history.replaceState(null, '', '/#g=' + enc)
      shareState = 'ready'
    }
    setTimeout(() => (shareState = null), 2500)
  }

  // Live link: saves current edits first so the link shows the chart as it looks right now
  async function shareLive() {
    if (!auth.user) {
      signIn()
      return
    }
    try {
      if (store.chartId) {
        await updateChart(store.chartId, { data: serializeChart() })
      } else {
        const name = store.chartName?.trim() || 'Untitled'
        const { id } = await createChart(name, serializeChart())
        store.chartId = id
        store.chartName = name
        history.replaceState(null, '', `/c/${id}`)
      }
      const token = await ensureShareToken(store.chartId)
      store.shareToken = token
      await navigator.clipboard.writeText(`${location.origin}/s/${token}`)
      liveState = 'copied'
    } catch {
      liveState = 'error'
    }
    setTimeout(() => (liveState = null), 2500)
  }

  async function stopSharing() {
    try {
      await revokeShareToken(store.chartId)
      store.shareToken = null
    } catch {
      liveState = 'error'
      setTimeout(() => (liveState = null), 2500)
    }
  }

  function makeCopy() {
    store.readonly = false
    store.chartId = null
    store.chartName = (store.chartName ?? 'Shared chart') + ' (copy)'
    history.replaceState(null, '', '/')
  }
</script>

<svelte:window ondragover={onWindowDrop} ondrop={onWindowDrop} />

<div class="mx-auto flex min-h-screen max-w-[1480px] flex-col gap-6 px-6 py-6">
  <header class="flex flex-wrap items-center gap-3">
    <h1 class="text-2xl font-bold tracking-tight">
      <a
        href="/"
        class="transition-opacity hover:opacity-80"
        onclick={(e) => {
          // Shared view or modified click: real navigation, so the visitor's
          // own autosave survives (in-SPA clear would wipe it)
          if (e.metaKey || e.ctrlKey || store.readonly) return
          e.preventDefault()
          loadRows([], null)
          history.replaceState(null, '', '/')
        }}
      >🧙 Ganttalf</a>
    </h1>
    {#if hasRows && !store.readonly}
      <SaveMenu />
    {/if}
    <div class="mr-auto"></div>
    {#if hasRows}
      <div class="inline-flex overflow-hidden rounded-md border border-input" role="group" aria-label="Time scale">
        <button class="h-9 px-3 text-sm font-medium transition-colors {store.scale === 'month' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}" onclick={() => (store.scale = 'month')}>Month</button>
        <button class="h-9 border-l border-input px-3 text-sm font-medium transition-colors {store.scale === 'week' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}" onclick={() => (store.scale = 'week')}>Week</button>
      </div>
      {#if !store.readonly}
        <DropZone compact />
      {/if}
      <ExportMenu
        {shareState}
        {liveState}
        showLive={!store.readonly && !!auth.user}
        showRevoke={!store.readonly && !!store.shareToken}
        onsharelive={shareLive}
        onstopsharing={stopSharing}
        onshare={shareLink}
        onexcel={() => exportWorkbook(store.rows, `${baseName}.xlsx`)}
        onpng={() => exportPng(chart.getSvg(), `${baseName}.png`)}
        onsvg={() => exportSvg(chart.getSvg(), `${baseName}.svg`)}
        onpptx={() => exportPptx(chart.getLayout(), `${baseName}.pptx`)}
      />
      {#if !store.readonly}
        <Button variant="ghost" onclick={() => { loadRows([], null); history.replaceState(null, '', '/') }}>Clear</Button>
      {/if}
    {/if}
    <a
      href="https://github.com/esenilsson/ganttalf"
      target="_blank"
      rel="noopener"
      title="View on GitHub"
      aria-label="View on GitHub"
      class="inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <svg viewBox="0 0 16 16" class="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
    </a>
    <UserMenu />
  </header>

  {#if hasRows}
    {#if store.readonly}
      <div class="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-4 py-2.5">
        <p class="text-sm text-muted-foreground">Viewing a shared chart — read-only. It always shows the owner's latest saved version.</p>
        <Button variant="outline" size="sm" onclick={makeCopy}>Make a copy</Button>
      </div>
    {/if}
    <section class="rounded-xl border border-border bg-card shadow-sm" class:pointer-events-none={store.readonly}>
      <GanttChart bind:this={chart} />
    </section>
    {#if !store.readonly}
      <section class="flex flex-col gap-2">
        <h2 class="text-sm font-medium text-muted-foreground">
          Activities — edit here or drag bars/edges/milestones directly on the chart
        </h2>
        <RowTable />
      </section>
      <footer class="pb-4 text-xs text-muted-foreground">
        PowerPoint tips: <b>Export → PowerPoint</b> gives a .pptx where every bar and label is an
        editable native shape. <b>SVG</b> pastes crisply into slides (Insert → Pictures), and
        right-click → “Convert to Shape” makes it editable too. Keep the Excel file as the source of
        truth: re-import → adjust → re-export.
      </footer>
    {/if}
  {:else}
    {#if hashError}
      <p class="text-sm text-destructive">Couldn't read the chart data in this link — it may be truncated or from an incompatible version.</p>
    {/if}
    {#if chartNotFound}
      <p class="text-sm text-destructive">That saved chart doesn't exist anymore — it may have been deleted.</p>
    {/if}
    {#if sharedNotFound}
      <p class="text-sm text-destructive">This share link is no longer valid — sharing may have been turned off by the owner.</p>
    {/if}
    <Landing />
  {/if}
</div>
