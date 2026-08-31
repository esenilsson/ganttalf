<script>
  // "Your charts" on the start page: visible whenever you're signed in with
  // no chart open — including right after the OAuth redirect and when the
  // logo brings you back here.
  import { auth } from '../lib/auth.svelte.js'
  import * as api from '../lib/api.js'
  import { loadChart } from '../lib/stores.svelte.js'

  let charts = $state(null) // null = loading (or signed out)
  let renamingId = $state(null)
  let renameValue = $state('')
  let error = $state(false)

  $effect(() => {
    if (!auth.user) {
      charts = null
      return
    }
    api
      .listCharts()
      .then((cs) => (charts = cs))
      .catch(() => {
        charts = []
        error = true
      })
  })

  const fmtDate = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })

  async function openChart(id) {
    try {
      const c = await api.getChart(id)
      loadChart(c.id, c.name, c.data, c.share_token)
      history.replaceState(null, '', `/c/${c.id}`)
    } catch {
      error = true
    }
  }

  async function removeChart(c) {
    if (!confirm(`Delete "${c.name}"?`)) return
    try {
      await api.deleteChart(c.id)
      charts = charts.filter((x) => x.id !== c.id)
    } catch {
      error = true
    }
  }

  async function commitRename(c) {
    const name = renameValue.trim()
    renamingId = null
    if (!name || name === c.name) return
    try {
      await api.updateChart(c.id, { name })
      c.name = name
    } catch {
      error = true
    }
  }
</script>

{#if auth.user && (charts?.length || error)}
  <section class="w-full max-w-2xl rounded-xl bg-gt-paper p-5 shadow-sm">
    <h3 class="font-display text-[22px] font-medium leading-tight">Your charts</h3>
    {#if error}
      <p class="mt-2 text-[13px] text-gt-brick-500">Couldn't load your charts — try reloading the page.</p>
    {:else}
      <ul class="mt-2 flex max-h-72 flex-col overflow-y-auto">
        {#each charts as c (c.id)}
          <li class="group flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent">
            {#if renamingId === c.id}
              <input
                class="h-7 flex-1 rounded border border-input bg-card px-2 text-sm"
                bind:value={renameValue}
                onkeydown={(e) => { if (e.key === 'Enter') commitRename(c); if (e.key === 'Escape') renamingId = null }}
                onblur={() => commitRename(c)}
              />
            {:else}
              <button class="flex-1 truncate text-left" title={c.name} onclick={() => openChart(c.id)}>
                {c.name}
              </button>
              <span class="text-[11px] text-gt-ink-faint">{fmtDate.format(new Date(c.updated_at))}</span>
              <button class="hidden px-1 text-gt-ink-muted hover:text-gt-ink group-hover:block" title="Rename" onclick={() => { renamingId = c.id; renameValue = c.name }}>✎</button>
              <button class="hidden px-1 text-gt-ink-muted hover:text-gt-brick-500 group-hover:block" title="Delete" onclick={() => removeChart(c)}>✕</button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}
