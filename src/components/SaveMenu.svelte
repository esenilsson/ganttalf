<script>
  import { store, serializeChart, loadChart } from '../lib/stores.svelte.js'
  import * as api from '../lib/api.js'
  import { auth, signIn } from '../lib/auth.svelte.js'

  let saveState = $state(null) // null | 'saved' | 'copied' | 'error'
  let open = $state(false)
  let charts = $state(null) // null = loading
  let renamingId = $state(null)
  let renameValue = $state('')

  function flash(state) {
    saveState = state
    setTimeout(() => (saveState = null), 2500)
  }

  async function save(asNew = false) {
    if (!auth.user) {
      signIn() // autosave already captured the rows; boot restores them after the redirect
      return
    }
    const name = store.chartName?.trim() || 'Untitled'
    const data = serializeChart()
    try {
      if (store.chartId && !asNew) {
        try {
          await api.updateChart(store.chartId, { name, data })
          flash('saved')
          return
        } catch (err) {
          // 403 = someone else's chart, 404 = deleted meanwhile → save a copy instead
          if (err.status !== 403 && err.status !== 404) throw err
        }
      }
      const { id } = await api.createChart(name, data)
      const isCopy = !!store.chartId && !asNew
      store.chartId = id
      store.chartName = name
      history.replaceState(null, '', `/c/${id}`)
      flash(isCopy ? 'copied' : 'saved')
    } catch {
      flash('error')
    }
  }

  async function toggleList() {
    open = !open
    if (open) {
      charts = null
      charts = await api.listCharts().catch(() => [])
    }
  }

  async function openChart(id) {
    open = false
    try {
      const c = await api.getChart(id)
      loadChart(c.id, c.name, c.data, c.share_token)
      history.replaceState(null, '', `/c/${c.id}`)
    } catch {
      flash('error')
    }
  }

  async function removeChart(c) {
    if (!confirm(`Delete "${c.name}"?`)) return
    try {
      await api.deleteChart(c.id)
      charts = charts.filter((x) => x.id !== c.id)
      if (store.chartId === c.id) {
        store.chartId = null
        history.replaceState(null, '', '/')
      }
    } catch {
      flash('error')
    }
  }

  function onKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      save()
    }
  }

  async function commitRename(c) {
    const name = renameValue.trim()
    renamingId = null
    if (!name || name === c.name) return
    try {
      await api.updateChart(c.id, { name })
      c.name = name
      if (store.chartId === c.id) store.chartName = name
    } catch {
      flash('error')
    }
  }
</script>

<svelte:window onclick={() => (open = false)} onkeydown={onKeydown} />

<div class="flex items-center">
  <input
    class="h-9 w-44 rounded-l-md border border-input bg-card px-3 text-sm shadow-sm transition-colors placeholder:text-gt-ink-faint focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    placeholder="Untitled"
    bind:value={store.chartName}
    onkeydown={(e) => e.key === 'Enter' && save()}
  />
  <button
    class="h-9 whitespace-nowrap border-y border-r border-input bg-card px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground {saveState === 'error' ? 'text-destructive' : ''}"
    onclick={() => save()}
  >
    {saveState === 'saved' ? 'Saved ✓' : saveState === 'copied' ? 'Saved a copy ✓' : saveState === 'error' ? 'Save failed' : 'Save'}
  </button>
  <div class="relative">
    <button
      class="h-9 rounded-r-md border-y border-r border-input bg-card px-2 text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
      aria-label="Saved charts"
      onclick={(e) => { e.stopPropagation(); toggleList() }}
    >▾</button>
    {#if open}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div class="absolute left-0 top-10 z-20 w-72 rounded-md border border-border bg-card p-1 shadow-md" onclick={(e) => e.stopPropagation()}>
        {#if charts === null}
          <p class="px-2 py-1.5 text-sm text-muted-foreground">Loading…</p>
        {:else if charts.length === 0}
          <p class="px-2 py-1.5 text-sm text-muted-foreground">No saved charts yet</p>
        {:else}
          {#each charts as c (c.id)}
            <div class="group flex items-center gap-1 rounded px-2 py-1.5 text-sm hover:bg-accent">
              {#if renamingId === c.id}
                <input
                  class="h-6 flex-1 rounded border border-input bg-card px-1 text-sm"
                  bind:value={renameValue}
                  onkeydown={(e) => { if (e.key === 'Enter') commitRename(c); if (e.key === 'Escape') renamingId = null }}
                  onblur={() => commitRename(c)}
                />
              {:else}
                <button class="flex-1 truncate text-left" title={c.name} onclick={() => openChart(c.id)}>
                  {c.name}
                </button>
                <button class="hidden px-1 text-gt-ink-muted hover:text-gt-ink group-hover:block" title="Rename" onclick={() => { renamingId = c.id; renameValue = c.name }}>✎</button>
                <button class="hidden px-1 text-gt-ink-muted hover:text-gt-brick-500 group-hover:block" title="Delete" onclick={() => removeChart(c)}>✕</button>
              {/if}
            </div>
          {/each}
        {/if}
        {#if store.chartId}
          <div class="mt-1 border-t border-border pt-1">
            <button class="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent" onclick={() => { open = false; save(true) }}>Save as new</button>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>
