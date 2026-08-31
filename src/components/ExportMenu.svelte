<script>
  import Button from './ui/Button.svelte'

  let { shareState, liveState, showLive, showRevoke, onsharelive, onstopsharing, onshare, onexcel, onpng, onsvg, onpptx } = $props()
  let open = $state(false)

  const items = [
    { label: 'Excel (.xlsx)', action: () => onexcel() },
    { label: 'PNG', action: () => onpng() },
    { label: 'SVG', action: () => onsvg() },
    { label: 'PowerPoint (.pptx)', action: () => onpptx() },
  ]

  function run(action) {
    open = false
    action()
  }
</script>

<svelte:window onclick={() => (open = false)} />

<div class="relative">
  <Button variant="outline" onclick={(e) => { e.stopPropagation(); open = !open }}>Export ▾</Button>
  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="absolute right-0 top-10 z-20 w-52 border border-gt-ink bg-gt-paper p-1" onclick={(e) => e.stopPropagation()}>
      <!-- share entries stay open to show the copied feedback -->
      {#if showLive}
        <button class="w-full px-2 py-1.5 text-left text-[13px] hover:bg-gt-line-soft" onclick={onsharelive}>
          {liveState === 'copied' ? 'Live link copied ✓' : liveState === 'error' ? 'Sharing failed' : 'Copy live link'}
        </button>
      {/if}
      <button class="w-full px-2 py-1.5 text-left text-[13px] hover:bg-gt-line-soft" onclick={onshare}>
        {shareState === 'copied' ? 'Snapshot copied ✓' : shareState === 'ready' ? 'Link in address bar ✓' : 'Copy snapshot link'}
      </button>
      {#if showRevoke}
        <button class="w-full px-2 py-1.5 text-left text-[13px] text-gt-ink-muted hover:bg-gt-line-soft" onclick={() => run(onstopsharing)}>
          Stop sharing
        </button>
      {/if}
      <div class="my-1 border-t border-gt-line"></div>
      {#each items as item (item.label)}
        <button class="w-full px-2 py-1.5 text-left text-[13px] hover:bg-gt-line-soft" onclick={() => run(item.action)}>
          {item.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
