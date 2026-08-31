<script>
  import { auth, signIn, signOut } from '../lib/auth.svelte.js'
  import { store, loadRows } from '../lib/stores.svelte.js'
  import Button from './ui/Button.svelte'

  let open = $state(false)
  const name = $derived(auth.user?.user_metadata?.full_name || auth.user?.email)
  const picture = $derived(auth.user?.user_metadata?.avatar_url)

  async function handleSignOut() {
    await signOut()
    // Back to the start page — same rules as clicking the logo: real
    // navigation from a shared view so the visitor's autosave survives
    if (store.readonly) {
      location.href = '/'
      return
    }
    loadRows([], null)
    history.replaceState(null, '', '/')
  }
</script>

<svelte:window onclick={() => (open = false)} />

{#if auth.user}
  <div class="relative">
    <button
      class="flex h-8 w-8 items-center justify-center overflow-hidden border border-gt-line bg-gt-paper text-sm font-medium text-gt-ink transition-colors duration-[120ms] ease-out hover:border-gt-ink"
      title={name}
      onclick={(e) => { e.stopPropagation(); open = !open }}
    >
      {#if picture}
        <img src={picture} alt="" class="h-full w-full object-cover" />
      {:else}
        {(name || '?')[0].toUpperCase()}
      {/if}
    </button>
    {#if open}
      <div class="absolute right-0 top-10 z-20 w-44 border border-gt-ink bg-gt-paper p-1">
        <p class="truncate px-2 py-1.5 text-[11px] text-gt-ink-muted">{name}</p>
        <button class="block w-full px-2 py-1.5 text-left text-[13px] hover:bg-gt-line-soft" onclick={handleSignOut}>Sign out</button>
      </div>
    {/if}
  </div>
{:else if auth.ready}
  <div class="relative">
    <Button variant="ghost" size="sm" onclick={(e) => { e.stopPropagation(); open = !open }}>Sign in</Button>
    {#if open}
      <div class="absolute right-0 top-10 z-20 w-48 border border-gt-ink bg-gt-paper p-1">
        <button class="w-full px-2 py-1.5 text-left text-[13px] hover:bg-gt-line-soft" onclick={() => signIn('google')}>Continue with Google</button>
        <button class="w-full px-2 py-1.5 text-left text-[13px] hover:bg-gt-line-soft" onclick={() => signIn('github')}>Continue with GitHub</button>
      </div>
    {/if}
  </div>
{/if}
